// Hazir Sablonlar modulu: sozlesme/ihtarname/dilekce ornekleri.
// Bu sablonlar OZGUN olarak, Turk hukuk uygulamasindaki standart dilekce/sozlesme
// yapisi (baslik, taraflar, aciklama, hukuki sebep, sonuc-istem, imza) esas
// alinarak yazilmistir; herhangi bir bakanlik/kurum sitesinden veya ucuncu bir
// kaynaktan birebir alintilanmamistir. Somut olaya gore mutlaka gozden
// gecirilip uyarlanmalidir; resmi bir form/tebligat degildir.

const HAZIR_SABLONLAR = [
  {
    id: "konut-kira-sozlesmesi",
    kategori: "Sözleşmeler",
    baslik: "Konut Kira Sözleşmesi",
    aciklama: "Standart bir konut kirası için temel maddeleri içeren kira sözleşmesi taslağı.",
    icerik: `KONUT KİRA SÖZLEŞMESİ

MADDE 1 - TARAFLAR
Kiraya Veren: [AD SOYAD / UNVAN], TC/Vergi No: [.....], Adres: [.....]
Kiracı: [AD SOYAD], TC No: [.....], Adres: [.....]

MADDE 2 - KİRALANANIN ADRESİ VE NİTELİĞİ
Adres: [.....]
Niteliği: [.....] m², [.....] oda, kullanım amacı: mesken (konut)

MADDE 3 - SÖZLEŞMENİN SÜRESİ
Kira süresi [BAŞLANGIÇ TARİHİ] tarihinde başlar, 1 (bir) yıl sürelidir; taraflardan biri
sözleşme bitiminden en az 15 gün önce yazılı fesih bildiriminde bulunmadığı takdirde
sözleşme, TBK m.347 uyarınca birer yıllık sürelerle kendiliğinden uzar.

MADDE 4 - KİRA BEDELİ VE ÖDEME ŞEKLİ
Aylık kira bedeli [.....] TL olup her ayın [.....] günü, kiraya verenin [IBAN/BANKA] hesabına
ödenir. Takip eden yıllarda kira bedeli, TBK m.344 uyarınca bir önceki kira yılında
Türkiye İstatistik Kurumunca belirlenen tüketici fiyat endeksindeki (TÜFE) on iki aylık
ortalamalara göre değişim oranını geçmemek kaydıyla tarafların anlaşacağı miktarda,
anlaşma olmaması halinde TÜFE oranında artırılır.

MADDE 5 - DEPOZİTO (GÜVENCE BEDELİ)
Kiracı, sözleşme imzalanırken [.....] TL tutarında depozitoyu kiraya verene öder/bir banka
hesabına vadeli olarak yatırır (TBK m.342). Depozito, kiralananın tesliminde herhangi bir
hasar bulunmaması ve kira/yan gider borcu kalmaması halinde tahliyeyi izleyen 3 ay
içinde kiracıya iade edilir.

MADDE 6 - KİRALANANIN KULLANIMI VE BAKIMI
Kiracı, kiralananı sözleşmede belirtilen amaç dışında kullanamaz, kiraya verenin yazılı
izni olmadan alt kiraya veremez veya kullanım hakkını devredemez. Kiracı, kiralananın
olağan kullanımından doğan küçük bakım ve onarım giderlerini karşılar; yapısal/büyük
onarımlar kiraya verene aittir (TBK m.318).

MADDE 7 - YAN GİDERLER
Elektrik, su, doğalgaz, aidat ve benzeri tüketime bağlı giderler kiracı tarafından karşılanır.

MADDE 8 - TAHLİYE
Sözleşmenin sona ermesi veya feshi halinde kiracı, kiralananı sözleşme başlangıcındaki
durumuna (olağan yıpranma hariç) uygun şekilde, boş ve temiz olarak kiraya verene
teslim eder.

MADDE 9 - İHTİLAFLARIN ÇÖZÜMÜ
Bu sözleşmeden doğan uyuşmazlıklarda [.....] Sulh Hukuk/Asliye Hukuk Mahkemeleri ve
İcra Daireleri yetkilidir.

MADDE 10 - EKLER VE TESLİM TUTANAĞI
Kiralananın teslim anındaki durumu ve varsa demirbaşlar, işbu sözleşmenin ekinde yer
alan teslim tutanağında ayrıca belirtilir.

İşbu sözleşme [.....] maddeden ibaret olup taraflarca [TARİH] tarihinde 2 (iki) nüsha
olarak okunarak imza altına alınmıştır.

KİRAYA VEREN                                                    KİRACI
[AD SOYAD / İMZA]                                          [AD SOYAD / İMZA]`,
  },
  {
    id: "tahliye-taahhutnamesi",
    kategori: "Sözleşmeler",
    baslik: "Tahliye Taahhütnamesi",
    aciklama: "Kiracının belirli bir tarihte kiralananı boşaltacağını taahhüt ettiği belge örneği.",
    icerik: `TAHLİYE TAAHHÜTNAMESİ

Aşağıda açık kimliği yazılı kiracı sıfatıyla ben, [KİRACI AD SOYAD], TC No: [.....];

[KİRAYA VEREN AD SOYAD]'a ait olup [ADRES] adresinde bulunan ve halen kiracısı
olduğum taşınmazı, herhangi bir ihtar ve dava açılmasına gerek kalmaksızın
[TAHLİYE TARİHİ] tarihinde tamamen boşaltarak, içinde hiçbir eşyam kalmaksızın ve
üzerimde herhangi bir hak iddia etmeksizin, kiraya verene veya vekiline teslim
edeceğimi; aksi halde hakkımda İcra ve İflas Kanunu'nun 272. ve devamı maddeleri
uyarınca ilamsız tahliye takibi yapılmasını ve tahliyemin zorla sağlanmasını kabul,
beyan ve taahhüt ederim.

İşbu taahhütname, [SÖZLEŞME TARİHİ] tarihli kira sözleşmesinden bağımsız olarak,
kira sözleşmesinin kurulmasından SONRAKİ bir tarihte serbest irade ile verilmiştir.

Not: Yargıtay içtihatlarına göre tahliye taahhüdünün geçerli olabilmesi için kira
sözleşmesi kurulduktan sonraki bir tarihte, kiracının serbest iradesiyle
imzalanmış olması gerekir; sözleşmeyle eş zamanlı/boş tarihli taahhütler geçersiz
sayılabilir. Somut olaya göre tarih ve koşulları mutlaka kontrol edin.

Taahhüt Eden (Kiracı)
[AD SOYAD]
[TARİH]
[İMZA]

Tanık 1: [AD SOYAD / TC / İMZA]
Tanık 2: [AD SOYAD / TC / İMZA]`,
  },
  {
    id: "kira-artis-ihtarnamesi",
    kategori: "İhtarnameler",
    baslik: "Kira Bedeli Artışı / Tespiti İhtarnamesi",
    aciklama: "Yeni kira döneminde bedel artışını veya tespit talebini kiracıya bildiren ihtarname örneği.",
    icerik: `İHTARNAME

İHTAR EDEN (Kiraya Veren): [AD SOYAD], TC No: [.....], Adres: [.....]
MUHATAP (Kiracı): [AD SOYAD], Adres: [.....]

KONU: [ADRES] adresindeki taşınmaza ilişkin kira bedelinin yeni dönem için
artırılması/tespiti talebimizin bildirilmesinden ibarettir.

AÇIKLAMALAR:
1) Muhatap ile aramızda [SÖZLEŞME TARİHİ] tarihli kira sözleşmesi bulunmakta olup,
mevcut aylık kira bedeli [MEVCUT BEDEL] TL'dir.
2) [YENİ DÖNEM BAŞLANGIÇ TARİHİ] tarihinde başlayacak yeni kira döneminde, Türk
Borçlar Kanunu m.344 uyarınca kira bedelinin, bir önceki kira yılında tüketici
fiyat endeksindeki (TÜFE) on iki aylık ortalamalara göre değişim oranını
geçmeyecek şekilde [YENİ BEDEL] TL olarak uygulanmasını talep ediyoruz.
3) Beş yıldan uzun süredir devam eden kira ilişkilerinde bu oranın üzerinde bir
tespit talebi ancak dava yoluyla (kira tespit davası) istenebileceğinden,
anlaşma sağlanamaması halinde yasal yollara başvurma hakkımız saklıdır.

SONUÇ VE İSTEM: Yukarıda açıklanan nedenlerle yeni dönem kira bedelinin
[YENİ BEDEL] TL olarak kabul edilerek bu tutarın [ÖDEME TARİHİ]'nden itibaren
ödenmesini, aksi halde yasal yollara (kira tespit davası dahil) başvurulacağını
ihtaren bildiririz.

İhtar Eden
[AD SOYAD / İMZA]
[TARİH]

Not: Bu ihtarnamenin noter kanalıyla veya iadeli taahhütlü mektupla, mümkünse
KEP/e-tebligat ile gönderilmesi ispat açısından önerilir.`,
  },
  {
    id: "temerrut-tahliye-ihtarnamesi",
    kategori: "İhtarnameler",
    baslik: "Kira Borcu Nedeniyle Temerrüt / Tahliye İhtarnamesi",
    aciklama: "Ödenmeyen kira bedelinin talep edildiği ve ödenmemesi halinde tahliye edileceğinin bildirildiği ihtarname örneği.",
    icerik: `İHTARNAME

İHTAR EDEN (Kiraya Veren): [AD SOYAD], Adres: [.....]
MUHATAP (Kiracı): [AD SOYAD], Adres: [.....]

KONU: [ADRES] adresindeki taşınmaza ilişkin ödenmemiş kira bedelinin ödenmesi,
aksi halde Türk Borçlar Kanunu m.315 uyarınca sözleşmenin feshedileceğinin ve
tahliye talep edileceğinin ihtarıdır.

AÇIKLAMALAR:
1) Muhatap, kiracısı bulunduğu yukarıda adresi yazılı taşınmaza ilişkin
[DÖNEM/AYLAR] dönemine ait toplam [TUTAR] TL kira bedelini ödememiştir.
2) Türk Borçlar Kanunu'nun 315. maddesi uyarınca, kiracıya işbu ihtarın
tebliğinden itibaren konut ve çatılı işyeri kiralarında en az 30 (otuz) gün
süre verilmekte olup bu süre içinde borcun ödenmemesi halinde sözleşmenin
feshedilerek tahliye talep edileceği ihtar olunur.

SONUÇ VE İSTEM: Yukarıda belirtilen [TUTAR] TL kira borcunun işbu ihtarın
tebliğinden itibaren 30 gün içinde tarafımıza ödenmesini; aksi halde ayrıca bir
ihtara gerek kalmaksızın kira sözleşmesinin feshedilerek icra takibi yoluyla
tahliyenizin talep edileceğini ihtaren bildiririz.

İhtar Eden
[AD SOYAD / İMZA]
[TARİH]`,
  },
  {
    id: "icra-itiraz-dilekcesi",
    kategori: "Dilekçeler",
    baslik: "İcra Takibine İtiraz Dilekçesi",
    aciklama: "Borçlunun ilamsız icra takibine, borca ve/veya imzaya itiraz ettiği dilekçe örneği.",
    icerik: `[.....] İCRA DAİRESİ MÜDÜRLÜĞÜ'NE

DOSYA NO: [.....] Esas

İTİRAZ EDEN (BORÇLU): [AD SOYAD], TC No: [.....], Adres: [.....]
ALACAKLI: [AD SOYAD / UNVAN], Adres: [.....]
VEKİLİ (varsa): Av. [AD SOYAD]

KONU: Yukarıda esas numarası yazılı icra takibine, süresi içinde borca ve
ferilerine itirazlarımızın sunulmasından ibarettir.

AÇIKLAMALAR:
1) Alacaklı tarafından hakkımda başlatılan yukarıda numarası yazılı icra takibine
ilişkin ödeme emri tarafıma [TEBLİĞ TARİHİ] tarihinde tebliğ edilmiştir.
2) Takip konusu alacağın tamamına/[.....] TL'lik kısmına, faize ve işlemiş
faize itiraz ediyorum. Şöyle ki: [İTİRAZ GEREKÇESİ - örn: borç bulunmadığı,
borcun ödendiği, zamanaşımına uğradığı, miktarın fahiş olduğu vb. somut olarak
açıklanmalıdır].
3) İtirazım, İcra ve İflas Kanunu'nun 62. ve devamı maddeleri uyarınca süresi
içinde (ödeme emri tebliğinden itibaren 7 gün içinde) sunulmaktadır.

SONUÇ VE İSTEM: Yukarıda açıklanan nedenlerle takip konusu borca, faize ve
ferilerine itiraz ediyorum; itirazım üzerine takibin durdurulmasına karar
verilmesini saygıyla arz ve talep ederim. [TARİH]

İtiraz Eden (Borçlu)
[AD SOYAD / İMZA]

EKLER: [Varsa itirazı destekleyen belgeler - ödeme dekontu, ibraname vb.]`,
  },
  {
    id: "alacak-davasi-dilekcesi",
    kategori: "Dilekçeler",
    baslik: "Alacak Davası Dilekçesi (Genel)",
    aciklama: "Sözleşme veya borç ilişkisinden doğan bir alacağın tahsili için açılacak genel alacak davası dilekçesi örneği.",
    icerik: `[.....] NÖBETÇİ ASLİYE HUKUK MAHKEMESİ'NE

DAVACI: [AD SOYAD], TC No: [.....], Adres: [.....]
VEKİLİ (varsa): Av. [AD SOYAD], Adres: [.....]
DAVALI: [AD SOYAD / UNVAN], Adres: [.....]
KONU: [ALACAK TUTARI] TL alacağın davalıdan faiziyle birlikte tahsili talebinden
ibarettir.
HARCA ESAS DEĞER: [TUTAR] TL

AÇIKLAMALAR:
1) Taraflar arasında [TARİH] tarihli [SÖZLEŞME/İLİŞKİ TÜRÜ] ilişkisi kurulmuş
olup, davalı bu ilişkiden doğan [TUTAR] TL tutarındaki borcunu ödememiştir.
2) [OLAYLARIN KRONOLOJİK AÇIKLAMASI - hangi tarihte, hangi işlem/edim
yapıldığı, ödemenin neden ve ne zamandan beri yapılmadığı somut olarak
anlatılmalıdır].
3) Davalıya [TARİH] tarihinde ihtarname keşide edilmiş, ancak alacağımız
ödenmemiştir. (Bu madde ihtar çekilmişse eklenir.)
4) Davalının borcunu ödememesi nedeniyle alacağımızın dava yoluyla tahsili
zorunluluğu doğmuştur.

HUKUKİ SEBEPLER: Türk Borçlar Kanunu, Türk Ticaret Kanunu, Hukuk Muhakemeleri
Kanunu ve ilgili sair mevzuat.

DELİLLER: [Sözleşme, faturalar, banka dekontları, yazışmalar, tanık, bilirkişi
incelemesi ve sair her türlü delil]

SONUÇ VE İSTEM: Yukarıda açıklanan nedenlerle, [TUTAR] TL alacağımızın dava
tarihinden itibaren işleyecek yasal faiziyle birlikte davalıdan tahsiline,
yargılama giderleri ve vekalet ücretinin davalı üzerinde bırakılmasına karar
verilmesini saygıyla arz ve talep ederiz. [TARİH]

Davacı / Vekili
[AD SOYAD / İMZA]`,
  },
  {
    id: "anlasmali-bosanma-dilekcesi",
    kategori: "Dilekçeler",
    baslik: "Anlaşmalı Boşanma Dava Dilekçesi",
    aciklama: "TMK m.166/3 uyarınca anlaşmalı boşanma talebiyle açılacak dava dilekçesi ve protokol örneği.",
    icerik: `[.....] AİLE MAHKEMESİ'NE

DAVACI: [AD SOYAD], TC No: [.....], Adres: [.....]
DAVALI: [AD SOYAD], TC No: [.....], Adres: [.....]
KONU: Tarafların TMK m.166/3 uyarınca anlaşmalı olarak boşanmalarına karar
verilmesi talebinden ibarettir.

AÇIKLAMALAR:
1) Taraflar [EVLİLİK TARİHİ] tarihinde evlenmiş olup evlilik en az bir yıl
sürmüştür.
2) Taraflar, evliliklerini sona erdirme konusunda anlaşmış olup, boşanmanın
mali sonuçları ile varsa müşterek çocuğun/çocukların durumu hususunda ekte
sunulan protokolde mutabık kalmışlardır.
3) Taraflar duruşmada hazır bulunarak hakim huzurunda iradelerini bizzat
açıklayacaklardır.

SONUÇ VE İSTEM: Taraflarca birlikte hazırlanan ekli protokol doğrultusunda,
tarafların TMK m.166/3 uyarınca anlaşmalı olarak boşanmalarına karar
verilmesini saygıyla arz ve talep ederiz. [TARİH]

Davacı                                                              Davalı
[AD SOYAD / İMZA]                                          [AD SOYAD / İMZA]

---
ANLAŞMALI BOŞANMA PROTOKOLÜ (EK)

1) MADDİ TAZMİNAT / MANEVİ TAZMİNAT: [Taraflar birbirlerinden tazminat talep
edip etmediklerini belirtir.]
2) YOKSULLUK NAFAKASI: [Talep edilip edilmediği, edilecekse tutar ve süresi.]
3) ZİYNET EŞYASI VE EV EŞYALARI: [Paylaşım şekli.]
4) MÜŞTEREK ÇOCUK/ÇOCUKLARIN VELAYETİ: [Velayetin kimde kalacağı.]
5) ÇOCUKLA KİŞİSEL İLİŞKİ: [Görüşme gün/saatleri.]
6) İŞTİRAK NAFAKASI: [Aylık tutar.]
7) YARGILAMA GİDERLERİ: Taraflar kendi vekalet ücretlerini ve yargılama
giderlerini kendileri karşılar; taraflar birbirlerinden bu kalemlerde talepte
bulunmayacaklarını kabul ederler.

Taraflar işbu protokolü [TARİH] tarihinde serbest iradeleriyle imzalamışlardır.

Davacı                                                              Davalı
[AD SOYAD / İMZA]                                          [AD SOYAD / İMZA]`,
  },
  {
    id: "vekaletname-azli-bildirimi",
    kategori: "Bildirimler",
    baslik: "Vekaletnamenin Azli (İptali) Bildirimi",
    aciklama: "Müvekkilin, vekiline verdiği vekaleti geri aldığını karşı tarafa/kuruma bildirdiği yazı örneği.",
    icerik: `[.....] NOTERLİĞİ'NE / [.....] MAHKEMESİ'NE / [KURUM ADI]'NA

KONU: [.....] Noterliğinin [TARİH] tarih ve [YEVMİYE NO] yevmiye numaralı
vekaletnamesiyle Av. [VEKİL AD SOYAD]'a vermiş olduğum vekaletin, işbu bildirim
tarihi itibarıyla azledildiğinin (geri alındığının) bildirilmesinden ibarettir.

AÇIKLAMALAR:
1) Yukarıda belirtilen vekaletname ile Av. [VEKİL AD SOYAD]'ı, [KONUSU/DAVA
DOSYA NO belirtilir] işlerini takip etmek üzere vekil tayin etmiştim.
2) İşbu bildirim ile anılan vekaleti, Avukatlık Kanunu m.174 ve Türk Borçlar
Kanunu m.512 vd. hükümleri uyarınca azlediyorum. Azil, bildirim tarihinden
itibaren hüküm ifade eder.
3) Azil nedeniyle vekilin, azil tarihine kadar yapmış olduğu işlemler geçerli
olup, azil sonrası hiçbir işlem için yetkisi bulunmamaktadır.

SONUÇ VE İSTEM: Yukarıda açıklanan azil keyfiyetinin ilgili dosyaya/kayıtlara
işlenmesini ve gereğinin yapılmasını saygıyla arz ve talep ederim. [TARİH]

Müvekkil
[AD SOYAD / TC NO / İMZA]

Not: Azlin vekile de ayrıca (noter kanalıyla veya yazılı olarak) bildirilmesi
ve ilgili mahkeme/icra dosyasına bildirilmesi önerilir; aksi halde üçüncü
kişiler bakımından azlin öğrenilmediği ileri sürülebilir.`,
  },
  {
    id: "is-fesih-ihtarnamesi",
    kategori: "İhtarnameler",
    baslik: "İş Sözleşmesi Feshi ve Alacak Talebi İhtarnamesi",
    aciklama: "İşçinin, haklı nedenle iş sözleşmesini feshettiğini ve kıdem/ihbar tazminatı ile diğer işçilik alacaklarını talep ettiği ihtarname örneği.",
    icerik: `İHTARNAME

İHTAR EDEN (İşçi): [AD SOYAD], TC No: [.....], Adres: [.....]
MUHATAP (İşveren): [UNVAN], Adres: [.....]

KONU: İş sözleşmemin haklı nedenle feshedildiğinin bildirilmesi ile kıdem
tazminatı, ihbar tazminatı ve diğer işçilik alacaklarımın ödenmesi talebinden
ibarettir.

AÇIKLAMALAR:
1) [BAŞLANGIÇ TARİHİ] tarihinden bu yana işyerinizde [GÖREV] olarak
çalışmaktayım.
2) [FESIH GEREKÇESİ - örn: ücretin ödenmemesi, fazla mesai ücretlerinin
ödenmemesi, sigorta primlerinin eksik yatırılması, mobbing vb. somut olarak
açıklanmalıdır] nedeniyle iş sözleşmemi 4857 sayılı İş Kanunu m.24 uyarınca
haklı nedenle feshettiğimi bildiririm.
3) Bu kapsamda, kıdem tazminatı, kullanılmayan yıllık izin ücreti, varsa
ödenmemiş ücret, fazla mesai, hafta tatili ve genel tatil alacaklarımın
tarafıma ödenmesini talep ediyorum.

SONUÇ VE İSTEM: Yukarıda açıklanan alacaklarımın işbu ihtarın tebliğinden
itibaren [.....] gün içinde tarafıma ödenmesini, aksi halde yasal yollara
(dava/arabuluculuk) başvurulacağını ihtaren bildiririm. [TARİH]

İhtar Eden
[AD SOYAD / İMZA]

Not: 7036 sayılı Kanun uyarınca işçi-işveren alacak ve tazminat
uyuşmazlıklarında dava açılmadan önce arabulucuya başvurulması dava şartıdır.`,
  },
];

let currentSablonId = null;

function loadSablonlarPage() {
  const box = document.getElementById("sablon-list");
  const kategoriler = [...new Set(HAZIR_SABLONLAR.map((s) => s.kategori))];
  box.innerHTML = kategoriler
    .map(
      (kat) => `
    <div class="mb-6">
      <h4 class="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">${escapeHtml(kat)}</h4>
      <div class="grid sm:grid-cols-2 gap-3">
        ${HAZIR_SABLONLAR.filter((s) => s.kategori === kat)
          .map(
            (s) => `
          <div onclick="location.hash = '#/sablonlar/${s.id}'" class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 cursor-pointer hover:border-indigo-400">
            <p class="font-semibold text-sm">${escapeHtml(s.baslik)}</p>
            <p class="text-xs text-slate-500 mt-1">${escapeHtml(s.aciklama)}</p>
          </div>`
          )
          .join("")}
      </div>
    </div>`
    )
    .join("");
}

function openSablonPage(id) {
  const s = HAZIR_SABLONLAR.find((x) => x.id === id);
  if (!s) {
    showToast("Şablon bulunamadı.");
    location.hash = "#/sablonlar";
    return;
  }
  currentSablonId = id;
  document.getElementById("sablon-detay-baslik").textContent = s.baslik;
  document.getElementById("sablon-detay-kategori").textContent = s.kategori;
  document.getElementById("sablon-detay-aciklama").textContent = s.aciklama;
  document.getElementById("sablon-detay-metin").value = s.icerik;
}

function kopyalaSablon() {
  const metin = document.getElementById("sablon-detay-metin").value;
  navigator.clipboard
    .writeText(metin)
    .then(() => showToast("Panoya kopyalandı."))
    .catch(() => showToast("Kopyalanamadı, metni elle seçip kopyalayabilirsiniz."));
}

function indirSablon() {
  const s = HAZIR_SABLONLAR.find((x) => x.id === currentSablonId);
  const metin = document.getElementById("sablon-detay-metin").value;
  const blob = new Blob([metin], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${s ? s.baslik : "sablon"}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
