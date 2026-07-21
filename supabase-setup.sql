-- ============================================================
-- Mercado Solidário — setup do banco no Supabase
-- Rode UMA VEZ em: Supabase → SQL Editor → New query → colar → Run
-- ============================================================

create table if not exists produtos (
  id text primary key, nome text, qtd int, unidade text, data text, por text, ts bigint
);
create table if not exists saidas (
  id text primary key, nome text, qtd int, unidade text, familia text, obs text, data text, por text, ts bigint
);
create table if not exists familias (
  id text primary key, nome text, obs text, por text, ts bigint
);
create table if not exists catalogo (
  id text primary key, nome text, por text, ts bigint
);

-- Row Level Security ligado, com acesso liberado para a chave pública (anon).
-- (App simples da igreja, sem login por senha; o site já é público.)
alter table produtos enable row level security;
alter table saidas   enable row level security;
alter table familias enable row level security;
alter table catalogo enable row level security;

create policy "acesso publico" on produtos for all using (true) with check (true);
create policy "acesso publico" on saidas   for all using (true) with check (true);
create policy "acesso publico" on familias for all using (true) with check (true);
create policy "acesso publico" on catalogo for all using (true) with check (true);
