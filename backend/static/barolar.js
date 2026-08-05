// Barolar Rehberi verisi: 81 il barosu (+ Ankara ve Istanbul'un ikinci barolari).
// Baro adi, baro baskani ve telefon numaralari, Turkiye Barolar Birligi'nin
// kendi resmi sayfasindan (barobirlik.org.tr/Haberler/baro-baskanlari-5423)
// alinmistir; uydurma/tahmini deger icermez. Baskanlik gorevleri secimle
// degisebildiginden, listedeki isimler zaman icinde guncelligini yitirebilir -
// TBB sayfasi tek otoriter kaynaktir.
const BAROLAR = [
  { il: "Adana", baskan: "Av. Volkan Böke", tel: "0 322 351 21 21" },
  { il: "Adıyaman", baskan: "Av. Bilal Doğan", tel: "0 416 216 13 51" },
  { il: "Afyonkarahisar", baskan: "Av. Melehat İpek Yılmaz Göktürk", tel: "0 272 217 59 69" },
  { il: "Ağrı", baskan: "Av. Serdar Günakın", tel: "0 472 215 17 63" },
  { il: "Aksaray", baskan: "Av. Erçin Mevlüt Düzgün", tel: "0 382 216 03 31" },
  { il: "Amasya", baskan: "Av. Edip Hakan Subaşı", tel: "0 358 218 98 25" },
  { il: "Ankara", baskan: "Av. Mustafa Köroğlu", tel: "0 312 416 72 00" },
  { il: "Ankara (2 Nolu)", baskan: "Av. Gökhan Ağdemir", tel: "0 312 269 77 35" },
  { il: "Antalya", baskan: "Av. Ali Çağdaş Bozaner", tel: "0 242 238 61 55" },
  { il: "Ardahan", baskan: "Av. Murat Yolçu", tel: "0 478 211 64 12" },
  { il: "Artvin", baskan: "Av. Handan Demiral Almalı", tel: "0 466 212 14 04" },
  { il: "Aydın", baskan: "Av. Utku Devrim Barış Arslan", tel: "0 256 225 73 96" },
  { il: "Balıkesir", baskan: "Av. Hakan Topaloğlu", tel: "0 266 244 87 33" },
  { il: "Bartın", baskan: "Av. Nail Öztürk", tel: "0 378 227 16 94" },
  { il: "Batman", baskan: "Av. Abdulhamit Çakan", tel: "0 488 213 95 52" },
  { il: "Bayburt", baskan: "Av. Şenol Yılmaz", tel: "0 456 213 15 38" },
  { il: "Bilecik", baskan: "Av. Halime Kahraman", tel: "0 228 212 70 79" },
  { il: "Bingöl", baskan: "Av. Yusuf Ketenalp", tel: "0 426 214 49 40" },
  { il: "Bitlis", baskan: "Av. Gülhan Bayram Sekmen", tel: "0 434 226 37 22" },
  { il: "Bolu", baskan: "Av. Sinan Barut", tel: "0 374 212 61 46" },
  { il: "Burdur", baskan: "Av. Meltem Özdemir", tel: "0 248 233 49 55" },
  { il: "Bursa", baskan: "Av. Metin Öztosun", tel: "0 224 272 11 94" },
  { il: "Çanakkale", baskan: "Av. Ardahan Dikme", tel: "0 286 212 71 71" },
  { il: "Çankırı", baskan: "Av. Mustafa Deniz", tel: "0 376 213 40 40" },
  { il: "Çorum", baskan: "Av. Turan Kalıpcı", tel: "0 364 227 78 19" },
  { il: "Denizli", baskan: "Av. Engin Yıldız", tel: "0 258 261 29 48" },
  { il: "Diyarbakır", baskan: "Av. Abdulkadir Güleç", tel: "0 412 224 44 41" },
  { il: "Düzce", baskan: "Av. Erol Batum", tel: "0 380 523 16 13" },
  { il: "Edirne", baskan: "Av. Gökhan Karakoç", tel: "0 284 225 10 55" },
  { il: "Elazığ", baskan: "Av. Melih Efe", tel: "0 424 248 39 24" },
  { il: "Erzincan", baskan: "Av. Emre Bölükbaşı", tel: "0 446 214 10 42" },
  { il: "Erzurum", baskan: "Av. Mesut Öner", tel: "0 442 233 10 20" },
  { il: "Eskişehir", baskan: "Av. Barış Günaydın", tel: "0 222 240 14 00" },
  { il: "Gaziantep", baskan: "Av. Bülent Duran", tel: "0 342 231 52 90" },
  { il: "Giresun", baskan: "Av. Soner Karademir", tel: "0 454 215 76 57" },
  { il: "Gümüşhane", baskan: "Av. Metin Aslan", tel: "0 456 213 15 38" },
  { il: "Hakkari", baskan: "Av. Ergün Canan", tel: "0 438 211 60 80" },
  { il: "Hatay", baskan: "Av. Hatay Tut", tel: "0 326 215 18 77" },
  { il: "Iğdır", baskan: "Av. Ahmet Tutulmaz", tel: "0 476 226 03 57" },
  { il: "Isparta", baskan: "Av. Fatih Semiz", tel: "0 246 228 54 10" },
  { il: "İstanbul", baskan: "Av. İbrahim Özden Kaboğlu", tel: "0 212 393 07 00" },
  { il: "İstanbul (2 Nolu)", baskan: "Av. Yasin Şamlı", tel: "0 216 722 66 00" },
  { il: "İzmir", baskan: "Av. Sefa Yılmaz", tel: "0 232 463 00 14" },
  { il: "Kahramanmaraş", baskan: "Av. Mehmet Kaan Kır", tel: "0 344 211 11 27" },
  { il: "Karabük", baskan: "Av. Emrah Köklü", tel: "0 370 415 38 88" },
  { il: "Karaman", baskan: "Av. Oktay Yılmaz", tel: "0 338 212 17 53" },
  { il: "Kars", baskan: "Av. Necat Yağcı", tel: "0 474 212 82 50" },
  { il: "Kastamonu", baskan: "Av. Özgür Demir", tel: "0 366 215 11 44" },
  { il: "Kayseri", baskan: "Av. Murat Tolga Özsoy", tel: "0 352 222 27 34" },
  { il: "Kırıkkale", baskan: "Av. Turan Zeki", tel: "0 318 224 27 09" },
  { il: "Kırklareli", baskan: "Av. Mümün Neşetoğlu", tel: "0 288 214 13 16" },
  { il: "Kırşehir", baskan: "Av. İsa Dağıstan", tel: "0 386 213 12 43" },
  { il: "Kilis", baskan: "Av. Mehmet Taşcı", tel: "0 348 813 49 76" },
  { il: "Kocaeli", baskan: "Av. Kadir Caner Karakadılar", tel: "0 262 321 13 90" },
  { il: "Konya", baskan: "Av. Oktay Unkur", tel: "0 332 356 00 18" },
  { il: "Kütahya", baskan: "Av. Edip İlkay Sunay", tel: "0 274 216 15 49" },
  { il: "Malatya", baskan: "Av. Onur Demez", tel: "0 422 325 86 85" },
  { il: "Manisa", baskan: "Av. Sevgi Başak Yeşil", tel: "444 45 25" },
  { il: "Mardin", baskan: "Av. Ahmet Duyan", tel: "0 482 213 60 43" },
  { il: "Mersin", baskan: "Av. Gazi Özdemir", tel: "0 324 231 19 65" },
  { il: "Muğla", baskan: "Av. Levent Akgün", tel: "0 252 212 36 16" },
  { il: "Muş", baskan: "Av. Kadir Karaçelik", tel: "0 436 212 16 38" },
  { il: "Nevşehir", baskan: "Av. Mustafa Necmi Öncül", tel: "0 384 213 12 66" },
  { il: "Niğde", baskan: "Av. Emin Alper Öztürk", tel: "0 388 232 33 87" },
  { il: "Ordu", baskan: "Av. Birsen Uçar", tel: "0 452 214 01 37" },
  { il: "Osmaniye", baskan: "Av. Ahmet Şefik Akın", tel: "0 328 826 15 52" },
  { il: "Rize", baskan: "Av. Ümit Peçe", tel: "0 464 217 24 80" },
  { il: "Sakarya", baskan: "Av. Musa Adıyaman", tel: "0 264 251 37 95" },
  { il: "Samsun", baskan: "Av. Pınar Gürsel Yıldıran", tel: "0 362 431 39 70" },
  { il: "Siirt", baskan: "Av. Muhammed Alptekin", tel: "0 484 224 31 60" },
  { il: "Sinop", baskan: "Av. Funda Öztürk Altuntaş", tel: "0 368 261 26 50" },
  { il: "Sivas", baskan: "Av. Fatih Sevim", tel: "0 346 221 51 78" },
  { il: "Şanlıurfa", baskan: "Av. Abdullah Öncel", tel: "0 414 313 28 28" },
  { il: "Şırnak", baskan: "Av. Abdullah Fındık", tel: "0 486 616 14 30" },
  { il: "Tekirdağ", baskan: "Av. Egemen Gürcün", tel: "0 282 261 12 83" },
  { il: "Tokat", baskan: "Av. Volkan Bozkurt", tel: "0 356 214 22 26" },
  { il: "Trabzon", baskan: "Av. Hakan Orhan", tel: "0 462 223 58 00" },
  { il: "Tunceli", baskan: "Av. Doğukan Kudat", tel: "0 428 213 16 23" },
  { il: "Uşak", baskan: "Av. Özgür Boz", tel: "0 276 212 12 06" },
  { il: "Van", baskan: "Av. Sinan Özaraz", tel: "0 432 214 58 04" },
  { il: "Yalova", baskan: "Av. Elif Turnacı Çavuş", tel: "0 226 812 49 86" },
  { il: "Yozgat", baskan: "Av. Muhsin Ayanoğlu", tel: "0 354 212 27 34" },
  { il: "Zonguldak", baskan: "Av. Türker Kapkaç", tel: "0 372 251 37 90" },
];

function telHref(tel) {
  return "tel:+90" + tel.replace(/[^0-9]/g, "").replace(/^0/, "");
}

function renderBaroGrid(filtre) {
  const q = (filtre || "").trim().toLocaleLowerCase("tr");
  const box = document.getElementById("baro-grid");
  const filtreli = BAROLAR.filter((b) => !q || b.il.toLocaleLowerCase("tr").includes(q));
  box.innerHTML = filtreli
    .map(
      (b) => `
    <div class="border border-slate-200 rounded-lg px-4 py-3 text-sm">
      <p class="font-semibold">${escapeHtml(b.il)} Barosu</p>
      <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(b.baskan)}</p>
      <a href="${telHref(b.tel)}" class="mt-1.5 inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-sm font-medium">
        <i class="fa-solid fa-phone text-xs"></i>${escapeHtml(b.tel)}
      </a>
    </div>`
    )
    .join("");
  if (!filtreli.length) {
    box.innerHTML = '<p class="text-sm text-slate-400 col-span-full">Eşleşen il bulunamadı.</p>';
  }
}

function filtreleBaroListesi() {
  renderBaroGrid(document.getElementById("baro-filtre").value);
}
