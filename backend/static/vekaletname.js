// Vekaletname Klasoru modulu.
let dosyaVekaletnameler = [];

const VEKALETNAME_FORM_FIELDS = [
  "vekaletname-vekil-adi",
  "vekaletname-muvekkil-adi",
  "vekaletname-muvekkil-tc",
  "vekaletname-noter",
  "vekaletname-muvekkil-adres",
  "vekaletname-veren-tarih",
  "vekaletname-gecerlilik-tarihi",
  "vekaletname-ozel-yetkiler",
  "vekaletname-notlar",
];

function vekaletnameDurum(v) {
  if (!v) return { label: "Eksik", cls: "bg-rose-100 text-rose-700" };
  if (v.gecerlilik_tarihi && v.gecerlilik_tarihi < todayStr()) {
    return { label: "Süresi Geçmiş", cls: "bg-rose-100 text-rose-700" };
  }
  return { label: "Geçerli", cls: "bg-emerald-100 text-emerald-700" };
}

// ---------------------------------------------------------------------------
// Vekaletnameler overview sayfasi
// ---------------------------------------------------------------------------
async function loadVekaletnamelerPage() {
  const box = document.getElementById("vekaletname-overview-list");
  box.innerHTML = '<p class="text-sm text-slate-400">Yükleniyor...</p>';
  try {
    const [dosyalar, vekaletnameler] = await Promise.all([api.listDosyalar(), api.listVekaletnameler()]);
    if (!dosyalar.length) {
      box.innerHTML = '<p class="text-sm text-slate-400">Henüz dosya yok.</p>';
      return;
    }
    box.innerHTML = dosyalar
      .map((d) => {
        const latest = vekaletnameler
          .filter((v) => v.dosya_id === d.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        const durum = vekaletnameDurum(latest);
        return `
        <div onclick="location.hash = '#/dosyalar/${d.id}'" class="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3 text-sm cursor-pointer hover:border-indigo-400">
          <div>
            <p class="font-semibold">${d.muvekkil_adi}${d.karsi_taraf ? " vs. " + d.karsi_taraf : ""}</p>
            <p class="text-xs text-slate-500">${latest ? "Geçerlilik: " + (latest.gecerlilik_tarihi ? formatTarihTR(latest.gecerlilik_tarihi) : "belirtilmemiş") : "Vekaletname kaydı yok"}</p>
          </div>
          <span class="text-xs px-2.5 py-1 rounded-full ${durum.cls}">${durum.label}</span>
        </div>`;
      })
      .join("");
  } catch (err) {
    box.innerHTML = '<p class="text-sm text-rose-500">Yüklenemedi: ' + err.message + "</p>";
  }
}

// ---------------------------------------------------------------------------
// Dosya detayindaki vekaletname bolumu
// ---------------------------------------------------------------------------
async function loadDosyaVekaletname(dosyaId) {
  try {
    dosyaVekaletnameler = await api.listDosyaVekaletname(dosyaId);
  } catch (err) {
    dosyaVekaletnameler = [];
  }
  renderVekaletnameDurumBox();
}

function renderVekaletnameDurumBox() {
  const box = document.getElementById("vekaletname-durum-box");
  const latest = dosyaVekaletnameler[0];
  const durum = vekaletnameDurum(latest);
  if (!latest) {
    box.innerHTML = `<span class="text-xs px-2.5 py-1 rounded-full ${durum.cls}">${durum.label}</span> <span class="text-sm text-slate-500 ml-2">Bu dosya için henüz vekaletname kaydı yok.</span>`;
    return;
  }
  box.innerHTML = `
    <div class="flex items-center gap-2 mb-2">
      <span class="text-xs px-2.5 py-1 rounded-full ${durum.cls}">${durum.label}</span>
    </div>
    <p class="text-sm text-slate-600">
      ${latest.vekil_adi ? "Vekil: <strong>" + escapeHtml(latest.vekil_adi) + "</strong> · " : ""}Müvekkil: <strong>${latest.muvekkil_adi ? escapeHtml(latest.muvekkil_adi) : "-"}</strong>
    </p>
    <p class="text-sm text-slate-600 mt-0.5">
      Veren tarih: ${latest.veren_tarih ? formatTarihTR(latest.veren_tarih) : "-"} ·
      Geçerlilik: ${latest.gecerlilik_tarihi ? formatTarihTR(latest.gecerlilik_tarihi) : "-"}
      ${latest.noter ? " · Noter: " + escapeHtml(latest.noter) : ""}
    </p>
    ${latest.muvekkil_tc ? `<p class="text-xs text-slate-500 mt-1">TC: ${escapeHtml(latest.muvekkil_tc)}</p>` : ""}
    ${latest.muvekkil_adres ? `<p class="text-xs text-slate-500 mt-1">Adres: ${escapeHtml(latest.muvekkil_adres)}</p>` : ""}
    ${latest.ozel_yetkiler ? `<p class="text-sm text-slate-600 mt-1"><strong>Özel yetkiler:</strong> ${escapeHtml(latest.ozel_yetkiler)}</p>` : ""}
    ${latest.notlar ? `<p class="text-xs text-slate-500 mt-1">${escapeHtml(latest.notlar)}</p>` : ""}
  `;
}

function toggleVekaletnameForm() {
  const form = document.getElementById("vekaletname-form");
  form.classList.toggle("hidden");
  if (!form.classList.contains("hidden")) {
    VEKALETNAME_FORM_FIELDS.forEach((id) => (document.getElementById(id).value = ""));
    document.getElementById("vekaletname-dosya").value = "";
    document.getElementById("vekaletname-oku-durum").textContent =
      "Belge seçtiğinizde alanlar otomatik okunup doldurulmaya çalışılır — okunamayan alanları siz tamamlayın, kaydetmeden önce kontrol edin.";
  }
}

// Belge secilince: kaydetmeden ONCE sadece alanlari okuyup formu doldurur
// (on-izleme). Kullanici kontrol edip duzelttikten sonra "Kaydet"e basar.
async function vekaletnameDosyaSecildi(e) {
  const file = e.target.files[0];
  if (!file) return;
  const durumEl = document.getElementById("vekaletname-oku-durum");
  durumEl.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-1"></i>Belge okunuyor, birkaç saniye sürebilir...';
  try {
    const fields = await api.vekaletnameOku(file);
    const map = {
      "vekaletname-vekil-adi": fields.vekil_adi,
      "vekaletname-muvekkil-adi": fields.muvekkil_adi,
      "vekaletname-muvekkil-tc": fields.muvekkil_tc,
      "vekaletname-noter": fields.noter,
      "vekaletname-muvekkil-adres": fields.muvekkil_adres,
      "vekaletname-veren-tarih": fields.veren_tarih,
      "vekaletname-ozel-yetkiler": fields.ozel_yetkiler,
      "vekaletname-notlar": fields.ozet,
    };
    let doluSayisi = 0;
    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (value && !el.value) {
        el.value = value;
        doluSayisi++;
      }
    });
    durumEl.innerHTML = doluSayisi
      ? `<i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i>${doluSayisi} alan otomatik dolduruldu. Kaydetmeden önce kontrol edin, okunamayan alanları siz tamamlayın.`
      : '<i class="fa-solid fa-circle-info mr-1"></i>Belgeden alan okunamadı; alanları elle doldurun.';
  } catch (err) {
    const yumusak = yumusakMesajKutusu(err.message);
    durumEl.innerHTML = yumusak
      ? yumusak + '<p class="text-xs text-slate-500 mt-1">Alanları elle doldurup kaydedebilirsiniz.</p>'
      : '<span class="text-rose-600">Belge okunamadı: ' + escapeHtml(err.message) + " — alanları elle doldurabilirsiniz.</span>";
  }
}

async function submitVekaletname() {
  const file = document.getElementById("vekaletname-dosya").files[0];
  try {
    await api.createVekaletname(
      currentDosyaId,
      {
        vekil_adi: document.getElementById("vekaletname-vekil-adi").value,
        muvekkil_adi: document.getElementById("vekaletname-muvekkil-adi").value,
        muvekkil_tc: document.getElementById("vekaletname-muvekkil-tc").value,
        muvekkil_adres: document.getElementById("vekaletname-muvekkil-adres").value,
        veren_tarih: document.getElementById("vekaletname-veren-tarih").value,
        gecerlilik_tarihi: document.getElementById("vekaletname-gecerlilik-tarihi").value,
        ozel_yetkiler: document.getElementById("vekaletname-ozel-yetkiler").value,
        noter: document.getElementById("vekaletname-noter").value,
        notlar: document.getElementById("vekaletname-notlar").value,
      },
      file
    );
    document.getElementById("vekaletname-form").classList.add("hidden");
    showToast("Vekaletname kaydedildi.");
    await loadDosyaVekaletname(currentDosyaId);
  } catch (err) {
    showToast("Kaydedilemedi: " + err.message);
  }
}
