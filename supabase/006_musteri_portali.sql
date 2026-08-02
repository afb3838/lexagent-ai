-- LexAgent AI — Faz 7 eklentisi: Basit Muvekkil Portali
-- Dosyaya salt-okunur, girissiz erisim icin rastgele bir paylasim tokeni ekler.

alter table public.dosyalar add column if not exists paylasim_token text unique;
