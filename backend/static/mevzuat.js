// Mevzuat arama - ISKELET modulu. Kucuk bir ornek veri seti icerir,
// tam mevzuat.gov.tr / Resmi Gazete entegrasyonu ayri bir calismadir.
async function loadMevzuatPage() {
  document.getElementById("mevzuat-arama").value = "";
  await aramaMevzuat();
}

async function aramaMevzuat() {
  const q = document.getElementById("mevzuat-arama").value.trim();
  const box = document.getElementById("mevzuat-sonuc");
  box.innerHTML = '<p class="text-sm text-slate-400">Aranıyor...</p>';
  try {
    const sonuclar = await api.searchMevzuat(q);
    box.innerHTML = sonuclar.length
      ? sonuclar
          .map(
            (m) => `
      <div class="border border-slate-200 rounded-lg px-4 py-3 text-sm">
        <p class="font-semibold">${m.kanun_adi}${m.kanun_no ? " (" + m.kanun_no + ")" : ""}</p>
        <p class="text-xs text-slate-500 mt-1">${m.ozet || ""}</p>
        <div class="flex items-center justify-between mt-2">
          <span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">${m.kategori || ""}</span>
          ${m.kaynak_url ? `<a href="${m.kaynak_url}" target="_blank" class="text-xs text-indigo-600 hover:underline">Kaynağa git <i class="fa-solid fa-arrow-up-right-from-square ml-0.5"></i></a>` : ""}
        </div>
      </div>`
          )
          .join("")
      : '<p class="text-sm text-slate-400">Sonuç bulunamadı.</p>';
  } catch (err) {
    box.innerHTML = '<p class="text-sm text-rose-500">Arama başarısız: ' + err.message + "</p>";
  }
}
