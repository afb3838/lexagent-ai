// Faz 0 kurulumundan sonra bu iki degeri kendi Supabase projenizin bilgileriyle
// degistirin (Supabase Dashboard > Settings > API). anon key public bir anahtardir,
// tarayicida bulunmasi guvenlidir (GEMINI_API_KEY ile karistirmayin, o asla buraya gelmez).
const SUPABASE_URL = "https://uwoupkvyibfhnrtqzpje.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ux_CMhpj43aLgAVHhYqIDw_HPT5nxln";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getAccessToken() {
  const { data } = await supabaseClient.auth.getSession();
  return data.session ? data.session.access_token : null;
}

// FastAPI hatalari genelde {"detail": "..."} govdesiyle doner; kullaniciya ham
// JSON/teknik metin yerine sadece o okunabilir mesaji gostermek icin ayiklar.
function extractErrorMessage(rawText, fallback) {
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed.detail === "string") return parsed.detail;
    if (Array.isArray(parsed?.detail) && parsed.detail[0]?.msg) return parsed.detail[0].msg;
  } catch (e) {
    // JSON degil, ham metni kullan
  }
  return rawText || fallback;
}

async function authedFetch(url, options = {}) {
  const token = await getAccessToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(extractErrorMessage(text, res.status + " " + res.statusText));
  }
  return res;
}

function toFormData(fields) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v ?? ""));
  return fd;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Gunluk arama limiti bir hata degil, bilincli bir kullanim kurali oldugu icin
// diger (gercek) hatalardan ayirt edip nazik bir bilgi kutusu olarak gosteririz.
function isGunlukLimitMesaji(msg) {
  return typeof msg === "string" && msg.includes("Günlük araştırma hakkınızı doldurdunuz");
}

// Gemini servisinin gecici olarak kullanilamadigi (kota/faturalandirma/5xx) durum -
// kullaniciya "kirik" degil, gecici bir bakim/yogunluk mesaji gibi gosterilir.
function isGeciciKullanilamiyorMesaji(msg) {
  return typeof msg === "string" && msg.includes("şu anda geçici olarak kullanılamıyor");
}

function bilgiKutusuHtml(msg) {
  return (
    '<div class="bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl p-4 text-sm flex items-start gap-2">' +
    '<i class="fa-solid fa-circle-info mt-0.5"></i><span>' +
    escapeHtml(msg) +
    "</span></div>"
  );
}

function uyariKutusuHtml(msg) {
  return (
    '<div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm flex items-start gap-2">' +
    '<i class="fa-solid fa-clock-rotate-left mt-0.5"></i><span>' +
    escapeHtml(msg) +
    "</span></div>"
  );
}

// Hem gunluk limit hem gecici-kullanilamama mesajlarini "hata degil, bilgi" olarak
// gosteren ortak karar fonksiyonu - cagiran kod tek bir if/else yazsin yeter.
function yumusakMesajKutusu(msg) {
  if (isGunlukLimitMesaji(msg)) return bilgiKutusuHtml(msg);
  if (isGeciciKullanilamiyorMesaji(msg)) return uyariKutusuHtml(msg);
  return null;
}

// Emsal Arastirma ve Mevzuat modullerinin ikisinde de kullanilan ortak sonuc
// gorunumu: kaynak linklerini chip olarak, metni okunakli paragraf kartlarina
// bolerek gosterir; sonuc yoksa net bir "bulunamadi" karti gosterir (bos/kirik
// gorunmesin diye).
function renderKaynakliSonuc(sourcesElId, textElId, resultText, sources, noResultText, unverifiedKunyeler) {
  const sourcesBox = document.getElementById(sourcesElId);
  const textBox = document.getElementById(textElId);
  const trimmed = (resultText || "").trim();

  if (!trimmed) {
    sourcesBox.innerHTML = "";
    textBox.innerHTML = `
      <div class="text-center py-10 text-slate-400">
        <i class="fa-solid fa-circle-info text-2xl mb-2"></i>
        <p class="text-sm">${escapeHtml(noResultText || "Bu konuda doğrulanmış bir sonuç bulunamadı.")}</p>
      </div>`;
    return;
  }

  sourcesBox.innerHTML = (sources || []).length
    ? sources
        .map(
          (s) =>
            `<a href="${escapeHtml(s.uri)}" target="_blank" class="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 px-2.5 py-1.5 rounded-md border border-slate-200 inline-flex items-center gap-1"><i class="fa-solid fa-link"></i>${escapeHtml(s.title.substring(0, 50))}</a>`
        )
        .join("")
    : `<p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 inline-block"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Kaynak bağlantısı dönmedi — sonucu ayrıca doğrulayın.</p>`;

  const unverified = unverifiedKunyeler || [];
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim());
  textBox.innerHTML = paragraphs.length
    ? paragraphs
        .map((p) => {
          const metin = p.trim();
          const supheli = unverified.some((k) => metin.includes(k));
          const kutuStil = supheli
            ? "border-rose-300 bg-rose-50/70"
            : "border-slate-100 bg-slate-50/60";
          const rozet = supheli
            ? '<span class="block text-[11px] font-semibold text-rose-600 mb-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Kaynağı doğrulanamadı — resmi kaynaktan teyit edin</span>'
            : "";
          return `<div class="border ${kutuStil} rounded-lg p-3.5 whitespace-pre-wrap">${rozet}${escapeHtml(metin)}</div>`;
        })
        .join("")
    : `<div class="whitespace-pre-wrap">${escapeHtml(trimmed)}</div>`;
}

// Dosyalari tek tek yukleyip her biri icin ayri bir ilerleme cubugu gosterir.
// uploadOne(file) her dosya icin cagrilir; basarili sonucu dondurur ya da hata firlatir.
async function runUploadQueue(files, containerId, uploadOne) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const items = Array.from(files).map((file, i) => {
    const id = `upload-item-${Date.now()}-${i}`;
    container.insertAdjacentHTML(
      "beforeend",
      `<div id="${id}" class="border border-slate-200 rounded-lg p-3 text-xs space-y-1.5">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate"><i class="fa-solid fa-file-lines text-indigo-600 mr-1"></i>${file.name}</span>
          <span class="upload-status text-slate-400 whitespace-nowrap">Bekliyor...</span>
        </div>
        <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div class="upload-bar h-full bg-indigo-500 rounded-full" style="width:0%"></div>
        </div>
      </div>`
    );
    return { file, el: document.getElementById(id) };
  });

  const results = [];
  for (const { file, el } of items) {
    const statusEl = el.querySelector(".upload-status");
    const barEl = el.querySelector(".upload-bar");
    statusEl.textContent = "Yükleniyor...";
    statusEl.className = "upload-status text-indigo-600 whitespace-nowrap";
    barEl.className = "upload-bar h-full bg-indigo-500 rounded-full upload-bar-indeterminate";
    try {
      const result = await uploadOne(file);
      statusEl.textContent = "Tamamlandı";
      statusEl.className = "upload-status text-emerald-600 whitespace-nowrap";
      barEl.className = "upload-bar h-full bg-emerald-500 rounded-full";
      barEl.style.width = "100%";
      results.push({ file, result, error: null });
    } catch (err) {
      statusEl.textContent = "Hata";
      statusEl.className = "upload-status text-rose-600 whitespace-nowrap";
      barEl.className = "upload-bar h-full bg-rose-500 rounded-full";
      barEl.style.width = "100%";
      results.push({ file, result: null, error: err.message });
    }
  }
  return results;
}

async function downloadBlobResponse(res, fallbackName) {
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : fallbackName;
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

async function downloadTextAsPdf(baslik, metin) {
  const res = await authedFetch("/api/convert/text-to-pdf", { method: "POST", body: toFormData({ baslik, metin }) });
  await downloadBlobResponse(res, "belge.pdf");
}

async function downloadFileAsPdf(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await authedFetch("/api/convert/to-pdf", { method: "POST", body: fd });
  await downloadBlobResponse(res, "belge.pdf");
}

const api = {
  async health() {
    const res = await fetch("/api/health");
    return res.json();
  },
  async listDosyalar() {
    const res = await authedFetch("/api/dosyalar");
    return (await res.json()).dosyalar;
  },
  async createDosya(fields) {
    const res = await authedFetch("/api/dosyalar", { method: "POST", body: toFormData(fields) });
    return res.json();
  },
  async getDosya(id) {
    const res = await authedFetch(`/api/dosyalar/${id}`);
    return res.json();
  },
  async patchDosya(id, fields) {
    const res = await authedFetch(`/api/dosyalar/${id}`, { method: "PATCH", body: toFormData(fields) });
    return res.json();
  },
  async uploadBelgeler(dosyaId, files, tur = "diger") {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    fd.append("tur", tur);
    const res = await authedFetch(`/api/dosyalar/${dosyaId}/belgeler`, { method: "POST", body: fd });
    return res.json();
  },
  async parseFiles(files) {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    const res = await authedFetch("/api/parse", { method: "POST", body: fd });
    return (await res.json()).documents;
  },
  async research(fields) {
    const res = await authedFetch("/api/research", { method: "POST", body: toFormData(fields) });
    return res.json();
  },
  async draft(fields) {
    const res = await authedFetch("/api/draft", { method: "POST", body: toFormData(fields) });
    return res.json();
  },
  async listEtkinlikler() {
    const res = await authedFetch("/api/etkinlikler");
    return (await res.json()).etkinlikler;
  },
  async listDosyaEtkinlikleri(dosyaId) {
    const res = await authedFetch(`/api/dosyalar/${dosyaId}/etkinlikler`);
    return (await res.json()).etkinlikler;
  },
  async createEtkinlik(fields) {
    const res = await authedFetch("/api/etkinlikler", { method: "POST", body: toFormData(fields) });
    return res.json();
  },
  async patchEtkinlik(id, fields) {
    const res = await authedFetch(`/api/etkinlikler/${id}`, { method: "PATCH", body: toFormData(fields) });
    return res.json();
  },
  async createVekaletname(dosyaId, fields, file) {
    const fd = toFormData(fields);
    if (file) fd.append("dosya", file);
    const res = await authedFetch(`/api/dosyalar/${dosyaId}/vekaletname`, { method: "POST", body: fd });
    return res.json();
  },
  async vekaletnameOku(file) {
    const fd = new FormData();
    fd.append("dosya", file);
    const res = await authedFetch("/api/vekaletname-oku", { method: "POST", body: fd });
    return res.json();
  },
  async listDosyaVekaletname(dosyaId) {
    const res = await authedFetch(`/api/dosyalar/${dosyaId}/vekaletname`);
    return (await res.json()).vekaletnameler;
  },
  async listVekaletnameler() {
    const res = await authedFetch("/api/vekaletnameler");
    return (await res.json()).vekaletnameler;
  },
  async createCariHesapKaydi(dosyaId, fields) {
    const res = await authedFetch(`/api/dosyalar/${dosyaId}/cari-hesap`, { method: "POST", body: toFormData(fields) });
    return res.json();
  },
  async listDosyaCariHesap(dosyaId) {
    const res = await authedFetch(`/api/dosyalar/${dosyaId}/cari-hesap`);
    return (await res.json()).kayitlar;
  },
  async listCariHesap() {
    const res = await authedFetch("/api/cari-hesap");
    return (await res.json()).kayitlar;
  },
  async listIcra() {
    const res = await authedFetch("/api/icra");
    return (await res.json()).icra_dosyalari;
  },
  async createIcra(fields) {
    const res = await authedFetch("/api/icra", { method: "POST", body: toFormData(fields) });
    return res.json();
  },
  async getIcra(id) {
    const res = await authedFetch(`/api/icra/${id}`);
    return res.json();
  },
  async patchIcra(id, fields) {
    const res = await authedFetch(`/api/icra/${id}`, { method: "PATCH", body: toFormData(fields) });
    return res.json();
  },
  async createIcraAdim(id, fields) {
    const res = await authedFetch(`/api/icra/${id}/adimlar`, { method: "POST", body: toFormData(fields) });
    return res.json();
  },
  async searchMevzuat(q) {
    const res = await authedFetch(`/api/mevzuat?q=${encodeURIComponent(q || "")}`);
    return res.json();
  },
  async createPaylasimLinki(dosyaId) {
    const res = await authedFetch(`/api/dosyalar/${dosyaId}/paylasim-linki`, { method: "POST" });
    return res.json();
  },
  async belgeAnalizi(metin) {
    const res = await authedFetch("/api/belge-analizi", { method: "POST", body: toFormData({ metin }) });
    return res.json();
  },
  async dogrulaArastirma(metin) {
    const res = await authedFetch("/api/research/dogrula", { method: "POST", body: toFormData({ metin }) });
    return res.json();
  },
  async getProfil() {
    const res = await authedFetch("/api/profil");
    return res.json();
  },
  async planTalebi(fields) {
    const res = await authedFetch("/api/plan-talebi", { method: "POST", body: toFormData(fields) });
    return res.json();
  },
  async listMusteriler() {
    const res = await authedFetch("/api/musteriler");
    return (await res.json()).musteriler;
  },
  async createMusteri(fields) {
    const res = await authedFetch("/api/musteriler", { method: "POST", body: toFormData(fields) });
    return res.json();
  },
  async getMusteri(id) {
    const res = await authedFetch(`/api/musteriler/${id}`);
    return res.json();
  },
  async patchMusteri(id, fields) {
    const res = await authedFetch(`/api/musteriler/${id}`, { method: "PATCH", body: toFormData(fields) });
    return res.json();
  },
  async createZamanKaydi(dosyaId, fields) {
    const res = await authedFetch(`/api/dosyalar/${dosyaId}/zaman`, { method: "POST", body: toFormData(fields) });
    return res.json();
  },
  async listZamanKayitlari(dosyaId) {
    const res = await authedFetch(`/api/dosyalar/${dosyaId}/zaman`);
    return (await res.json()).kayitlar;
  },
  async createFatura(dosyaId, fields) {
    const res = await authedFetch(`/api/dosyalar/${dosyaId}/fatura`, { method: "POST", body: toFormData(fields) });
    return res.json();
  },
  async listFaturalar(dosyaId) {
    const res = await authedFetch(`/api/dosyalar/${dosyaId}/faturalar`);
    return (await res.json()).faturalar;
  },
  async faturaPdfIndir(faturaId, faturaNo) {
    const res = await authedFetch(`/api/faturalar/${faturaId}/pdf`);
    await downloadBlobResponse(res, `fatura-${faturaNo}.pdf`);
  },
};

// Kaynaksiz, sade metin sonuclarini (belge risk analizi gibi) paragraf
// kartlarina bolerek gosterir - renderKaynakliSonuc'un kaynak-chip kismi
// olmayan sadelestirilmis hali.
function renderMetinKartlari(elId, text) {
  const box = document.getElementById(elId);
  const trimmed = (text || "").trim();
  if (!trimmed) {
    box.innerHTML = '<p class="text-sm text-slate-400">Sonuç alınamadı.</p>';
    return;
  }
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim());
  box.innerHTML = paragraphs.length
    ? paragraphs
        .map((p) => `<div class="border border-slate-100 rounded-lg p-3.5 bg-slate-50/60 whitespace-pre-wrap">${escapeHtml(p.trim())}</div>`)
        .join("")
    : `<div class="whitespace-pre-wrap">${escapeHtml(trimmed)}</div>`;
}
