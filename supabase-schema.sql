-- KasKita Supabase schema. Jalankan sekali di Supabase Dashboard > SQL Editor > New query.
-- Urutan: buat tabel + policy dulu, lalu daftarkan 3 user di Authentication > Users,
-- terakhir jalankan ulang bagian INSERT profiles di bawah.
--
-- PENTING (anti-bobol, setting manual sekali di Dashboard):
-- 1. Authentication > Sign In / Up > MATIKAN "Allow new users to sign up".
--    Kalau dibiarkan ON, orang asing bisa daftar sendiri via anon key lalu
--    dapat role authenticated dan bisa MENULIS semua tabel (kebijakan write_auth).
-- 2. Jangan pernah tempel SERVICE ROLE key ke kolom "Anon key" di aplikasi.
--    Service role melewati semua RLS. Yang dipakai aplikasi hanya ANON key.
-- 3. Aktifkan "Protect against leaked passwords" di pengaturan Auth bila tersedia.

-- ============ TABEL ============
create table if not exists participants (
  id text primary key,
  name text not null,
  size text not null default 'M',
  size_cat text not null default 'dewasa',
  active boolean not null default true,
  created_at timestamptz default now()
);

-- kolom kategori ukuran (dewasa/anak) untuk database yang dibuat sebelum fitur ini ada
alter table participants add column if not exists size_cat text not null default 'dewasa';
update participants set size_cat = 'dewasa' where size_cat not in ('dewasa', 'anak');

create table if not exists payments (
  id text primary key,
  participant_id text not null,
  amount integer not null,
  date text not null,
  note text default '',
  by text default '',
  created_at timestamptz default now()
);

create table if not exists expenses (
  id text primary key,
  title text not null,
  amount integer not null,
  date text not null,
  note text default '',
  by text default '',
  created_at timestamptz default now()
);

create table if not exists shirt_paid (
  participant_id text primary key,
  amount integer not null default 0
);

create table if not exists shirt_project (
  id integer primary key,
  name text,
  price integer
);

create table if not exists activities (
  id text primary key,
  ts bigint,
  by text,
  text text
);

create table if not exists profiles (
  email text primary key,
  name text not null,
  role text not null,
  disabled boolean not null default false,
  perms jsonb not null default '{}'
);

-- ============ RLS: baca publik, tulis khusus admin login ============
alter table participants enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table shirt_paid enable row level security;
alter table shirt_project enable row level security;
alter table activities enable row level security;
alter table profiles enable row level security;

drop policy if exists read_public on participants;
create policy read_public on participants for select using (true);
drop policy if exists write_auth on participants;
create policy write_auth on participants for all to authenticated using (true) with check (true);

drop policy if exists read_public on payments;
create policy read_public on payments for select using (true);
drop policy if exists write_auth on payments;
create policy write_auth on payments for all to authenticated using (true) with check (true);

drop policy if exists read_public on expenses;
create policy read_public on expenses for select using (true);
drop policy if exists write_auth on expenses;
create policy write_auth on expenses for all to authenticated using (true) with check (true);

drop policy if exists read_public on shirt_paid;
create policy read_public on shirt_paid for select using (true);
drop policy if exists write_auth on shirt_paid;
create policy write_auth on shirt_paid for all to authenticated using (true) with check (true);

drop policy if exists read_public on shirt_project;
create policy read_public on shirt_project for select using (true);
drop policy if exists write_auth on shirt_project;
create policy write_auth on shirt_project for all to authenticated using (true) with check (true);

drop policy if exists read_public on activities;
create policy read_public on activities for select using (true);
drop policy if exists write_auth on activities;
create policy write_auth on activities for all to authenticated using (true) with check (true);

-- Profil admin BUKAN data publik: hanya user login yang boleh baca.
-- Tamu tetap bisa melihat kas/peserta/baju tanpa login, tapi daftar email admin tertutup.
drop policy if exists read_public on profiles;
drop policy if exists read_auth on profiles;
create policy read_auth on profiles for select to authenticated using (true);
drop policy if exists write_auth on profiles;
create policy write_auth on profiles for all to authenticated using (true) with check (true);

-- kolom perms untuk database yang dibuat sebelum fitur hak akses ada.
-- HARUS sebelum INSERT di bawah, kalau tidak insert gagal (kolom belum ada).
alter table profiles add column if not exists perms jsonb not null default '{}';
update profiles set perms = '{"peserta":true,"kas":true,"baju":true,"aktivitas":true,"pengaturan":true}' where perms = '{}';

-- ============ AKUN ADMIN (jalankan setelah 3 user dibuat di Authentication) ============
insert into profiles (email, name, role, disabled, perms) values
  ('rayhan@gmail.com', 'Rayhan', 'SUPER ADMIN', false, '{"peserta":true,"kas":true,"baju":true,"aktivitas":true,"pengaturan":true}'),
  ('alfi@gmail.com', 'Alfi', 'ADMIN', false, '{"peserta":true,"kas":true,"baju":true,"aktivitas":true,"pengaturan":true}'),
  ('naugal@gmail.com', 'Naufal', 'ADMIN', false, '{"peserta":true,"kas":true,"baju":true,"aktivitas":true,"pengaturan":true}')
on conflict (email) do update set name = excluded.name, role = excluded.role;

insert into shirt_project (id, name, price) values (1, 'Baju Angkatan 2026', 75000)
on conflict (id) do nothing;

-- ============ REALTIME: perubahan langsung tampil di semua perangkat ============
-- dibungkus DO agar aman di-run ulang (tabel yang sudah terdaftar dilewati)
do $$
begin
  begin alter publication supabase_realtime add table participants; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table payments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table expenses; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table shirt_paid; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table shirt_project; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table activities; exception when duplicate_object then null; end;
end $$;
