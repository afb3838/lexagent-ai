import os
import io
import re
import uuid
import zipfile
from typing import List, Optional

import httpx
from fastapi import Depends, FastAPI, Form, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pypdf

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
    dosya_id: str = Form(...),
    case_subject: str = Form(...),
    court_type: str = Form(...),
    party_role: str = Form(...),
    case_details: str = Form(...),
    instruction: str = Form(""),
    user: dict = Depends(get_current_user),
):
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
    await db.insert(
        "belgeler",
        {"dosya_id": dosya_id, "ad": "Emsal Arastirma Sonucu", "tur": "arastirma", "metin": text},
    )
    return {"result": text, "sources": sources}


@app.post("/api/draft")
async def draft(
    dosya_id: str = Form(...),
    case_subject: str = Form(...),
    court_type: str = Form(...),
    party_role: str = Form(...),
    case_details: str = Form(...),
    instruction: str = Form(""),
    precedents: str = Form(""),
    user: dict = Depends(get_current_user),
):
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
    await db.insert(
        "belgeler",
        {"dosya_id": dosya_id, "ad": "Dilekce Taslagi", "tur": "dilekce", "metin": text},
    )
    return {"petition": text}


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
