-- LexAgent AI — Faz 4 eklentisi: Vekaletname Klasoru + Cari Hesap
-- Supabase SQL Editor'de elle calistirilir. supabase/schema.sql zaten calismis olmali.

create table public.vekaletnameler (
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

create index vekaletnameler_dosya_id_idx on public.vekaletnameler(dosya_id);
create index vekaletnameler_kullanici_id_idx on public.vekaletnameler(kullanici_id);

alter table public.vekaletnameler enable row level security;

create table public.cari_hesap_kayitlari (
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

create index cari_hesap_dosya_id_idx on public.cari_hesap_kayitlari(dosya_id);
create index cari_hesap_kullanici_id_idx on public.cari_hesap_kayitlari(kullanici_id);

alter table public.cari_hesap_kayitlari enable row level security;
