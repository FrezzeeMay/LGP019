/* KasKita supabase-config.js: config cloud BAWAAN untuk situs yang di-deploy.
   Kalau file ini diisi, SEMUA pengunjung situs otomatis tersambung ke Supabase
   (tidak perlu isi URL/key manual per browser lagi).
   Isi dengan Project URL + ANON key (Project Settings > API di Supabase Dashboard),
   lalu commit + deploy ke GitHub Pages / Cloudflare Pages.
   ANON key memang publik dan aman dipublish. JANGAN taruh SERVICE ROLE key di sini.
   Super Admin masih bisa override atau putus sementara lewat panel Koneksi Cloud
   (override itu tersimpan per browser, tidak mengubah file ini). */

window.KASKITA_CLOUD = {
  url: "https://sqkgvjjcfajmxbniqntd.supabase.co/rest/v1",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxa2d2ampjZmFqbXhibmlxbnRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMTIxMzAsImV4cCI6MjEwNjY4ODEzMH0.ge044KeW2c7_UtC0ZXgkvyx0NFsM-oGb33MrDdXTi-c"
};
