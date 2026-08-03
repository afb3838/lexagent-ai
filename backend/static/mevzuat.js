// Mevzuat arama - canli arama modulu. Emsal Arastirma modulundekiyle ayni
// yaklasimi kullanir: Gemini + google_search grounding ile mevzuat.gov.tr/Resmi
// Gazete kaynakli, dogrulanabilir sonuclar arar (sabit ornek veri seti yok).
async function loadMevzuatPage() {
  document.getElementById("mevzuat-arama").value = "";
  document.getElementById("mevzuat-sonuc").innerHTML =
    '<p class="text-sm text-slate-400">Aramak için bir kanun/madde/konu girin.</p>';
}

async function aramaMevzuat() {
  const q = document.getElementById("mevzuat-arama").value.trim();
  const box = document.getElementById("mevzuat-sonuc");
  if (!q) {
    box.innerHTML = '<p class="text-sm text-slate-400">Aramak için bir kanun/madde/konu girin.</p>';
    return;
  }
  box.innerHTML = '<p class="text-sm text-slate-400"><i class="fa-solid fa-magnifying-glass animate-pulse mr-1"></i>Gerçek kaynaklar taranıyor, birkaç saniye sürebilir...</p>';
  try {
    const data = await api.searchMevzuat(q);
    const sourcesHtml = (data.sources || [])
      .map(
        (s) =>
          `<a href="${s.uri}" target="_blank" class="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 px-2.5 py-1 rounded-md border border-slate-200 inline-block mr-1 mb-1"><i class="fa-solid fa-link mr-1"></i>${s.title.substring(0, 50)}</a>`
      )
      .join("");
    box.innerHTML = data.result
      ? `<div class="border border-slate-200 rounded-lg p-4 space-y-3">
          <div class="flex flex-wrap gap-1">${sourcesHtml || '<span class="text-xs text-slate-400">Kaynak bağlantısı dönmedi.</span>'}</div>
          <div class="text-sm whitespace-pre-wrap leading-relaxed">${data.result}</div>
        </div>`
      : '<p class="text-sm text-slate-400">Sonuç bulunamadı.</p>';
  } catch (err) {
    box.innerHTML = '<p class="text-sm text-rose-500">Arama başarısız: ' + err.message + "</p>";
  }
}
