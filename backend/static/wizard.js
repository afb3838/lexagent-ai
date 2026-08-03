// Emsal Arastirma + Dilekce sihirbazi. Tek DOM kopyasi (#wizard-root) iki baglamda
// kullanilir: bir dosya icinden (currentDosyaId dolu, sonuc otomatik dosyaya kaydedilir)
// veya bagimsiz (#/emsal-arastirma, currentDosyaId null, sonuc istege bagli kaydedilir).
let currentDosyaId = null;
let lastResearchText = "";
let lastDraftText = "";
let standaloneDocs = [];

// Dilekce sablon kutuphanesi: sadece hazirlama TALIMATI icerir (AI'a ne
// vurgulamasi gerektigini soyler), hazir hukuki metin/boilerplate DEGILDIR -
// bu sekilde yanlis/eksik bir "hazir dilekce" riski tasimaz.
const SABLONLAR = [
  { ad: "İşe İade Davası", mahkeme: "Nöbetçi İş Mahkemesi", dava_turu: "İşe İade Davası", talimat: "İşe iade davası dilekçesi olsun; feshin geçersizliğini, işe iade talebini, boşta geçen süre ücretini ve işe başlatmama tazminatını vurgula." },
  { ad: "Kıdem ve İhbar Tazminatı", mahkeme: "Nöbetçi İş Mahkemesi", dava_turu: "Kıdem ve İhbar Tazminatı Alacağı", talimat: "Kıdem ve ihbar tazminatı talebini, varsa fazla mesai ve yıllık izin alacaklarını vurgula." },
  { ad: "Boşanma Davası", mahkeme: "Nöbetçi Aile Mahkemesi", dava_turu: "Boşanma Davası", talimat: "Boşanma davası dilekçesi olsun; evlilik birliğinin temelinden sarsıldığını, varsa maddi/manevi tazminat ve nafaka taleplerini vurgula." },
  { ad: "Velayet Değişikliği", mahkeme: "Nöbetçi Aile Mahkemesi", dava_turu: "Velayetin Değiştirilmesi", talimat: "Velayetin değiştirilmesi talebini, çocuğun üstün yararını gözeterek vurgula." },
  { ad: "Kira Tespiti / Tahliye", mahkeme: "Nöbetçi Sulh Hukuk Mahkemesi", dava_turu: "Kira Tespiti ve Tahliye", talimat: "Kira bedelinin tespiti ve/veya tahliye talebini, sözleşme ve tebligat sürecini vurgula." },
  { ad: "Tüketici Şikayeti", mahkeme: "Nöbetçi Tüketici Mahkemesi", dava_turu: "Tüketici Hakem Heyeti/Mahkemesi Başvurusu", talimat: "Ayıplı mal/hizmet iddiasını, tüketici haklarını ve talep edilen bedel iadesi/değişimi vurgula." },
  { ad: "İcra Takibine İtiraz", mahkeme: "Nöbetçi İcra Hukuk Mahkemesi", dava_turu: "İcra Takibine İtiraz", talimat: "Borca ve/veya imzaya itirazı, takibin durdurulması talebini vurgula." },
  { ad: "Haksız Fiil Tazminatı", mahkeme: "Nöbetçi Asliye Hukuk Mahkemesi", dava_turu: "Maddi ve Manevi Tazminat Davası", talimat: "Haksız fiil nedeniyle maddi ve manevi tazminat talebini, kusur ve zarar unsurlarını vurgula." },
  { ad: "Ticari Alacak Davası", mahkeme: "Nöbetçi Asliye Ticaret Mahkemesi", dava_turu: "Ticari Alacak Davası", talimat: "Ticari ilişkiden doğan alacağın tahsili talebini, fatura/sözleşme dayanaklarını vurgula." },
  { ad: "İdari İşlemin İptali", mahkeme: "Nöbetçi İdare Mahkemesi", dava_turu: "İdari İşlemin İptali Davası", talimat: "İdari işlemin hukuka aykırılığını ve iptali talebini, yürütmenin durdurulması talebini vurgula." },
];

(function populateSablonSec() {
  const select = document.getElementById("sablon-sec");
  SABLONLAR.forEach((s, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = s.ad;
    select.appendChild(opt);
  });
})();

function uygulaSablon() {
  const i = document.getElementById("sablon-sec").value;
  if (i === "") return;
  const sablon = SABLONLAR[i];
  document.getElementById("courtType").value = sablon.mahkeme;
  document.getElementById("caseSubject").value = sablon.dava_turu;
  document.getElementById("instruction").value = sablon.talimat;
}

function mountWizard(containerId, dosyaId) {
  currentDosyaId = dosyaId;
  lastResearchText = "";
  lastDraftText = "";
  standaloneDocs = [];
  document.getElementById(containerId).appendChild(document.getElementById("wizard-root"));

  document.getElementById("caseSubject").value = "";
  document.getElementById("caseDetails").value = "";
  document.getElementById("instruction").value = "";
  document.getElementById("sablon-sec").value = "";
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
    renderKaynakliSonuc(
      "research-sources",
      "research-text",
      data.result,
      data.sources,
      "Bu konuyla ilgili doğrulanmış bir emsal karar bulunamadı. Aşağıdaki kanun maddeleri ve genel hukuki ilkeler için sonucu inceleyin, ya da farklı anahtar kelimelerle tekrar deneyin."
    );
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

async function downloadPetitionAsPdf() {
  if (!lastDraftText) {
    showToast("İndirilecek dilekçe yok.");
    return;
  }
  try {
    const baslik = document.getElementById("caseSubject").value.trim() || "Dilekce Taslagi";
    await downloadTextAsPdf(baslik, lastDraftText);
  } catch (err) {
    showToast("PDF oluşturulamadı: " + err.message);
  }
}
