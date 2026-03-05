-- Good Deeds - Supabase Setup
-- Run this in Supabase SQL Editor

drop table if exists app_state;
drop table if exists logs;
drop table if exists custom_good_deeds;
drop table if exists custom_bad_deeds;
drop table if exists kids;

create table kids (
  id int primary key,
  name text not null,
  age int not null,
  emoji text not null,
  color text not null,
  avatar text
);

create table logs (
  id text primary key,
  kid_id int references kids(id) on delete cascade,
  type text not null check (type in ('good', 'bad')),
  label text not null,
  emoji text not null,
  weight int not null default 1,
  ts timestamptz not null default now()
);

create table custom_good_deeds (
  id serial primary key,
  label text not null,
  emoji text not null default '✨'
);

create table custom_bad_deeds (
  id serial primary key,
  label text not null,
  emoji text not null default '💢'
);

alter table kids enable row level security;
alter table logs enable row level security;
alter table custom_good_deeds enable row level security;
alter table custom_bad_deeds enable row level security;
create policy "Allow all" on kids for all using (true) with check (true);
create policy "Allow all" on logs for all using (true) with check (true);
create policy "Allow all" on custom_good_deeds for all using (true) with check (true);
create policy "Allow all" on custom_bad_deeds for all using (true) with check (true);

-- Note: Kids are auto-seeded by the app on first load.
-- After running this, enable Realtime on all 3 tables in Database > Replication.
