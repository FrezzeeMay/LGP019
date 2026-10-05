/* KasKita app.js: state, auth, navigasi, dashboard, aktivitas, pengaturan.
   File lain (participants/payments/shirts) menempel ke window.KasKita.
   Aturan akses: tamu boleh melihat semua data, hanya admin yang boleh mengubah. */
(function () {
  "use strict";

  var LS_KEY = "kaskita_v2";
  var SESSION_KEY = "kaskita_session";

  var FULL_PERMS = { peserta: true, kas: true, baju: true, aktivitas: true, pengaturan: true };
  var PERM_LABEL = { peserta: "Data Peserta", kas: "Pembayaran Kas", baju: "Pembuatan Baju", aktivitas: "Aktivitas", pengaturan: "Pengaturan" };
  var ACCT_KEY = "kaskita_accounts";

  var CRED = {
    "rayhan@gmail.com": { password: "RayhanLGP019", name: "Rayhan", role: "SUPER ADMIN", perms: FULL_PERMS },
    "alfi@gmail.com": { password: "AlfiLGP019", name: "Alfi", role: "ADMIN", perms: FULL_PERMS },
    "naugal@gmail.com": { password: "NaufalLGP019", name: "Naufal", role: "ADMIN", perms: FULL_PERMS }
  };
  // alias typo umum: ketikan naufal@ diarahkan ke akun naugal@ (akun yang sama)
  function normEmail(v) {
    var k = String(v || "").trim().toLowerCase();
    if (k === "naufal@gmail.com") return "naugal@gmail.com";
    return k;
  }

  function clonePerms(p) {
    return { peserta: !!(p && p.peserta), kas: !!(p && p.kas), baju: !!(p && p.baju), aktivitas: !!(p && p.aktivitas), pengaturan: !!(p && p.pengaturan) };
  }
  function loadCustomAccounts() {
    try { return JSON.parse(localStorage.getItem(ACCT_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveCustomAccounts(obj) {
    try { localStorage.setItem(ACCT_KEY, JSON.stringify(obj || {})); } catch (e) {}
  }
  // gabungan akun bawaan + akun buatan Super Admin (mode lokal)
  function allCreds() {
    var out = {};
    Object.keys(CRED).forEach(function (email) {
      out[email] = { password: CRED[email].password, name: CRED[email].name, role: CRED[email].role, perms: clonePerms(CRED[email].perms), isDefault: true };
    });
    var custom = loadCustomAccounts();
    Object.keys(custom).forEach(function (email) {
      var c = custom[email] || {};
      if (out[email]) {
        if (c.name) out[email].name = c.name;
        if (c.role) out[email].role = c.role;
        if (c.perms) out[email].perms = clonePerms(c.perms);
        if (c.password) out[email].password = c.password;
      } else {
        out[email] = { password: c.password || "", name: c.name || email, role: c.role || "ADMIN", perms: clonePerms(c.perms), isDefault: false };
      }
    });
    return out;
  }
  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim().toLowerCase());
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function uid(prefix) { return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtRp(n) {
    n = Math.round(Number(n) || 0);
    return "Rp" + n.toLocaleString("id-ID");
  }
  // input nominal: ketik 20000 -> tampil "20.000". Simpan selalu angka polos.
  function parseRupiah(v) {
    var d = String(v == null ? "" : v).replace(/\D/g, "").slice(0, 13);
    return d ? parseInt(d, 10) : 0;
  }
  function fmtRibuan(n) {
    n = Math.round(Number(n) || 0);
    return n.toLocaleString("id-ID");
  }
  function bindRupiah(id) {
    var el = document.getElementById(id);
    if (!el || el.getAttribute("data-rupiah")) return;
    el.setAttribute("data-rupiah", "1");
    el.addEventListener("input", function () {
      var d = el.value.replace(/\D/g, "").slice(0, 13);
      el.value = d ? Number(d).toLocaleString("id-ID") : "";
    });
  }
  function fmtDate(iso) {
    if (!iso) return "-";
    var d = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  }
  function fmtTime(ts) {
    var d = new Date(ts);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---------- State awal: kosong, user mengisi sendiri ---------- */
  function seed() {
    return {
      participants: [],
      payments: [],
      expenses: [],
      shirtPaid: {},
      shirt: { name: "Baju Angkatan 2026", price: 75000, photo: null },
      activities: [],
      adminOff: {}
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) { var s = seed(); localStorage.setItem(LS_KEY, JSON.stringify(s)); return s; }
      var data = JSON.parse(raw);
      if (!data.participants || !data.payments || !data.shirt) throw new Error("bad shape");
      // gabung default agar data lama yang belum punya field baru tidak rusak
      data.expenses = data.expenses || [];
      data.shirtPaid = data.shirtPaid || {};
      data.activities = data.activities || [];
      data.adminOff = data.adminOff || {};
      return data;
    } catch (e) {
      var s2 = seed();
      try { localStorage.setItem(LS_KEY, JSON.stringify(s2)); } catch (_e) {}
      return s2;
    }
  }
  function saveLocal() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function save() {
    saveLocal();
    if (window.KasKitaCloud) window.KasKitaCloud.schedulePush();
  }
  function replaceState(next) {
    state = next;
    window.KasKita.state = state;
    saveLocal();
  }

  var state = load();

  /* ---------- Derived ---------- */
  function totalsByPid() {
    var m = {};
    state.participants.forEach(function (p) { m[p.id] = 0; });
    state.payments.forEach(function (t) { m[t.participantId] = (m[t.participantId] || 0) + Number(t.amount || 0); });
    return m;
  }
  function grandTotal() {
    return state.payments.reduce(function (a, t) { return a + Number(t.amount || 0); }, 0);
  }
  function shirtTarget() { return Number(state.shirt.price || 0) * state.participants.length; }
  // dana baju = total kas tiap peserta dibatasi harga baju, mengikuti catatan kas
  function shirtCollected() {
    var price = Number(state.shirt.price || 0);
    if (!(price > 0)) return 0;
    var totals = totalsByPid();
    return state.participants.reduce(function (a, p) {
      return a + Math.min(totals[p.id] || 0, price);
    }, 0);
  }
  function participantName(pid) {
    var p = state.participants.find(function (x) { return x.id === pid; });
    return p ? p.name : "(dihapus)";
  }
  function currentUser() {
    if (window.KasKitaCloud && window.KasKitaCloud.enabled()) {
      return window.KasKitaCloud.cachedUser();
    }
    try {
      var u = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (!u || !u.email) return null;
      var key = normEmail(u.email);
      var creds = allCreds();
      if (!creds[key]) return null;
      if (state.adminOff && state.adminOff[key]) return null;
      // selesaikan dari data akun terbaru agar edit nama/role/perms langsung berlaku
      return { email: key, name: creds[key].name, role: creds[key].role, perms: clonePerms(creds[key].perms) };
    } catch (e) { return null; }
  }
  function isSuper() { var u = currentUser(); return !!(u && u.role === "SUPER ADMIN"); }
  // hak akses per menu. Tamu bebas melihat, admin mengikuti perms. Super Admin selalu boleh.
  function can(key) {
    if (key === "dashboard") return true;
    var u = currentUser();
    if (!u) return true;
    if (u.role === "SUPER ADMIN") return true;
    return !!(u.perms && u.perms[key]);
  }
  function requirePerm(key) {
    if (!currentUser()) {
      openLoginGate();
      toast("Login sebagai admin dulu untuk mengubah data.", "err");
      return false;
    }
    if (!can(key)) {
      toast("Akunmu tidak punya akses ke " + (PERM_LABEL[key] || "menu ini") + ".", "err");
      return false;
    }
    return true;
  }

  /* ---------- Toast ---------- */
  function toast(msg, type) {
    var root = $("#toastRoot");
    var el = document.createElement("div");
    el.className = "toast " + (type === "err" ? "err" : "ok");
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.classList.add("leaving");
      setTimeout(function () { el.remove(); }, 220);
    }, 2600);
  }

  /* ---------- Modal manager ---------- */
  var lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    $("#modalBackdrop").hidden = false;
    $all(".modal").forEach(function (m) { m.hidden = true; });
    var m = $("#" + id);
    if (m) {
      m.hidden = false;
      var f = m.querySelector("input,select,button.btn-primary");
      if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 60);
    }
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    $("#modalBackdrop").hidden = true;
    $all(".modal").forEach(function (m) { m.hidden = true; });
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }
  var confirmCb = null;
  function askConfirm(title, desc, yesLabel, cb) {
    $("#mcTitle").textContent = title;
    $("#mcDesc").textContent = desc;
    $("#confirmYes").textContent = yesLabel || "Hapus";
    confirmCb = cb;
    openModal("modal-confirm");
  }

  /* ---------- Gerbang admin: tamu boleh lihat, ubah harus login ---------- */
  function openLoginGate() {
    $("#loginView").hidden = false;
    $("#appView").hidden = true;
    $("#loginBack").hidden = false;
    $("#loginErr").hidden = true;
  }
  function requireAdmin() {
    if (currentUser()) return true;
    openLoginGate();
    toast("Login sebagai admin dulu untuk mengubah data.", "err");
    return false;
  }

  /* ---------- Activity ---------- */
  function logActivity(text) {
    var u = currentUser();
    state.activities.unshift({ id: uid("act"), ts: Date.now(), by: u ? u.name : "Sistem", text: text });
    state.activities = state.activities.slice(0, 200);
    save();
    renderActivity();
    renderDashboard();
  }

  /* ---------- Unduh CSV (buka di Excel, pemisah ; + BOM) ---------- */
  function downloadCSV(filename, headers, rows) {
    function cell(v) {
      var s = String(v == null ? "" : v);
      if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var lines = [headers.map(cell).join(";")];
    rows.forEach(function (r) { lines.push(r.map(cell).join(";")); });
    var blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportActivity() {
    var f = $("#actFilter") ? $("#actFilter").value : "";
    var list = state.activities.filter(function (a) { return !f || a.by === f; });
    if (!list.length) { toast("Tidak ada data untuk diunduh.", "err"); return; }
    var rows = list.map(function (a) {
      var d = new Date(a.ts);
      var waktu = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) + " " +
        d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      return [waktu, a.by, a.text];
    });
    downloadCSV("kaskita-aktivitas-" + todayISO() + ".csv", ["Waktu", "Admin", "Aktivitas"], rows);
    toast("Tabel aktivitas diunduh (" + rows.length + " baris).");
  }

  /* ---------- Navigation ---------- */
  var VIEWS = ["dashboard", "peserta", "kas", "baju", "aktivitas", "pengaturan"];
  function showView(name) {
    if (VIEWS.indexOf(name) < 0) name = "dashboard";
    // kunci menu sesuai hak akses akun (tamu bebas melihat semua)
    if (name !== "dashboard" && currentUser() && !can(name)) {
      toast("Akunmu tidak punya akses ke " + (PERM_LABEL[name] || "menu ini") + ".", "err");
      name = "dashboard";
    }
    if (name === "pengaturan" && !currentUser()) {
      toast("Login sebagai admin dulu untuk membuka Pengaturan.");
      name = "dashboard";
    }
    $all(".view").forEach(function (v) {
      var on = v.id === "view-" + name;
      v.hidden = !on;
      v.classList.toggle("is-active", on);
    });
    $all("[data-nav]").forEach(function (b) {
      var on = b.getAttribute("data-nav") === name;
      b.classList.toggle("is-active", on);
      if (b.classList.contains("nav-item")) {
        if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
      }
    });
    closeSheet();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openSheet() {
    $("#mobileSheet").hidden = false;
    $("#mobileMenuBtn").setAttribute("aria-expanded", "true");
  }
  function closeSheet() {
    var s = $("#mobileSheet");
    if (s && !s.hidden) { s.hidden = true; $("#mobileMenuBtn").setAttribute("aria-expanded", "false"); }
  }

  /* ---------- Auth ---------- */
  function applyUser() {
    var u = currentUser();
    var guest = !u;
    var name = u ? u.name : "Tamu";
    var role = u ? u.role : "TAMU";
    ["greetName", "sideUserName", "topUserName", "setName"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = name;
    });
    ["sideUserRole", "topUserRole", "setRole"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.textContent = role;
        el.classList.toggle("super", !!(u && u.role === "SUPER ADMIN"));
      }
    });
    var initial = (name || "T").charAt(0).toUpperCase();
    ["sideAvatar", "topAvatar", "setAvatar"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = initial;
    });
    var su = document.getElementById("setUser");
    if (su) su.textContent = u ? u.email : "mode tamu, lihat saja";
    // tombol login tampil saat tamu, tombol keluar tampil saat admin
    ["loginBtnTop", "loginBtnSide", "loginBtnMain", "loginBtnSheet"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.hidden = !guest;
    });
    ["logoutBtnTop", "logoutBtnSide", "logoutBtnMain", "logoutBtnSheet"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.hidden = guest;
    });
    // sembunyikan menu yang tidak boleh diakses akun ini (tamu tetap lihat semua)
    (function gateNav() {
      var u = currentUser();
      $all("[data-nav]").forEach(function (b) {
        var key = b.getAttribute("data-nav");
        var show = !u || can(key);
        b.style.display = show ? "" : "none";
      });
      var fab = document.querySelector(".bnav-fab");
      if (fab) fab.style.display = (!u || can("kas")) ? "" : "none";
    })();
    var panel = document.getElementById("accountsPanel");
    if (panel) panel.style.display = isSuper() ? "" : "none";
    // koneksi cloud hanya untuk Rayhan (Super Admin)
    var cloudPanel = document.getElementById("cloudPanel");
    if (cloudPanel) cloudPanel.style.display = isSuper() ? "" : "none";
    var clearBtn = document.getElementById("actClearBtn");
    if (clearBtn) clearBtn.style.display = isSuper() ? "" : "none";
    var note = document.getElementById("actSub");
    if (note) note.textContent = isSuper()
      ? "Jejak transaksi dan perubahan yang dilakukan admin."
      : "Jejak transaksi terbaru. Kelola akun hanya untuk Super Admin.";
  }
  function doLogin(email, password) {
    if (window.KasKitaCloud && window.KasKitaCloud.enabled()) {
      return window.KasKitaCloud.signIn(email, password);
    }
    var key = normEmail(email);
    var c = allCreds()[key];
    if (!c || c.password !== password) return null;
    if (state.adminOff && state.adminOff[key]) return { disabled: true };
    return { email: key, name: c.name, role: c.role, perms: clonePerms(c.perms) };
  }
  function enterApp() {
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    $("#loginBack").hidden = true;
    applyUser();
    refreshAll();
    showView("dashboard");
  }
  function enterGuest() {
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    $("#loginBack").hidden = true;
    applyUser();
    refreshAll();
    showView("dashboard");
  }
  function exitToGuest() {
    localStorage.removeItem(SESSION_KEY);
    closeModal();
    enterGuest();
  }

  /* ---------- Dashboard ---------- */
  function renderDashboard() {
    var totals = totalsByPid();
    var g = grandTotal();
    var n = state.participants.length;
    var paid = state.participants.filter(function (p) { return (totals[p.id] || 0) > 0; }).length;
    var pct = n ? Math.round((paid / n) * 100) : 0;

    $("#statTotalKas").textContent = fmtRp(g);
    var expOut = state.expenses.reduce(function (a, x) { return a + Number(x.amount || 0); }, 0);
    $("#statKasMeta").textContent = state.payments.length + " masuk, " + state.expenses.length +
      " keluar. Saldo " + fmtRp(g - expOut) + ".";
    $("#statKasBar").style.width = Math.min(100, n ? (g / (n * 50000)) * 100 : 0) + "%";
    $("#statPeserta").textContent = n;
    $("#statSudah").textContent = paid;
    $("#statSudahMeta").textContent = pct + "% dari peserta";
    $("#statBelum").textContent = n - paid;

    var t = shirtTarget(), c = shirtCollected();
    $("#statDanaBaju").textContent = fmtRp(c);
    $("#statDanaMeta").textContent = "dari " + fmtRp(t);
    $("#statTargetBaju").textContent = fmtRp(t);
    $("#statTargetMeta").textContent = n ? "otomatis per peserta" : "tambah peserta dulu";

    var p = t ? Math.min(100, (c / t) * 100) : 0;
    var bar = $("#dashProgressBar");
    if (bar) bar.style.width = p + "%";
    var wrap = $("#dashProgressWrap");
    if (wrap) wrap.setAttribute("aria-valuenow", String(Math.round(p)));
    $("#dashProgressPct").textContent = p.toFixed(1) + "%";
    $("#dashProgressText").textContent = (c >= t && t > 0) ? "Lunas" : "Kurang " + fmtRp(Math.max(0, t - c));

    var d = new Date();
    var u = currentUser();
    $("#dashDate").textContent = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) +
      (u ? ". Ringkasan kas dan baju hari ini." : ". Kamu melihat sebagai tamu, login admin untuk mengelola.");

    // 5 aktivitas kas terakhir gabungan masuk dan keluar
    var combined = state.payments.map(function (x) {
      return { date: x.date, amt: Number(x.amount) || 0, kind: "in", label: participantName(x.participantId), sub: fmtDate(x.date) + " &middot; " + esc(x.by) };
    }).concat(state.expenses.map(function (x) {
      return { date: x.date, amt: Number(x.amount) || 0, kind: "out", label: x.title, sub: fmtDate(x.date) + " &middot; " + esc(x.by) + " &middot; keluar" };
    })).sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 5);
    var rl = $("#recentList");
    rl.innerHTML = combined.length ? combined.map(function (x) {
      var sign = x.kind === "in" ? "+" : "-";
      return '<li><span class="r-avatar" aria-hidden="true">' + esc(x.label.charAt(0).toUpperCase()) + '</span>' +
        '<span class="r-meta"><span class="r-name">' + esc(x.label) + '</span><br><span class="r-sub">' + x.sub + "</span></span>" +
        '<span class="r-amt ' + x.kind + '">' + sign + esc(fmtRp(x.amt)) + "</span></li>";
    }).join("") : '<li><span class="r-meta"><span class="r-name">Belum ada transaksi</span></span></li>';

    var sizes = {};
    state.participants.forEach(function (x) {
      if (!x.size) return;
      var cat = window.KasKitaSizes ? window.KasKitaSizes.normCat(x.sizeCat) : "dewasa";
      var key = cat + "|" + x.size;
      sizes[key] = (sizes[key] || 0) + 1;
    });
    $("#sizeDist").innerHTML = Object.keys(sizes).sort().map(function (k2) {
      var parts = k2.split("|");
      var short = window.KasKitaSizes ? window.KasKitaSizes.CATS[parts[0]].short : "";
      return '<span class="size-chip">' + esc(parts[1]) + " &middot; " + esc(short) + " &times; " + sizes[k2] + "</span>";
    }).join("") || '<span class="muted small">Belum ada ukuran.</span>';

    $("#dashActivity").innerHTML = state.activities.slice(0, 4).map(function (a) {
      return "<li><time>" + esc(fmtTime(a.ts)) + "</time> <span class='by'>" + esc(a.by) + "</span> " + esc(a.text) + "</li>";
    }).join("") || "<li>Belum ada aktivitas.</li>";

    var unpaid = state.participants.filter(function (x) { return !(totals[x.id] > 0); }).slice(0, 5);
    var nl = $("#notifList");
    if (!state.participants.length) {
      nl.innerHTML = "<li>Belum ada peserta. Tambah peserta dulu lewat menu Data Peserta.</li>";
    } else {
      nl.innerHTML = unpaid.length ? unpaid.map(function (x) {
        return "<li><strong>" + esc(x.name) + "</strong> sedang membayar kas.</li>";
      }).join("") : "<li>Semua peserta sudah membayar. Kerja bagus.</li>";
    }
    var dot = $("#notifDot");
    if (dot) dot.style.display = unpaid.length ? "" : "none";
    $("#notifBtn").setAttribute("aria-label", "Notifikasi, " + unpaid.length + " belum dibaca");
  }

  /* ---------- Activity view ---------- */
  function renderActivity() {
    var sel = $("#actFilter");
    var f = sel ? sel.value : "";
    // opsi filter mengikuti nama admin yang muncul di aktivitas (akun baru otomatis kebawa)
    if (sel) {
      var known = {};
      $all("option", sel).forEach(function (o) { known[o.value] = true; });
      var fresh = false;
      state.activities.forEach(function (a) {
        if (a.by && !known[a.by]) {
          var o = document.createElement("option");
          o.value = a.by;
          o.textContent = a.by;
          sel.appendChild(o);
          known[a.by] = true;
          fresh = true;
        }
      });
      if (fresh && f && !known[f]) sel.value = "";
      f = sel.value;
    }
    var list = state.activities.filter(function (a) { return !f || a.by === f; });
    var ol = $("#activityList");
    ol.innerHTML = list.map(function (a) {
      var d = new Date(a.ts);
      var ds = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) + " " + fmtTime(a.ts);
      return "<li><time>" + esc(ds) + "</time><span class='by'>" + esc(a.by) + "</span> " + esc(a.text) + "</li>";
    }).join("");
    $("#activityEmpty").hidden = list.length > 0;
    ol.style.display = list.length ? "" : "none";
  }

  /* ---------- Kelola akun admin (Super Admin) ---------- */
  var cloudProfiles = [];
  function permsSummary(p) {
    var keys = Object.keys(PERM_LABEL).filter(function (k) { return p && p[k]; });
    if (keys.length === 5) return "semua akses";
    if (!keys.length) return "tanpa akses";
    return keys.join(", ");
  }
  function acctRow(email, name, role, perms, off, isDefault) {
    var me = currentUser();
    var selfRow = !!(me && String(me.email).toLowerCase() === email);
    var btns = '<button class="mini-btn" type="button" data-acct-edit="' + esc(email) + '">Edit</button>';
    if (role !== "SUPER ADMIN" && !selfRow) {
      btns += '<button class="mini-btn" type="button" data-acct="' + esc(email) + '">' + (off ? "Aktifkan" : "Nonaktifkan") + "</button>";
      if (!isDefault) btns += '<button class="mini-btn danger" type="button" data-acct-del="' + esc(email) + '">Hapus</button>';
    }
    return '<li><span class="r-avatar" aria-hidden="true">' + esc((name || "?").charAt(0).toUpperCase()) + '</span>' +
      '<span class="a-meta"><span class="a-name">' + esc(name) + (off ? ' <span class="badge badge-nonaktif">Nonaktif</span>' : "") + '</span><br><span class="a-user">' + esc(email) + " &middot; " + esc(role) + "<br>" + esc(permsSummary(perms)) + "</span></span>" +
      '<span class="row-actions">' + btns + "</span></li>";
  }
  function getPermsFromForm() {
    var out = {};
    $all('input[name="accperm"]').forEach(function (c) { out[c.value] = c.checked; });
    return out;
  }
  function setPermsToForm(perms) {
    $all('input[name="accperm"]').forEach(function (c) { c.checked = !!(perms && perms[c.value]); });
  }
  function openAccountCreate() {
    if (!isSuper()) { toast("Hanya Super Admin yang bisa menambah akun.", "err"); return; }
    $("#maTitle").textContent = "Tambah Akun";
    $("#accMode").value = "create";
    $("#accName").value = "";
    $("#accEmail").value = "";
    $("#accEmail").disabled = false;
    $("#accPass").value = "";
    $("#accPassWrap").style.display = "";
    $("#accRole").value = "ADMIN";
    setPermsToForm(FULL_PERMS);
    $("#accErr").hidden = true;
    $("#accSaveBtn").textContent = "Buat Akun";
    openModal("modal-account");
  }
  function openAccountEdit(email) {
    if (!isSuper()) { toast("Hanya Super Admin.", "err"); return; }
    email = String(email || "").toLowerCase();
    $("#accErr").hidden = true;
    if (window.KasKitaCloud && window.KasKitaCloud.enabled()) {
      var row = cloudProfiles.filter(function (r) { return String(r.email).toLowerCase() === email; })[0];
      if (!row) { toast("Akun tidak ditemukan.", "err"); return; }
      $("#maTitle").textContent = "Edit Akun";
      $("#accMode").value = "edit";
      $("#accName").value = row.name || "";
      $("#accEmail").value = row.email;
      $("#accEmail").disabled = true;
      $("#accPassWrap").style.display = "none";
      $("#accRole").value = row.role === "SUPER ADMIN" ? "SUPER ADMIN" : "ADMIN";
      setPermsToForm(row.perms || FULL_PERMS);
      $("#accSaveBtn").textContent = "Simpan";
      openModal("modal-account");
      return;
    }
    var c = allCreds()[email];
    if (!c) { toast("Akun tidak ditemukan.", "err"); return; }
    $("#maTitle").textContent = "Edit Akun";
    $("#accMode").value = "edit";
    $("#accName").value = c.name || "";
    $("#accEmail").value = email;
    $("#accEmail").disabled = true;
    $("#accPassWrap").style.display = "none";
    $("#accRole").value = c.role === "SUPER ADMIN" ? "SUPER ADMIN" : "ADMIN";
    setPermsToForm(c.perms);
    $("#accSaveBtn").textContent = "Simpan";
    openModal("modal-account");
  }

  /* ---------- Settings ---------- */
  function renderSettings() {
    $("#setShirtName").value = state.shirt.name || "";
    $("#setShirtPrice").value = fmtRibuan(state.shirt.price || 0);
    renderCloud();
    var ul = $("#accountsList");
    if (!ul) return;
    if (window.KasKitaCloud && window.KasKitaCloud.enabled()) {
      ul.innerHTML = '<li><span class="muted small">Memuat akun...</span></li>';
      window.KasKitaCloud.getProfiles()
        .then(function (rows) {
          cloudProfiles = rows || [];
          if (!cloudProfiles.length) {
            ul.innerHTML = '<li><span class="muted small">Belum ada akun di cloud.</span></li>';
            return;
          }
          ul.innerHTML = cloudProfiles.map(function (c) {
            var email = String(c.email).toLowerCase();
            return acctRow(email, c.name, c.role, c.perms || {}, !!c.disabled, true);
          }).join("");
        })
        .catch(function () {
          ul.innerHTML = '<li><span class="muted small">Gagal memuat akun cloud.</span></li>';
        });
      return;
    }
    var creds = allCreds();
    ul.innerHTML = Object.keys(creds).sort().map(function (email) {
      var c = creds[email];
      var off = !!(state.adminOff && state.adminOff[email]);
      return acctRow(email, c.name, c.role, c.perms, off, !!c.isDefault);
    }).join("");
  }

  /* ---------- Cloud panel ---------- */
  function renderCloud() {
    var st = document.getElementById("cloudStatus");
    if (!st) return;
    if (window.KasKitaCloud && window.KasKitaCloud.enabled()) {
      var c = window.KasKitaCloud.cfg();
      st.textContent = "Tersambung ke cloud" + (c && c.url ? " (" + c.url + ")" : "") + ". Data sama di semua perangkat." +
        (c && c.source === "baked" ? " Config bawaan situs (js/supabase-config.js)." : "");
      var u = document.getElementById("cloudUrl");
      var k = document.getElementById("cloudKey");
      if (u && !u.value) u.value = (c && c.url) || "";
      if (k && !k.value) k.value = (c && c.key) || "";
    } else if (window.KasKitaCloud && window.KasKitaCloud.cloudOff() && window.KasKitaCloud.baked()) {
      st.textContent = "Mode lokal (cloud bawaan situs dimatikan di browser ini). Kosongkan form lalu Sambungkan untuk memakai config bawaan lagi.";
    } else {
      st.textContent = window.supabase
        ? "Mode lokal: data hanya di perangkat ini."
        : "Mode lokal: pustaka cloud tidak termuat (perlu internet sekali saat dibuka).";
    }
  }
  function refreshAll() {
    renderDashboard();
    renderActivity();
    renderSettings();
    if (window.KasKitaPeserta) window.KasKitaPeserta.render();
    if (window.KasKitaKas) window.KasKitaKas.render();
    if (window.KasKitaBaju) window.KasKitaBaju.render();
  }

  /* ---------- Public API ---------- */
  window.KasKita = {
    state: state, save: save, $: $, $all: $all, esc: esc, uid: uid,
    fmtRp: fmtRp, fmtDate: fmtDate, todayISO: todayISO,
    parseRupiah: parseRupiah, fmtRibuan: fmtRibuan, bindRupiah: bindRupiah,
    totalsByPid: totalsByPid, grandTotal: grandTotal,
    shirtTarget: shirtTarget, shirtCollected: shirtCollected,
    participantName: participantName, currentUser: currentUser, isSuper: isSuper, downloadCSV: downloadCSV,
    toast: toast, openModal: openModal, closeModal: closeModal, askConfirm: askConfirm,
    requireAdmin: requireAdmin, openLoginGate: openLoginGate,
    logActivity: logActivity, showView: showView, refreshAll: refreshAll, replaceState: replaceState,
    renderDashboard: renderDashboard, renderActivity: renderActivity, renderSettings: renderSettings
  };

  /* ---------- Events ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    boot();

    function boot() {
      if (window.KasKitaCloud && window.KasKitaCloud.enabled()) {
        enterGuest();
        window.KasKitaCloud.subscribe();
        window.KasKitaCloud.pull()
          .then(function (how) {
            if (how === "pushed") toast("Data lokal diunggah ke cloud.");
            refreshAll();
            return window.KasKitaCloud.restoreSession();
          })
          .then(function (u) {
            if (u) { applyUser(); refreshAll(); showView("dashboard"); }
          })
          .catch(function (err) {
            var m = String((err && err.message) || "");
            if (/relation|does not exist|404|not found|schema/i.test(m)) {
              toast("Tabel cloud belum dibuat. Run supabase-schema.sql di SQL Editor.", "err");
            } else if (/failed to fetch|network|load failed|offline/i.test(m)) {
              toast("Cloud tidak terjangkau (jaringan/URL/key/project paused).", "err");
            } else {
              toast("Cloud tidak terjangkau, memakai data lokal.", "err");
            }
          });
        return;
      }
      var u = currentUser();
      if (u) enterApp();
      else enterGuest();
    }

    $("#loginForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("#loginUser").value.trim().toLowerCase();
      var pass = $("#loginPass").value;
      $("#loginUserErr").hidden = !!email;
      $("#loginPassErr").hidden = !!pass;
      if (!email || !pass) return;
      var btn = $("#loginBtn");
      btn.disabled = true;
      btn.textContent = "Memeriksa...";
      function done() { btn.disabled = false; btn.textContent = "Masuk sebagai Admin"; }
      Promise.resolve()
        .then(function () { return doLogin(email, pass); })
        .then(function (res) {
          done();
          var err = $("#loginErr");
          if (!res) {
            err.textContent = "Email atau password salah.";
            err.hidden = false;
            toast("Login gagal, periksa email dan password.", "err");
            return;
          }
          if (res.disabled) {
            err.textContent = "Akun ini sedang dinonaktifkan oleh Super Admin.";
            err.hidden = false;
            return;
          }
          if (res.noprofile) {
            err.textContent = "Login Auth berhasil tapi profil tidak ketemu. Pastikan SQL schema sudah di-Run dan email persis sama di Authentication.";
            err.hidden = false;
            toast("Profil admin tidak ditemukan di cloud.", "err");
            return;
          }
          err.hidden = true;
          if (!(window.KasKitaCloud && window.KasKitaCloud.enabled())) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(res));
          }
          $("#loginPass").value = "";
          toast("Selamat datang, " + res.name + ".");
          enterApp();
        })
        .catch(function () {
          done();
          toast("Tidak bisa menghubungi cloud, coba lagi.", "err");
        });
    });

    $("#loginBack").addEventListener("click", function () { enterGuest(); });

    function goLogin() { openLoginGate(); }
    ["loginBtnTop", "loginBtnSide", "loginBtnMain", "loginBtnSheet"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener("click", function () { closeSheet(); goLogin(); });
    });
    function logout() {
      localStorage.removeItem(SESSION_KEY);
      if (window.KasKitaCloud && window.KasKitaCloud.enabled()) {
        window.KasKitaCloud.signOut().catch(function () {});
      }
      exitToGuest();
      toast("Kamu sudah keluar, sekarang mode tamu.");
    }
    ["logoutBtnTop", "logoutBtnSide", "logoutBtnMain", "logoutBtnSheet"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener("click", function () { closeSheet(); logout(); });
    });

    // nav
    document.addEventListener("click", function (e) {
      var nav = e.target.closest("[data-nav]");
      if (nav) { showView(nav.getAttribute("data-nav")); return; }
      var go = e.target.closest("[data-goto]");
      if (go) { showView(go.getAttribute("data-goto")); return; }
      var act = e.target.closest("[data-action]");
      if (act) {
        var a0 = act.getAttribute("data-action");
        if (a0 === "size-guide" && window.KasKitaSizes) { window.KasKitaSizes.openGuide(); return; }
        if (a0 === "export-peserta" && window.KasKitaPeserta) { window.KasKitaPeserta.exportCSV(); return; }
        if ((a0 === "export-kas-in" || a0 === "export-kas-out") && window.KasKitaKas) {
          window.KasKitaKas.exportCSV(a0 === "export-kas-out" ? "out" : "in");
          return;
        }
        if (a0 === "export-baju" && window.KasKitaBaju) { window.KasKitaBaju.exportCSV(); return; }
        if (a0 === "export-aktivitas") { exportActivity(); return; }
        if (!requireAdmin()) return;
        var a = a0;
        if (a === "add-payment" && window.KasKitaKas) window.KasKitaKas.openNew();
        if (a === "add-expense" && window.KasKitaKas) window.KasKitaKas.openExpenseNew();
        if (a === "add-participant" && window.KasKitaPeserta) window.KasKitaPeserta.openNew();
        return;
      }
      if (e.target.closest("[data-close]")) { closeModal(); return; }
    });

    // modal backdrop + esc
    $("#modalBackdrop").addEventListener("click", function (e) {
      if (e.target === this) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (!$("#modalBackdrop").hidden) closeModal();
        var np = $("#notifPop");
        if (np && !np.hidden) { np.hidden = true; $("#notifBtn").setAttribute("aria-expanded", "false"); }
        closeSheet();
      }
    });
    $("#confirmYes").addEventListener("click", function () {
      var cb = confirmCb;
      confirmCb = null;
      closeModal();
      if (cb) cb();
    });

    // notif
    $("#notifBtn").addEventListener("click", function () {
      var p = $("#notifPop");
      var open = p.hidden;
      p.hidden = !open;
      this.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function (e) {
      var p = $("#notifPop");
      if (!p || p.hidden) return;
      if (!e.target.closest("#notifPop") && !e.target.closest("#notifBtn")) {
        p.hidden = true;
        $("#notifBtn").setAttribute("aria-expanded", "false");
      }
    });

    // mobile sheet
    $("#mobileMenuBtn").addEventListener("click", function () {
      var s = $("#mobileSheet");
      if (s.hidden) openSheet(); else closeSheet();
    });
    $("#sheetClose").addEventListener("click", closeSheet);
    $("#mobileSheet").addEventListener("click", function (e) {
      if (e.target === this) closeSheet();
    });

    // activity filter + clear
    $("#actFilter").addEventListener("change", renderActivity);
    $("#actClearBtn").addEventListener("click", function () {
      if (!isSuper()) { toast("Hanya Super Admin yang bisa menghapus riwayat.", "err"); return; }
      askConfirm("Hapus riwayat aktivitas?", "Semua catatan aktivitas akan dihapus dan tidak bisa dikembalikan.", "Hapus", function () {
        state.activities = [];
        save(); renderActivity();
        toast("Riwayat aktivitas dihapus.");
      });
    });

    // shirt settings
    $("#shirtSettingsForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!requireAdmin()) return;
      var nm = $("#setShirtName").value.trim();
      var pr = Math.round(parseRupiah($("#setShirtPrice").value));
      if (nm.length < 3) { toast("Nama proyek minimal 3 huruf.", "err"); return; }
      if (pr < 1000) { toast("Harga minimal Rp1.000.", "err"); return; }
      state.shirt.name = nm;
      state.shirt.price = pr;
      save(); refreshAll();
      logActivity("mengubah proyek baju menjadi " + nm + " (" + fmtRp(pr) + "/orang)");
      toast("Proyek baju disimpan.");
    });

    // tambah akun -> buka modal
    $("#addAccountBtn").addEventListener("click", function () { openAccountCreate(); });

    // simpan akun (create / edit, lokal & cloud)
    $("#accountForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!isSuper()) { toast("Hanya Super Admin yang bisa mengelola akun.", "err"); return; }
      var mode = $("#accMode").value === "edit" ? "edit" : "create";
      var name = $("#accName").value.trim();
      var email = normEmail($("#accEmail").value);
      var pass = $("#accPass").value;
      var role = $("#accRole").value === "SUPER ADMIN" ? "SUPER ADMIN" : "ADMIN";
      var perms = getPermsFromForm();
      var err = $("#accErr");
      function fail(msg) { err.textContent = msg; err.hidden = false; }
      err.hidden = true;
      if (name.length < 2) { fail("Nama minimal 2 huruf."); return; }
      if (!validEmail(email)) { fail("Email tidak valid."); return; }
      if (mode === "create" && String(pass || "").length < 6) { fail("Password minimal 6 karakter."); return; }
      if (!perms.peserta && !perms.kas && !perms.baju && !perms.aktivitas && !perms.pengaturan) { fail("Pilih minimal 1 hak akses."); return; }

      // mode cloud: lewat Edge Function create-admin
      if (window.KasKitaCloud && window.KasKitaCloud.enabled()) {
        var btn = $("#accSaveBtn");
        btn.disabled = true;
        btn.textContent = "Menyimpan...";
        var payload = mode === "create"
          ? { action: "create", email: email, password: pass, name: name, role: role, perms: perms }
          : { action: "update", email: email, name: name, role: role, perms: perms };
        window.KasKitaCloud.adminOp(payload.action, payload)
          .then(function () {
            btn.disabled = false;
            btn.textContent = mode === "create" ? "Buat Akun" : "Simpan";
            closeModal();
            renderSettings();
            logActivity((mode === "create" ? "membuat akun " : "mengedit akun ") + name + " (" + email + ")");
            toast(mode === "create" ? "Akun " + name + " dibuat." : "Akun " + name + " diperbarui.");
          })
          .catch(function (ex) {
            btn.disabled = false;
            btn.textContent = mode === "create" ? "Buat Akun" : "Simpan";
            fail(String((ex && ex.message) || "Gagal menyimpan akun."));
            toast("Gagal menyimpan akun.", "err");
          });
        return;
      }

      // mode lokal: simpan di localStorage kaskita_accounts
      var creds = allCreds();
      if (mode === "create" && creds[email]) { fail("Email ini sudah terdaftar."); return; }
      var store = loadCustomAccounts();
      if (mode === "create") {
        store[email] = { password: pass, name: name, role: role, perms: perms };
      } else {
        var prev = creds[email];
        if (!prev) { fail("Akun tidak ditemukan."); return; }
        store[email] = { password: prev.password, name: name, role: role, perms: perms };
        // cegah Super Admin terakhir menghapus dirinya sendiri dari peran penting
        if (prev.role === "SUPER ADMIN" && role !== "SUPER ADMIN") {
          var supers = Object.keys(creds).filter(function (k) { return creds[k].role === "SUPER ADMIN" && k !== email; });
          if (!supers.length) { fail("Minimal harus ada 1 Super Admin."); return; }
        }
      }
      saveCustomAccounts(store);
      closeModal();
      renderSettings();
      applyUser();
      logActivity((mode === "create" ? "membuat akun " : "mengedit akun ") + name + " (" + email + ")");
      toast(mode === "create" ? "Akun " + name + " dibuat. Password sudah tersimpan, berikan ke pemiliknya." : "Akun " + name + " diperbarui.");
    });

    // aksi per akun: edit / nonaktif / hapus (delegate)
    $("#accountsList").addEventListener("click", function (e) {
      var ed = e.target.closest("[data-acct-edit]");
      if (ed) { openAccountEdit(ed.getAttribute("data-acct-edit")); return; }
      var del = e.target.closest("[data-acct-del]");
      if (del) {
        if (!isSuper()) { toast("Hanya Super Admin.", "err"); return; }
        var demail = del.getAttribute("data-acct-del");
        if (window.KasKitaCloud && window.KasKitaCloud.enabled()) { toast("Hapus akun cloud lewat Dashboard > Authentication.", "err"); return; }
        var dc = allCreds()[demail];
        askConfirm("Hapus akun?", "Hapus akun " + (dc ? dc.name + " (" + demail + ")" : demail) + "? Tidak bisa dikembalikan.", "Hapus", function () {
          var s = loadCustomAccounts();
          delete s[demail];
          saveCustomAccounts(s);
          if (state.adminOff) delete state.adminOff[demail];
          save(); renderSettings();
          toast("Akun dihapus.");
        });
        return;
      }
      var b = e.target.closest("[data-acct]");
      if (!b) return;
      if (!isSuper()) { toast("Hanya Super Admin.", "err"); return; }
      var email = b.getAttribute("data-acct");
      if (window.KasKitaCloud && window.KasKitaCloud.enabled()) {
        var turnOff = b.textContent.trim() === "Nonaktifkan";
        window.KasKitaCloud.setDisabled(email, turnOff)
          .then(function () {
            renderSettings();
            toast("Akun " + email + (turnOff ? " dinonaktifkan." : " diaktifkan."));
          })
          .catch(function (ex) { toast(String((ex && ex.message) || "Gagal mengubah akun."), "err"); });
        return;
      }
      if (email === (currentUser() && currentUser().email)) { toast("Tidak bisa menonaktifkan diri sendiri.", "err"); return; }
      state.adminOff[email] = !state.adminOff[email];
      if (!state.adminOff[email]) delete state.adminOff[email];
      save(); renderSettings();
      toast("Akun " + email + (state.adminOff[email] ? " dinonaktifkan." : " diaktifkan."));
    });

    // export backup (penghapusan massal tidak disediakan, hapus per data saja)
    $("#exportBtn").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kaskita-backup.json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast("Backup JSON diunduh.");
    });

    // cloud connect / disconnect
    $("#cloudForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!isSuper()) { toast("Hanya Super Admin yang bisa mengatur koneksi cloud.", "err"); return; }
      var url = $("#cloudUrl").value.trim().replace(/\/$/, "");
      var key = $("#cloudKey").value.trim();
      if (!window.supabase || !window.supabase.createClient) {
        toast("Pustaka cloud belum termuat, periksa internet lalu coba lagi.", "err");
        return;
      }
      // form dikosongkan + ada config bawaan file = sambungkan lagi ke config bawaan
      if ((!url || !key) && window.KasKitaCloud.baked()) {
        window.KasKitaCloud.setOff(false);
        toast("Memakai config bawaan situs, memuat ulang...");
        setTimeout(function () { window.location.reload(); }, 700);
        return;
      }
      if (!url || !key) { toast("Isi Project URL dan anon key dulu.", "err"); return; }
      try {
        localStorage.setItem(window.KasKitaCloud.CFG_KEY, JSON.stringify({ url: url, key: key }));
        window.KasKitaCloud.setOff(false);
      } catch (err) { toast("Gagal menyimpan config.", "err"); return; }
      toast("Config tersimpan, memuat ulang...");
      setTimeout(function () { window.location.reload(); }, 700);
    });
    $("#cloudDisconnect").addEventListener("click", function () {
      if (!isSuper()) { toast("Hanya Super Admin yang bisa mengatur koneksi cloud.", "err"); return; }
      askConfirm("Putuskan cloud?", "Browser ini kembali ke mode lokal. Data cloud tetap aman di Supabase.", "Putuskan", function () {
        if (window.KasKitaCloud) {
          window.KasKitaCloud.signOut().catch(function () {});
          window.KasKitaCloud.forget();
          localStorage.removeItem(window.KasKitaCloud.CFG_KEY);
          window.KasKitaCloud.setOff(true);
        }
        localStorage.removeItem(SESSION_KEY);
        setTimeout(function () { window.location.reload(); }, 300);
      });
    });

    $("#cloudTest").addEventListener("click", function () {
      if (!isSuper()) { toast("Hanya Super Admin yang bisa mengatur koneksi cloud.", "err"); return; }
      var st = document.getElementById("cloudStatus");
      st.textContent = "Memeriksa...";
      window.KasKitaCloud.diagnose()
        .then(function (rows) {
          st.innerHTML = rows.map(function (r) {
            return (r.ok ? "OK " : "GAGAL ") + esc(r.label) + ": " + esc(r.detail);
          }).join("<br>");
          var bad = rows.filter(function (r) { return !r.ok; }).length;
          toast(bad ? bad + " pemeriksaan gagal, lihat rinciannya." : "Semua pemeriksaan lolos, cloud siap dipakai.", bad ? "err" : "ok");
        })
        .catch(function () { st.textContent = "Tes gagal dijalankan."; });
    });

    bindRupiah("setShirtPrice");

    if ($("#payDate")) $("#payDate").value = todayISO();
  });
})();
