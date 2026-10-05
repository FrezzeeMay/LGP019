// Edge Function: create-admin
// Deploy: Supabase Dashboard > Edge Functions > Create function > nama: create-admin
// > paste seluruh file ini > Deploy. Tidak perlu CLI.
// Tugas: hanya SUPER ADMIN yang boleh membuat / mengubah akun + hak akses.
// Dipanggil aplikasi lewat KasKitaCloud.adminOp("create" | "update" | "set-disabled", {...}).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, cors),
  });
}

const PERM_KEYS = ["peserta", "kas", "baju", "aktivitas", "pengaturan"];

function cleanPerms(p) {
  const out = {};
  PERM_KEYS.forEach((k) => { out[k] = !!(p && p[k]); });
  return out;
}

function validEmail(e) {
  return typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim().toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method tidak diizinkan" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: ud } = await supabase.auth.getUser(token);
  const caller = (ud && ud.user && ud.user.email ? ud.user.email : "").toLowerCase();
  if (!caller) return json({ error: "unauthorized" }, 401);

  const { data: me } = await supabase.from("profiles").select("role").eq("email", caller).single();
  if (!me || me.role !== "SUPER ADMIN") return json({ error: "hanya Super Admin" }, 403);

  let body = {};
  try { body = await req.json(); } catch (_e) { return json({ error: "body bukan JSON" }, 400); }

  async function countSupers(exceptEmail) {
    const { data } = await supabase.from("profiles").select("email").eq("role", "SUPER ADMIN").eq("disabled", false);
    return (data || []).map((r) => String(r.email).toLowerCase()).filter((e) => e !== exceptEmail);
  }

  if (body.action === "create") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const role = body.role === "SUPER ADMIN" ? "SUPER ADMIN" : "ADMIN";
    if (!validEmail(email) || email.length > 80) return json({ error: "email tidak valid" }, 400);
    if (password.length < 6 || password.length > 128) return json({ error: "password 6-128 karakter" }, 400);
    if (name.length < 2 || name.length > 40) return json({ error: "nama 2-40 huruf" }, 400);
    const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return json({ error: error.message }, 400);
    const { error: e2 } = await supabase.from("profiles").upsert({
      email, name, role, disabled: false, perms: cleanPerms(body.perms),
    });
    if (e2) return json({ error: e2.message }, 400);
    return json({ ok: true });
  }

  if (body.action === "update") {
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const role = body.role === "SUPER ADMIN" ? "SUPER ADMIN" : "ADMIN";
    if (!validEmail(email) || email.length > 80) return json({ error: "email tidak valid" }, 400);
    if (name.length < 2 || name.length > 40) return json({ error: "nama 2-40 huruf" }, 400);
    // cegah penurunan super admin terakhir (nanti tidak ada yang bisa kelola akun)
    if (role !== "SUPER ADMIN") {
      const { data: cur } = await supabase.from("profiles").select("role").eq("email", email).single();
      if (cur && cur.role === "SUPER ADMIN") {
        const rest = await countSupers(email);
        if (rest.length === 0) return json({ error: "minimal harus ada 1 Super Admin aktif" }, 400);
      }
    }
    const { error } = await supabase.from("profiles").update({
      name, role, perms: cleanPerms(body.perms),
    }).eq("email", email);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (body.action === "set-disabled") {
    const email = String(body.email || "").trim().toLowerCase();
    if (!validEmail(email)) return json({ error: "email tidak valid" }, 400);
    if (email === caller) return json({ error: "tidak bisa menonaktifkan diri sendiri" }, 400);
    if (body.disabled) {
      const { data: cur } = await supabase.from("profiles").select("role").eq("email", email).single();
      if (cur && cur.role === "SUPER ADMIN") {
        const rest = await countSupers(email);
        if (rest.length === 0) return json({ error: "minimal harus ada 1 Super Admin aktif" }, 400);
      }
    }
    const { error } = await supabase.from("profiles").update({ disabled: !!body.disabled }).eq("email", email);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "aksi tidak dikenal" }, 400);
});
