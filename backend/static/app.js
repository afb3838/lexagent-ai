let currentDosyaId = null;
let lastResearchText = "";

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

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => t.classList.add("translate-y-20", "opacity-0"), 3000);
}

function setView(name) {
  ["login", "dashboard", "dosya"].forEach((v) => {
    document.getElementById("view-" + v).classList.toggle("hidden", v !== name);
  });
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
  document.getElementById("user-email").textContent = session.user.email;
  document.getElementById("user-email").classList.remove("hidden");
  document.getElementById("logout-btn").classList.remove("hidden");
  await goToDashboard();
}

function onSignedOut() {
  document.getElementById("user-email").classList.add("hidden");
  document.getElementById("logout-btn").classList.add("hidden");
  setView("login");
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) onSignedIn(session);
  else onSignedOut();
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function goToDashboard() {
  currentDosyaId = null;
  setView("dashboard");
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
    <div onclick="openDosya('${d.id}')" class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between cursor-pointer hover:border-indigo-400">
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

async function submitNewDosya() {
  const muvekkil_adi = document.getElementById("new-muvekkil").value.trim();
  if (!muvekkil_adi) {
    showToast("Müvekkil adı zorunlu.");
    return;
  }
  try {
    const dosya = await api.createDosya({
      muvekkil_adi,
      karsi_taraf: document.getElementById("new-karsi-taraf").value.trim(),
      mahkeme: document.getElementById("new-mahkeme").value.trim(),
      esas_no: document.getElementById("new-esas-no").value.trim(),
      dava_turu: document.getElementById("new-dava-turu").value.trim(),
      acilis_tarihi: document.getElementById("new-acilis-tarihi").value,
    });
    await openDosya(dosya.id);
  } catch (err) {
    showToast("Dosya oluşturulamadı: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Dosya detail
// ---------------------------------------------------------------------------
async function openDosya(id) {
  currentDosyaId = id;
  try {
    const dosya = await api.getDosya(id);
    renderDosya(dosya);
    setView("dosya");
    switchTab(1);
  } catch (err) {
    showToast("Dosya yüklenemedi: " + err.message);
  }
}

function renderDosya(dosya) {
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
  document.getElementById("caseSubject").value = dosya.dava_turu || "";
  synthesizeCaseDetails(dosya.belgeler || []);
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
  showToast("Belgeler okunuyor...");
  try {
    await api.uploadBelgeler(currentDosyaId, files);
    const dosya = await api.getDosya(currentDosyaId);
    renderDosya(dosya);
    showToast("Belgeler yüklendi.");
  } catch (err) {
    showToast("Belge yükleme hatası: " + err.message);
  }
  e.target.value = "";
}

// ---------------------------------------------------------------------------
// Wizard: arastirma + dilekce
// ---------------------------------------------------------------------------
function switchTab(n) {
  [1, 2, 3].forEach((i) => {
    document.getElementById("tab-" + i).className =
      i === n ? "py-2.5 rounded-lg bg-white shadow-sm text-indigo-700 font-semibold" : "py-2.5 rounded-lg text-slate-600";
    document.getElementById("step-" + i).classList.toggle("hidden", i !== n);
  });
}

async function startResearch() {
  const caseSubject = document.getElementById("caseSubject").value.trim();
  const caseDetails = document.getElementById("caseDetails").value.trim();
  if (!caseSubject || !caseDetails) {
    showToast("Lütfen dava konusu ve olay özetini doldurun.");
    return;
  }
  switchTab(2);
  document.getElementById("research-loading").classList.remove("hidden");
  document.getElementById("research-results").classList.add("hidden");
  document.getElementById("research-error").classList.add("hidden");

  try {
    const data = await api.research({
      dosya_id: currentDosyaId,
      case_subject: caseSubject,
      court_type: document.getElementById("courtType").value,
      party_role: document.getElementById("partyRole").value,
      case_details: caseDetails,
      instruction: document.getElementById("instruction").value,
    });
    lastResearchText = data.result;
    document.getElementById("research-text").textContent = data.result;
    const srcBox = document.getElementById("research-sources");
    srcBox.innerHTML = data.sources.length
      ? data.sources
          .map(
            (s) =>
              `<a href="${s.uri}" target="_blank" class="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 px-2.5 py-1 rounded-md border border-slate-200"><i class="fa-solid fa-link mr-1"></i>${s.title.substring(0, 40)}</a>`
          )
          .join("")
      : '<span class="text-xs text-slate-400">Kaynak künyesi dönmedi.</span>';
    document.getElementById("research-loading").classList.add("hidden");
    document.getElementById("research-results").classList.remove("hidden");
  } catch (err) {
    document.getElementById("research-loading").classList.add("hidden");
    const errBox = document.getElementById("research-error");
    errBox.textContent = "Hata: " + err.message;
    errBox.classList.remove("hidden");
  }
}

async function goToDraft() {
  switchTab(3);
  document.getElementById("draft-loading").classList.remove("hidden");
  document.getElementById("petition-canvas").classList.add("hidden");
  document.getElementById("draft-error").classList.add("hidden");

  try {
    const data = await api.draft({
      dosya_id: currentDosyaId,
      case_subject: document.getElementById("caseSubject").value.trim(),
      court_type: document.getElementById("courtType").value,
      party_role: document.getElementById("partyRole").value,
      case_details: document.getElementById("caseDetails").value.trim(),
      instruction: document.getElementById("instruction").value,
      precedents: lastResearchText,
    });
    const canvas = document.getElementById("petition-canvas");
    canvas.textContent = data.petition;
    document.getElementById("draft-loading").classList.add("hidden");
    canvas.classList.remove("hidden");
  } catch (err) {
    document.getElementById("draft-loading").classList.add("hidden");
    const errBox = document.getElementById("draft-error");
    errBox.textContent = "Hata: " + err.message;
    errBox.classList.remove("hidden");
  }
}

function copyPetition() {
  const text = document.getElementById("petition-canvas").textContent;
  if (!text) {
    showToast("Kopyalanacak metin yok.");
    return;
  }
  navigator.clipboard.writeText(text);
  showToast("Panoya kopyalandı.");
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
      badge.className = "text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400";
    } else {
      badge.textContent = "GEMINI_API_KEY tanımlı değil";
      badge.className = "text-xs px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400";
    }
  })
  .catch(() => {});

(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) await onSignedIn(data.session);
  else onSignedOut();
})();
