-- LexAgent AI — Faz 6 eklentisi: Mevzuat veritabani ISKELETI
-- ONEMLI: Bu tablo kucuk, ORNEK bir veri setiyle doldurulur. Gercek/eksiksiz
-- mevzuat metni icermez; tam veri cekme (mevzuat.gov.tr / Resmi Gazete)
-- AYRI bir is olarak ele alinmalidir. Buradaki kayitlar sadece arama/iskelet
-- mimarisini gostermek icindir.

create table public.mevzuat (
  id uuid primary key default gen_random_uuid(),
  kanun_adi text not null,
  kanun_no text,
  ozet text,
  kategori text,
  kaynak_url text,
  created_at timestamptz not null default now()
);

create index mevzuat_kanun_adi_idx on public.mevzuat(kanun_adi);

-- RLS acik ama policy yok degil: mevzuat herkese acik/genel bilgi oldugu icin
-- (kisisel veri degil) su an icin acik okuma verilebilir; yine de backend
-- service_role uzerinden erisir, bu satir ileride frontend'in dogrudan
-- okumasi gerekirse kolaylik olsun diye acik birakildi.
alter table public.mevzuat enable row level security;
create policy "mevzuat herkese acik okuma"
  on public.mevzuat for select
  using (true);

-- Kucuk ornek veri seti (sadece kanun adi/no - genel/tartismasiz bilgiler,
-- madde metni veya sure/miktar gibi dogrulanmasi gereken detaylar icermez).
insert into public.mevzuat (kanun_adi, kanun_no, ozet, kategori, kaynak_url) values
  ('Türkiye Cumhuriyeti Anayasası', '2709', 'Devletin temel yapısını ve temel hak/özgürlükleri düzenler.', 'Anayasa', 'https://www.mevzuat.gov.tr/'),
  ('Türk Medeni Kanunu', '4721', 'Kişiler, aile, miras ve eşya hukukuna ilişkin genel esasları düzenler.', 'Medeni Hukuk', 'https://www.mevzuat.gov.tr/'),
  ('Türk Borçlar Kanunu', '6098', 'Borç ilişkilerine, sözleşmelere ve haksız fiillere ilişkin genel esasları düzenler.', 'Borçlar Hukuku', 'https://www.mevzuat.gov.tr/'),
  ('Türk Ticaret Kanunu', '6102', 'Ticari işletmeler, şirketler ve kıymetli evraka ilişkin esasları düzenler.', 'Ticaret Hukuku', 'https://www.mevzuat.gov.tr/'),
  ('Hukuk Muhakemeleri Kanunu', '6100', 'Medeni yargılama usulüne ilişkin esasları düzenler.', 'Usul Hukuku', 'https://www.mevzuat.gov.tr/'),
  ('Ceza Muhakemesi Kanunu', '5271', 'Ceza yargılaması usulüne ilişkin esasları düzenler.', 'Usul Hukuku', 'https://www.mevzuat.gov.tr/'),
  ('Türk Ceza Kanunu', '5237', 'Suç ve cezalara ilişkin genel ve özel hükümleri düzenler.', 'Ceza Hukuku', 'https://www.mevzuat.gov.tr/'),
  ('İş Kanunu', '4857', 'İş ilişkileri, işçi ve işveren hak/yükümlülüklerini düzenler.', 'İş Hukuku', 'https://www.mevzuat.gov.tr/'),
  ('İcra ve İflas Kanunu', '2004', 'Cebri icra ve iflas takibi usullerini düzenler.', 'İcra-İflas Hukuku', 'https://www.mevzuat.gov.tr/'),
  ('Kabahatler Kanunu', '5326', 'İdari yaptırım gerektiren kabahatlere ilişkin genel esasları düzenler.', 'İdare Hukuku', 'https://www.mevzuat.gov.tr/');
