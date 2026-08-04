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

let cariKaydiGonderiliyor = false;

async function submitCariHesapKaydi() {
  if (cariKaydiGonderiliyor) return;
  const tutar = document.getElementById("cari-tutar").value;
  if (!tutar || Number(tutar) <= 0) {
    showToast("Geçerli bir tutar girin.");
    return;
  }
  cariKaydiGonderiliyor = true;
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
  } finally {
    cariKaydiGonderiliyor = false;
  }
}

// ---------------------------------------------------------------------------
// AAUT ucret hesaplayici — Avukatlik Asgari Ucret Tarifesi (Resmi Gazete Sayi
// 33067, 4 Kasim 2025, Turkiye Barolar Birligi). Tablo 1 (konusu para olmayan
// islerde mahkemeye gore maktu ucret) ve Tablo 2 (konusu para olan islerde
// dava degerine gore kademeli/kumulatif nispi ucret) rakamlari kullanicinin
// dogrudan verdigi resmi metne dayanir - burada UYDURULMAMISTIR. Listede
// olmayan ozel durumlar icin hesaplama yapilmaz, kullaniciya tarifeyi elle
// kontrol etmesi soylenir.
// ---------------------------------------------------------------------------
const AAUT_KAYNAK_URL = "https://www.resmigazete.gov.tr/eskiler/2025/11/20251104-9-1.pdf";

// Tablo 2 — konusu para olan islerde dava degerine gore kademeli oran.
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

// Tablo 1 — konusu para olmayan/degerlendirilemeyen islerde, davanin
// goruldugu mahkemeye gore maktu ucret (Ikinci Kisim Ikinci Bolum).
const AAUT_TABLO1 = [
  { id: "icra_daireleri", ad: "İcra Daireleri", tutar: 9000 },
  { id: "icra_mahkemeleri_is", ad: "İcra Mahkemeleri (iş)", tutar: 11000 },
  { id: "icra_mahkemeleri_dava", ad: "İcra Mahkemeleri (dava/duruşmalı)", tutar: 18000 },
  { id: "icra_tahliye", ad: "Tahliyeye İlişkin İcra Takipleri", tutar: 20000 },
  { id: "icra_mahkemeleri_ceza", ad: "İcra Mahkemeleri (ceza işleri)", tutar: 15000 },
  { id: "sulh_hukuk", ad: "Sulh Hukuk Mahkemeleri", tutar: 30000 },
  { id: "sulh_ceza_infaz", ad: "Sulh Ceza / İnfaz Hakimlikleri", tutar: 18000 },
  { id: "asliye", ad: "Asliye Mahkemeleri", tutar: 45000 },
  { id: "tuketici", ad: "Tüketici Mahkemeleri", tutar: 22500 },
  { id: "fikri_sinai", ad: "Fikri ve Sınai Haklar Mahkemeleri", tutar: 55000 },
  { id: "agir_ceza", ad: "Ağır Ceza Mahkemeleri", tutar: 65000 },
  { id: "cocuk", ad: "Çocuk Mahkemeleri", tutar: 45000 },
  { id: "cocuk_agir_ceza", ad: "Çocuk Ağır Ceza Mahkemeleri", tutar: 65000 },
  { id: "idare_vergi_durusmasiz", ad: "İdare/Vergi Mahkemeleri (duruşmasız)", tutar: 30000 },
  { id: "idare_vergi_durusmali", ad: "İdare/Vergi Mahkemeleri (duruşmalı)", tutar: 40000 },
  { id: "bam_bim_ilk", ad: "BAM/BİM İlk Derece", tutar: 35000 },
  { id: "bam_bim_istinaf_tek", ad: "BAM/BİM İstinaf (tek duruşma)", tutar: 22000 },
  { id: "bam_bim_istinaf_coklu", ad: "BAM/BİM İstinaf (çoklu duruşma/keşif)", tutar: 42000 },
  { id: "yargitay_ilk", ad: "Yargıtay İlk Derece", tutar: 65000 },
  { id: "danistay_durusmasiz", ad: "Danıştay İlk Derece (duruşmasız)", tutar: 40000 },
  { id: "danistay_durusmali", ad: "Danıştay İlk Derece (duruşmalı)", tutar: 65000 },
  { id: "temyiz_durusmasi", ad: "Yargıtay/Danıştay/Sayıştay Temyiz Duruşması", tutar: 40000 },
  { id: "uyusmazlik", ad: "Uyuşmazlık Mahkemesi", tutar: 40000 },
  { id: "aym_yuce_divan", ad: "AYM Yüce Divan", tutar: 120000 },
  { id: "aym_bireysel_durusmasiz", ad: "AYM Bireysel Başvuru (duruşmasız)", tutar: 40000 },
  { id: "aym_bireysel_durusmali", ad: "AYM Bireysel Başvuru (duruşmalı)", tutar: 80000 },
  { id: "aym_bireysel_diger", ad: "AYM Bireysel Başvuru (diğer)", tutar: 90000 },
];

function initAautMahkemeSelect() {
  const sel = document.getElementById("aaut-mahkeme");
  if (!sel || sel.options.length) return;
  sel.innerHTML = AAUT_TABLO1.map((m) => `<option value="${m.id}">${m.ad} (${formatTL(m.tutar)})</option>`).join("");
}

function toggleAautDeger() {
  const paraOlan = document.getElementById("aaut-para-olcumu").value === "olan";
  document.getElementById("aaut-deger-alani").classList.toggle("hidden", !paraOlan);
}

function aautTablo2Hesapla(deger) {
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
  return { toplam, satirlar };
}

function hesaplaAAUT() {
  const mahkeme = AAUT_TABLO1.find((m) => m.id === document.getElementById("aaut-mahkeme").value);
  const paraOlan = document.getElementById("aaut-para-olcumu").value === "olan";
  const ozelDurum = document.getElementById("aaut-ozel-durum").value;
  const box = document.getElementById("aaut-sonuc");
  if (!mahkeme) {
    showToast("Dava/iş türünü seçin.");
    return;
  }

  let taban = 0;
  let tabloAciklama = "";

  if (!paraOlan) {
    taban = mahkeme.tutar;
    tabloAciklama = `Tablo 1 — ${mahkeme.ad}: <strong>${formatTL(mahkeme.tutar)}</strong> (konusu para ile ölçülemeyen işler).`;
  } else {
    const deger = parseFloat(document.getElementById("aaut-deger").value);
    if (!deger || deger <= 0) {
      showToast("Geçerli bir dava değeri girin.");
      return;
    }
    if (mahkeme.id === "icra_daireleri" && deger <= 56250) {
      taban = mahkeme.tutar;
      tabloAciklama = `Madde 11 — takip miktarı ${formatTL(56250)}'ye kadar olduğu için maktu ücret esas alındı: <strong>${formatTL(mahkeme.tutar)}</strong>.`;
    } else {
      const nispi = aautTablo2Hesapla(deger);
      if (nispi.toplam >= mahkeme.tutar) {
        taban = nispi.toplam;
        tabloAciklama = `Tablo 2 (nispi) — <strong>${formatTL(nispi.toplam)}</strong>, Tablo 1 maktu ücretten (${formatTL(mahkeme.tutar)}) düşük olamayacağı için nispi tutar esas alındı (Madde 13).<br><span class="text-slate-400">${nispi.satirlar.join(" · ")}</span>`;
      } else {
        taban = mahkeme.tutar;
        tabloAciklama = `Tablo 1 maktu ücret — <strong>${formatTL(mahkeme.tutar)}</strong>, hesaplanan nispi tutardan (${formatTL(nispi.toplam)}) yüksek olduğu için esas alındı (Madde 13 — nispi ücret maktu ücretin altına düşemez).`;
      }
    }
  }

  let sonuc = taban;
  let ozelAciklama = "";
  if (ozelDurum === "madde6_yarisi") {
    sonuc = taban * 0.5;
    ozelAciklama = "Madde 6: Ön inceleme duruşması/tutanağından önce feragat, kabul veya sulh ile sonuçlandığı için ücretin yarısı uygulandı.";
  } else if (ozelDurum === "madde7_yarisi") {
    sonuc = Math.min(taban * 0.5, mahkeme.tutar);
    ozelAciklama = `Madde 7: Tutanaktan önce görevsizlik/yetkisizlik/husumet nedeniyle ret — ücretin yarısı, Tablo 1 mahkeme ücretini (${formatTL(mahkeme.tutar)}) geçemez.`;
  } else if (ozelDurum === "madde7_tamami") {
    sonuc = Math.min(taban, mahkeme.tutar);
    ozelAciklama = `Madde 7: Tutanaktan sonra görevsizlik/yetkisizlik/husumet nedeniyle ret — ücretin tamamı, Tablo 1 mahkeme ücretini (${formatTL(mahkeme.tutar)}) geçemez.`;
  } else if (ozelDurum === "madde11_pesin") {
    sonuc = taban * 0.75;
    ozelAciklama = "Madde 11: Borçlu, ödeme/icra emrindeki süre içinde borcunu öderse ücretin 3/4'ü uygulanır.";
  } else if (ozelDurum === "madde16_arabuluculuk") {
    if (paraOlan) {
      const deger = parseFloat(document.getElementById("aaut-deger").value) || 0;
      const esas = deger <= 50000 ? mahkeme.tutar : aautTablo2Hesapla(deger).toplam;
      sonuc = Math.min(esas * 1.25, deger);
      ozelAciklama = `Madde 16: Dava şartı arabuluculukta anlaşma sağlandığı için esas tutarın 1/4 fazlası uygulandı, asıl alacağı (${formatTL(deger)}) geçemez.`;
    } else {
      sonuc = mahkeme.tutar * 1.25;
      ozelAciklama = "Madde 16: Dava şartı arabuluculukta anlaşma sağlandığı için Tablo 1 maktu ücretin 1/4 fazlası uygulandı.";
    }
  }

  box.innerHTML = `
    <p class="font-bold text-indigo-900 mb-2">Hesaplanan vekalet ücreti: ${formatTL(sonuc)}</p>
    <p class="text-xs text-slate-600 mb-2">${tabloAciklama}</p>
    ${ozelAciklama ? `<p class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mb-2">${ozelAciklama}</p>` : ""}
    <p class="text-xs text-slate-400 border-t border-slate-100 pt-2">
      Kaynak: Avukatlık Asgari Ücret Tarifesi, Resmi Gazete Sayı 33067, 4 Kasım 2025, Türkiye Barolar Birliği —
      <a href="${AAUT_KAYNAK_URL}" target="_blank" class="text-indigo-600 hover:underline">tam metin <i class="fa-solid fa-arrow-up-right-from-square ml-0.5"></i></a>.
      Bu araç yardımcı niteliktedir, nihai hesaplama avukata aittir.
    </p>
  `;
  box.classList.remove("hidden");
}
