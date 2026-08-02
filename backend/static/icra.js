// Icra Takip modulu.
const ICRA_DURUM_LABELS = {
  acildi: "Açıldı",
  haciz_asamasinda: "Haciz Aşamasında",
  tahsil_edildi: "Tahsil Edildi",
  kapandi: "Kapandı",
};

const ICRA_ADIM_TUR_LABELS = { haciz: "Haciz", tahsilat: "Tahsilat", tebligat: "Tebligat", diger: "Diğer" };

let currentIcraId = null;

// ---------------------------------------------------------------------------
// Icra Takip listesi
// ---------------------------------------------------------------------------
async function loadIcraListPage() {
  closeNewIcraForm();
  const box = document.getElementById("icra-list");
  box.innerHTML = '<p class="text-sm text-slate-400">Yükleniyor...</p>';
  try {
    const kayitlar = await api.listIcra();
    renderIcraList(kayitlar);
  } catch (err) {
    box.innerHTML = '<p class="text-sm text-rose-500">Yüklenemedi: ' + err.message + "</p>";
  }
}

function renderIcraList(kayitlar) {
  const box = document.getElementById("icra-list");
  if (!kayitlar.length) {
    box.innerHTML = '<p class="text-sm text-slate-400">Henüz icra takibi yok. "Yeni İcra Takibi" ile başlayın.</p>';
    return;
  }
  box.innerHTML = kayitlar
    .map(
      (k) => `
    <div onclick="location.hash = '#/icra-takip/${k.id}'" class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between cursor-pointer hover:border-indigo-400">
      <div>
        <p class="font-semibold">${k.alacakli_adi} / ${k.borclu_adi}</p>
        <p class="text-xs text-slate-500">${k.icra_dairesi || ""} ${k.takip_no ? "· Takip No: " + k.takip_no : ""}${k.takip_tutari ? " · " + formatTL(k.takip_tutari) : ""}</p>
      </div>
      <span class="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">${ICRA_DURUM_LABELS[k.durum] || k.durum}</span>
    </div>`
    )
    .join("");
}

async function openNewIcraForm() {
  document.getElementById("new-icra-form").classList.remove("hidden");
  const select = document.getElementById("new-icra-dosya");
  select.innerHTML = '<option value="">Bağımsız (bir dosyaya bağlama)</option>';
  try {
    const dosyalar = await api.listDosyalar();
    select.innerHTML += dosyalar
      .map((d) => `<option value="${d.id}">${d.muvekkil_adi}${d.karsi_taraf ? " vs. " + d.karsi_taraf : ""}</option>`)
      .join("");
  } catch (err) {
    // dosya secimi olmadan da devam edilebilir
  }
}

function closeNewIcraForm() {
  document.getElementById("new-icra-form").classList.add("hidden");
  ["new-icra-borclu", "new-icra-alacakli", "new-icra-takip-no", "new-icra-daire", "new-icra-tutar"].forEach(
    (id) => (document.getElementById(id).value = "")
  );
}

async function submitNewIcra() {
  const borclu_adi = document.getElementById("new-icra-borclu").value.trim();
  const alacakli_adi = document.getElementById("new-icra-alacakli").value.trim();
  if (!borclu_adi || !alacakli_adi) {
    showToast("Borçlu ve alacaklı zorunlu.");
    return;
  }
  try {
    const icra = await api.createIcra({
      borclu_adi,
      alacakli_adi,
      takip_no: document.getElementById("new-icra-takip-no").value.trim(),
      icra_dairesi: document.getElementById("new-icra-daire").value.trim(),
      takip_tutari: document.getElementById("new-icra-tutar").value,
      dosya_id: document.getElementById("new-icra-dosya").value,
    });
    location.hash = "#/icra-takip/" + icra.id;
  } catch (err) {
    showToast("Oluşturulamadı: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Icra Takip detayi
// ---------------------------------------------------------------------------
async function openIcraPage(id) {
  currentIcraId = id;
  document.getElementById("icra-adim-form").classList.add("hidden");
  try {
    const icra = await api.getIcra(id);
    renderIcra(icra);
  } catch (err) {
    showToast("İcra takibi yüklenemedi: " + err.message);
  }
}

function renderIcra(icra) {
  document.getElementById("page-title").textContent = `${icra.alacakli_adi} / ${icra.borclu_adi}`;
  document.getElementById("icra-title").textContent = `${icra.alacakli_adi} / ${icra.borclu_adi}`;
  document.getElementById("icra-durum").value = icra.durum;
  document.getElementById("icra-meta").innerHTML = `
    <span><i class="fa-solid fa-building-columns mr-1"></i>${icra.icra_dairesi || "-"}</span>
    <span><i class="fa-solid fa-hashtag mr-1"></i>${icra.takip_no || "-"}</span>
    <span><i class="fa-solid fa-turkish-lira-sign mr-1"></i>${icra.takip_tutari ? formatTL(icra.takip_tutari) : "-"}</span>
  `;
  renderIcraAdimList(icra.adimlar || []);
}

async function updateIcraDurum() {
  const durum = document.getElementById("icra-durum").value;
  try {
    await api.patchIcra(currentIcraId, { durum });
    showToast("Durum güncellendi.");
  } catch (err) {
    showToast("Güncellenemedi: " + err.message);
  }
}

function renderIcraAdimList(adimlar) {
  const box = document.getElementById("icra-adim-list");
  box.innerHTML = adimlar.length
    ? adimlar
        .map(
          (a) => `
      <div class="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-xs">
        <span>${formatTarihTR(a.tarih)} · ${ICRA_ADIM_TUR_LABELS[a.tur] || a.tur}${a.aciklama ? " · " + a.aciklama : ""}</span>
        ${a.tutar ? `<span class="font-semibold text-slate-700">${formatTL(a.tutar)}</span>` : ""}
      </div>`
        )
        .join("")
    : '<p class="text-sm text-slate-400">Henüz adım kaydı yok.</p>';
}

function toggleIcraAdimForm() {
  const form = document.getElementById("icra-adim-form");
  form.classList.toggle("hidden");
  if (!form.classList.contains("hidden")) {
    document.getElementById("icra-adim-tarih").value = todayStr();
    document.getElementById("icra-adim-tur").value = "tebligat";
    document.getElementById("icra-adim-tutar").value = "";
    document.getElementById("icra-adim-aciklama").value = "";
  }
}

async function submitIcraAdim() {
  const tarih = document.getElementById("icra-adim-tarih").value;
  if (!tarih) {
    showToast("Tarih zorunlu.");
    return;
  }
  try {
    await api.createIcraAdim(currentIcraId, {
      tarih,
      tur: document.getElementById("icra-adim-tur").value,
      tutar: document.getElementById("icra-adim-tutar").value,
      aciklama: document.getElementById("icra-adim-aciklama").value,
    });
    document.getElementById("icra-adim-form").classList.add("hidden");
    showToast("Adım eklendi.");
    const icra = await api.getIcra(currentIcraId);
    renderIcra(icra);
  } catch (err) {
    showToast("Eklenemedi: " + err.message);
  }
}
