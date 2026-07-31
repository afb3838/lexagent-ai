import os
import io
import re
import zipfile
from typing import List

import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import pypdf

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
# Guncel, uretime uygun model adi (Temmuz 2026 itibariyla). Eger ileride
# bu model de kullanimdan kaldirilirsa, Google AI Studio > Models sayfasindan
# guncel adi kontrol edip burada degistirin.
MODEL_NAME = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

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


@app.post("/api/parse")
async def parse_files(files: List[UploadFile] = File(...)):
    results = []
    for f in files:
        data = await f.read()
        name_lower = (f.filename or "").lower()
        try:
            if name_lower.endswith(".pdf"):
                text = extract_pdf_text(data)
            elif name_lower.endswith(".udf"):
                text = extract_udf_text(data)
            else:
                results.append({"name": f.filename, "text": "", "error": "Desteklenmeyen dosya turu"})
                continue
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


@app.post("/api/research")
async def research(
    case_subject: str = Form(...),
    court_type: str = Form(...),
    party_role: str = Form(...),
    case_details: str = Form(...),
    instruction: str = Form(""),
):
    user_prompt = f"""Mahkeme Turu: {court_type}
Taraf Rolu: {party_role}
Dava Konusu: {case_subject}
Kullanici Talimati: {instruction}

Olay / Evrak Ozeti:
{case_details}

Bu uyusmazlikla dogrudan ilgili, gercek ve dogrulanabilir emsal kararlari ara ve listele.
Uygulanacak kanun maddelerini de belirt."""

    text, sources = await call_gemini(RESEARCH_SYSTEM, user_prompt, use_search=True)
    return {"result": text, "sources": sources}


@app.post("/api/draft")
async def draft(
    case_subject: str = Form(...),
    court_type: str = Form(...),
    party_role: str = Form(...),
    case_details: str = Form(...),
    instruction: str = Form(""),
    precedents: str = Form(""),
):
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
    return {"petition": text}


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME, "api_key_configured": bool(GEMINI_API_KEY)}


# Frontend'i (static/) ayni servisten sun -> ayri bir hosting'e / CORS ayarina gerek kalmaz
app.mount("/", StaticFiles(directory="static", html=True), name="static")
