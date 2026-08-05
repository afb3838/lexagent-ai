// Hesaplama Araclari modulu: Hukuki Sure, E-Tebligat Teblig Tarihi, Yasal Faiz,
// Icra Masrafi, Arabuluculuk Ucreti. Tarih/kural bazli hesaplar (sure, e-teblig)
// tamamen deterministiktir. Yillara gore degisen parasal oranlar (faiz, harc,
// arabuluculuk tarifesi) sistem tarafindan UYDURULMAZ; kullanici gunmcel orani
// "Guncel Orani Bul" butonuyla canli kaynaktan arayip kendisi girer.

function parseTarih(str) {
  return new Date(str + "T00:00:00");
}

// ---------------------------------------------------------------------------
// Dosya Formati Donusturucu (PDF/UDF/DOCX/JPG/PNG -> PDF)
// ---------------------------------------------------------------------------
async function handleDonusturucuSecim(event) {
  const file = event.target.files[0];
  if (!file) return;
  const durum = document.getElementById("donusturucu-durum");
  durum.classList.remove("hidden");
  durum.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-1"></i>Dönüştürülüyor...';
  try {
    await downloadFileAsPdf(file);
    durum.innerHTML = '<span class="text-emerald-600"><i class="fa-solid fa-circle-check mr-1"></i>PDF olarak indirildi.</span>';
  } catch (err) {
    durum.innerHTML = '<span class="text-rose-500">Dönüştürülemedi: ' + escapeHtml(err.message) + "</span>";
  } finally {
    event.target.value = "";
  }
}

// ---------------------------------------------------------------------------
// Hukuki Sure Hesaplama (HMK m.90-95, m.104 adli tatil uzatmasi)
// ---------------------------------------------------------------------------
function hesaplaHukukiSure() {
  const tebligStr = document.getElementById("sure-teblig-tarihi").value;
  const miktar = parseInt(document.getElementById("sure-miktar").value, 10);
  const birim = document.getElementById("sure-birim").value;
  const adliTatilUzat = document.getElementById("sure-adli-tatil").checked;
  const box = document.getElementById("sure-sonuc");

  if (!tebligStr || !miktar || miktar <= 0) {
    showToast("Tebliğ tarihi ve geçerli bir süre miktarı girin.");
    return;
  }

  const teblig = parseTarih(tebligStr);
  const notlar = [];
  let bitis;

  if (birim === "gun" || birim === "hafta") {
    // Gun bazli suredeki adli tatil gunleri sayilmaz (islemez); tatil bitiminden
    // itibaren kalan gunler + HMK m.104'teki 7 gunluk ilave eklenir. Onceki
    // implementasyon sadece "naif bitis tarihi tatile denk geliyor mu" bakiyordu,
    // bu da suresi tatilden once kismen islemis (ornegin uzun sureli) hesaplarda
    // yanlis (cok erken) bir bitis tarihi veriyordu.
    const gunSayisi = birim === "hafta" ? miktar * 7 : miktar;
    let kalan = gunSayisi;
    let tatileGirdiMi = false;
    let tarih = new Date(teblig);
    while (kalan > 0) {
      tarih.setDate(tarih.getDate() + 1);
      const ay = tarih.getMonth(); // 0-indeksli: 6 = Temmuz, 7 = Agustos
      const gunNo = tarih.getDate();
      const adliTatilde = adliTatilUzat && ((ay === 6 && gunNo >= 20) || ay === 7);
      if (adliTatilde) {
        tatileGirdiMi = true;
      } else {
        kalan--;
      }
    }
    if (tatileGirdiMi) {
      tarih.setDate(tarih.getDate() + 7);
      notlar.push(
        `Süre, adli tatil (20 Temmuz - 31 Ağustos) döneminde durduğu için bu dönemdeki günler sayılmadı; adli tatilin bitiminden itibaren kalan süre işletilip 7 gün ilave edilerek ${formatTarihTR(toDateStr(tarih))} tarihi bulundu (HMK m.104).`
      );
    }
    bitis = tarih;
  } else {
    bitis = new Date(teblig);
    if (birim === "ay") bitis.setMonth(bitis.getMonth() + miktar);
    else if (birim === "yil") bitis.setFullYear(bitis.getFullYear() + miktar);

    if (adliTatilUzat) {
      const yil = bitis.getFullYear();
      const adliBaslangic = new Date(yil, 6, 20);
      const adliBitis = new Date(yil, 7, 31, 23, 59, 59);
      if (bitis >= adliBaslangic && bitis <= adliBitis) {
        const yeniBitis = new Date(yil, 8, 1);
        yeniBitis.setDate(yeniBitis.getDate() + 7);
        notlar.push(
          `Hesaplanan tarih adli tatile (20 Temmuz - 31 Ağustos) denk geldiği için süre, adli tatilin bittiği günden itibaren 7 gün uzatılarak ${formatTarihTR(toDateStr(yeniBitis))} tarihine ertelendi (HMK m.104).`
        );
        bitis = yeniBitis;
      }
    }
  }

  const gun = bitis.getDay();
  if (gun === 6) {
    bitis.setDate(bitis.getDate() + 2);
    notlar.push("Hesaplanan son gün Cumartesi'ye denk geldiği için bir sonraki iş gününe (Pazartesi) uzatıldı.");
  } else if (gun === 0) {
    bitis.setDate(bitis.getDate() + 1);
    notlar.push("Hesaplanan son gün Pazar'a denk geldiği için bir sonraki iş gününe (Pazartesi) uzatıldı.");
  }

  box.innerHTML = `
    <p class="font-bold text-indigo-900 mb-2">Sürenin son günü: ${formatTarihTR(toDateStr(bitis))}</p>
    ${notlar.length ? `<ul class="text-xs text-slate-600 list-disc list-inside space-y-1 mb-2">${notlar.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>` : ""}
    <p class="text-xs text-slate-400 border-t border-slate-100 pt-2">Resmi/dini bayram günleri otomatik tespit edilmez; son gün bir bayrama denk geliyorsa ayrıca kontrol edip bir sonraki iş gününe göre değerlendirin.</p>
  `;
  box.classList.remove("hidden");
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// E-Tebligat Teblig Tarihi (7201 sayili Tebligat Kanunu Ek m.7)
// ---------------------------------------------------------------------------
function hesaplaETebligat() {
  const teslimStr = document.getElementById("etebligat-teslim-tarihi").value;
  const box = document.getElementById("etebligat-sonuc");
  if (!teslimStr) {
    showToast("Elektronik adrese teslim tarihini girin.");
    return;
  }
  const teslim = parseTarih(teslimStr);
  const teblig = new Date(teslim);
  teblig.setDate(teblig.getDate() + 5);
  box.innerHTML = `
    <p class="font-bold text-indigo-900 mb-2">Tebliğ tarihi: ${formatTarihTR(toDateStr(teblig))}</p>
    <p class="text-xs text-slate-500">Teslim tarihi (${formatTarihTR(teslimStr)}) izleyen 5. günün sonunda tebliğ yapılmış sayılır (takvim günü olarak hesaplanır, tatile rastlaması bu tarihi değiştirmez). Bu tarihten sonra işleyecek hukuki süreleri hesaplamak için "Hukuki Süre Hesaplama" aracını kullanabilirsiniz.</p>
  `;
  box.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Yasal Faiz Hesaplama
// ---------------------------------------------------------------------------
function hesaplaYasalFaiz() {
  const anapara = parseFloat(document.getElementById("faiz-anapara").value);
  const oran = parseFloat(document.getElementById("faiz-oran").value);
  const baslangicStr = document.getElementById("faiz-baslangic").value;
  const bitisStr = document.getElementById("faiz-bitis").value;
  const box = document.getElementById("faiz-sonuc");

  if (!anapara || anapara <= 0 || !oran || oran < 0 || !baslangicStr || !bitisStr) {
    showToast("Anapara, faiz oranı ve tarih aralığını eksiksiz girin.");
    return;
  }
  const baslangic = parseTarih(baslangicStr);
  const bitis = parseTarih(bitisStr);
  const gunSayisi = Math.round((bitis - baslangic) / 86400000);
  if (gunSayisi <= 0) {
    showToast("Bitiş tarihi başlangıçtan sonra olmalı.");
    return;
  }
  const faiz = (anapara * (oran / 100) * gunSayisi) / 365;
  const toplam = anapara + faiz;

  box.innerHTML = `
    <p class="font-bold text-indigo-900 mb-2">Hesaplanan faiz: ${formatTL(faiz)}</p>
    <ul class="text-xs text-slate-600 list-disc list-inside space-y-0.5 mb-2">
      <li>Süre: ${gunSayisi} gün (${formatTarihTR(baslangicStr)} — ${formatTarihTR(bitisStr)})</li>
      <li>Formül: ${formatTL(anapara)} × %${oran} × ${gunSayisi}/365</li>
      <li>Anapara + Faiz = <strong>${formatTL(toplam)}</strong></li>
    </ul>
    <p class="text-xs text-slate-400 border-t border-slate-100 pt-2">Basit faiz esasıyla hesaplanmıştır (yıl=365 gün kabul edilmiştir). Girdiğiniz oranın doğru dönem/türe (adi kanuni faiz, temerrüt faizi, avans faizi) ait olduğunu kontrol edin.</p>
  `;
  box.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Icra Masrafi Hesaplama (492 sayili Harclar Kanunu (1) sayili tarife, B bolumu)
// Oranlar (binde 5 pesin harc; %4,55 / %9,10 / %11,38 / %2,27 kademeli tahsil
// harci) kanunda sabit yuzdeler olarak belirlenmis olup yillara gore degismez;
// yalniz basvurma harci gibi maktu TL tutarlari her yil yeniden degerleme
// oranina gore guncellenir (burada 2026 tutari onceden dolduruldu, kullanici
// isterse degistirebilir / "Guncel Oranlari Bul" ile teyit edebilir).
// ---------------------------------------------------------------------------
function toggleIcraAlanlari() {
  const ilamsiz = document.getElementById("icra-tur").value === "ilamsiz";
  document.getElementById("icra-pesin-alani").classList.toggle("hidden", !ilamsiz);
}

function icraTahsilAsamaDegisti() {
  const secim = document.getElementById("icra-tahsil-asama").value;
  const ozelInput = document.getElementById("icra-tahsil-oran");
  if (secim === "custom") {
    ozelInput.classList.remove("hidden");
    ozelInput.value = "";
    ozelInput.focus();
  } else {
    ozelInput.classList.add("hidden");
    ozelInput.value = secim;
  }
}

function hesaplaIcraMasrafi() {
  const tutar = parseFloat(document.getElementById("icra-tutar").value);
  const tur = document.getElementById("icra-tur").value;
  const basvurma = parseFloat(document.getElementById("icra-basvurma").value) || 0;
  const pesinOran = parseFloat(document.getElementById("icra-pesin-oran").value) || 0;
  const tahsilOran = parseFloat(document.getElementById("icra-tahsil-oran").value) || 0;
  const vekalet = parseFloat(document.getElementById("icra-vekalet").value) || 0;
  const box = document.getElementById("icra-sonuc");

  if (!tutar || tutar <= 0) {
    showToast("Geçerli bir alacak tutarı girin.");
    return;
  }

  const kalemler = [{ ad: "Başvurma harcı (maktu)", tutar: basvurma }];
  let pesinHarc = 0;
  if (tur === "ilamsiz") {
    pesinHarc = tutar * (pesinOran / 1000);
    kalemler.push({ ad: `Peşin harç (‰${pesinOran || 0})`, tutar: pesinHarc });
  }
  const tahsilHarciTam = tutar * (tahsilOran / 100);
  const tahsilHarci = tur === "ilamsiz" ? Math.max(0, tahsilHarciTam - pesinHarc) : tahsilHarciTam;
  kalemler.push({
    ad: `Tahsil harcı (%${tahsilOran || 0}${tur === "ilamsiz" ? ", peşin harç mahsup edilmiş" : ""})`,
    tutar: tahsilHarci,
  });
  kalemler.push({ ad: "Vekalet (icra takip) ücreti", tutar: vekalet });

  const toplam = kalemler.reduce((s, k) => s + k.tutar, 0);

  box.innerHTML = `
    <p class="font-bold text-indigo-900 mb-2">Tahmini toplam masraf: ${formatTL(toplam)}</p>
    <ul class="text-xs text-slate-600 list-disc list-inside space-y-0.5 mb-2">
      ${kalemler.map((k) => `<li>${escapeHtml(k.ad)}: <strong>${formatTL(k.tutar)}</strong></li>`).join("")}
    </ul>
    <p class="text-xs text-slate-400 border-t border-slate-100 pt-2">Tahsil harcı oranları (492 s. Harçlar K. (1) sayılı tarife B bölümü) ödeme aşamasına göre kademelidir; ilamsız takipte başlangıçta ödenen peşin harç, tahsil harcından mahsup edilmiştir (İİK m.29). Başvurma harcı gibi maktu tutarlar yıl başında değişebilir — yeni yılda "Güncel Oranları Bul" ile teyit edin.</p>
  `;
  box.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Arabuluculuk Ucreti Hesaplama
// ---------------------------------------------------------------------------
function toggleArabAlanlari() {
  const paraOlan = document.getElementById("arab-tur").value === "para-olan";
  document.getElementById("arab-saat-alani").classList.toggle("hidden", paraOlan);
  document.getElementById("arab-saatlik-ucret-alani").classList.toggle("hidden", paraOlan);
  document.getElementById("arab-tutar-alani").classList.toggle("hidden", !paraOlan);
  document.getElementById("arab-nispi-oran-alani").classList.toggle("hidden", !paraOlan);
}

function hesaplaArabuluculuk() {
  const paraOlan = document.getElementById("arab-tur").value === "para-olan";
  const taraf = parseInt(document.getElementById("arab-taraf").value, 10) || 2;
  const box = document.getElementById("arab-sonuc");

  if (paraOlan) {
    const tutar = parseFloat(document.getElementById("arab-tutar").value);
    const oran = parseFloat(document.getElementById("arab-nispi-oran").value);
    if (!tutar || tutar <= 0 || !oran || oran < 0) {
      showToast("Uyuşmazlık tutarını ve nispi oranı girin.");
      return;
    }
    const ucret = tutar * (oran / 100);
    box.innerHTML = `
      <p class="font-bold text-indigo-900 mb-2">Tahmini arabuluculuk ücreti: ${formatTL(ucret)}</p>
      <p class="text-xs text-slate-600">Formül: ${formatTL(tutar)} × %${oran}</p>
      <p class="text-xs text-slate-400 border-t border-slate-100 pt-2 mt-2">Parayla ölçülebilen uyuşmazlıklarda ücret, konusu ve taraf sayısına göre kademeli bir tarifeye tabidir; girdiğiniz tek oranla basitleştirilmiştir — "Güncel Tarifeyi Bul" ile kontrol edin.</p>
    `;
  } else {
    const saat = Math.max(2, parseFloat(document.getElementById("arab-saat").value) || 2);
    const saatlikUcret = parseFloat(document.getElementById("arab-saatlik-ucret").value);
    if (!saatlikUcret || saatlikUcret <= 0) {
      showToast("Saatlik ücreti girin.");
      return;
    }
    const tarafCarpani = taraf > 2 ? 1 + (taraf - 2) * 0.1 : 1;
    const ucret = saat * saatlikUcret * tarafCarpani;
    box.innerHTML = `
      <p class="font-bold text-indigo-900 mb-2">Tahmini arabuluculuk ücreti: ${formatTL(ucret)}</p>
      <ul class="text-xs text-slate-600 list-disc list-inside space-y-0.5">
        <li>Çalışma süresi: ${saat} saat × ${formatTL(saatlikUcret)}</li>
        <li>Taraf sayısı çarpanı (${taraf} taraf): ×${tarafCarpani.toFixed(2)}</li>
      </ul>
      <p class="text-xs text-slate-400 border-t border-slate-100 pt-2 mt-2">Taraf sayısı arttıkça uygulanan artış oranı tarifeye göre değişebilir; burada basitleştirilmiş bir varsayım (taraf başına +%10) kullanılmıştır — "Güncel Tarifeyi Bul" ile kontrol edin.</p>
    `;
  }
  box.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Ortak: mevcut canli Mevzuat aramasini kullanarak guncel oran/tarife arama
// ---------------------------------------------------------------------------
async function guncelOranAra(sorgu, sourcesElId, textElId) {
  document.getElementById(textElId).innerHTML =
    '<div class="text-center py-6 text-slate-400"><i class="fa-solid fa-spinner animate-spin mr-1"></i>Güncel oran aranıyor...</div>';
  document.getElementById(sourcesElId).innerHTML = "";
  try {
    const data = await api.searchMevzuat(sorgu);
    renderKaynakliSonuc(sourcesElId, textElId, data.result, data.sources, "Güncel oran bulunamadı, resmi kaynaktan kontrol edin.");
  } catch (err) {
    document.getElementById(textElId).innerHTML = '<p class="text-sm text-rose-500">Arama başarısız: ' + escapeHtml(err.message) + "</p>";
  }
}
