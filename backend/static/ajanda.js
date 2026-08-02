// Ajanda / Takvim modulu. Onemli: burada hicbir otomatik sure/zamanasimi
// HESAPLAMASI yapilmaz - kullanici tarihi kendisi girer, sayfadaki sabit uyari
// bunu hatirlatir.
const ETKINLIK_TUR_LABELS = { durusma: "Duruşma", sure: "Süre", hatirlatma: "Hatırlatma", genel: "Genel" };
const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

let calendarViewDate = new Date();
let calendarEtkinlikler = [];
let selectedDay = null;
let dosyaEtkinlikler = [];
let etkinlikFormDosyaId = null;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTarihTR(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

// ---------------------------------------------------------------------------
// Ajanda sayfasi (takvim + yaklasan etkinlikler)
// ---------------------------------------------------------------------------
async function loadAjandaPage() {
  selectedDay = todayStr();
  calendarViewDate = new Date();
  try {
    calendarEtkinlikler = await api.listEtkinlikler();
  } catch (err) {
    showToast("Etkinlikler yüklenemedi: " + err.message);
    calendarEtkinlikler = [];
  }
  renderCalendar();
  renderSelectedDay();
  renderUpcoming();
}

function calendarPrevMonth() {
  calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
  renderCalendar();
}

function calendarNextMonth() {
  calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
  renderCalendar();
}

function selectDay(dateStr) {
  selectedDay = dateStr;
  renderCalendar();
  renderSelectedDay();
}

function renderCalendar() {
  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  document.getElementById("calendar-month-label").textContent = `${AY_ADLARI[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Pazartesi = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventDates = new Set(calendarEtkinlikler.map((e) => e.tarih));
  const today = todayStr();

  let html = "";
  for (let i = 0; i < startOffset; i++) html += "<div></div>";
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const hasEvent = eventDates.has(dateStr);
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDay;
    let cls = "text-sm rounded-lg py-2 cursor-pointer ";
    cls += isSelected
      ? "bg-indigo-600 text-white font-semibold"
      : isToday
      ? "bg-indigo-50 text-indigo-700 font-semibold"
      : "hover:bg-slate-100";
    const dot = hasEvent
      ? `<span class="block w-1 h-1 rounded-full mx-auto mt-0.5 ${isSelected ? "bg-white" : "bg-indigo-500"}"></span>`
      : "";
    html += `<div onclick="selectDay('${dateStr}')" class="${cls}">${day}${dot}</div>`;
  }
  document.getElementById("calendar-grid").innerHTML = html;
}

function renderSelectedDay() {
  document.getElementById("selected-day-title").textContent = selectedDay ? formatTarihTR(selectedDay) : "";
  const events = calendarEtkinlikler
    .filter((e) => e.tarih === selectedDay)
    .sort((a, b) => (a.saat || "").localeCompare(b.saat || ""));
  document.getElementById("selected-day-events").innerHTML = events.length
    ? events.map((e) => renderEtkinlikCard(e, "ajanda")).join("")
    : '<p class="text-sm text-slate-400">Bu tarihte etkinlik yok.</p>';
}

function renderUpcoming() {
  const today = todayStr();
  const relevant = calendarEtkinlikler.filter((e) => !e.tamamlandi || e.tarih >= today);
  relevant.sort((a, b) => (a.tarih + (a.saat || "")).localeCompare(b.tarih + (b.saat || "")));
  const top10 = relevant.slice(0, 10);
  document.getElementById("upcoming-events").innerHTML = top10.length
    ? top10.map((e) => renderEtkinlikCard(e, "ajanda")).join("")
    : '<p class="text-sm text-slate-400">Yaklaşan etkinlik yok.</p>';
}

function renderEtkinlikCard(e, context) {
  const overdue = e.tarih < todayStr() && !e.tamamlandi;
  const box = overdue ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50";
  return `
    <div class="flex items-start justify-between border ${box} rounded-lg px-3 py-2 text-sm">
      <div class="flex items-start gap-2">
        <input type="checkbox" ${e.tamamlandi ? "checked" : ""} onchange="toggleTamamlandi('${e.id}', this.checked, '${context}')" class="mt-1">
        <div>
          <p class="font-semibold ${e.tamamlandi ? "line-through text-slate-400" : ""}">${e.baslik}</p>
          <p class="text-xs text-slate-500">${formatTarihTR(e.tarih)}${e.saat ? " · " + e.saat.slice(0, 5) : ""} · ${ETKINLIK_TUR_LABELS[e.tur] || e.tur}${e.aciklama ? " · " + e.aciklama : ""}</p>
        </div>
      </div>
      ${overdue ? '<span class="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-full whitespace-nowrap">Süresi Geçti</span>' : ""}
    </div>`;
}

async function toggleTamamlandi(id, checked, context) {
  try {
    await api.patchEtkinlik(id, { tamamlandi: checked });
    if (context === "dosya") {
      await loadDosyaEtkinlikleri(currentDosyaId);
    } else {
      await loadAjandaPage();
    }
  } catch (err) {
    showToast("Güncellenemedi: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Dosya detayindaki ajanda bolumu
// ---------------------------------------------------------------------------
async function loadDosyaEtkinlikleri(dosyaId) {
  try {
    dosyaEtkinlikler = await api.listDosyaEtkinlikleri(dosyaId);
  } catch (err) {
    dosyaEtkinlikler = [];
  }
  renderDosyaEtkinlikList();
}

function renderDosyaEtkinlikList() {
  const box = document.getElementById("dosya-etkinlik-list");
  box.innerHTML = dosyaEtkinlikler.length
    ? dosyaEtkinlikler.map((e) => renderEtkinlikCard(e, "dosya")).join("")
    : '<p class="text-sm text-slate-400">Bu dosyaya bağlı etkinlik yok.</p>';
}

// ---------------------------------------------------------------------------
// Yeni Etkinlik formu (paylasilan DOM, Ajanda veya Dosya Detayi'na tasinir)
// ---------------------------------------------------------------------------
function openNewEtkinlikForm(presetDosyaId) {
  etkinlikFormDosyaId = presetDosyaId || null;
  const containerId = presetDosyaId ? "dosya-etkinlik-form-mount" : "etkinlik-form-mount-ajanda";
  document.getElementById(containerId).appendChild(document.getElementById("etkinlik-form-root"));

  document.getElementById("etkinlik-baslik").value = "";
  document.getElementById("etkinlik-tarih").value = selectedDay || todayStr();
  document.getElementById("etkinlik-saat").value = "";
  document.getElementById("etkinlik-tur").value = "genel";
  document.getElementById("etkinlik-aciklama").value = "";
  populateEtkinlikDosyaSelect(presetDosyaId);
  document.getElementById("etkinlik-form-root").classList.remove("hidden");
}

function closeEtkinlikForm() {
  document.getElementById("etkinlik-form-root").classList.add("hidden");
}

async function populateEtkinlikDosyaSelect(presetDosyaId) {
  const select = document.getElementById("etkinlik-dosya");
  try {
    const dosyalar = await api.listDosyalar();
    select.innerHTML =
      '<option value="">Bağımsız (bir dosyaya bağlama)</option>' +
      dosyalar.map((d) => `<option value="${d.id}">${d.muvekkil_adi}${d.karsi_taraf ? " vs. " + d.karsi_taraf : ""}</option>`).join("");
    if (presetDosyaId) select.value = presetDosyaId;
  } catch (err) {
    select.innerHTML = '<option value="">Dosyalar yüklenemedi</option>';
  }
}

async function submitEtkinlik() {
  const baslik = document.getElementById("etkinlik-baslik").value.trim();
  const tarih = document.getElementById("etkinlik-tarih").value;
  if (!baslik || !tarih) {
    showToast("Başlık ve tarih zorunlu.");
    return;
  }
  try {
    await api.createEtkinlik({
      baslik,
      tarih,
      saat: document.getElementById("etkinlik-saat").value,
      tur: document.getElementById("etkinlik-tur").value,
      aciklama: document.getElementById("etkinlik-aciklama").value,
      dosya_id: document.getElementById("etkinlik-dosya").value,
    });
    closeEtkinlikForm();
    showToast("Etkinlik eklendi.");
    if (etkinlikFormDosyaId) {
      await loadDosyaEtkinlikleri(etkinlikFormDosyaId);
    } else {
      await loadAjandaPage();
    }
  } catch (err) {
    showToast("Eklenemedi: " + err.message);
  }
}
