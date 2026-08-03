// Mevzuat arama - canli arama modulu. Emsal Arastirma modulundekiyle ayni
// yaklasimi (Gemini + google_search grounding) ve ayni sonuc gorunumunu
// (renderKaynakliSonuc, api.js) kullanir - sabit ornek veri seti yok.
function clearMevzuatSonuc(message) {
  document.getElementById("mevzuat-sources").innerHTML = "";
  document.getElementById("mevzuat-text").innerHTML = `<p class="text-sm text-slate-400">${message}</p>`;
}

async function loadMevzuatPage() {
  document.getElementById("mevzuat-arama").value = "";
  clearMevzuatSonuc("Aramak için bir kanun/madde/konu girin.");
}

async function aramaMevzuat() {
  const q = document.getElementById("mevzuat-arama").value.trim();
  if (!q) {
    clearMevzuatSonuc("Aramak için bir kanun/madde/konu girin.");
    return;
  }
  clearMevzuatSonuc('<i class="fa-solid fa-magnifying-glass animate-pulse mr-1"></i>Gerçek kaynaklar taranıyor, birkaç saniye sürebilir...');
  try {
    const data = await api.searchMevzuat(q);
    renderKaynakliSonuc(
      "mevzuat-sources",
      "mevzuat-text",
      data.result,
      data.sources,
      "Bu konuda doğrulanmış bir mevzuat hükmü bulunamadı. Farklı anahtar kelimelerle (kanun adı, madde no) tekrar deneyin."
    );
  } catch (err) {
    document.getElementById("mevzuat-sources").innerHTML = "";
    document.getElementById("mevzuat-text").innerHTML =
      '<p class="text-sm text-rose-500">Arama başarısız: ' + escapeHtml(err.message) + "</p>";
  }
}
