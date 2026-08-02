// Emsal Arastirma + Dilekce sihirbazi. Tek DOM kopyasi (#wizard-root) iki baglamda
// kullanilir: bir dosya icinden (currentDosyaId dolu, sonuc otomatik dosyaya kaydedilir)
// veya bagimsiz (#/emsal-arastirma, currentDosyaId null, sonuc istege bagli kaydedilir).
let currentDosyaId = null;
let lastResearchText = "";
let lastDraftText = "";
let standaloneDocs = [];

function mountWizard(containerId, dosyaId) {
  currentDosyaId = dosyaId;
  lastResearchText = "";
  lastDraftText = "";
  standaloneDocs = [];
  document.getElementById(containerId).appendChild(document.getElementById("wizard-root"));

  document.getElementById("caseSubject").value = "";
  document.getElementById("caseDetails").value = "";
  document.getElementById("instruction").value = "";
  document.getElementById("research-results").classList.add("hidden");
  document.getElementById("research-error").classList.add("hidden");
  document.getElementById("petition-canvas").classList.add("hidden");
  document.getElementById("draft-error").classList.add("hidden");

  const standalone = !dosyaId;
  document.getElementById("standalone-upload-section").classList.toggle("hidden", !standalone);
  document.getElementById("standalone-upload-progress").innerHTML = "";
  document.getElementById("save-to-dosya-research").classList.toggle("hidden", !standalone);
  document.getElementById("save-to-dosya-draft").classList.toggle("hidden", !standalone);
  if (standalone) {
    populateSaveDosyaSelects();
    renderStandaloneFileList();
  }

  switchTab(1);
}

async function handleStandaloneUpload(e) {
  const files = e.target.files;
  if (!files.length) return;

  const results = await runUploadQueue(files, "standalone-upload-progress", async (file) => {
    const [doc] = await api.parseFiles([file]);
    if (doc.error) throw new Error(doc.error);
    return doc;
  });

  results.forEach((r) => {
    if (r.result) standaloneDocs.push(r.result);
  });
  renderStandaloneFileList();
  synthesizeStandaloneCaseDetails();
  const failed = results.filter((r) => r.error).length;
  showToast(failed ? `${results.length - failed}/${results.length} belge okundu, ${failed} hata.` : "Belgeler okundu.");
  e.target.value = "";
}

function removeStandaloneDoc(i) {
  standaloneDocs.splice(i, 1);
  renderStandaloneFileList();
  synthesizeStandaloneCaseDetails();
}

function renderStandaloneFileList() {
  const box = document.getElementById("standalone-file-list");
  box.innerHTML = standaloneDocs
    .map(
      (d, i) => `
    <div class="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
      <span><i class="fa-solid fa-file-lines text-indigo-600 mr-1"></i>${d.name}${d.error ? " (hata: " + d.error + ")" : ""}</span>
      <button onclick="removeStandaloneDoc(${i})" class="text-rose-500"><i class="fa-solid fa-trash-can"></i></button>
    </div>`
    )
    .join("");
}

function synthesizeStandaloneCaseDetails() {
  const combined = standaloneDocs.map((d, i) => `--- EVRAK ${i + 1}: ${d.name} ---\n${d.text}`).join("\n\n");
  document.getElementById("caseDetails").value = combined;
}

async function populateSaveDosyaSelects() {
  try {
    const dosyalar = await api.listDosyalar();
    const options = dosyalar.length
      ? dosyalar.map((d) => `<option value="${d.id}">${d.muvekkil_adi}${d.karsi_taraf ? " vs. " + d.karsi_taraf : ""}</option>`).join("")
      : '<option value="">Once bir dosya olusturun</option>';
    document.getElementById("save-dosya-select-research").innerHTML = options;
    document.getElementById("save-dosya-select-draft").innerHTML = options;
  } catch (err) {
    showToast("Dosya listesi alinamadi: " + err.message);
  }
}

async function saveResultToDosya(which) {
  const select = document.getElementById(which === "research" ? "save-dosya-select-research" : "save-dosya-select-draft");
  const dosyaId = select.value;
  if (!dosyaId) {
    showToast("Lütfen bir dosya seçin.");
    return;
  }
  const isResearch = which === "research";
  const ad = isResearch ? "Emsal Arastirma Sonucu" : "Dilekce Taslagi";
  const tur = isResearch ? "arastirma" : "dilekce";
  const metin = isResearch ? lastResearchText : lastDraftText;
  try {
    await authedFetch(`/api/dosyalar/${dosyaId}/belge-ekle-metin`, {
      method: "POST",
      body: toFormData({ ad, tur, metin }),
    });
    showToast("Dosyaya kaydedildi.");
  } catch (err) {
    showToast("Kaydedilemedi: " + err.message);
  }
}

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
      dosya_id: currentDosyaId || "",
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
      dosya_id: currentDosyaId || "",
      case_subject: document.getElementById("caseSubject").value.trim(),
      court_type: document.getElementById("courtType").value,
      party_role: document.getElementById("partyRole").value,
      case_details: document.getElementById("caseDetails").value.trim(),
      instruction: document.getElementById("instruction").value,
      precedents: lastResearchText,
    });
    lastDraftText = data.petition;
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
