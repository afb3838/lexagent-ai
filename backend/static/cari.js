// Cari Hesap / Musteki Defteri modulu + AAUT ucret hesaplayici.
const CARI_TUR_LABELS = { ucret: "Ücret", masraf: "Masraf", odeme: "Ödeme" };
let dosyaCariKayitlar = [];

function hesaplaBakiye(kayitlar) {
  let borc = 0;
  let odeme = 0;
  kayitlar.forEach((k) => {
    const tutar = parseFloat(k.tutar) || 0;
    if (k.tur === "odeme") odeme += tutar;
    else borc += tutar;
  });
  return { borc, odeme, bakiye: borc - odeme };
}

function formatTL(n) {
  return Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL";
}

// ---------------------------------------------------------------------------
// Cari Hesap overview sayfasi
// ---------------------------------------------------------------------------
async function loadCariHesapPage() {
  const box = document.getElementById("cari-overview-list");
  box.innerHTML = '<p class="text-sm text-slate-400">Yükleniyor...</p>';
  try {
    const [dosyalar, kayitlar] = await Promise.all([api.listDosyalar(), api.listCariHesap()]);
    if (!dosyalar.length) {
      box.innerHTML = '<p class="text-sm text-slate-400">Henüz dosya yok.</p>';
    } else {
      box.innerHTML = dosyalar
        .map((d) => {
          const { borc, odeme, bakiye } = hesaplaBakiye(kayitlar.filter((k) => k.dosya_id === d.id));
          const bakiyeCls = bakiye > 0 ? "text-rose-600" : "text-emerald-600";
          return `
          <div onclick="location.hash = '#/dosyalar/${d.id}'" class="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3 text-sm cursor-pointer hover:border-indigo-400">
            <div>
              <p class="font-semibold">${d.muvekkil_adi}${d.karsi_taraf ? " vs. " + d.karsi_taraf : ""}</p>
              <p class="text-xs text-slate-500">Ücret+Masraf: ${formatTL(borc)} · Ödeme: ${formatTL(odeme)}</p>
            </div>
            <span class="text-sm font-semibold ${bakiyeCls}">${formatTL(bakiye)}</span>
          </div>`;
        })
        .join("");
    }
  } catch (err) {
    box.innerHTML = '<p class="text-sm text-rose-500">Yüklenemedi: ' + err.message + "</p>";
  }
}

// ---------------------------------------------------------------------------
// Dosya detayindaki cari hesap bolumu
// ---------------------------------------------------------------------------
async function loadDosyaCariHesap(dosyaId) {
  try {
    dosyaCariKayitlar = await api.listDosyaCariHesap(dosyaId);
  } catch (err) {
    dosyaCariKayitlar = [];
  }
  renderCariHesapList();
}

function renderCariHesapList() {
  const { borc, odeme, bakiye } = hesaplaBakiye(dosyaCariKayitlar);
  const bakiyeCls = bakiye > 0 ? "text-rose-600" : "text-emerald-600";
  document.getElementById("cari-hesap-bakiye").innerHTML =
    `Toplam Ücret+Masraf: ${formatTL(borc)} · Toplam Ödeme: ${formatTL(odeme)} · ` +
    `<span class="${bakiyeCls}">Kalan Bakiye: ${formatTL(bakiye)}</span>`;

  const box = document.getElementById("cari-hesap-list");
  box.innerHTML = dosyaCariKayitlar.length
    ? dosyaCariKayitlar
        .map(
          (k) => `
      <div class="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-xs">
        <span>${formatTarihTR(k.tarih)} · ${CARI_TUR_LABELS[k.tur] || k.tur}${k.aciklama ? " · " + k.aciklama : ""}</span>
        <span class="font-semibold ${k.tur === "odeme" ? "text-emerald-600" : "text-slate-700"}">${k.tur === "odeme" ? "-" : ""}${formatTL(k.tutar)}</span>
      </div>`
        )
        .join("")
    : '<p class="text-sm text-slate-400">Henüz kayıt yok.</p>';
}

function toggleCariHesapForm() {
  const form = document.getElementById("cari-hesap-form");
  form.classList.toggle("hidden");
  if (!form.classList.contains("hidden")) {
    document.getElementById("cari-tur").value = "ucret";
    document.getElementById("cari-tutar").value = "";
    document.getElementById("cari-tarih").value = todayStr();
    document.getElementById("cari-aciklama").value = "";
  }
}

async function submitCariHesapKaydi() {
  const tutar = document.getElementById("cari-tutar").value;
  if (!tutar || Number(tutar) <= 0) {
    showToast("Geçerli bir tutar girin.");
    return;
  }
  try {
    await api.createCariHesapKaydi(currentDosyaId, {
      tur: document.getElementById("cari-tur").value,
      tutar,
      tarih: document.getElementById("cari-tarih").value,
      aciklama: document.getElementById("cari-aciklama").value,
    });
    document.getElementById("cari-hesap-form").classList.add("hidden");
    showToast("Kayıt eklendi.");
    await loadDosyaCariHesap(currentDosyaId);
  } catch (err) {
    showToast("Eklenemedi: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// AAUT ucret hesaplayici — ORNEK/yaklasik oran tablosu, gercek AAUT DEGIL.
// Gercek oranlar her yil Resmi Gazete'de yayimlanir; bu tablo sadece
// hesaplayicinin nasil calisacagini gostermek icin ornek amaclidir.
// ---------------------------------------------------------------------------
const AAUT_ORNEK_DILIMLER = [
  { limit: 50000, oran: 0.16 },
  { limit: 100000, oran: 0.15 },
  { limit: 250000, oran: 0.14 },
  { limit: 500000, oran: 0.1 },
  { limit: Infinity, oran: 0.08 },
];

function hesaplaAAUT() {
  const deger = parseFloat(document.getElementById("aaut-deger").value);
  const box = document.getElementById("aaut-sonuc");
  if (!deger || deger <= 0) {
    showToast("Geçerli bir dava değeri girin.");
    return;
  }
  let kalan = deger;
  let alt = 0;
  let toplam = 0;
  const satirlar = [];
  for (const dilim of AAUT_ORNEK_DILIMLER) {
    if (kalan <= 0) break;
    const dilimGenisligi = dilim.limit - alt;
    const buDilim = Math.min(kalan, dilimGenisligi);
    const tutar = buDilim * dilim.oran;
    toplam += tutar;
    satirlar.push(`${formatTL(buDilim)} × %${(dilim.oran * 100).toFixed(0)} = ${formatTL(tutar)}`);
    kalan -= buDilim;
    alt = dilim.limit;
  }
  box.innerHTML = `
    <p class="font-bold text-indigo-900 mb-2">Tahmini Ücret: ${formatTL(toplam)}</p>
    <p class="text-xs text-slate-500 mb-2">Örnek dilimli hesaplama (gerçek AAÜT oranları değildir):</p>
    <ul class="text-xs text-slate-600 list-disc list-inside space-y-0.5">${satirlar.map((s) => `<li>${s}</li>`).join("")}</ul>
  `;
  box.classList.remove("hidden");
}
