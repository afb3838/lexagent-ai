// Faz 0 kurulumundan sonra bu iki degeri kendi Supabase projenizin bilgileriyle
// degistirin (Supabase Dashboard > Settings > API). anon key public bir anahtardir,
// tarayicida bulunmasi guvenlidir (GEMINI_API_KEY ile karistirmayin, o asla buraya gelmez).
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

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
  async research(fields) {
    const res = await authedFetch("/api/research", { method: "POST", body: toFormData(fields) });
    return res.json();
  },
  async draft(fields) {
    const res = await authedFetch("/api/draft", { method: "POST", body: toFormData(fields) });
    return res.json();
  },
};
