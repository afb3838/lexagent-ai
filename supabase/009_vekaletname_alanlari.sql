-- LexAgent AI — Vekaletname OCR icin yapilandirilmis alanlar
-- Supabase SQL Editor'de calistirin.

alter table public.vekaletnameler add column if not exists vekil_adi text;
alter table public.vekaletnameler add column if not exists muvekkil_adi text;
alter table public.vekaletnameler add column if not exists muvekkil_tc text;
alter table public.vekaletnameler add column if not exists muvekkil_adres text;
alter table public.vekaletnameler add column if not exists noter text;
