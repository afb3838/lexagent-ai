-- LexAgent AI — Faz 1 + Faz 2 veritabani semasi
-- Supabase SQL Editor'de elle calistirilir (Faz 0, adim 5). Idempotent degildir;
-- ilk kurulumda bir kez calistirin.

create table public.dosyalar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  muvekkil_adi text not null,
  karsi_taraf text,
  mahkeme text,
  esas_no text,
  dava_turu text,
  acilis_tarihi date,
  durum text not null default 'acildi',
  -- durum degerleri: acildi | bilirkisi_bekleniyor | durusma_bekleniyor | karar_cikti | temyiz | kesinlesti
  son_durum_ozeti text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dosyalar_user_id_idx on public.dosyalar(user_id);

create table public.belgeler (
  id uuid primary key default gen_random_uuid(),
  dosya_id uuid not null references public.dosyalar(id) on delete cascade,
  ad text not null,
  tur text not null default 'diger',
  -- tur degerleri: dilekce | karar | delil | arastirma | diger
  metin text,
  storage_path text,
  created_at timestamptz not null default now()
);

create index belgeler_dosya_id_idx on public.belgeler(dosya_id);

-- RLS acik ama policy tanimlanmadi (deny-by-default). Backend, service_role
-- anahtariyla PostgREST'e baglanir ve RLS'i bypass eder; frontend bu tablolara
-- hicbir zaman dogrudan erismez (hep FastAPI /api/... uzerinden), o yuzden
-- ayrica bir "kullanici kendi satirini okuyabilir" policy'sine gerek yok.
alter table public.dosyalar enable row level security;
alter table public.belgeler enable row level security;

-- updated_at otomatik guncelleme
create function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger dosyalar_set_updated_at
  before update on public.dosyalar
  for each row execute procedure public.set_updated_at();
