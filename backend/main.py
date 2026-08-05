import os
import io
import base64
import html as html_lib
import json
import logging
import re
import secrets
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import httpx
from fastapi import Depends, FastAPI, Form, HTTPException, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pypdf
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

import auth
import db
from auth import get_current_user

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lexagent")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
# Guncel, uretime uygun model adi (Temmuz 2026 itibariyla). Eger ileride
# bu model de kullanimdan kaldirilirsa, Google AI Studio > Models sayfasindan
# guncel adi kontrol edip burada degistirin.
MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

STORAGE_BUCKET = "dosyalar"

app = FastAPI(title="LexAgent AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Belge okuma (PDF / UDF)
# ---------------------------------------------------------------------------
def extract_pdf_text(data: bytes) -> str:
    reader = pypdf.PdfReader(io.BytesIO(data))
    parts = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(parts)


def extract_udf_text(data: bytes) -> str:
    """UDF (UYAP) dosyalari aslinda bir ZIP arsividir; icindeki XML/metin
    icerigini duz metne cevirir."""
    text_parts = []
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        candidates = [n for n in z.namelist() if n.lower().endswith(".xml") or "content" in n.lower()]
        target_names = candidates if candidates else z.namelist()
        for name in target_names:
            try:
                content = z.read(name).decode("utf-8", errors="ignore")
                text_parts.append(re.sub(r"<[^>]+>", " ", content))
            except Exception:
                continue
    return "\n".join(text_parts)


def extract_docx_text(data: bytes) -> str:
    """DOCX (Word) dosyalari da PDF/UDF gibi bir ZIP arsividir; ayri bir
    python-docx bagimliligi eklemeden word/document.xml icindeki metin
    calismalarini duz metne cevirir."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
    except (zipfile.BadZipFile, KeyError):
        raise ValueError("Gecerli bir DOCX dosyasi degil")
    xml = re.sub(r"</w:p>", "\n", xml)
    xml = re.sub(r"<[^>]+>", "", xml)
    return xml.strip()


BELGE_OKUMA_SYSTEM = (
    "Sen bir belge tarama asistanisin. Sana verilen goruntudeki tum metni, "
    "yorum eklemeden, bicimlendirme yapmadan oldugu gibi duz metin olarak yaz."
)

IMAGE_MIME_BY_EXT = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


async def extract_text_for(filename: str, data: bytes) -> str:
    name_lower = (filename or "").lower()
    if name_lower.endswith(".pdf"):
        return extract_pdf_text(data)
    if name_lower.endswith(".udf"):
        return extract_udf_text(data)
    if name_lower.endswith(".docx"):
        return extract_docx_text(data)
    for ext, mime in IMAGE_MIME_BY_EXT.items():
        if name_lower.endswith(ext):
            return await call_gemini_vision(BELGE_OKUMA_SYSTEM, "Bu goruntudeki tum metni oldugu gibi yaz.", data, mime)
    raise ValueError("Desteklenmeyen dosya turu (desteklenenler: PDF, UDF, DOCX, JPG, PNG, WEBP)")


def generate_pdf_bytes(baslik: str, metin: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm, leftMargin=2 * cm, rightMargin=2 * cm
    )
    styles = getSampleStyleSheet()
    story = [Paragraph(html_lib.escape(baslik), styles["Title"]), Spacer(1, 12)]
    for para in metin.split("\n"):
        story.append(Paragraph(html_lib.escape(para) or "&nbsp;", styles["Normal"]))
        story.append(Spacer(1, 4))
    doc.build(story)
    return buf.getvalue()


@app.post("/api/parse")
async def parse_files(files: List[UploadFile] = File(...), user: dict = Depends(get_current_user)):
    results = []
    for f in files:
        data = await f.read()
        try:
            text = await extract_text_for(f.filename, data)
            results.append({"name": f.filename, "text": text.strip()})
        except Exception as e:
            results.append({"name": f.filename, "text": "", "error": str(e)})
    return {"documents": results}


# ---------------------------------------------------------------------------
# Gemini API cagrisi (sunucu tarafinda, API anahtari asla tarayiciya gitmez)
# ---------------------------------------------------------------------------
def friendly_gemini_error(status_code: int) -> str:
    """Gemini'nin ham hata govdesini kullaniciya hic gostermeyiz (teknik detay,
    bazen JSON, bazen kota/faturalandirma bilgisi icerir) - burada kullaniciya
    gosterilecek sade Turkce mesaja ceviririz; ham detay logger.error ile
    sunucu loglarina yazilir."""
    if status_code == 429:
        return "Bu özellik şu anda yoğun talep nedeniyle geçici olarak kullanılamıyor. Lütfen kısa süre sonra tekrar deneyin."
    if status_code in (401, 403):
        return "Bu özellik şu anda geçici olarak kullanılamıyor. Ekibimiz bilgilendirildi, lütfen daha sonra tekrar deneyin."
    if status_code >= 500:
        return "Bu özellik şu anda geçici olarak kullanılamıyor. Lütfen kısa süre sonra tekrar deneyin."
    return "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin."


async def call_gemini(system_prompt: str, user_prompt: str, use_search: bool):
    if not GEMINI_API_KEY:
        raise HTTPException(500, "Sunucuda GEMINI_API_KEY tanimli degil. Render Environment ayarlarindan ekleyin.")

    url = f"{GEMINI_BASE}/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
    }
    if use_search:
        payload["tools"] = [{"google_search": {}}]

    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(url, json=payload)

    if resp.status_code != 200:
        logger.error("Gemini API hatasi (%s): %s", resp.status_code, resp.text)
        raise HTTPException(resp.status_code, friendly_gemini_error(resp.status_code))

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise HTTPException(502, "Yapay zeka servisi boş yanıt döndürdü. Lütfen tekrar deneyin.")

    candidate = candidates[0]
    parts = candidate.get("content", {}).get("parts", [])
    text = "\n".join(p.get("text", "") for p in parts if "text" in p).strip()

    sources = []
    grounding = candidate.get("groundingMetadata", {}) or {}
    for chunk in grounding.get("groundingChunks", []) or []:
        web = chunk.get("web", {})
        if web.get("uri"):
            sources.append({"title": web.get("title", web["uri"]), "uri": web["uri"]})

    return text, sources


KUNYE_PATTERN = re.compile(
    r"(Esas\s*No\s*[:.]?\s*\d{2,4}\s*/\s*\d+|Karar\s*No\s*[:.]?\s*\d{2,4}\s*/\s*\d+|\b\d{2,4}\s*/\s*\d+\s*E\.|\b\d{2,4}\s*/\s*\d+\s*K\.)",
    re.IGNORECASE,
)


def bul_dogrulanmamis_kunyeler(text: str, grounding_supports: list) -> list:
    """groundingSupports, Gemini'nin cevabindaki hangi metin araliklarinin
    gercekten bir arama sonucuyla (grounding chunk) desteklendigini belirtir.
    Metinde gecen her Esas/Karar kunyesinin bu desteklenen araliklarin icinde
    olup olmadigini kontrol eder; olmayanlari "dogrulanamadi" olarak isaretler.
    Bu, sadece modelin kendi metnine guvenmek yerine, API'nin kendi grounding
    verisine dayanan kod seviyesinde bir kontroldur."""
    grounded_ranges = []
    for s in grounding_supports or []:
        seg = s.get("segment", {}) or {}
        start, end = seg.get("startIndex"), seg.get("endIndex")
        chunk_idx = s.get("groundingChunkIndices") or []
        if start is not None and end is not None and chunk_idx:
            grounded_ranges.append((start, end))

    unverified = []
    for m in KUNYE_PATTERN.finditer(text):
        kunye = m.group(0).strip()
        span = m.span()
        is_grounded = any(r[0] <= span[0] < r[1] or r[0] < span[1] <= r[1] for r in grounded_ranges)
        if not is_grounded and kunye not in unverified:
            unverified.append(kunye)
    return unverified


async def call_gemini_grounded(system_prompt: str, user_prompt: str):
    """call_gemini ile ayni, ama halusinasyon kontrolu icin ham grounding
    detaylarini (groundingSupports, groundingChunks) da dondurur. Sadece
    /api/research'te kullanilir - digerleri call_gemini'yi kullanmaya devam eder."""
    if not GEMINI_API_KEY:
        raise HTTPException(500, "Sunucuda GEMINI_API_KEY tanimli degil. Render Environment ayarlarindan ekleyin.")

    url = f"{GEMINI_BASE}/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": user_prompt}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "tools": [{"google_search": {}}],
    }

    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(url, json=payload)

    if resp.status_code != 200:
        logger.error("Gemini API hatasi (%s): %s", resp.status_code, resp.text)
        raise HTTPException(resp.status_code, friendly_gemini_error(resp.status_code))

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise HTTPException(502, "Yapay zeka servisi boş yanıt döndürdü. Lütfen tekrar deneyin.")

    candidate = candidates[0]
    parts = candidate.get("content", {}).get("parts", [])
    text = "\n".join(p.get("text", "") for p in parts if "text" in p).strip()

    grounding = candidate.get("groundingMetadata", {}) or {}
    chunks = grounding.get("groundingChunks", []) or []
    supports = grounding.get("groundingSupports", []) or []
    sources = []
    for chunk in chunks:
        web = chunk.get("web", {})
        if web.get("uri"):
            sources.append({"title": web.get("title", web["uri"]), "uri": web["uri"]})

    return text, sources, chunks, supports


async def call_gemini_vision(system_prompt: str, user_prompt: str, file_bytes: bytes, mime_type: str) -> str:
    """Gemini'nin coklu-mod (metin+goruntu/PDF) anlama yetenegini kullanarak, metin
    katmani olmayan taranmis belgeleri "okur" (OCR + anlama tek adimda). Ayri bir
    tesseract/pytesseract kurulumuna gerek birakmaz; Render'da ek sistem paketi
    gerektirmez."""
    if not GEMINI_API_KEY:
        raise HTTPException(500, "Sunucuda GEMINI_API_KEY tanimli degil.")

    url = f"{GEMINI_BASE}/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": user_prompt},
                    {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(file_bytes).decode("ascii")}},
                ]
            }
        ],
        "systemInstruction": {"parts": [{"text": system_prompt}]},
    }

    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(url, json=payload)

    if resp.status_code != 200:
        logger.error("Gemini vision API hatasi (%s): %s", resp.status_code, resp.text)
        raise HTTPException(resp.status_code, friendly_gemini_error(resp.status_code))

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise HTTPException(502, "Yapay zeka servisi boş yanıt döndürdü. Lütfen tekrar deneyin.")

    parts = candidates[0].get("content", {}).get("parts", [])
    return "\n".join(p.get("text", "") for p in parts if "text" in p).strip()


RESEARCH_SYSTEM = """Sen Turk hukuku konusunda uzman, Yargitay, Danistay, Anayasa Mahkemesi ve BAM/BIM kararlarini
gercek ve dogrulanabilir acik internet kaynaklarindan arastiran bir hukuki arastirma asistanisin.

KURALLAR (KESINLIKLE UY):
1. SADECE gercekten bulup dogrulayabildigin kararlari raporla. Esas/Karar numarasi UYDURMA.
2. Eger belirli bir konuda gercek bir karar bulamadiysan, bunu acikca "bu konuda dogrulanmis bir emsal
   bulamadim" diyerek belirt; sahte kunye uretme. Bunun yerine ilgili kanun maddelerini ve genel hukuki
   ilkeleri anlat.
3. Bulunan her karar icin soyle bir format kullan: Mahkeme/Daire, Esas No, Karar No, Tarih, kisa hukuki ilke ozeti.
4. Turkce yanit ver."""

DRAFT_SYSTEM = """Sen Turk yargilama hukukuna hakim, kidemli bir avukatsin. Sana verilen olay ozeti, kullanicinin
talimati ve (varsa) arastirma asamasinda bulunan gercek emsal kararlari kullanarak, Hukuk Muhakemeleri Kanunu
m.119'da (dava dilekcesinin icerigi) tanimlanan zorunlu unsurlari eksiksiz iceren resmi bir dilekce TASLAGI
yaziyorsun. Bu unsurlar bir sablon METNI degil, dilekcenin uymasi gereken YAPISAL ISKELETTIR - her davanin
somut olaylarina gore icerigini SEN olusturursun.

DILEKCENIN ZORUNLU YAPISI (HMK m.119 esas alinarak):
1. MAHKEME BASLIGI: Gorevli/yetkili mahkemenin adi, en ust satirda.
2. TARAFLAR: Davaci/davali (veya taraf rolune gore alacakli/borclu vb.) ad-soyad/unvan ve varsa vekilleri;
   gercek bir kimlik/adres bilgisi verilmemisse "[......]" seklinde doldurulmasi gereken bos alan birak,
   UYDURMA.
3. KONU: Davanin/talebin konusu, kisa ve net.
4. ACIKLAMALAR: Olayin, verilen bilgilere dayanarak, sira numarasi altinda acik bir ozeti (vakialar).
5. HUKUKI NEDENLER: Dayanilan kanun maddeleri ve hukuki sebepler (verilmisse arastirma sonuclarindaki
   emsal kararlarla desteklenir).
6. DELILLER: Olayda belirtilen veya mantiken var olacak delil turleri (belge, tanik, bilirkisi vb.).
7. SONUC VE ISTEM: Acik, sayilarla/maddelerle ifade edilmis somut talep.

KURALLAR:
- Sadece sana verilen emsal kararlari kullan; kendi uydurdugun Esas/Karar numarasi ekleme.
- Yukaridaki 7 unsurun tamamini, davanin turune uygun basliklarla, dilekcede mutlaka bulundur.
- Dilekcenin en altina kucuk harflerle su notu ekle: "Bu bir taslaktir; gonderilmeden once mutlaka bir
  avukat tarafindan incelenmelidir." """

SUMMARY_SYSTEM = """Sen bir hukuk burosunda dosya takibi yapan kidemli bir avukat asistanisin. Sana bir
dosyanin mevcut "son durum ozeti" (varsa) ve o dosyaya yeni eklenen bir belgenin metni veriliyor.

GOREV: Bu iki bilgiyi birlestirerek KISA (en fazla 5-6 cumle), guncel bir "son durum ozeti" uret -
dosyanin hangi asamada oldugunu ve en son ne oldugunu belirt.

KURALLAR:
- Sadece verilen bilgilerden yola cik; kanun maddesi, sure veya tarih UYDURMA.
- Bir sure/hak dusurucu sure hesaplamasindan bahsediyorsan mutlaka "bu bir on degerlendirmedir, avukat
  tarafindan teyit edilmelidir" notunu ekle.
- Turkce, sade ve net yaz."""

VEKALETNAME_EXTRACTION_SYSTEM = """Sen bir hukuk burosunda vekaletname belgelerini inceleyen bir asistansin.
Sana bir vekaletname belgesinin metni veya goruntusu veriliyor (taranmis/goruntu tabanli olabilir).
Belgeyi dikkatlice oku ve SADECE su alanlari iceren gecerli bir JSON nesnesi dondur:

{
  "vekil_adi": "avukatin (vekilin) adi soyadi veya null",
  "muvekkil_adi": "vekaleti verenin (muvekkilin) adi soyadi veya null",
  "muvekkil_tc": "muvekkilin TC kimlik numarasi (11 hane) veya null",
  "muvekkil_adres": "muvekkilin adresi veya null",
  "ozel_yetkiler": "belgede gecen ozel yetkilerin kisa listesi, orn: Dava Acma, Temyiz, Sulh, Ibra, Ahzu Kabz veya null",
  "veren_tarih": "YYYY-MM-DD veya null",
  "noter": "duzenleyen noterlik adi veya null",
  "ozet": "1-2 cumlelik kisa aciklama veya null"
}

KURALLAR (KESINLIKLE UY):
- Sadece belgede gercekten okuyabildigin bilgileri doldur; bir alani okuyamiyorsan veya emin
  degilsen o alani null birak. ASLA tahmini/uydurma bir isim, TC numarasi veya tarih yazma -
  yanlis bir TC kimlik no veya isim ciddi sonuclara yol acabilir.
- Baska hicbir metin ekleme, sadece JSON dondur (kod bloğu isaretleyicisi de ekleme)."""

MEVZUAT_SYSTEM = """Sen Turk mevzuati konusunda uzman bir arastirma asistanisin. Kullanicinin arattigi
kanun/madde/konu ile ilgili GERCEK ve DOGRULANABILIR bilgiyi, acik internet kaynaklarindan bularak raporla.

TARANACAK KAYNAKLAR (oncelik sirasiyla):
1. mevzuat.gov.tr (resmi mevzuat bilgi sistemi)
2. Resmi Gazete (resmigazete.gov.tr)
3. TBMM Kanunlar ve Kararlar Bilgi Sistemi (tbmm.gov.tr)
4. Ilgili bakanlik/kurum resmi sayfalari (orn. Adalet Bakanligi, Turkiye Barolar Birligi)
Birden fazla kaynaktan capraz dogrulama yapmaya calis; ayni bilgiyi birden fazla resmi kaynakta
teyit edebiliyorsan bunu belirt.

KURALLAR (KESINLIKLE UY):
1. SADECE gercekten bulup dogrulayabildigin kanun/madde bilgisini raporla. Madde numarasi, tarih veya
   metin icerigini UYDURMA.
2. Eger aramayla eslesen gercek/guncel bir sonuc bulamadiysan, bunu acikca ve profesyonelce belirt
   ("bu konuda dogrulanmis bir mevzuat hukmu bulamadim" gibi); sahte bir kanun adi/numarasi veya
   madde metni uretme. Boyle durumda, biliyorsan ilgili genel konunun hangi kanun(lar) altinda
   duzenlenmis olabilecegini (madde numarasi vermeden) belirtebilirsin.
3. Her sonuc icin ayri bir paragrafta: Kanun adi, Kanun No (varsa), ilgili madde(ler), kisa aciklama,
   yururluk/guncelleme tarihi (biliniyorsa).
4. Turkce yanit ver."""

RISK_ANALIZI_SYSTEM = """Sen sozlesme ve hukuki belge inceleme konusunda uzman, kidemli bir avukatsin.
Sana bir belgenin metni veriliyor. Bu belgeyi hukuki risk acisindan incele ve asagidaki basliklar
altinda, ayri paragraflar halinde bir rapor ver:

1. BELGE TURU VE TARAFLAR: Belgenin ne oldugu ve tespit edebildigin taraflari.
2. ONEMLI HUKUMLER: Sure, bedel, fesih, ceza-i sart gibi kritik hukumlerin kisa ozeti.
3. RISKLI/DIKKAT EDILMESI GEREKEN MADDELER: Taraflardan biri aleyhine olabilecek, belirsiz veya
   standart disi gordugun hukumler.
4. EKSIK OLABILECEK HUSUSLAR: Bu turdeki belgelerde genelde bulunan ama bu belgede gormedigin,
   eklenmesi faydali olabilecek unsurlar (varsa).

KURALLAR:
- Sadece belgede gercekten yazana dayan; UYDURMA, tahminlerini acikca "tahminimdir" diye belirt.
- Bu bir on degerlendirmedir; nihai karar ve onay mutlaka bir avukata aittir - raporun sonuna
  bunu kucuk harflerle ekle.
- Turkce, madde madde ve net yaz."""

VERIFICATION_SYSTEM = """Sen bir hukuk arastirmasi kalite kontrol uzmanisin. Sana bir "emsal karar
arastirmasi" sonucunun metni veriliyor. Bu metinde gecen HER BIR karar kunyesini (Mahkeme/Daire,
Esas No, Karar No) ayri ayri ele al ve kendi bilgine + varsa web aramasina dayanarak, bu kararin
gercekten var oldugunu dogrulayip dogrulayamadigini belirt.

FORMAT: Her kunye icin ayri bir satir/paragraf:
"[Kunye] - DOGRULANDI" (gercekten bulup teyit edebildiysen)
"[Kunye] - DOGRULANAMADI" (bulamadiysan veya emin degilsen)

KURALLAR:
- Kesin bir dogrulama garantisi veremeyecegini unutma; supheliysen mutlaka DOGRULANAMADI de,
  iyimser tahmin YAPMA.
- Metinde gecen kanun maddeleri hakkinda da kisaca yorum yapabilirsin ama odak karar kunyeleri
  olsun.
- Turkce, kisa ve net yaz."""


async def get_owned_dosya(dosya_id: str, user_id: str) -> dict:
    dosya = await db.select_one("dosyalar", {"id": f"eq.{dosya_id}", "user_id": f"eq.{user_id}"})
    if not dosya:
        raise HTTPException(404, "Dosya bulunamadi.")
    return dosya


async def update_son_durum_ozeti(dosya: dict, yeni_belge_adi: str, yeni_belge_metni: str):
    user_prompt = f"""Mevcut son durum ozeti:
{dosya.get("son_durum_ozeti") or "(henuz ozet yok)"}

Yeni eklenen belge ({yeni_belge_adi}):
{yeni_belge_metni[:8000]}

Guncellenmis "son durum ozeti"ni yaz."""
    try:
        ozet, _ = await call_gemini(SUMMARY_SYSTEM, user_prompt, use_search=False)
    except HTTPException:
        return
    await db.patch("dosyalar", {"id": f"eq.{dosya['id']}"}, {"son_durum_ozeti": ozet})


# ---------------------------------------------------------------------------
# Kullanici basina gunluk arama limiti (paylasilan Gemini kotasini korumak icin).
# Tablo henuz olusturulmadiysa (migration 011 calistirilmadiysa) sessizce
# atlanir - limit calismaz ama uygulama bozulmaz (fail-open).
# ---------------------------------------------------------------------------
def gunluk_arama_limiti() -> int:
    # Sabit kod yerine env var'dan okunur; Render Environment sekmesinden
    # kod degisikligi/deploy gerekmeden degistirilebilir. Ileride paket bazli
    # (deneme/baslangic/profesyonel/kurumsal) hale getirilecek tek nokta burasi.
    try:
        return int(os.environ.get("GUNLUK_ARAMA_LIMITI", "15"))
    except ValueError:
        return 15


async def gunluk_kullanim_kontrol_ve_artir(user_id: str):
    limit = gunluk_arama_limiti()
    bugun = datetime.now(timezone.utc).date().isoformat()
    try:
        kayit = await db.select_one("gunluk_kullanim", {"user_id": f"eq.{user_id}", "tarih": f"eq.{bugun}"})
    except Exception as e:
        logger.warning(f"gunluk_kullanim tablosuna erisilemedi, limit kontrolu atlandi: {e}")
        return
    if kayit and kayit["sayi"] >= limit:
        raise HTTPException(429, "Günlük araştırma hakkınızı doldurdunuz. Yarın tekrar deneyebilirsiniz.")
    try:
        if kayit:
            await db.patch("gunluk_kullanim", {"user_id": f"eq.{user_id}", "tarih": f"eq.{bugun}"}, {"sayi": kayit["sayi"] + 1})
        else:
            await db.insert("gunluk_kullanim", {"user_id": user_id, "tarih": bugun, "sayi": 1})
    except Exception as e:
        logger.warning(f"gunluk_kullanim guncellenemedi: {e}")


# ---------------------------------------------------------------------------
# Dosya (dava) yonetimi
# ---------------------------------------------------------------------------
@app.post("/api/dosyalar")
async def create_dosya(
    muvekkil_adi: str = Form(...),
    karsi_taraf: str = Form(""),
    mahkeme: str = Form(""),
    esas_no: str = Form(""),
    dava_turu: str = Form(""),
    acilis_tarihi: Optional[str] = Form(None),
    musteri_id: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    row = {
        "user_id": user["id"],
        "muvekkil_adi": muvekkil_adi,
        "karsi_taraf": karsi_taraf or None,
        "mahkeme": mahkeme or None,
        "esas_no": esas_no or None,
        "dava_turu": dava_turu or None,
        "acilis_tarihi": acilis_tarihi or None,
        "musteri_id": musteri_id or None,
    }
    dosya = await db.insert("dosyalar", row)
    return dosya


@app.get("/api/dosyalar")
async def list_dosyalar(user: dict = Depends(get_current_user)):
    rows = await db.select("dosyalar", {"user_id": f"eq.{user['id']}"}, order="created_at.desc")
    return {"dosyalar": rows}


@app.get("/api/dosyalar/{dosya_id}")
async def get_dosya(dosya_id: str, user: dict = Depends(get_current_user)):
    dosya = await get_owned_dosya(dosya_id, user["id"])
    belgeler = await db.select("belgeler", {"dosya_id": f"eq.{dosya_id}"}, order="created_at.desc")
    return {**dosya, "belgeler": belgeler}


@app.patch("/api/dosyalar/{dosya_id}")
async def patch_dosya(
    dosya_id: str,
    muvekkil_adi: Optional[str] = Form(None),
    karsi_taraf: Optional[str] = Form(None),
    mahkeme: Optional[str] = Form(None),
    esas_no: Optional[str] = Form(None),
    dava_turu: Optional[str] = Form(None),
    acilis_tarihi: Optional[str] = Form(None),
    durum: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    await get_owned_dosya(dosya_id, user["id"])
    fields = {
        k: v
        for k, v in {
            "muvekkil_adi": muvekkil_adi,
            "karsi_taraf": karsi_taraf,
            "mahkeme": mahkeme,
            "esas_no": esas_no,
            "dava_turu": dava_turu,
            "acilis_tarihi": acilis_tarihi,
            "durum": durum,
        }.items()
        if v is not None
    }
    if not fields:
        raise HTTPException(400, "Guncellenecek alan yok.")
    rows = await db.patch("dosyalar", {"id": f"eq.{dosya_id}"}, fields)
    return rows[0]


@app.post("/api/dosyalar/{dosya_id}/belgeler")
async def upload_belge(
    dosya_id: str,
    files: List[UploadFile] = File(...),
    tur: str = Form("diger"),
    user: dict = Depends(get_current_user),
):
    dosya = await get_owned_dosya(dosya_id, user["id"])
    created = []
    for f in files:
        data = await f.read()
        try:
            metin = await extract_text_for(f.filename, data)
        except Exception as e:
            created.append({"name": f.filename, "error": str(e)})
            continue

        storage_path = None
        try:
            path = f"{dosya_id}/{uuid.uuid4()}-{f.filename}"
            storage_path = await db.upload_file(STORAGE_BUCKET, path, data, f.content_type)
        except Exception:
            pass  # metin yine de kaydedilir; orijinal dosya saklanamazsa uygulama durmaz

        belge = await db.insert(
            "belgeler",
            {
                "dosya_id": dosya_id,
                "ad": f.filename,
                "tur": tur,
                "metin": metin.strip(),
                "storage_path": storage_path,
            },
        )
        created.append(belge)
        await update_son_durum_ozeti(dosya, f.filename, metin)
        dosya = await get_owned_dosya(dosya_id, user["id"])

    return {"belgeler": created, "son_durum_ozeti": dosya.get("son_durum_ozeti")}


@app.post("/api/research")
async def research(
    dosya_id: Optional[str] = Form(None),
    case_subject: str = Form(...),
    court_type: str = Form(...),
    party_role: str = Form(...),
    case_details: str = Form(...),
    instruction: str = Form(""),
    user: dict = Depends(get_current_user),
):
    await gunluk_kullanim_kontrol_ve_artir(user["id"])
    if dosya_id:
        await get_owned_dosya(dosya_id, user["id"])

    user_prompt = f"""Mahkeme Turu: {court_type}
Taraf Rolu: {party_role}
Dava Konusu: {case_subject}
Kullanici Talimati: {instruction}

Olay / Evrak Ozeti:
{case_details}

Bu uyusmazlikla dogrudan ilgili, gercek ve dogrulanabilir emsal kararlari ara ve listele.
Uygulanacak kanun maddelerini de belirt."""

    text, sources, chunks, supports = await call_gemini_grounded(RESEARCH_SYSTEM, user_prompt)

    if not chunks:
        # Grounding hic gercek kaynak dondurmedi - modelin metnine guvenilemez,
        # potansiyel olarak uydurma karar icerebilir. Metni HIC gostermeyip
        # net bir "bulunamadi" mesaji dondur.
        return {
            "result": "Şu anda gerçek kaynaklardan doğrulanmış bir emsal karar bulunamadı. Lütfen birkaç dakika sonra tekrar deneyin veya farklı anahtar kelimelerle arayın.",
            "sources": [],
            "unverified_kunyeler": [],
        }

    unverified = bul_dogrulanmamis_kunyeler(text, supports)

    if dosya_id:
        await db.insert(
            "belgeler",
            {"dosya_id": dosya_id, "ad": "Emsal Arastirma Sonucu", "tur": "arastirma", "metin": text},
        )
    return {"result": text, "sources": sources, "unverified_kunyeler": unverified}


@app.post("/api/draft")
async def draft(
    dosya_id: Optional[str] = Form(None),
    case_subject: str = Form(...),
    court_type: str = Form(...),
    party_role: str = Form(...),
    case_details: str = Form(...),
    instruction: str = Form(""),
    precedents: str = Form(""),
    user: dict = Depends(get_current_user),
):
    await gunluk_kullanim_kontrol_ve_artir(user["id"])
    if dosya_id:
        await get_owned_dosya(dosya_id, user["id"])

    user_prompt = f"""GOREVLI MAHKEME: {court_type}
TARAF ROLU: {party_role}
DAVA KONUSU: {case_subject}
KULLANICI TALIMATI: {instruction}

OLAY OZETI:
{case_details}

BULUNAN EMSAL KARARLAR:
{precedents}

Yukaridaki bilgilerle eksiksiz, resmi bir dilekce taslagi yaz."""

    text, _ = await call_gemini(DRAFT_SYSTEM, user_prompt, use_search=False)
    if dosya_id:
        await db.insert(
            "belgeler",
            {"dosya_id": dosya_id, "ad": "Dilekce Taslagi", "tur": "dilekce", "metin": text},
        )
    return {"petition": text}


@app.post("/api/dosyalar/{dosya_id}/belge-ekle-metin")
async def add_text_belge(
    dosya_id: str,
    ad: str = Form(...),
    tur: str = Form("diger"),
    metin: str = Form(...),
    user: dict = Depends(get_current_user),
):
    dosya = await get_owned_dosya(dosya_id, user["id"])
    belge = await db.insert(
        "belgeler",
        {"dosya_id": dosya_id, "ad": ad, "tur": tur, "metin": metin},
    )
    await update_son_durum_ozeti(dosya, ad, metin)
    return belge


@app.post("/api/etkinlikler")
async def create_etkinlik(
    baslik: str = Form(...),
    tarih: str = Form(...),
    saat: Optional[str] = Form(None),
    tur: str = Form("genel"),
    aciklama: Optional[str] = Form(None),
    dosya_id: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    if dosya_id:
        await get_owned_dosya(dosya_id, user["id"])
    row = {
        "kullanici_id": user["id"],
        "dosya_id": dosya_id or None,
        "baslik": baslik,
        "tarih": tarih,
        "saat": saat or None,
        "tur": tur,
        "aciklama": aciklama or None,
    }
    return await db.insert("etkinlikler", row)


@app.get("/api/etkinlikler")
async def list_etkinlikler(user: dict = Depends(get_current_user)):
    rows = await db.select("etkinlikler", {"kullanici_id": f"eq.{user['id']}"}, order="tarih.asc,saat.asc")
    return {"etkinlikler": rows}


@app.get("/api/dosyalar/{dosya_id}/etkinlikler")
async def list_dosya_etkinlikleri(dosya_id: str, user: dict = Depends(get_current_user)):
    await get_owned_dosya(dosya_id, user["id"])
    rows = await db.select("etkinlikler", {"dosya_id": f"eq.{dosya_id}"}, order="tarih.asc,saat.asc")
    return {"etkinlikler": rows}


async def get_owned_etkinlik(etkinlik_id: str, user_id: str) -> dict:
    etkinlik = await db.select_one("etkinlikler", {"id": f"eq.{etkinlik_id}", "kullanici_id": f"eq.{user_id}"})
    if not etkinlik:
        raise HTTPException(404, "Etkinlik bulunamadi.")
    return etkinlik


@app.patch("/api/etkinlikler/{etkinlik_id}")
async def patch_etkinlik(
    etkinlik_id: str,
    baslik: Optional[str] = Form(None),
    tarih: Optional[str] = Form(None),
    saat: Optional[str] = Form(None),
    tur: Optional[str] = Form(None),
    aciklama: Optional[str] = Form(None),
    tamamlandi: Optional[bool] = Form(None),
    user: dict = Depends(get_current_user),
):
    await get_owned_etkinlik(etkinlik_id, user["id"])
    fields = {
        k: v
        for k, v in {
            "baslik": baslik,
            "tarih": tarih,
            "saat": saat,
            "tur": tur,
            "aciklama": aciklama,
            "tamamlandi": tamamlandi,
        }.items()
        if v is not None
    }
    if not fields:
        raise HTTPException(400, "Guncellenecek alan yok.")
    rows = await db.patch("etkinlikler", {"id": f"eq.{etkinlik_id}"}, fields)
    return rows[0]


async def extract_vekaletname_fields(data: bytes, filename: str, content_type: str) -> dict:
    """Vekaletname belgesinden yapilandirilmis alanlari cikarir. Metin katmani
    varsa (normal PDF) o metni Gemini'ye gonderir; yoksa (taranmis/goruntu
    tabanli) Gemini'nin coklu-mod anlama ozelligiyle dogrudan gorseli okur.
    Hicbir alani UYDURMAZ - okuyamadigini null birakir (bkz. VEKALETNAME_EXTRACTION_SYSTEM)."""
    content_type = (content_type or "").lower()
    name_lower = (filename or "").lower()
    extracted_text = ""
    if name_lower.endswith(".pdf") or content_type == "application/pdf":
        try:
            extracted_text = extract_pdf_text(data)
        except Exception:
            extracted_text = ""

    # HTTPException (Gemini servisi gecici olarak kullanilamiyor/kota vb.) burada
    # YUTULMAZ - cagiran endpoint'e aynen yansir, boylece kullaniciya "belge
    # okunamadi" gibi yanlis bir mesaj yerine gercek nedeni ("su anda gecici
    # olarak kullanilamiyor") gosterilir. Sadece JSON ayristirma/format
    # hatalari (gercekten "bu belgeden alan cikaramadim" durumu) yutulur.
    if len(extracted_text.strip()) >= 50:
        raw, _ = await call_gemini(VEKALETNAME_EXTRACTION_SYSTEM, extracted_text[:15000], use_search=False)
    else:
        mime = content_type or ("application/pdf" if name_lower.endswith(".pdf") else "image/jpeg")
        raw = await call_gemini_vision(
            VEKALETNAME_EXTRACTION_SYSTEM,
            "Bu vekaletname belgesini incele ve istenen alanlari JSON olarak dondur.",
            data,
            mime,
        )
    try:
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        return json.loads(cleaned)
    except Exception:
        return {}


@app.post("/api/vekaletname-oku")
async def vekaletname_oku(dosya: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """On-izleme: belgeyi kaydetmeden sadece alanlari cikarip dondurur, boylece
    kullanici formu kontrol edip duzeltebilir, sonra ayrica kaydeder."""
    await gunluk_kullanim_kontrol_ve_artir(user["id"])
    data = await dosya.read()
    fields = await extract_vekaletname_fields(data, dosya.filename, dosya.content_type)
    return fields


@app.post("/api/dosyalar/{dosya_id}/vekaletname")
async def create_vekaletname(
    dosya_id: str,
    vekil_adi: Optional[str] = Form(None),
    muvekkil_adi: Optional[str] = Form(None),
    muvekkil_tc: Optional[str] = Form(None),
    muvekkil_adres: Optional[str] = Form(None),
    veren_tarih: Optional[str] = Form(None),
    gecerlilik_tarihi: Optional[str] = Form(None),
    ozel_yetkiler: Optional[str] = Form(None),
    noter: Optional[str] = Form(None),
    notlar: Optional[str] = Form(None),
    dosya: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user),
):
    await get_owned_dosya(dosya_id, user["id"])
    storage_path = None
    if dosya is not None and dosya.filename:
        data = await dosya.read()
        try:
            path = f"vekaletname/{dosya_id}/{uuid.uuid4()}-{dosya.filename}"
            storage_path = await db.upload_file(STORAGE_BUCKET, path, data, dosya.content_type)
        except Exception:
            pass

    row = {
        "kullanici_id": user["id"],
        "dosya_id": dosya_id,
        "vekil_adi": vekil_adi or None,
        "muvekkil_adi": muvekkil_adi or None,
        "muvekkil_tc": muvekkil_tc or None,
        "muvekkil_adres": muvekkil_adres or None,
        "veren_tarih": veren_tarih or None,
        "gecerlilik_tarihi": gecerlilik_tarihi or None,
        "ozel_yetkiler": ozel_yetkiler or None,
        "noter": noter or None,
        "notlar": notlar or None,
        "storage_path": storage_path,
    }
    return await db.insert("vekaletnameler", row)


@app.get("/api/dosyalar/{dosya_id}/vekaletname")
async def list_dosya_vekaletname(dosya_id: str, user: dict = Depends(get_current_user)):
    await get_owned_dosya(dosya_id, user["id"])
    rows = await db.select("vekaletnameler", {"dosya_id": f"eq.{dosya_id}"}, order="created_at.desc")
    return {"vekaletnameler": rows}


@app.get("/api/vekaletnameler")
async def list_vekaletnameler(user: dict = Depends(get_current_user)):
    rows = await db.select("vekaletnameler", {"kullanici_id": f"eq.{user['id']}"}, order="created_at.desc")
    return {"vekaletnameler": rows}


@app.post("/api/dosyalar/{dosya_id}/cari-hesap")
async def create_cari_hesap_kaydi(
    dosya_id: str,
    tur: str = Form(...),
    tutar: float = Form(...),
    aciklama: Optional[str] = Form(None),
    tarih: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    await get_owned_dosya(dosya_id, user["id"])
    row = {
        "kullanici_id": user["id"],
        "dosya_id": dosya_id,
        "tur": tur,
        "tutar": tutar,
        "aciklama": aciklama or None,
        "tarih": tarih or None,
    }
    row = {k: v for k, v in row.items() if v is not None}
    return await db.insert("cari_hesap_kayitlari", row)


@app.get("/api/dosyalar/{dosya_id}/cari-hesap")
async def list_dosya_cari_hesap(dosya_id: str, user: dict = Depends(get_current_user)):
    await get_owned_dosya(dosya_id, user["id"])
    rows = await db.select("cari_hesap_kayitlari", {"dosya_id": f"eq.{dosya_id}"}, order="tarih.desc")
    return {"kayitlar": rows}


@app.get("/api/cari-hesap")
async def list_cari_hesap(user: dict = Depends(get_current_user)):
    rows = await db.select("cari_hesap_kayitlari", {"kullanici_id": f"eq.{user['id']}"}, order="tarih.desc")
    return {"kayitlar": rows}


# ---------------------------------------------------------------------------
# Musteriler (CRM)
# ---------------------------------------------------------------------------
@app.post("/api/musteriler")
async def create_musteri(
    ad_soyad: str = Form(...),
    tc_vergi_no: str = Form(""),
    telefon: str = Form(""),
    eposta: str = Form(""),
    adres: str = Form(""),
    notlar: str = Form(""),
    user: dict = Depends(get_current_user),
):
    row = {
        "user_id": user["id"],
        "ad_soyad": ad_soyad,
        "tc_vergi_no": tc_vergi_no or None,
        "telefon": telefon or None,
        "eposta": eposta or None,
        "adres": adres or None,
        "notlar": notlar or None,
    }
    return await db.insert("musteriler", row)


@app.get("/api/musteriler")
async def list_musteriler(user: dict = Depends(get_current_user)):
    rows = await db.select("musteriler", {"user_id": f"eq.{user['id']}"}, order="ad_soyad.asc")
    return {"musteriler": rows}


async def get_owned_musteri(musteri_id: str, user_id: str) -> dict:
    musteri = await db.select_one("musteriler", {"id": f"eq.{musteri_id}", "user_id": f"eq.{user_id}"})
    if not musteri:
        raise HTTPException(404, "Müşteri bulunamadı.")
    return musteri


@app.get("/api/musteriler/{musteri_id}")
async def get_musteri(musteri_id: str, user: dict = Depends(get_current_user)):
    musteri = await get_owned_musteri(musteri_id, user["id"])
    dosyalar = await db.select("dosyalar", {"musteri_id": f"eq.{musteri_id}"}, order="created_at.desc")
    return {**musteri, "dosyalar": dosyalar}


@app.patch("/api/musteriler/{musteri_id}")
async def patch_musteri(
    musteri_id: str,
    ad_soyad: Optional[str] = Form(None),
    tc_vergi_no: Optional[str] = Form(None),
    telefon: Optional[str] = Form(None),
    eposta: Optional[str] = Form(None),
    adres: Optional[str] = Form(None),
    notlar: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    await get_owned_musteri(musteri_id, user["id"])
    fields = {
        k: v
        for k, v in {
            "ad_soyad": ad_soyad,
            "tc_vergi_no": tc_vergi_no,
            "telefon": telefon,
            "eposta": eposta,
            "adres": adres,
            "notlar": notlar,
        }.items()
        if v is not None
    }
    if not fields:
        raise HTTPException(400, "Güncellenecek alan yok.")
    rows = await db.patch("musteriler", {"id": f"eq.{musteri_id}"}, fields)
    return rows[0]


# ---------------------------------------------------------------------------
# Zaman Takibi (billable hours)
# ---------------------------------------------------------------------------
@app.post("/api/dosyalar/{dosya_id}/zaman")
async def create_zaman_kaydi(
    dosya_id: str,
    tarih: str = Form(...),
    sure_dakika: int = Form(...),
    aciklama: str = Form(""),
    saatlik_ucret: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    await get_owned_dosya(dosya_id, user["id"])
    if sure_dakika <= 0:
        raise HTTPException(400, "Süre 0'dan büyük olmalı.")
    row = {
        "dosya_id": dosya_id,
        "tarih": tarih,
        "sure_dakika": sure_dakika,
        "aciklama": aciklama or None,
        "saatlik_ucret": float(saatlik_ucret) if saatlik_ucret else None,
    }
    return await db.insert("zaman_kayitlari", row)


@app.get("/api/dosyalar/{dosya_id}/zaman")
async def list_zaman_kayitlari(dosya_id: str, user: dict = Depends(get_current_user)):
    await get_owned_dosya(dosya_id, user["id"])
    rows = await db.select("zaman_kayitlari", {"dosya_id": f"eq.{dosya_id}"}, order="tarih.desc")
    return {"kayitlar": rows}


# ---------------------------------------------------------------------------
# Faturalandirma
# ---------------------------------------------------------------------------
async def sonraki_fatura_no(user_id: str) -> str:
    yil = datetime.now(timezone.utc).year
    dosyalar = await db.select("dosyalar", {"user_id": f"eq.{user_id}"})
    dosya_ids = {d["id"] for d in dosyalar}
    tum_faturalar = await db.select("faturalar", order="created_at.desc")
    kullanici_faturalari = [f for f in tum_faturalar if f["dosya_id"] in dosya_ids and f["fatura_no"].startswith(f"{yil}-")]
    sira = len(kullanici_faturalari) + 1
    return f"{yil}-{sira:04d}"


@app.post("/api/dosyalar/{dosya_id}/fatura")
async def create_fatura(
    dosya_id: str,
    tutar: float = Form(...),
    aciklama: str = Form(""),
    user: dict = Depends(get_current_user),
):
    await get_owned_dosya(dosya_id, user["id"])
    if tutar <= 0:
        raise HTTPException(400, "Tutar 0'dan büyük olmalı.")
    fatura_no = await sonraki_fatura_no(user["id"])
    row = {"dosya_id": dosya_id, "fatura_no": fatura_no, "tutar": tutar, "aciklama": aciklama or None}
    return await db.insert("faturalar", row)


@app.get("/api/dosyalar/{dosya_id}/faturalar")
async def list_faturalar(dosya_id: str, user: dict = Depends(get_current_user)):
    await get_owned_dosya(dosya_id, user["id"])
    rows = await db.select("faturalar", {"dosya_id": f"eq.{dosya_id}"}, order="tarih.desc")
    return {"faturalar": rows}


@app.get("/api/faturalar/{fatura_id}/pdf")
async def fatura_pdf(fatura_id: str, user: dict = Depends(get_current_user)):
    fatura = await db.select_one("faturalar", {"id": f"eq.{fatura_id}"})
    if not fatura:
        raise HTTPException(404, "Fatura bulunamadı.")
    dosya = await get_owned_dosya(fatura["dosya_id"], user["id"])
    musteri = await db.select_one("musteriler", {"id": f"eq.{dosya['musteri_id']}"}) if dosya.get("musteri_id") else None

    musteri_adi = musteri["ad_soyad"] if musteri else dosya["muvekkil_adi"]
    musteri_detay = ""
    if musteri:
        if musteri.get("tc_vergi_no"):
            musteri_detay += f"TC/Vergi No: {musteri['tc_vergi_no']}\n"
        if musteri.get("adres"):
            musteri_detay += f"Adres: {musteri['adres']}\n"

    metin = f"""Fatura No: {fatura['fatura_no']}
Tarih: {fatura['tarih']}

Müvekkil: {musteri_adi}
{musteri_detay}
Dosya: {dosya['muvekkil_adi']}{" vs. " + dosya['karsi_taraf'] if dosya.get('karsi_taraf') else ""}
Esas No: {dosya.get('esas_no') or '-'}

Açıklama: {fatura.get('aciklama') or '-'}

Tutar: {fatura['tutar']:.2f} TL"""

    pdf_bytes = generate_pdf_bytes(f"Fatura {fatura['fatura_no']}", metin)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="fatura-{fatura["fatura_no"]}.pdf"'},
    )


@app.post("/api/icra")
async def create_icra(
    borclu_adi: str = Form(...),
    alacakli_adi: str = Form(...),
    takip_no: Optional[str] = Form(None),
    icra_dairesi: Optional[str] = Form(None),
    takip_tutari: Optional[str] = Form(None),
    dosya_id: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    if dosya_id:
        await get_owned_dosya(dosya_id, user["id"])
    row = {
        "kullanici_id": user["id"],
        "dosya_id": dosya_id or None,
        "borclu_adi": borclu_adi,
        "alacakli_adi": alacakli_adi,
        "takip_no": takip_no or None,
        "icra_dairesi": icra_dairesi or None,
        "takip_tutari": float(takip_tutari) if takip_tutari else None,
    }
    return await db.insert("icra_dosyalari", row)


@app.get("/api/icra")
async def list_icra(user: dict = Depends(get_current_user)):
    rows = await db.select("icra_dosyalari", {"kullanici_id": f"eq.{user['id']}"}, order="created_at.desc")
    return {"icra_dosyalari": rows}


async def get_owned_icra(icra_id: str, user_id: str) -> dict:
    icra = await db.select_one("icra_dosyalari", {"id": f"eq.{icra_id}", "kullanici_id": f"eq.{user_id}"})
    if not icra:
        raise HTTPException(404, "Icra takibi bulunamadi.")
    return icra


@app.get("/api/icra/{icra_id}")
async def get_icra(icra_id: str, user: dict = Depends(get_current_user)):
    icra = await get_owned_icra(icra_id, user["id"])
    adimlar = await db.select("icra_adimlari", {"icra_id": f"eq.{icra_id}"}, order="tarih.desc")
    return {**icra, "adimlar": adimlar}


@app.patch("/api/icra/{icra_id}")
async def patch_icra(
    icra_id: str,
    borclu_adi: Optional[str] = Form(None),
    alacakli_adi: Optional[str] = Form(None),
    takip_no: Optional[str] = Form(None),
    icra_dairesi: Optional[str] = Form(None),
    takip_tutari: Optional[str] = Form(None),
    durum: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    await get_owned_icra(icra_id, user["id"])
    fields = {
        k: v
        for k, v in {
            "borclu_adi": borclu_adi,
            "alacakli_adi": alacakli_adi,
            "takip_no": takip_no,
            "icra_dairesi": icra_dairesi,
            "takip_tutari": float(takip_tutari) if takip_tutari else None,
            "durum": durum,
        }.items()
        if v is not None
    }
    if not fields:
        raise HTTPException(400, "Guncellenecek alan yok.")
    rows = await db.patch("icra_dosyalari", {"id": f"eq.{icra_id}"}, fields)
    return rows[0]


@app.post("/api/icra/{icra_id}/adimlar")
async def create_icra_adim(
    icra_id: str,
    tarih: str = Form(...),
    tur: str = Form("diger"),
    aciklama: Optional[str] = Form(None),
    tutar: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    await get_owned_icra(icra_id, user["id"])
    row = {
        "icra_id": icra_id,
        "tarih": tarih,
        "tur": tur,
        "aciklama": aciklama or None,
        "tutar": float(tutar) if tutar else None,
    }
    return await db.insert("icra_adimlari", row)


@app.post("/api/convert/to-pdf")
async def convert_file_to_pdf(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    data = await file.read()
    try:
        metin = await extract_text_for(file.filename, data)
    except Exception as e:
        raise HTTPException(400, str(e))
    pdf_bytes = generate_pdf_bytes(file.filename, metin)
    filename = re.sub(r"\.(pdf|udf|docx|jpe?g|png|webp)$", "", file.filename, flags=re.IGNORECASE) + ".pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/convert/text-to-pdf")
async def convert_text_to_pdf(
    baslik: str = Form("Belge"),
    metin: str = Form(...),
    user: dict = Depends(get_current_user),
):
    pdf_bytes = generate_pdf_bytes(baslik, metin)
    filename = re.sub(r"[^\w\-]+", "_", baslik).strip("_")[:60] or "belge"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
    )


@app.post("/api/belge-analizi")
async def belge_analizi(metin: str = Form(...), user: dict = Depends(get_current_user)):
    analiz, _ = await call_gemini(RISK_ANALIZI_SYSTEM, metin[:15000], use_search=False)
    return {"analiz": analiz}


@app.post("/api/research/dogrula")
async def dogrula_arastirma(metin: str = Form(...), user: dict = Depends(get_current_user)):
    sonuc, sources = await call_gemini(VERIFICATION_SYSTEM, metin[:15000], use_search=True)
    return {"result": sonuc, "sources": sources}


@app.get("/api/mevzuat")
async def search_mevzuat(q: str = "", user: dict = Depends(get_current_user)):
    if not q.strip():
        return {"result": "", "sources": []}
    await gunluk_kullanim_kontrol_ve_artir(user["id"])

    user_prompt = f"""Su konu/kanun/madde hakkinda gercek ve guncel mevzuat bilgisi ara: {q}

mevzuat.gov.tr veya Resmi Gazete gibi resmi kaynaklardan dogrulanabilir sonuclar bul ve
kaynak baglantilarini belirt."""
    text, sources = await call_gemini(MEVZUAT_SYSTEM, user_prompt, use_search=True)
    return {"result": text, "sources": sources}


@app.post("/api/dosyalar/{dosya_id}/paylasim-linki")
async def create_paylasim_linki(dosya_id: str, user: dict = Depends(get_current_user)):
    dosya = await get_owned_dosya(dosya_id, user["id"])
    token = dosya.get("paylasim_token")
    if not token:
        token = secrets.token_urlsafe(24)
        await db.patch("dosyalar", {"id": f"eq.{dosya_id}"}, {"paylasim_token": token})
    return {"token": token}


@app.get("/api/musteri/{token}")
async def get_musteri_gorunumu(token: str):
    dosya = await db.select_one("dosyalar", {"paylasim_token": f"eq.{token}"})
    if not dosya:
        raise HTTPException(404, "Gecersiz veya suresi dolmus link.")
    belgeler = await db.select("belgeler", {"dosya_id": f"eq.{dosya['id']}"}, order="created_at.desc")
    return {
        "muvekkil_adi": dosya["muvekkil_adi"],
        "karsi_taraf": dosya.get("karsi_taraf"),
        "mahkeme": dosya.get("mahkeme"),
        "esas_no": dosya.get("esas_no"),
        "dava_turu": dosya.get("dava_turu"),
        "durum": dosya.get("durum"),
        "acilis_tarihi": dosya.get("acilis_tarihi"),
        "son_durum_ozeti": dosya.get("son_durum_ozeti"),
        "belgeler": [{"ad": b["ad"], "tur": b["tur"], "created_at": b["created_at"]} for b in belgeler],
    }


PLAN_LABELS = {
    "deneme": "Deneme",
    "baslangic": "Başlangıç",
    "profesyonel": "Profesyonel",
    "kurumsal": "Kurumsal",
}


async def get_or_create_profil(user: dict) -> dict:
    profil = await db.select_one("profiller", {"user_id": f"eq.{user['id']}"})
    if profil:
        return profil
    deneme_bitis = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
    return await db.insert("profiller", {"user_id": user["id"], "deneme_bitis": deneme_bitis})


@app.get("/api/profil")
async def get_profil(user: dict = Depends(get_current_user)):
    profil = await get_or_create_profil(user)
    return {**profil, "plan_etiketi": PLAN_LABELS.get(profil.get("plan"), profil.get("plan"))}


@app.post("/api/plan-talebi")
async def create_plan_talebi(
    plan: str = Form(...),
    ad_soyad: str = Form(""),
    eposta: str = Form(""),
    telefon: str = Form(""),
    mesaj: str = Form(""),
    user: dict = Depends(get_current_user),
):
    if plan not in PLAN_LABELS:
        raise HTTPException(400, "Gecersiz plan.")
    row = await db.insert(
        "plan_talepleri",
        {
            "user_id": user["id"],
            "plan": plan,
            "ad_soyad": ad_soyad,
            "eposta": eposta or user.get("email") or "",
            "telefon": telefon,
            "mesaj": mesaj,
        },
    )
    return row


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "api_key_configured": bool(GEMINI_API_KEY),
        "supabase_url_configured": bool(auth.SUPABASE_URL),
        "supabase_jwt_secret_configured": bool(auth.SUPABASE_JWT_SECRET),
        "supabase_service_role_configured": bool(db.SUPABASE_SERVICE_ROLE_KEY),
    }


class NoCacheStaticFiles(StaticFiles):
    """Tarayicinin index.html/app.js gibi dosyalari agresif cache'leyip farkli
    deploy'lardan gelen HTML+JS'i karistirmasini onler (bkz. Madde 6 F5 testi:
    eski HTML + yeni JS karisip router()'in tamamen calismamasina yol acmisti).
    no-cache = her seferinde sunucuya sor, degismediyse 304 al; ETag sayesinde
    bant genisligi maliyeti yok, sadece "hangi surumdeyim" garantisi var."""

    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache"
        return response


# Frontend'i (static/) ayni servisten sun -> ayri bir hosting'e / CORS ayarina gerek kalmaz
app.mount("/", NoCacheStaticFiles(directory="static", html=True), name="static")
