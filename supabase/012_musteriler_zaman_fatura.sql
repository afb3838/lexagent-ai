-- LexAgent AI — Musteriler (CRM), Zaman Takibi, Faturalandirma
-- Idempotent: birden fazla kez calistirilabilir. Supabase SQL Editor'de calistirin.

create table if not exists public.musteriler (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  ad_soyad text not null,
  tc_vergi_no text,
  telefon text,
  eposta text,
  adres text,
  notlar text,
  created_at timestamptz not null default now()
);
create index if not exists musteriler_user_id_idx on public.musteriler(user_id);
alter table public.musteriler enable row level security;

alter table public.dosyalar add column if not exists musteri_id uuid references public.musteriler(id);

create table if not exists public.zaman_kayitlari (
  id uuid primary key default gen_random_uuid(),
  dosya_id uuid not null references public.dosyalar(id) on delete cascade,
  tarih date not null,
  sure_dakika integer not null,
  aciklama text,
  saatlik_ucret numeric,
  created_at timestamptz not null default now()
);
create index if not exists zaman_kayitlari_dosya_id_idx on public.zaman_kayitlari(dosya_id);
alter table public.zaman_kayitlari enable row level security;

create table if not exists public.faturalar (
  id uuid primary key default gen_random_uuid(),
  dosya_id uuid not null references public.dosyalar(id) on delete cascade,
  fatura_no text not null,
  tarih date not null default current_date,
  tutar numeric not null,
  aciklama text,
  created_at timestamptz not null default now()
);
create index if not exists faturalar_dosya_id_idx on public.faturalar(dosya_id);
alter table public.faturalar enable row level security;
