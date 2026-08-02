-- LexAgent AI — Faz 3 eklentisi: Ajanda/Takvim
-- Supabase SQL Editor'de elle calistirilir. supabase/schema.sql zaten calistirilmis
-- olmali (dosyalar tablosu bu tabloya referans veriyor).

create table public.etkinlikler (
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

create index etkinlikler_kullanici_id_idx on public.etkinlikler(kullanici_id);
create index etkinlikler_dosya_id_idx on public.etkinlikler(dosya_id);
create index etkinlikler_tarih_idx on public.etkinlikler(tarih);

-- Diger tablolarla ayni desen: RLS acik, policy yok (backend service_role ile bypass
-- eder, frontend bu tabloya dogrudan erismez).
alter table public.etkinlikler enable row level security;
