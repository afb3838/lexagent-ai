-- LexAgent AI — Konsolide migration: 002+003+004+006+007'yi tek seferde calistirir
-- Tum CREATE TABLE/INDEX ifadeleri IF NOT EXISTS kullanir, guvenle tekrar calistirilabilir.
-- Supabase SQL Editor'de tek parca halinde yapistirip calistirin.

-- ===== 002_etkinlikler.sql =====
-- LexAgent AI — Faz 3 eklentisi: Ajanda/Takvim
-- Supabase SQL Editor'de elle calistirilir. supabase/schema.sql zaten calistirilmis
-- olmali (dosyalar tablosu bu tabloya referans veriyor).

create table if not exists public.etkinlikler (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id),
  dosya_id uuid references public.dosyalar(id) on delete set null,
  baslik text not null,
  tarih date not null,
  saat time,
  tur text not null default 'genel',
  -- tur degerleri: durusma | sure | hatirlatma | genel
  aciklama text,
  tamamlandi boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists etkinlikler_kullanici_id_idx on public.etkinlikler(kullanici_id);
create index if not exists etkinlikler_dosya_id_idx on public.etkinlikler(dosya_id);
create index if not exists etkinlikler_tarih_idx on public.etkinlikler(tarih);

-- Diger tablolarla ayni desen: RLS acik, policy yok (backend service_role ile bypass
-- eder, frontend bu tabloya dogrudan erismez).
alter table public.etkinlikler enable row level security;

-- ===== 003_vekaletname_cari.sql =====
-- LexAgent AI — Faz 4 eklentisi: Vekaletname Klasoru + Cari Hesap
-- Supabase SQL Editor'de elle calistirilir. supabase/schema.sql zaten calismis olmali.

create table if not exists public.vekaletnameler (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id),
  dosya_id uuid not null references public.dosyalar(id) on delete cascade,
  veren_tarih date,
  gecerlilik_tarihi date,
  ozel_yetkiler text,
  storage_path text,
  notlar text,
  created_at timestamptz not null default now()
);

create index if not exists vekaletnameler_dosya_id_idx on public.vekaletnameler(dosya_id);
create index if not exists vekaletnameler_kullanici_id_idx on public.vekaletnameler(kullanici_id);

alter table public.vekaletnameler enable row level security;

create table if not exists public.cari_hesap_kayitlari (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id),
  dosya_id uuid not null references public.dosyalar(id) on delete cascade,
  tur text not null,
  -- tur degerleri: ucret | masraf | odeme
  tutar numeric(12,2) not null,
  aciklama text,
  tarih date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists cari_hesap_dosya_id_idx on public.cari_hesap_kayitlari(dosya_id);
create index if not exists cari_hesap_kullanici_id_idx on public.cari_hesap_kayitlari(kullanici_id);

alter table public.cari_hesap_kayitlari enable row level security;

-- ===== 004_icra_takip.sql =====
-- LexAgent AI — Faz 5 eklentisi: Icra Takip
-- Supabase SQL Editor'de elle calistirilir.

create table if not exists public.icra_dosyalari (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id),
  dosya_id uuid references public.dosyalar(id) on delete set null,
  takip_no text,
  icra_dairesi text,
  borclu_adi text not null,
  alacakli_adi text not null,
  takip_tutari numeric(12,2),
  durum text not null default 'acildi',
  -- durum degerleri: acildi | haciz_asamasinda | tahsil_edildi | kapandi
  created_at timestamptz not null default now()
);

create index if not exists icra_dosyalari_kullanici_id_idx on public.icra_dosyalari(kullanici_id);
create index if not exists icra_dosyalari_dosya_id_idx on public.icra_dosyalari(dosya_id);

alter table public.icra_dosyalari enable row level security;

create table if not exists public.icra_adimlari (
  id uuid primary key default gen_random_uuid(),
  icra_id uuid not null references public.icra_dosyalari(id) on delete cascade,
  tarih date not null default current_date,
  tur text not null default 'diger',
  -- tur degerleri: haciz | tahsilat | tebligat | diger
  aciklama text,
  tutar numeric(12,2),
  created_at timestamptz not null default now()
);

create index if not exists icra_adimlari_icra_id_idx on public.icra_adimlari(icra_id);

alter table public.icra_adimlari enable row level security;

-- ===== 006_musteri_portali.sql =====
-- LexAgent AI — Faz 7 eklentisi: Basit Muvekkil Portali
-- Dosyaya salt-okunur, girissiz erisim icin rastgele bir paylasim tokeni ekler.

alter table public.dosyalar add column if not exists paylasim_token text unique;

-- ===== 007_mevzuat_canli.sql =====
-- LexAgent AI — Faz 6 revizyonu: Mevzuat modulu canli aramaya gecti
-- (Gemini + google_search, Emsal Arastirma modulundekiyle ayni yontem).
-- Statik/ornek veri seti tasiyan eski "mevzuat" tablosuna artik gerek yok.
-- Supabase SQL Editor'de calistirin.

drop table if exists public.mevzuat cascade;

