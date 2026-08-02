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
  "emsal-arastirma": "Emsal Araştırma",
  ajanda: "Ajanda",
  vekaletnameler: "Vekaletnameler",
  "cari-hesap": "Cari Hesap",
  "icra-takip": "İcra Takip",
};

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => t.classList.add("translate-y-20", "opacity-0"), 3000);
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

async function handleLogout() {
  await supabaseClient.auth.signOut();
}

async function onSignedIn(session) {
  document.getElementById("view-login").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");
  document.getElementById("app-shell").classList.add("flex");
  document.getElementById("user-email").textContent = session.user.email;
  document.getElementById("user-email").classList.remove("hidden");
  document.getElementById("logout-btn").classList.remove("hidden");
  if (!location.hash) location.hash = "#/dosyalar";
  else await router();
}

function onSignedOut() {
  document.getElementById("app-shell").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("flex");
  document.getElementById("view-login").classList.remove("hidden");
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) onSignedIn(session);
  else onSignedOut();
});

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
  document.getElementById("page-title").textContent = PAGE_TITLES[route] || "";
  highlightNav(route);

  if (route === "dosyalar" && param) {
    showPage("page-dosya-detay");
    await openDosyaPage(param);
  } else if (route === "dosyalar") {
    showPage("page-dosyalar");
    await loadDosyaList();
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
    document.getElementById("aaut-sonuc").classList.add("hidden");
    document.getElementById("aaut-deger").value = "";
    await loadCariHesapPage();
  } else if (route === "icra-takip" && param) {
    showPage("page-icra-detay");
    await openIcraPage(param);
  } else if (route === "icra-takip") {
    showPage("page-icra-takip");
    await loadIcraListPage();
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
  } catch (err) {
    showToast("Dosyalar yüklenemedi: " + err.message);
  }
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
}

function closeNewDosyaForm() {
  document.getElementById("new-dosya-form").classList.add("hidden");
  ["new-muvekkil", "new-karsi-taraf", "new-mahkeme", "new-esas-no", "new-dava-turu", "new-acilis-tarihi"].forEach(
    (id) => (document.getElementById(id).value = "")
  );
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

async function submitNewDosya() {
  const muvekkil_adi = document.getElementById("new-muvekkil").value.trim();
  const karsi_taraf = document.getElementById("new-karsi-taraf").value.trim();
  if (!muvekkil_adi) {
    showToast("Müvekkil adı zorunlu.");
    return;
  }
  if (!(await celiskiKontrolu(muvekkil_adi, karsi_taraf))) return;
  try {
    const dosya = await api.createDosya({
      muvekkil_adi,
      karsi_taraf,
      mahkeme: document.getElementById("new-mahkeme").value.trim(),
      esas_no: document.getElementById("new-esas-no").value.trim(),
      dava_turu: document.getElementById("new-dava-turu").value.trim(),
      acilis_tarihi: document.getElementById("new-acilis-tarihi").value,
    });
    location.hash = "#/dosyalar/" + dosya.id;
  } catch (err) {
    showToast("Dosya oluşturulamadı: " + err.message);
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

function renderBelgeList(belgeler) {
  const box = document.getElementById("belge-list");
  if (!belgeler.length) {
    box.innerHTML = '<p class="text-sm text-slate-400">Henüz belge yok.</p>';
    return;
  }
  box.innerHTML = belgeler
    .map(
      (b) => `
    <div class="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
      <span><i class="fa-solid fa-file-lines text-indigo-600 mr-1"></i>${b.ad}
        <span class="text-slate-400 ml-1">(${BELGE_TUR_LABELS[b.tur] || b.tur})</span>
        ${b.error ? ' <span class="text-rose-500">hata: ' + b.error + "</span>" : ""}
      </span>
    </div>`
    )
    .join("");
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
