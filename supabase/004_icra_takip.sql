-- LexAgent AI — Faz 5 eklentisi: Icra Takip
-- Supabase SQL Editor'de elle calistirilir.

create table public.icra_dosyalari (
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

create index icra_dosyalari_kullanici_id_idx on public.icra_dosyalari(kullanici_id);
create index icra_dosyalari_dosya_id_idx on public.icra_dosyalari(dosya_id);

alter table public.icra_dosyalari enable row level security;

create table public.icra_adimlari (
  id uuid primary key default gen_random_uuid(),
  icra_id uuid not null references public.icra_dosyalari(id) on delete cascade,
  tarih date not null default current_date,
  tur text not null default 'diger',
  -- tur degerleri: haciz | tahsilat | tebligat | diger
  aciklama text,
  tutar numeric(12,2),
  created_at timestamptz not null default now()
);

create index icra_adimlari_icra_id_idx on public.icra_adimlari(icra_id);

alter table public.icra_adimlari enable row level security;
