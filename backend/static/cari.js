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
// AAUT ucret hesaplayici — 2025-2026 Avukatlik Asgari Ucret Tarifesi'nin
// (Resmi Gazete Sayi: 33067, Tarih: 04.11.2025) nispi vekalet ucreti dilim
// tablosuna dayanir. Iki bagimsiz kaynaktan capraz dogrulanmistir. Yine de
// yillik degisebildigi ve tam metnin istisna/ozel durumlar icerebilecegi
// icin sonuc mutlaka Resmi Gazete metniyle karsilastirilmalidir.
// ---------------------------------------------------------------------------
const AAUT_KAYNAK_URL = "https://www.resmigazete.gov.tr/eskiler/2025/11/20251104-9-1.pdf";
const AAUT_DILIMLERI = [
  { limit: 600000, oran: 0.16 },
  { limit: 1200000, oran: 0.15 },
  { limit: 2400000, oran: 0.14 },
  { limit: 3600000, oran: 0.13 },
  { limit: 5400000, oran: 0.11 },
  { limit: 7800000, oran: 0.08 },
  { limit: 10800000, oran: 0.05 },
  { limit: 14400000, oran: 0.03 },
  { limit: 18600000, oran: 0.02 },
  { limit: Infinity, oran: 0.01 },
];

const AAUT_MAKTU_UCRETLER = [
  { ad: "İcra dairelerinde takip (maktu, asıl alacağı geçemez)", tutar: 9000 },
  { ad: "Tahliyeye ilişkin icra takibi", tutar: 20000 },
  { ad: "Dilekçe / ihtarname düzenlenmesi", tutar: 6500 },
  { ad: "Kira sözleşmesi hazırlanması", tutar: 8000 },
  { ad: "Büroda sözlü danışma (ilk saat)", tutar: 4000 },
  { ad: "İlk derece mahkemelerinde (duruşmalı) takip", tutar: 45000 },
  { ad: "Boşanma davası (asgari)", tutar: 45000 },
  { ad: "İdare/vergi mahkemesi (duruşmasız)", tutar: 30000 },
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
  for (const dilim of AAUT_DILIMLERI) {
    if (kalan <= 0) break;
    const dilimGenisligi = dilim.limit - alt;
    const buDilim = Math.min(kalan, dilimGenisligi);
    const tutar = buDilim * dilim.oran;
    toplam += tutar;
    satirlar.push(`${formatTL(buDilim)} × %${(dilim.oran * 100).toFixed(0)} = ${formatTL(tutar)}`);
    kalan -= buDilim;
    alt = dilim.limit;
  }
  const maktuHtml = AAUT_MAKTU_UCRETLER.map((m) => `<li>${m.ad}: <strong>${formatTL(m.tutar)}</strong></li>`).join("");
  box.innerHTML = `
    <p class="font-bold text-indigo-900 mb-2">Nispi Vekalet Ücreti (tahmini): ${formatTL(toplam)}</p>
    <p class="text-xs text-slate-500 mb-2">Dilim hesaplaması:</p>
    <ul class="text-xs text-slate-600 list-disc list-inside space-y-0.5 mb-3">${satirlar.map((s) => `<li>${s}</li>`).join("")}</ul>
    <p class="text-xs font-semibold text-slate-700 mb-1">Sık kullanılan maktu ücretler (2025-2026):</p>
    <ul class="text-xs text-slate-600 list-disc list-inside space-y-0.5 mb-3">${maktuHtml}</ul>
    <p class="text-xs text-slate-400 border-t border-slate-100 pt-2">
      Kaynak: 2025-2026 Avukatlık Asgari Ücret Tarifesi, Resmi Gazete Sayı: 33067, 04.11.2025 —
      <a href="${AAUT_KAYNAK_URL}" target="_blank" class="text-indigo-600 hover:underline">tam metin <i class="fa-solid fa-arrow-up-right-from-square ml-0.5"></i></a>
    </p>
  `;
  box.classList.remove("hidden");
}
