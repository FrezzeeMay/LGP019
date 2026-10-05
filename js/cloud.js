/* KasKita cloud.js: sinkron Supabase (opsional).
   Tanpa config = mode lokal (localStorage saja, seperti sebelumnya).
   Dengan config = data + riwayat tersimpan di cloud dan sama di semua perangkat.
   Foto baju tetap lokal per perangkat karena ukurannya besar. */
(function () {
  "use strict";

  var CFG_KEY = "kaskita_cloud_cfg";
  var OFF_KEY = "kaskita_cloud_off";
  var client = null;
  var me = null;
  var profCache = null;
  var pushTimer = null;
  var pullTimer = null;
  var subscribed = false;
  var photoMigrated = false;
  var SHIRT_BUCKET = "shirt-photos";

  function K() { return window.KasKita; }

  // Config bawaan dari file js/supabase-config.js (untuk situs yang di-deploy).
  // Prioritas: setting manual per browser (localStorage) > config bawaan file.
  function baked() {
    try {
      var b = window.KASKITA_CLOUD || null;
      if (b && b.url && b.key) {
        return { url: String(b.url).trim(), key: String(b.key).trim(), source: "baked" };
      }
    } catch (e) {}
    return null;
  }
  function cfg() {
    try {
      var s = JSON.parse(localStorage.getItem(CFG_KEY) || "null");
      if (s && s.url && s.key) {
        return { url: String(s.url).trim(), key: String(s.key).trim(), source: "manual" };
      }
    } catch (e) {}
    return baked();
  }
  function cloudOff() {
    try { return localStorage.getItem(OFF_KEY) === "1"; } catch (e) { return false; }
  }
  function setOff(v) {
    try {
      if (v) localStorage.setItem(OFF_KEY, "1");
      else localStorage.removeItem(OFF_KEY);
    } catch (e) {}
  }
  function enabled() {
    if (cloudOff()) return false;
    var c = cfg();
    return !!(c && c.url && c.key && window.supabase && window.supabase.createClient);
  }
  function baseUrl(u) {
    // terima tempelan berlebih seperti .../rest/v1, potong sampai origin project
    return String(u || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "").replace(/\/+$/, "");
  }
  function db() {
    if (!client) {
      var c = cfg();
      client = window.supabase.createClient(baseUrl(c.url), c.key);
    }
    return client;
  }
  function forget() {
    client = null; me = null; profCache = null; subscribed = false;
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
    if (pullTimer) { clearTimeout(pullTimer); pullTimer = null; }
  }

  /* ---------- Tarik seluruh state dari cloud ---------- */
  async function pull() {
    var s = db();
    var got = await Promise.all([
      s.from("participants").select("*"),
      s.from("payments").select("*"),
      s.from("shirt_paid").select("*"),
      s.from("shirt_project").select("*").eq("id", 1).maybeSingle(),
      s.from("activities").select("*").order("ts", { ascending: false }).limit(200)
    ]);
    for (var i = 0; i < got.length; i++) {
      if (got[i].error) throw new Error(got[i].error.message);
    }
    // tabel expenses mungkin belum dibuat (schema lama), anggap kosong kalau gagal
    var expRows = [];
    try {
      var expR = await s.from("expenses").select("*");
      if (!expR.error) expRows = expR.data || [];
    } catch (e) {}
    var cloudEmpty = (got[0].data.length === 0 && got[1].data.length === 0 && expRows.length === 0 && got[4].data.length === 0);
    var local = K().state;
    var localHas = (local.participants.length > 0 || local.payments.length > 0 || (local.expenses && local.expenses.length > 0));
    if (cloudEmpty && localHas) {
      await push();
      return "pushed";
    }
    var shirtPaid = {};
    (got[2].data || []).forEach(function (r) { shirtPaid[r.participant_id] = Number(r.amount) || 0; });
    var proj = got[3].data || {};
    // foto: URL cloud menang; foto lokal lama (dataURL) dipakai hanya kalau cloud kosong,
    // lalu diam-diam dipindah ke Storage agar ikut tampil di semua perangkat
    var localPhoto = (local.shirt && local.shirt.photo) || null;
    var legacyLocal = /^data:/.test(localPhoto || "");
    if (!proj.photo_url && legacyLocal && !photoMigrated) {
      photoMigrated = true;
      migrateLegacyPhoto(localPhoto);
    }
    var next = {
      participants: (got[0].data || []).map(function (r) {
        return { id: r.id, name: r.name, size: r.size, sizeCat: (r.size_cat === "anak" ? "anak" : "dewasa"), active: !!r.active };
      }),
      payments: (got[1].data || []).map(function (r) {
        return { id: r.id, participantId: r.participant_id, amount: Number(r.amount) || 0, date: r.date, note: r.note || "", by: r.by || "" };
      }),
      expenses: expRows.map(function (r) {
        return { id: r.id, title: r.title, amount: Number(r.amount) || 0, date: r.date, note: r.note || "", by: r.by || "" };
      }),
      shirtPaid: shirtPaid,
      shirt: {
        name: proj.name || local.shirt.name,
        price: Number(proj.price) || local.shirt.price || 75000,
        photo: proj.photo_url || (legacyLocal ? localPhoto : null)
      },
      activities: (got[4].data || []).map(function (r) {
        return { id: r.id, ts: Number(r.ts), by: r.by, text: r.text };
      }),
      adminOff: local.adminOff || {}
    };
    // pastikan setiap peserta punya slot setoran baju
    next.participants.forEach(function (p) {
      if (next.shirtPaid[p.id] == null) next.shirtPaid[p.id] = 0;
    });
    K().replaceState(next);
    return "pulled";
  }

  /* ---------- Foto baju: Storage agar tampil di semua perangkat ---------- */
  function bucketPathOf(url) {
    if (!url || url.indexOf(SHIRT_BUCKET + "/") < 0) return null;
    return url.split(SHIRT_BUCKET + "/")[1].split("?")[0] || null;
  }
  async function uploadShirtPhoto(file, oldUrl) {
    var s = db();
    var ext = String((file.name || "").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    if (ext.length > 5) ext = "jpg";
    var path = "desain-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7) + "." + ext;
    var up = await s.storage.from(SHIRT_BUCKET).upload(path, file, { contentType: file.type || "image/" + ext, upsert: false });
    if (up.error) throw new Error(up.error.message);
    var pub = s.storage.from(SHIRT_BUCKET).getPublicUrl(path);
    // hapus file lama biar tidak menumpuk (best-effort)
    try {
      var old = bucketPathOf(oldUrl);
      if (old) await s.storage.from(SHIRT_BUCKET).remove([old]);
    } catch (e) {}
    return pub.data.publicUrl;
  }
  async function removeShirtPhoto(url) {
    var p = bucketPathOf(url);
    if (!p) return;
    try { await db().storage.from(SHIRT_BUCKET).remove([p]); } catch (e) {}
  }
  // pindahkan foto lokal lama (dataURL) ke Storage sekali, setelah itu semua ikut tampil
  async function migrateLegacyPhoto(dataUrl) {
    try {
      var blob = await (await fetch(dataUrl)).blob();
      if (!blob.size || blob.size > 5 * 1024 * 1024) return;
      var url = await uploadShirtPhoto(new File([blob], "desain.jpg", { type: blob.type || "image/jpeg" }), null);
      K().state.shirt.photo = url;
      K().save();
      K().refreshAll();
    } catch (e) {}
  }

  /* ---------- Dorong seluruh state lokal ke cloud ---------- */
  async function push() {
    if (!enabled()) return;
    var s = db();
    var st = K().state;
    async function syncTable(table, rows, idKey) {
      if (rows.length) {
        var up = await s.from(table).upsert(rows);
        if (up.error) throw new Error(up.error.message);
      }
      var ex = await s.from(table).select(idKey);
      if (ex.error) throw new Error(ex.error.message);
      var keep = {};
      rows.forEach(function (r) { keep[r[idKey]] = true; });
      var del = (ex.data || []).map(function (r) { return r[idKey]; }).filter(function (id) { return !keep[id]; });
      if (del.length) {
        var dl = await s.from(table).delete().in(idKey, del);
        if (dl.error) throw new Error(dl.error.message);
      }
    }
    try {
      await syncTable("participants", st.participants.map(function (p) {
        return { id: p.id, name: p.name, size: p.size, size_cat: (p.sizeCat === "anak" ? "anak" : "dewasa"), active: !!p.active };
      }), "id");
    } catch (e) {
      // database lama yang belum run schema size_cat: sync tanpa kolom itu
      if (!/size_cat/i.test(String((e && e.message) || ""))) throw e;
      await syncTable("participants", st.participants.map(function (p) {
        return { id: p.id, name: p.name, size: p.size, active: !!p.active };
      }), "id");
    }
    await syncTable("payments", st.payments.map(function (t) {
      return { id: t.id, participant_id: t.participantId, amount: Math.round(Number(t.amount) || 0), date: t.date, note: t.note || "", by: t.by || "" };
    }), "id");
    await syncTable("expenses", (st.expenses || []).map(function (x) {
      return { id: x.id, title: x.title, amount: Math.round(Number(x.amount) || 0), date: x.date, note: x.note || "", by: x.by || "" };
    }), "id").catch(function () {});
    var spRows = Object.keys(st.shirtPaid).map(function (pid) {
      return { participant_id: pid, amount: Math.round(Number(st.shirtPaid[pid]) || 0) };
    });
    await syncTable("shirt_paid", spRows, "participant_id");
    var photo = (st.shirt && st.shirt.photo) || null;
    // dataURL lama tidak disimpan ke kolom (migrasi mengunggahnya terpisah)
    var photoUrl = /^data:/.test(photo || "") ? null : photo;
    var pj = await s.from("shirt_project").upsert({ id: 1, name: st.shirt.name, price: Math.round(Number(st.shirt.price) || 0), photo_url: photoUrl });
    if (pj.error) {
      // database lama yang belum run schema photo_url: simpan tanpa kolom itu
      if (!/photo_url/i.test(pj.error.message || "")) throw new Error(pj.error.message);
      var pj2 = await s.from("shirt_project").upsert({ id: 1, name: st.shirt.name, price: Math.round(Number(st.shirt.price) || 0) });
      if (pj2.error) throw new Error(pj2.error.message);
    }
    await syncTable("activities", st.activities.slice(0, 200).map(function (a) {
      return { id: a.id, ts: a.ts, by: a.by, text: a.text };
    }), "id");
  }

  function schedulePush() {
    if (!enabled()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      push().catch(function () {});
    }, 900);
  }

  function schedulePullRefresh() {
    if (pullTimer) clearTimeout(pullTimer);
    pullTimer = setTimeout(function () {
      pullTimer = null;
      pull().then(function () { K().refreshAll(); }).catch(function () {});
    }, 1200);
  }

  function subscribe() {
    if (subscribed || !enabled()) return;
    subscribed = true;
    try {
      db().channel("kaskita-all")
        .on("postgres_changes", { event: "*", schema: "public" }, function () { schedulePullRefresh(); })
        .subscribe();
    } catch (e) {}
  }

  /* ---------- Auth admin via Supabase ---------- */
  async function signIn(email, password) {
    var s = db();
    var res = await s.auth.signInWithPassword({ email: email, password: password });
    if (res.error) return null;
    var prof = await s.from("profiles").select("*").eq("email", email).single();
    if (prof.error || !prof.data) { await s.auth.signOut(); return { noprofile: true }; }
    if (prof.data.disabled) { await s.auth.signOut(); return { disabled: true }; }
    me = { email: email, name: prof.data.name, role: prof.data.role, perms: prof.data.perms || {} };
    profCache = null;
    return me;
  }
  async function restoreSession() {
    if (!enabled()) return null;
    var ses = await db().auth.getSession();
    var user = ses.data.session && ses.data.session.user;
    if (!user || !user.email) return null;
    var email = String(user.email).toLowerCase();
    var prof = await db().from("profiles").select("*").eq("email", email).single();
    if (prof.error || !prof.data || prof.data.disabled) {
      await db().auth.signOut();
      return null;
    }
    me = { email: email, name: prof.data.name, role: prof.data.role, perms: prof.data.perms || {} };
    return me;
  }
  async function signOut() {
    try { if (enabled()) await db().auth.signOut(); } catch (e) {}
    me = null; profCache = null;
  }
  function cachedUser() { return me; }

  async function getProfiles() {
    if (profCache) return profCache;
    var r = await db().from("profiles").select("*").order("email");
    if (r.error) throw new Error(r.error.message);
    profCache = r.data || [];
    return profCache;
  }
  async function setDisabled(email, val) {
    // lewat Edge Function agar hanya Super Admin yang bisa (lihat supabase/functions/create-admin)
    await adminOp("set-disabled", { email: email, disabled: !!val });
    profCache = null;
  }

  // Operasi istimewa (buat/ubah akun + hak akses) lewat Edge Function create-admin.
  // Gagal dengan pesan jelas kalau function belum di-deploy.
  async function adminOp(action, payload) {
    var body = { action: action };
    Object.keys(payload || {}).forEach(function (k) { body[k] = payload[k]; });
    var r = await db().functions.invoke("create-admin", { body: body });
    if (r.error) {
      var m = r.error.message || "Function error";
      if (/not found|404/i.test(m)) throw new Error("Edge Function create-admin belum di-deploy. Deploy dulu di Dashboard > Edge Functions.");
      throw new Error(m);
    }
    if (r.data && r.data.error) throw new Error(r.data.error);
    profCache = null;
    return r.data;
  }

  /* ---------- Diagnosa bertahap untuk tombol Tes koneksi ---------- */
  async function diagnose() {
    var out = [];
    if (!(window.supabase && window.supabase.createClient)) {
      out.push({ label: "Pustaka Supabase", ok: false, detail: "tidak termuat, periksa internet lalu reload" });
      return out;
    }
    out.push({ label: "Pustaka Supabase", ok: true, detail: "termuat" });
    var c = cfg();
    if (!c || !c.url || !c.key) {
      out.push({ label: "Config", ok: false, detail: "URL/key belum disimpan, klik Sambungkan dulu" });
      return out;
    }
    var url = baseUrl(c.url);
    try {
      var h = await fetch(url + "/auth/v1/health", { headers: { apikey: c.key } });
      out.push({ label: "Server Supabase", ok: h.status < 500, detail: "HTTP " + h.status + (h.status < 500 ? "" : ", project mungkin paused, cek dashboard") });
    } catch (e) {
      out.push({ label: "Server Supabase", ok: false, detail: "tidak bisa dihubungi, cek internet, URL, atau project paused" });
      return out;
    }
    var s;
    try { s = db(); }
    catch (e) {
      out.push({ label: "Client", ok: false, detail: String(e.message || e) });
      return out;
    }
    try {
      var bl = await s.storage.from(SHIRT_BUCKET).list("", { limit: 1 });
      out.push(bl.error
        ? { label: "Storage " + SHIRT_BUCKET, ok: false, detail: bl.error.message + " (run bagian STORAGE di schema)" }
        : { label: "Storage " + SHIRT_BUCKET, ok: true, detail: "siap, foto tampil di semua perangkat" });
    } catch (e) {
      out.push({ label: "Storage " + SHIRT_BUCKET, ok: false, detail: String(e.message || e) });
    }
    var tables = ["participants", "payments", "expenses", "shirt_project", "activities", "profiles"];
    for (var i = 0; i < tables.length; i++) {
      try {
        var r = await s.from(tables[i]).select("*").limit(1);
        out.push(r.error
          ? { label: "Tabel " + tables[i], ok: false, detail: r.error.message + " (schema belum di-Run?)" }
          : { label: "Tabel " + tables[i], ok: true, detail: "bisa dibaca" });
      } catch (e) {
        out.push({ label: "Tabel " + tables[i], ok: false, detail: String(e.message || e) });
      }
    }
    return out;
  }

  window.KasKitaCloud = {
    diagnose: diagnose,
    enabled: enabled, cfg: cfg, forget: forget,
    pull: pull, push: push, schedulePush: schedulePush, subscribe: subscribe,
    signIn: signIn, restoreSession: restoreSession, signOut: signOut,
    cachedUser: cachedUser, getProfiles: getProfiles, setDisabled: setDisabled, adminOp: adminOp,
    uploadShirtPhoto: uploadShirtPhoto, removeShirtPhoto: removeShirtPhoto,
    CFG_KEY: CFG_KEY, OFF_KEY: OFF_KEY, baked: baked, cloudOff: cloudOff, setOff: setOff
  };
})();
