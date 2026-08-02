// Vekaletname Klasoru modulu.
let dosyaVekaletnameler = [];

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
      Veren tarih: ${latest.veren_tarih ? formatTarihTR(latest.veren_tarih) : "-"} ·
      Geçerlilik: ${latest.gecerlilik_tarihi ? formatTarihTR(latest.gecerlilik_tarihi) : "-"}
    </p>
    ${latest.ozel_yetkiler ? `<p class="text-sm text-slate-600 mt-1"><strong>Özel yetkiler:</strong> ${latest.ozel_yetkiler}</p>` : ""}
    ${latest.notlar ? `<p class="text-xs text-slate-500 mt-1">${latest.notlar}</p>` : ""}
  `;
}

function toggleVekaletnameForm() {
  const form = document.getElementById("vekaletname-form");
  form.classList.toggle("hidden");
  if (!form.classList.contains("hidden")) {
    document.getElementById("vekaletname-veren-tarih").value = "";
    document.getElementById("vekaletname-gecerlilik-tarihi").value = "";
    document.getElementById("vekaletname-ozel-yetkiler").value = "";
    document.getElementById("vekaletname-notlar").value = "";
    document.getElementById("vekaletname-dosya").value = "";
  }
}

async function submitVekaletname() {
  const file = document.getElementById("vekaletname-dosya").files[0];
  try {
    await api.createVekaletname(
      currentDosyaId,
      {
        veren_tarih: document.getElementById("vekaletname-veren-tarih").value,
        gecerlilik_tarihi: document.getElementById("vekaletname-gecerlilik-tarihi").value,
        ozel_yetkiler: document.getElementById("vekaletname-ozel-yetkiler").value,
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
