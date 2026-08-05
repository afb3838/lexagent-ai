// Musteriler (CRM) modulu.
let currentMusteriId = null;

async function loadMusterilerPage() {
  const box = document.getElementById("musteri-list");
  box.innerHTML = '<p class="text-sm text-slate-400">Yükleniyor...</p>';
  try {
    const musteriler = await api.listMusteriler();
    if (!musteriler.length) {
      box.innerHTML = '<p class="text-sm text-slate-400">Henüz müvekkil kaydı yok. "Yeni Müvekkil" ile başlayın.</p>';
      return;
    }
    box.innerHTML = musteriler
      .map(
        (m) => `
      <div onclick="location.hash = '#/musteriler/${m.id}'" class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between cursor-pointer hover:border-indigo-400">
        <div>
          <p class="font-semibold">${escapeHtml(m.ad_soyad)}</p>
          <p class="text-xs text-slate-500">${m.telefon ? escapeHtml(m.telefon) : ""}${m.telefon && m.eposta ? " · " : ""}${m.eposta ? escapeHtml(m.eposta) : ""}</p>
        </div>
        <i class="fa-solid fa-chevron-right text-slate-300"></i>
      </div>`
      )
      .join("");
  } catch (err) {
    box.innerHTML = '<p class="text-sm text-rose-500">Yüklenemedi: ' + escapeHtml(err.message) + "</p>";
  }
}

function openNewMusteriForm() {
  document.getElementById("new-musteri-form").classList.remove("hidden");
}

function closeNewMusteriForm() {
  document.getElementById("new-musteri-form").classList.add("hidden");
  ["new-musteri-ad", "new-musteri-tc", "new-musteri-telefon", "new-musteri-eposta", "new-musteri-adres", "new-musteri-notlar"].forEach(
    (id) => (document.getElementById(id).value = "")
  );
}

let musteriGonderiliyor = false;

async function submitNewMusteri() {
  if (musteriGonderiliyor) return;
  const ad_soyad = document.getElementById("new-musteri-ad").value.trim();
  if (!ad_soyad) {
    showToast("Ad Soyad / Unvan zorunlu.");
    return;
  }
  musteriGonderiliyor = true;
  try {
    await api.createMusteri({
      ad_soyad,
      tc_vergi_no: document.getElementById("new-musteri-tc").value.trim(),
      telefon: document.getElementById("new-musteri-telefon").value.trim(),
      eposta: document.getElementById("new-musteri-eposta").value.trim(),
      adres: document.getElementById("new-musteri-adres").value.trim(),
      notlar: document.getElementById("new-musteri-notlar").value.trim(),
    });
    closeNewMusteriForm();
    showToast("Müvekkil eklendi.");
    await loadMusterilerPage();
  } catch (err) {
    showToast("Eklenemedi: " + err.message);
  } finally {
    musteriGonderiliyor = false;
  }
}

async function openMusteriPage(id) {
  currentMusteriId = id;
  try {
    const musteri = await api.getMusteri(id);
    renderMusteri(musteri);
  } catch (err) {
    showToast("Müvekkil yüklenemedi: " + err.message);
  }
}

function renderMusteri(m) {
  document.getElementById("page-title").textContent = m.ad_soyad;
  document.getElementById("musteri-title").textContent = m.ad_soyad;
  document.getElementById("musteri-detay").innerHTML = `
    ${m.telefon ? `<span><i class="fa-solid fa-phone mr-1"></i>${escapeHtml(m.telefon)}</span>` : ""}
    ${m.eposta ? `<span><i class="fa-solid fa-envelope mr-1"></i>${escapeHtml(m.eposta)}</span>` : ""}
    ${m.tc_vergi_no ? `<span><i class="fa-solid fa-id-card mr-1"></i>${escapeHtml(m.tc_vergi_no)}</span>` : ""}
    ${m.adres ? `<span><i class="fa-solid fa-location-dot mr-1"></i>${escapeHtml(m.adres)}</span>` : ""}
  `;
  document.getElementById("musteri-notlar-box").innerHTML = m.notlar
    ? `<p class="text-sm text-slate-600">${escapeHtml(m.notlar)}</p>`
    : '<p class="text-sm text-slate-400">Not eklenmemiş.</p>';

  const dosyalar = m.dosyalar || [];
  document.getElementById("musteri-dosyalar").innerHTML = dosyalar.length
    ? dosyalar
        .map(
          (d) => `
      <div onclick="location.hash = '#/dosyalar/${d.id}'" class="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm cursor-pointer hover:border-indigo-400">
        <span>${escapeHtml(d.muvekkil_adi)}${d.karsi_taraf ? " vs. " + escapeHtml(d.karsi_taraf) : ""}</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${DURUM_LABELS[d.durum] || d.durum}</span>
      </div>`
        )
        .join("")
    : '<p class="text-sm text-slate-400">Bu müvekkile bağlı dosya yok.</p>';
}

// Yeni Dosya formundaki "Kayıtlı Müşteri" secimini doldurur.
async function populateMusteriSelect() {
  const select = document.getElementById("new-dosya-musteri");
  if (!select) return;
  try {
    const musteriler = await api.listMusteriler();
    select.innerHTML =
      '<option value="">Kayıtlı değil / serbest metin</option>' +
      musteriler.map((m) => `<option value="${m.id}">${escapeHtml(m.ad_soyad)}</option>`).join("");
  } catch (err) {
    select.innerHTML = '<option value="">Kayıtlı değil / serbest metin</option>';
  }
}
