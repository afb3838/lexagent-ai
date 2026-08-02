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

async function authedFetch(url, options = {}) {
  const token = await getAccessToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers["Authorization"] = "Bearer " + token;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || (res.status + " " + res.statusText));
  }
  return res;
}

function toFormData(fields) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v ?? ""));
  return fd;
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
};
