-- LexAgent AI — Kullanici basina gunluk arama limiti (paylasilan Gemini
-- kotasini tek bir kullanicinin tuketip digerlerini etkilemesini onlemek icin).
-- Idempotent: birden fazla kez calistirilabilir. Supabase SQL Editor'de calistirin.

create table if not exists public.gunluk_kullanim (
  user_id uuid not null references auth.users(id) on delete cascade,
  tarih date not null,
  sayi integer not null default 0,
  primary key (user_id, tarih)
);

alter table public.gunluk_kullanim enable row level security;
