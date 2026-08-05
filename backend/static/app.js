const DURUM_LABELS = {
  acildi: "Açıldı",
  bilirkisi_bekleniyor: "Bilirkişi Bekleniyor",
  durusma_bekleniyor: "Duruşma Bekleniyor",
  karar_cikti: "Karar Çıktı",
  temyiz: "Temyiz",
  kesinlesti: "Kesinleşti",
};

const BELGE_TUR_LABELS = {
  dilekce: "Dilekçe",
  karar: "Karar",
  delil: "Delil",
  arastirma: "Emsal Araştırma",
  diger: "Diğer",
};

const PAGE_TITLES = {
  dosyalar: "Dosyalarım",
  musteriler: "Müvekkiller",
  "emsal-arastirma": "Emsal Araştırma",
  ajanda: "Ajanda",
  vekaletnameler: "Vekaletnameler",
  "cari-hesap": "Cari Hesap",
  "icra-takip": "İcra Takip",
  mevzuat: "Mevzuat",
  "hesaplama-araclari": "Hesaplama Araçları",
  sablonlar: "Hazır Şablonlar",
  barolar: "Barolar Rehberi",
};

const PLAN_LABELS_JS = {
  deneme: "Deneme",
  baslangic: "Başlangıç",
  profesyonel: "Profesyonel",
  kurumsal: "Kurumsal",
};

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => t.classList.add("translate-y-20", "opacity-0"), 3000);
}

// ---------------------------------------------------------------------------
// Public landing sayfasi yardimcilari
// ---------------------------------------------------------------------------
function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showAuthTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("auth-form-login").classList.toggle("hidden", !isLogin);
  document.getElementById("auth-form-signup").classList.toggle("hidden", isLogin);
  document.getElementById("auth-tab-login").className =
    "flex-1 py-2 rounded-md " + (isLogin ? "bg-white shadow-sm font-semibold text-slate-800" : "text-slate-500");
  document.getElementById("auth-tab-signup").className =
    "flex-1 py-2 rounded-md " + (!isLogin ? "bg-white shadow-sm font-semibold text-slate-800" : "text-slate-500");
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errBox = document.getElementById("login-error");
  errBox.classList.add("hidden");
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    errBox.textContent = "Giriş başarısız: " + error.message;
    errBox.classList.remove("hidden");
  }
}

async function handleSignup() {
  const ad_soyad = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const errBox = document.getElementById("signup-error");
  const okBox = document.getElementById("signup-success");
  errBox.classList.add("hidden");
  okBox.classList.add("hidden");
  if (!email || !password) {
    errBox.textContent = "E-posta ve şifre zorunlu.";
    errBox.classList.remove("hidden");
    return;
  }
  if (password.length < 6) {
    errBox.textContent = "Şifre en az 6 karakter olmalı.";
    errBox.classList.remove("hidden");
    return;
  }
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { ad_soyad } },
  });
  if (error) {
    errBox.textContent = "Kayıt başarısız: " + error.message;
    errBox.classList.remove("hidden");
    return;
  }
  if (!data.session) {
    okBox.textContent = "Kayıt başarılı! E-postanıza gelen bağlantıyla hesabınızı onaylayıp giriş yapabilirsiniz.";
    okBox.classList.remove("hidden");
  }
  // data.session doluysa onAuthStateChange zaten onSignedIn'i tetikler.
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
}

async function onSignedIn(session) {
  document.getElementById("view-public").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");
  document.getElementById("app-shell").classList.add("flex");
  document.getElementById("user-email").textContent = session.user.email;
  document.getElementById("user-email").classList.remove("hidden");
  document.getElementById("logout-btn").classList.remove("hidden");
  loadPlanBadge();
  if (!location.hash) location.hash = "#/dosyalar";
  else await router();
}

function onSignedOut() {
  document.getElementById("app-shell").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("flex");
  document.getElementById("view-public").classList.remove("hidden");
  document.getElementById("plan-badge").classList.add("hidden");
  showAuthTab("login");
}

// ---------------------------------------------------------------------------
// Abonelik plani
// ---------------------------------------------------------------------------
let selectedPlanForModal = "profesyonel";

async function loadPlanBadge() {
  const badge = document.getElementById("plan-badge");
  try {
    const profil = await api.getProfil();
    let text = profil.plan_etiketi || "Deneme";
    if (profil.plan === "deneme" && profil.deneme_bitis) {
      const kalanGun = Math.max(0, Math.ceil((new Date(profil.deneme_bitis) - new Date()) / 86400000));
      text += ` · ${kalanGun} gün kaldı`;
    }
    document.getElementById("plan-badge-text").textContent = text;
    badge.classList.remove("hidden");
  } catch (err) {
    badge.classList.add("hidden");
  }
}

function openPlanModal(plan) {
  selectedPlanForModal = plan || "profesyonel";
  document.getElementById("plan-modal-plan-label").textContent = PLAN_LABELS_JS[selectedPlanForModal] || selectedPlanForModal;
  document.getElementById("plan-modal-error").classList.add("hidden");
  document.getElementById("plan-modal-telefon").value = "";
  document.getElementById("plan-modal-mesaj").value = "";
  const modal = document.getElementById("plan-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closePlanModal() {
  const modal = document.getElementById("plan-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

let planTalebiGonderiliyor = false;

async function submitPlanTalebi() {
  if (planTalebiGonderiliyor) return;
  const errBox = document.getElementById("plan-modal-error");
  errBox.classList.add("hidden");
  planTalebiGonderiliyor = true;
  try {
    await api.planTalebi({
      plan: selectedPlanForModal,
      ad_soyad: "",
      eposta: document.getElementById("user-email").textContent || "",
      telefon: document.getElementById("plan-modal-telefon").value.trim(),
      mesaj: document.getElementById("plan-modal-mesaj").value.trim(),
    });
    closePlanModal();
    showToast("Talebiniz alındı, en kısa sürede sizinle iletişime geçilecek.");
  } catch (err) {
    errBox.textContent = "Gönderilemedi: " + err.message;
    errBox.classList.remove("hidden");
  } finally {
    planTalebiGonderiliyor = false;
  }
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) onSignedIn(session);
  else onSignedOut();
});

// ---------------------------------------------------------------------------
// Mobil sidebar (kucuk ekranlarda hamburger menu)
// ---------------------------------------------------------------------------
function toggleMobileMenu() {
  document.getElementById("sidebar")?.classList.toggle("-translate-x-full");
  document.getElementById("sidebar-overlay")?.classList.toggle("hidden");
}

function closeMobileMenu() {
  document.getElementById("sidebar")?.classList.add("-translate-x-full");
  document.getElementById("sidebar-overlay")?.classList.add("hidden");
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const segments = raw.split("/").filter(Boolean);
  return { route: segments[0] || "dosyalar", param: segments[1] };
}

function showPage(pageId) {
  document.querySelectorAll("#page-content .page").forEach((el) => el.classList.add("hidden"));
  document.getElementById(pageId).classList.remove("hidden");
}

const NAV_BADGE_ROUTES = new Set();

function highlightNav(route) {
  document.querySelectorAll("#sidebar-nav .nav-link").forEach((el) => {
    const active = el.dataset.route === route;
    const layout = NAV_BADGE_ROUTES.has(el.dataset.route) ? "flex items-center justify-between" : "flex items-center";
    const color = active ? "bg-indigo-600 text-white font-semibold" : "text-slate-300 hover:bg-slate-800 hover:text-white";
    el.className = `nav-link ${layout} px-3 py-2 rounded-lg ${color}`;
  });
}

async function router() {
  const { route, param } = parseHash();
  closeMobileMenu();
  document.getElementById("page-title").textContent = PAGE_TITLES[route] || "";
  highlightNav(route);

  if (route === "dosyalar" && param) {
    showPage("page-dosya-detay");
    await openDosyaPage(param);
  } else if (route === "dosyalar") {
    showPage("page-dosyalar");
    await loadDosyaList();
  } else if (route === "musteriler" && param) {
    showPage("page-musteri-detay");
    await openMusteriPage(param);
  } else if (route === "musteriler") {
    showPage("page-musteriler");
    document.getElementById("new-musteri-form").classList.add("hidden");
    await loadMusterilerPage();
  } else if (route === "emsal-arastirma") {
    showPage("page-emsal-arastirma");
    mountWizard("wizard-mount-standalone", null);
  } else if (route === "ajanda") {
    showPage("page-ajanda");
    await loadAjandaPage();
  } else if (route === "vekaletnameler") {
    showPage("page-vekaletnameler");
    await loadVekaletnamelerPage();
  } else if (route === "cari-hesap") {
    showPage("page-cari-hesap");
    initAautMahkemeSelect();
    document.getElementById("aaut-sonuc").classList.add("hidden");
    document.getElementById("aaut-deger").value = "";
    document.getElementById("aaut-para-olcumu").value = "olmayan";
    document.getElementById("aaut-ozel-durum").value = "yok";
    toggleAautDeger();
    await loadCariHesapPage();
  } else if (route === "icra-takip" && param) {
    showPage("page-icra-detay");
    await openIcraPage(param);
  } else if (route === "icra-takip") {
    showPage("page-icra-takip");
    await loadIcraListPage();
  } else if (route === "mevzuat") {
    showPage("page-mevzuat");
    await loadMevzuatPage();
  } else if (route === "hesaplama-araclari") {
    showPage("page-hesaplama");
    ["sure-sonuc", "etebligat-sonuc", "faiz-sonuc", "icra-sonuc", "arab-sonuc"].forEach((id) =>
      document.getElementById(id).classList.add("hidden")
    );
    toggleIcraAlanlari();
  } else if (route === "sablonlar" && param) {
    showPage("page-sablon-detay");
    openSablonPage(param);
  } else if (route === "sablonlar") {
    showPage("page-sablonlar");
    loadSablonlarPage();
  } else if (route === "barolar") {
    showPage("page-barolar");
    document.getElementById("baro-filtre").value = "";
    filtreleBaroListesi();
  } else {
    location.hash = "#/dosyalar";
  }
}

window.addEventListener("hashchange", router);

// ---------------------------------------------------------------------------
// Dosyalar (dashboard)
// ---------------------------------------------------------------------------
async function loadDosyaList() {
  closeNewDosyaForm();
  try {
    const dosyalar = await api.listDosyalar();
    renderDosyaList(dosyalar);
    renderOzetPanel(dosyalar);
  } catch (err) {
    showToast("Dosyalar yüklenemedi: " + err.message);
  }
}

async function renderOzetPanel(dosyalar) {
  const acikDurumlar = new Set(["acildi", "bilirkisi_bekleniyor", "durusma_bekleniyor"]);
  const acikSayisi = dosyalar.filter((d) => acikDurumlar.has(d.durum)).length;

  let yaklasanDurusma = 0;
  let bekleyenBakiye = 0;
  try {
    const [etkinlikler, kayitlar] = await Promise.all([api.listEtkinlikler(), api.listCariHesap()]);
    const bugun = todayStr();
    const yediGunSonra = new Date();
    yediGunSonra.setDate(yediGunSonra.getDate() + 7);
    const yediGunSonraStr = toDateStr(yediGunSonra);
    yaklasanDurusma = etkinlikler.filter(
      (e) => e.tur === "durusma" && e.tarih >= bugun && e.tarih <= yediGunSonraStr
    ).length;
    const { bakiye } = hesaplaBakiye(kayitlar);
    bekleyenBakiye = bakiye;
  } catch (err) {
    // ozet panel ikincil bilgidir, hata durumunda sessizce eksik gosterilir
  }

  const kartlar = [
    { ikon: "fa-folder-open", etiket: "Açık Dosya", deger: String(acikSayisi), renk: "text-indigo-600 bg-indigo-50" },
    { ikon: "fa-gavel", etiket: "7 Gün İçinde Duruşma", deger: String(yaklasanDurusma), renk: "text-amber-600 bg-amber-50" },
    { ikon: "fa-coins", etiket: "Bekleyen Tahsilat", deger: formatTL(bekleyenBakiye), renk: "text-rose-600 bg-rose-50" },
    { ikon: "fa-address-book", etiket: "Toplam Dosya", deger: String(dosyalar.length), renk: "text-slate-600 bg-slate-100" },
  ];
  document.getElementById("ozet-panel").innerHTML = kartlar
    .map(
      (k) => `
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg ${k.renk} flex items-center justify-center shrink-0"><i class="fa-solid ${k.ikon}"></i></div>
      <div>
        <p class="text-lg font-bold leading-tight">${k.deger}</p>
        <p class="text-xs text-slate-500">${k.etiket}</p>
      </div>
    </div>`
    )
    .join("");
}

function renderDosyaList(dosyalar) {
  const box = document.getElementById("dosya-list");
  if (!dosyalar.length) {
    box.innerHTML = '<p class="text-sm text-slate-400">Henüz dosya yok. "Yeni Dosya" ile başlayın.</p>';
    return;
  }
  box.innerHTML = dosyalar
    .map(
      (d) => `
    <div onclick="location.hash = '#/dosyalar/${d.id}'" class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between cursor-pointer hover:border-indigo-400">
      <div>
        <p class="font-semibold">${d.muvekkil_adi}${d.karsi_taraf ? " vs. " + d.karsi_taraf : ""}</p>
        <p class="text-xs text-slate-500">${d.dava_turu || ""} ${d.esas_no ? "· Esas No: " + d.esas_no : ""}</p>
      </div>
      <span class="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">${DURUM_LABELS[d.durum] || d.durum}</span>
    </div>`
    )
    .join("");
}

function openNewDosyaForm() {
  document.getElementById("new-dosya-form").classList.remove("hidden");
  populateMusteriSelect();
}

function closeNewDosyaForm() {
  document.getElementById("new-dosya-form").classList.add("hidden");
  ["new-muvekkil", "new-karsi-taraf", "new-mahkeme", "new-esas-no", "new-dava-turu", "new-acilis-tarihi"].forEach(
    (id) => (document.getElementById(id).value = "")
  );
  document.getElementById("new-dosya-musteri").value = "";
}

async function celiskiKontrolu(muvekkil_adi, karsi_taraf) {
  if (!karsi_taraf) return true;
  let mevcutDosyalar = [];
  try {
    mevcutDosyalar = await api.listDosyalar();
  } catch (err) {
    return true; // kontrol edilemiyorsa engelleme
  }
  const a = muvekkil_adi.trim().toLowerCase();
  const b = karsi_taraf.trim().toLowerCase();
  const carpisan = mevcutDosyalar.find(
    (d) => (d.muvekkil_adi || "").trim().toLowerCase() === b || (d.karsi_taraf || "").trim().toLowerCase() === a
  );
  if (!carpisan) return true;
  return confirm(
    `⚠️ Çelişki uyarısı: "${carpisan.muvekkil_adi}${carpisan.karsi_taraf ? " vs. " + carpisan.karsi_taraf : ""}" dosyasıyla isim çakışması var (aynı kişi başka bir dosyada müvekkil/karşı taraf olarak görünüyor). Yine de devam etmek istiyor musunuz?`
  );
}

let dosyaGonderiliyor = false;

async function submitNewDosya() {
  if (dosyaGonderiliyor) return;
  const muvekkil_adi = document.getElementById("new-muvekkil").value.trim();
  const karsi_taraf = document.getElementById("new-karsi-taraf").value.trim();
  if (!muvekkil_adi) {
    showToast("Müvekkil adı zorunlu.");
    return;
  }
  if (!(await celiskiKontrolu(muvekkil_adi, karsi_taraf))) return;
  dosyaGonderiliyor = true;
  try {
    const dosya = await api.createDosya({
      muvekkil_adi,
      karsi_taraf,
      musteri_id: document.getElementById("new-dosya-musteri").value,
      mahkeme: document.getElementById("new-mahkeme").value.trim(),
      esas_no: document.getElementById("new-esas-no").value.trim(),
      dava_turu: document.getElementById("new-dava-turu").value.trim(),
      acilis_tarihi: document.getElementById("new-acilis-tarihi").value,
    });
    location.hash = "#/dosyalar/" + dosya.id;
  } catch (err) {
    showToast("Dosya oluşturulamadı: " + err.message);
  } finally {
    dosyaGonderiliyor = false;
  }
}

// ---------------------------------------------------------------------------
// Dosya detayi
// ---------------------------------------------------------------------------
async function openDosyaPage(id) {
  if (currentDosyaId !== id) {
    mountWizard("wizard-mount-dosya", id);
    document.getElementById("belge-upload-progress").innerHTML = "";
    document.getElementById("vekaletname-form").classList.add("hidden");
    document.getElementById("cari-hesap-form").classList.add("hidden");
    document.getElementById("zaman-form").classList.add("hidden");
    document.getElementById("fatura-form").classList.add("hidden");
    document.getElementById("paylasim-link-box").classList.add("hidden");
    document.getElementById("belge-analiz-sonuc").classList.add("hidden");
  }
  await refreshDosyaInfo(id);
}

async function refreshDosyaInfo(id) {
  try {
    const dosya = await api.getDosya(id);
    renderDosya(dosya);
  } catch (err) {
    showToast("Dosya yüklenemedi: " + err.message);
  }
}

function renderDosya(dosya) {
  document.getElementById("page-title").textContent =
    dosya.muvekkil_adi + (dosya.karsi_taraf ? " vs. " + dosya.karsi_taraf : "");
  document.getElementById("dosya-title").textContent =
    dosya.muvekkil_adi + (dosya.karsi_taraf ? " vs. " + dosya.karsi_taraf : "");
  document.getElementById("dosya-durum").value = dosya.durum;
  document.getElementById("dosya-meta").innerHTML = `
    <span><i class="fa-solid fa-gavel mr-1"></i>${dosya.mahkeme || "-"}</span>
    <span><i class="fa-solid fa-hashtag mr-1"></i>${dosya.esas_no || "-"}</span>
    <span><i class="fa-solid fa-scale-balanced mr-1"></i>${dosya.dava_turu || "-"}</span>
    <span><i class="fa-solid fa-calendar mr-1"></i>${dosya.acilis_tarihi || "-"}</span>
  `;
  const ozetBox = document.getElementById("dosya-ozet");
  if (dosya.son_durum_ozeti) {
    ozetBox.classList.remove("hidden");
    document.getElementById("dosya-ozet-text").textContent = dosya.son_durum_ozeti;
  } else {
    ozetBox.classList.add("hidden");
  }
  renderBelgeList(dosya.belgeler || []);
  if (!document.getElementById("caseSubject").value) {
    document.getElementById("caseSubject").value = dosya.dava_turu || "";
  }
  synthesizeCaseDetails(dosya.belgeler || []);
  loadDosyaEtkinlikleri(dosya.id);
  loadDosyaVekaletname(dosya.id);
  loadDosyaCariHesap(dosya.id);
  loadDosyaZaman(dosya.id);
  loadDosyaFaturalar(dosya.id);
}

async function updateDurum() {
  const durum = document.getElementById("dosya-durum").value;
  try {
    await api.patchDosya(currentDosyaId, { durum });
    showToast("Durum güncellendi.");
  } catch (err) {
    showToast("Güncellenemedi: " + err.message);
  }
}

async function olusturPaylasimLinki() {
  try {
    const { token } = await api.createPaylasimLinki(currentDosyaId);
    const link = `${location.origin}/musteri.html?token=${token}`;
    document.getElementById("paylasim-link-input").value = link;
    document.getElementById("paylasim-link-box").classList.remove("hidden");
  } catch (err) {
    showToast("Link oluşturulamadı: " + err.message);
  }
}

function kopyalaPaylasimLinki() {
  const input = document.getElementById("paylasim-link-input");
  navigator.clipboard.writeText(input.value);
  showToast("Link panoya kopyalandı.");
}

let currentBelgeler = [];

function renderBelgeList(belgeler) {
  currentBelgeler = belgeler;
  const box = document.getElementById("belge-list");
  if (!belgeler.length) {
    box.innerHTML = '<p class="text-sm text-slate-400">Henüz belge yok.</p>';
    return;
  }
  box.innerHTML = belgeler
    .map(
      (b, i) => `
    <div class="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
      <span><i class="fa-solid fa-file-lines text-indigo-600 mr-1"></i>${b.ad}
        <span class="text-slate-400 ml-1">(${BELGE_TUR_LABELS[b.tur] || b.tur})</span>
        ${b.error ? ' <span class="text-rose-500">hata: ' + b.error + "</span>" : ""}
      </span>
      <span class="flex items-center gap-2">
        ${b.metin ? `<button onclick="analizEtBelge(${i})" class="text-slate-400 hover:text-indigo-600" title="Risk analizi"><i class="fa-solid fa-magnifying-glass-chart"></i></button>` : ""}
        ${b.metin ? `<button onclick="downloadBelgeAsPdf(${i})" class="text-slate-400 hover:text-indigo-600" title="PDF indir"><i class="fa-solid fa-file-pdf"></i></button>` : ""}
      </span>
    </div>`
    )
    .join("");
}

async function downloadBelgeAsPdf(i) {
  const belge = currentBelgeler[i];
  try {
    await downloadTextAsPdf(belge.ad, belge.metin);
  } catch (err) {
    showToast("PDF oluşturulamadı: " + err.message);
  }
}

async function analizEtBelge(i) {
  const belge = currentBelgeler[i];
  const box = document.getElementById("belge-analiz-sonuc");
  box.classList.remove("hidden");
  document.getElementById("belge-analiz-baslik").textContent = `Risk Analizi — ${belge.ad}`;
  renderMetinKartlari("belge-analiz-metin", '<i class="fa-solid fa-magnifying-glass-chart animate-pulse mr-1"></i>Analiz ediliyor, birkaç saniye sürebilir...');
  try {
    const data = await api.belgeAnalizi(belge.metin);
    renderMetinKartlari("belge-analiz-metin", data.analiz);
  } catch (err) {
    const yumusak = yumusakMesajKutusu(err.message);
    document.getElementById("belge-analiz-metin").innerHTML =
      yumusak || '<p class="text-sm text-rose-500">Analiz başarısız: ' + escapeHtml(err.message) + "</p>";
  }
}

function kapatBelgeAnalizi() {
  document.getElementById("belge-analiz-sonuc").classList.add("hidden");
}

function synthesizeCaseDetails(belgeler) {
  const combined = belgeler
    .filter((b) => b.tur !== "arastirma" && b.tur !== "dilekce" && b.metin)
    .map((b) => `--- ${b.ad} ---\n${b.metin}`)
    .join("\n\n");
  document.getElementById("caseDetails").value = combined;
}

async function handleBelgeUpload(e) {
  const files = e.target.files;
  if (!files.length) return;
  const dosyaId = currentDosyaId;

  const results = await runUploadQueue(files, "belge-upload-progress", async (file) => {
    const data = await api.uploadBelgeler(dosyaId, [file]);
    const belge = data.belgeler[0];
    if (belge.error) throw new Error(belge.error);
    return belge;
  });

  await refreshDosyaInfo(dosyaId);
  const failed = results.filter((r) => r.error).length;
  showToast(failed ? `${results.length - failed}/${results.length} belge yüklendi, ${failed} hata.` : "Belgeler yüklendi.");
  e.target.value = "";
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
fetch("/api/health")
  .then((r) => r.json())
  .then((d) => {
    const badge = document.getElementById("health-badge");
    if (d.api_key_configured) {
      badge.textContent = "Sunucu hazır (" + d.model + ")";
      badge.className = "text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-center";
    } else {
      badge.textContent = "GEMINI_API_KEY tanımlı değil";
      badge.className = "text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-center";
    }
  })
  .catch(() => {});

(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) await onSignedIn(data.session);
  else onSignedOut();
})();
