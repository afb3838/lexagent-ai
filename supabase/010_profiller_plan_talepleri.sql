-- LexAgent AI — Profiller (abonelik plani) + Plan Talepleri
-- Idempotent: birden fazla kez calistirilabilir. Supabase SQL Editor'de calistirin.

create table if not exists public.profiller (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ad_soyad text,
  plan text not null default 'deneme',
  -- plan degerleri: deneme | baslangic | profesyonel | kurumsal
  deneme_bitis timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

alter table public.profiller enable row level security;

-- Yeni kullanici Supabase Auth'ta olusunca otomatik bir profil satiri acar
-- (14 gunluk deneme suresiyle). Zaten var olan kullanicilar icin backend
-- /api/profil endpoint'i ilk cagrida ayni satiri kendisi olusturur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiller (user_id, ad_soyad, deneme_bitis)
  values (new.id, new.raw_user_meta_data ->> 'ad_soyad', now() + interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Ucretli plana gecmek isteyen kullanicilarin talepleri (gercek odeme
-- entegrasyonu yok; talep buraya dusuyor, isletme sahibi manuel donus yapar).
create table if not exists public.plan_talepleri (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  plan text not null,
  ad_soyad text,
  eposta text,
  telefon text,
  mesaj text,
  durum text not null default 'yeni',
  -- durum degerleri: yeni | iletisime_gecildi | tamamlandi
  created_at timestamptz not null default now()
);

alter table public.plan_talepleri enable row level security;
