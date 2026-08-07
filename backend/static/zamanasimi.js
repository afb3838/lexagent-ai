// Zamanasimi Takip Radari: alacak/dava turune gore kanunda sabit olarak
// belirlenmis zamanasimi surelerini (TBK, TTK, 4857 s. Is K. vb.) hesaplar.
// Bu sureler, faiz/harc orani gibi yillara gore degisen piyasa degiskenleri
// DEGILDIR - kanun metninde sabit rakam olarak yazilidir, bu yuzden burada
// onceden doldurulmustur. Yine de kesilme/durma halleri (dava acilmasi, icra
// takibi, borcun ikrari vb.) somut olaya gore ayrica degerlendirilmelidir.

const ZAMANASIMI_TURLERI = [
  {
    id: "genel",
    ad: "Genel Zamanaşımı (TBK m.146)",
    yil: 10,
    aciklama: "Kanunda aksi öngörülmedikçe her türlü alacak için uygulanan genel süre.",
  },
  {
    id: "tbk147",
    ad: "Kira Bedeli, Sözleşme Cezası vb. (TBK m.147)",
    yil: 5,
    aciklama: "Kira bedeli, faiz, ücret gibi TBK m.147'de sayılan alacaklar.",
  },
  {
    id: "haksiz-fiil",
    ad: "Haksız Fiil / Tazminat (TBK m.72)",
    yil: 2,
    azamiYil: 10,
    aciklama: "Zarar görenin, zararı ve failini öğrendiği tarihten itibaren 2 yıl; her hâlde olay tarihinden itibaren azami 10 yıl.",
    ogrenmeTarihiGerekli: true,
  },
  {
    id: "iscilik",
    ad: "İşçilik Alacakları (4857 s. İş K. Ek m.3, m.32)",
    yil: 5,
    aciklama: "Kıdem, ihbar, kötüniyet, izin ücreti ve ücret alacakları dahil (7036 s. Kanun ile 25.10.2017 sonrası için).",
  },
  {
    id: "kambiyo",
    ad: "Kambiyo Senedi — Asıl Borçluya Karşı (TTK m.749)",
    yil: 3,
    aciklama: "Bono/poliçede kabul edene, çekte keşideciye karşı; vade tarihinden itibaren.",
  },
  {
    id: "sigorta",
    ad: "Sigorta Tazminatı Talebi (TTK m.1420)",
    yil: 2,
    aciklama: "Sigorta sözleşmesinden doğan tüm talepler için (bazı dal sigortalarında farklılık gösterebilir, poliçeyi kontrol edin).",
  },
  {
    id: "ayipli-mal",
    ad: "Ayıplı Mal / Hizmet (TKHK m.12)",
    yil: 2,
    aciklama: "Ayıp gizli değilse teslimden itibaren; konut/tatil amaçlı taşınmazlarda süre 5 yıldır.",
  },
  {
    id: "ticari",
    ad: "Ticari Alacak (Genel, TBK m.146)",
    yil: 10,
    aciklama: "Aksine özel bir hüküm yoksa ticari alacaklar da genel 10 yıllık süreye tabidir; sözleşmede kısaltma varsa onu esas alın.",
  },
];

function initZamanasimiTurSelect() {
  const select = document.getElementById("zamanasimi-tur");
  if (select.options.length) return;
  select.innerHTML = ZAMANASIMI_TURLERI.map((t) => `<option value="${t.id}">${escapeHtml(t.ad)}</option>`).join("");
  toggleZamanasimiOgrenmeAlani();
}

function toggleZamanasimiOgrenmeAlani() {
  const tur = ZAMANASIMI_TURLERI.find((t) => t.id === document.getElementById("zamanasimi-tur").value);
  document.getElementById("zamanasimi-ogrenme-alani").classList.toggle("hidden", !tur.ogrenmeTarihiGerekli);
  document.getElementById("zamanasimi-baslangic-label").textContent = tur.ogrenmeTarihiGerekli
    ? "Zarar Verici Olayın Tarihi"
    : "Alacağın Muaccel Olduğu / Doğduğu Tarih";
}

function hesaplaZamanasimi() {
  const tur = ZAMANASIMI_TURLERI.find((t) => t.id === document.getElementById("zamanasimi-tur").value);
  const baslangicStr = document.getElementById("zamanasimi-baslangic").value;
  const box = document.getElementById("zamanasimi-sonuc");

  if (!baslangicStr) {
    showToast("Başlangıç tarihini girin.");
    return;
  }

  const baslangic = parseTarih(baslangicStr);
  const notlar = [];
  let sonBitis;

  if (tur.ogrenmeTarihiGerekli) {
    const ogrenmeStr = document.getElementById("zamanasimi-ogrenme").value;
    if (!ogrenmeStr) {
      showToast("Zararın ve failin öğrenildiği tarihi de girin.");
      return;
    }
    const ogrenme = parseTarih(ogrenmeStr);
    const kisaBitis = new Date(ogrenme);
    kisaBitis.setFullYear(kisaBitis.getFullYear() + tur.yil);
    const azamiBitis = new Date(baslangic);
    azamiBitis.setFullYear(azamiBitis.getFullYear() + tur.azamiYil);
    sonBitis = kisaBitis < azamiBitis ? kisaBitis : azamiBitis;
    notlar.push(
      `Kısa süre (öğrenmeden itibaren ${tur.yil} yıl): ${formatTarihTR(toDateStr(kisaBitis))}`,
      `Azami süre (olaydan itibaren ${tur.azamiYil} yıl): ${formatTarihTR(toDateStr(azamiBitis))}`,
      "İki tarihten hangisi daha önce geliyorsa zamanaşımı o tarihte dolar."
    );
  } else {
    sonBitis = new Date(baslangic);
    sonBitis.setFullYear(sonBitis.getFullYear() + tur.yil);
  }

  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  const kalanGun = Math.round((sonBitis - bugun) / 86400000);
  let durumHtml;
  if (kalanGun < 0) {
    durumHtml = `<span class="text-rose-600 font-bold">Zamanaşımı süresi ${formatTarihTR(toDateStr(sonBitis))} tarihinde DOLMUŞ (${Math.abs(kalanGun)} gün önce).</span>`;
  } else if (kalanGun <= 90) {
    durumHtml = `<span class="text-amber-600 font-bold">Dikkat: son ${kalanGun} gün içinde zamanaşımı dolacak.</span>`;
  } else {
    durumHtml = `<span class="text-emerald-600 font-bold">${kalanGun} gün kaldı.</span>`;
  }

  box.innerHTML = `
    <p class="font-bold text-indigo-900 mb-1">Zamanaşımı tarihi: ${formatTarihTR(toDateStr(sonBitis))}</p>
    <p class="text-sm mb-2">${durumHtml}</p>
    <p class="text-xs text-slate-600 mb-2">${escapeHtml(tur.ad)} — ${escapeHtml(tur.aciklama)}</p>
    ${notlar.length ? `<ul class="text-xs text-slate-600 list-disc list-inside space-y-0.5 mb-2">${notlar.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>` : ""}
    <p class="text-xs text-slate-400 border-t border-slate-100 pt-2">Zamanaşımı; dava açılması, icra takibi başlatılması veya borcun ikrarı gibi hallerle kesilebilir ve o andan itibaren yeniden işlemeye başlar (TBK m.154-157). Bu hesap, herhangi bir kesilme/durma olmadığı varsayımıyla yapılmıştır — somut dosyayı mutlaka kontrol edin.</p>
  `;
  box.classList.remove("hidden");
}
