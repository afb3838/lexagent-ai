import os
import io
import base64
import html as html_lib
import json
import re
import secrets
import uuid
import zipfile
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


def extract_text_for(filename: str, data: bytes) -> str:
    name_lower = (filename or "").lower()
    if name_lower.endswith(".pdf"):
        return extract_pdf_text(data)
    if name_lower.endswith(".udf"):
        return extract_udf_text(data)
    raise ValueError("Desteklenmeyen dosya turu")


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
            text = extract_text_for(f.filename, data)
            results.append({"name": f.filename, "text": text.strip()})
        except Exception as e:
            results.append({"name": f.filename, "text": "", "error": str(e)})
    return {"documents": results}


# ---------------------------------------------------------------------------
# Gemini API cagrisi (sunucu tarafinda, API anahtari asla tarayiciya gitmez)
# ---------------------------------------------------------------------------
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
        raise HTTPException(resp.status_code, f"Gemini API hatasi: {resp.text}")

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise HTTPException(502, "Gemini API bos yanit dondurdu.")

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
        raise HTTPException(resp.status_code, f"Gemini API hatasi: {resp.text}")

    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise HTTPException(502, "Gemini API bos yanit dondurdu.")

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
talimati ve (varsa) arastirma asamasinda bulunan gercek emsal kararlari kullanarak resmi standartlara uygun bir
dilekce TASLAGI yaziyorsun.

KURALLAR:
- Sadece sana verilen emsal kararlari kullan; kendi uydurdugun Esas/Karar numarasi ekleme.
- Resmi dilekce formatini uygula: Mahkeme basligi, taraflar, konu, aciklamalar (olay + hukuki gerekce),
  hukuki nedenler, hukuki deliller, sonuc ve istem.
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

VEKALETNAME_OCR_SYSTEM = """Sen bir hukuk burosunda vekaletname belgelerini inceleyen bir asistansin.
Sana taranmis (goruntu tabanli, metin katmani olmayabilir) bir vekaletname belgesi veriliyor.
Belgeyi dikkatlice oku ve SADECE su alanlari iceren gecerli bir JSON nesnesi dondur:

{"veren_tarih": "YYYY-MM-DD" veya null, "ozel_yetkiler": "kisa liste, orn: Temyiz, Sulh, Ibra" veya null, "ozet": "1-2 cumlelik kisa aciklama (kime, hangi kapsamda verildigi)" veya null}

KURALLAR:
- Sadece belgede gercekten okuyabildigin bilgileri doldur; emin olmadigin alanlari null birak, UYDURMA.
- Baska hicbir metin ekleme, sadece JSON dondur (kod bloğu isaretleyicisi de ekleme)."""

MEVZUAT_SYSTEM = """Sen Turk mevzuati konusunda uzman bir arastirma asistanisin. Kullanicinin arattigi
kanun/madde/konu ile ilgili GERCEK ve DOGRULANABILIR bilgiyi, acik internet kaynaklarindan (oncelikle
mevzuat.gov.tr ve Resmi Gazete) bularak raporla.

KURALLAR (KESINLIKLE UY):
1. SADECE gercekten bulup dogrulayabildigin kanun/madde bilgisini raporla. Madde numarasi, tarih veya
   metin icerigini UYDURMA.
2. Eger aramayla eslesen gercek/guncel bir sonuc bulamadiysan, bunu acikca belirt; sahte bir kanun
   adi/numarasi veya madde metni uretme.
3. Her sonuc icin: Kanun adi, Kanun No (varsa), ilgili madde(ler), kisa aciklama.
4. Turkce yanit ver."""


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
            metin = extract_text_for(f.filename, data)
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

    text, sources = await call_gemini(RESEARCH_SYSTEM, user_prompt, use_search=True)
    if dosya_id:
        await db.insert(
            "belgeler",
            {"dosya_id": dosya_id, "ad": "Emsal Arastirma Sonucu", "tur": "arastirma", "metin": text},
        )
    return {"result": text, "sources": sources}


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


@app.post("/api/dosyalar/{dosya_id}/vekaletname")
async def create_vekaletname(
    dosya_id: str,
    veren_tarih: Optional[str] = Form(None),
    gecerlilik_tarihi: Optional[str] = Form(None),
    ozel_yetkiler: Optional[str] = Form(None),
    notlar: Optional[str] = Form(None),
    dosya: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user),
):
    await get_owned_dosya(dosya_id, user["id"])
    storage_path = None
    ai_fields = {}
    if dosya is not None and dosya.filename:
        data = await dosya.read()
        try:
            path = f"vekaletname/{dosya_id}/{uuid.uuid4()}-{dosya.filename}"
            storage_path = await db.upload_file(STORAGE_BUCKET, path, data, dosya.content_type)
        except Exception:
            pass

        # Metin katmani var mi kontrol et (pypdf); yoksa (taranmis/goruntu tabanli
        # belge) Gemini'nin coklu-mod anlama ozelligiyle OCR + alan cikarimi yap.
        content_type = (dosya.content_type or "").lower()
        name_lower = dosya.filename.lower()
        extracted_text = ""
        if name_lower.endswith(".pdf") or content_type == "application/pdf":
            try:
                extracted_text = extract_pdf_text(data)
            except Exception:
                extracted_text = ""

        is_image = content_type.startswith("image/")
        is_scanned_pdf = (name_lower.endswith(".pdf") or content_type == "application/pdf") and len(extracted_text.strip()) < 50
        if is_image or is_scanned_pdf:
            mime = content_type or "application/pdf"
            try:
                raw = await call_gemini_vision(
                    VEKALETNAME_OCR_SYSTEM,
                    "Bu vekaletname belgesini incele ve istenen alanlari JSON olarak dondur.",
                    data,
                    mime,
                )
                cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
                ai_fields = json.loads(cleaned)
            except Exception:
                ai_fields = {}

    row = {
        "kullanici_id": user["id"],
        "dosya_id": dosya_id,
        "veren_tarih": veren_tarih or ai_fields.get("veren_tarih") or None,
        "gecerlilik_tarihi": gecerlilik_tarihi or None,
        "ozel_yetkiler": ozel_yetkiler or ai_fields.get("ozel_yetkiler") or None,
        "notlar": notlar or ai_fields.get("ozet") or None,
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


@app.post("/api/icra")
async def create_icra(
    borclu_adi: str = Form(...),
    alacakli_adi: str = Form(...),
    takip_no: Optional[str] = Form(None),
    icra_dairesi: Optional[str] = Form(None),
    takip_tutari: Optional[float] = Form(None),
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
        "takip_tutari": takip_tutari,
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
    takip_tutari: Optional[float] = Form(None),
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
            "takip_tutari": takip_tutari,
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
    tutar: Optional[float] = Form(None),
    user: dict = Depends(get_current_user),
):
    await get_owned_icra(icra_id, user["id"])
    row = {
        "icra_id": icra_id,
        "tarih": tarih,
        "tur": tur,
        "aciklama": aciklama or None,
        "tutar": tutar,
    }
    return await db.insert("icra_adimlari", row)


@app.post("/api/convert/to-pdf")
async def convert_file_to_pdf(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    data = await file.read()
    try:
        metin = extract_text_for(file.filename, data)
    except Exception as e:
        raise HTTPException(400, str(e))
    pdf_bytes = generate_pdf_bytes(file.filename, metin)
    filename = re.sub(r"\.(pdf|udf)$", "", file.filename, flags=re.IGNORECASE) + ".pdf"
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


@app.get("/api/mevzuat")
async def search_mevzuat(q: str = "", user: dict = Depends(get_current_user)):
    if not q.strip():
        return {"result": "", "sources": []}

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


# Frontend'i (static/) ayni servisten sun -> ayri bir hosting'e / CORS ayarina gerek kalmaz
app.mount("/", StaticFiles(directory="static", html=True), name="static")
