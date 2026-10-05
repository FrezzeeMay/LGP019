/* KasKita export.js: unduh CSV per tabel, mengikuti filter yang sedang tampil.
   Delimiter ; + BOM agar langsung rapi dibuka di Excel Indonesia.
   Nominal ditulis angka polos (tanpa Rp) supaya bisa di-SUM di Excel. */
(function () {
  "use strict";
  function K() { return window.KasKita; }
  function SZ() { return window.KasKitaSizes; }

  function stamp() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, "0"); }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function cell(v) {
    var s = String(v == null ? "" : v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function download(name, headers, rows) {
    if (!rows.length) { K().toast("Tidak ada data untuk diunduh.", "err"); return; }
    var lines = [headers.map(cell).join(";")];
    rows.forEach(function (r) { lines.push(r.map(cell).join(";")); });
    var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name + "-" + stamp() + ".csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    K().toast("File " + a.download + " diunduh (" + rows.length + " baris).");
  }
  function catOf(p) { return SZ() ? SZ().normCat(p.sizeCat) : "dewasa"; }
  function catName(p) { return SZ() ? SZ().catLabel(catOf(p)) : "Dewasa"; }
  function bajuStatus(kasTotal, price) {
    if (kasTotal >= price && price > 0) return "Lunas";
    if (kasTotal > 0) return "Sebagian";
    return "Sedang Bayar";
  }

  function peserta() {
    var st = K().state, totals = K().totalsByPid();
    var q = (document.getElementById("pesertaSearch").value || "").toLowerCase();
    var cf = document.getElementById("pesertaCatFilter").value;
    var sf = document.getElementById("pesertaSizeFilter").value;
    var af = document.getElementById("pesertaStatusFilter").value;
    var rows = st.participants.filter(function (p) {
      var pcat = catOf(p);
      if (q && p.name.toLowerCase().indexOf(q) < 0) return false;
      if (cf && pcat !== cf) return false;
      if (sf && (pcat + "|" + p.size) !== sf) return false;
      if (af === "aktif" && !p.active) return false;
      if (af === "nonaktif" && p.active) return false;
      return true;
    }).map(function (p, i) {
      return [i + 1, p.name, catName(p), p.size, totals[p.id] || 0, p.active ? "Aktif" : "Nonaktif"];
    });
    download("kaskita-peserta", ["No", "Nama", "Kategori", "Ukuran", "Total Kas", "Status"], rows);
  }

  function kasMasuk() {
    var st = K().state, totals = K().totalsByPid();
    var q = (document.getElementById("kasSearch").value || "").toLowerCase();
    var sort = document.getElementById("kasSort").value;
    var rows = st.participants.filter(function (p) {
      return !q || p.name.toLowerCase().indexOf(q) >= 0;
    });
    rows.sort(function (a, b) {
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      var ta = totals[a.id] || 0, tb = totals[b.id] || 0;
      return sort === "total-asc" ? ta - tb : tb - ta;
    });
    download("kaskita-kas-masuk", ["No", "Nama", "Kategori", "Ukuran", "Jumlah Transaksi", "Total"],
      rows.map(function (p, i) {
        var n = st.payments.filter(function (x) { return x.participantId === p.id; }).length;
        return [i + 1, p.name, catName(p), p.size, n, totals[p.id] || 0];
      }));
  }

  function kasKeluar() {
    var st = K().state;
    var q = (document.getElementById("expSearch").value || "").toLowerCase();
    var rows = st.expenses.filter(function (x) {
      var hay = (x.title + " " + (x.note || "")).toLowerCase();
      return !q || hay.indexOf(q) >= 0;
    }).sort(function (a, b) { return b.date.localeCompare(a.date); });
    download("kaskita-kas-keluar", ["No", "Keterangan", "Tanggal", "Nominal", "Catatan", "Admin"],
      rows.map(function (x, i) {
        return [i + 1, x.title, x.date, x.amount, x.note || "", x.by || ""];
      }));
  }

  function baju() {
    var st = K().state, k = K();
    var price = Number(st.shirt.price) || 0;
    var totals = k.totalsByPid();
    var q = (document.getElementById("bajuSearch").value || "").toLowerCase();
    var f = document.getElementById("bajuStatusFilter").value;
    var cf = document.getElementById("bajuCatFilter").value;
    // samakan logika filter status dengan tampilan (lunas / sebagian / sedang)
    var rows = st.participants.filter(function (p) {
      if (q && p.name.toLowerCase().indexOf(q) < 0) return false;
      if (cf && catOf(p) !== cf) return false;
      var kasTotal = totals[p.id] || 0;
      var key = (kasTotal >= price && price > 0) ? "lunas" : (kasTotal > 0 ? "sebagian" : "sedang");
      if (f && key !== f) return false;
      return true;
    });
    download("kaskita-baju", ["No", "Nama", "Kategori", "Ukuran", "Target", "Dibayar", "Status"],
      rows.map(function (p, i) {
        var kasTotal = totals[p.id] || 0;
        var paid = price > 0 ? Math.min(kasTotal, price) : 0;
        return [i + 1, p.name, catName(p), p.size, price, paid, bajuStatus(kasTotal, price)];
      }));
  }

  function aktivitas() {
    var st = K().state;
    var f = document.getElementById("actFilter") ? document.getElementById("actFilter").value : "";
    var rows = st.activities.filter(function (a) { return !f || a.by === f; });
    download("kaskita-aktivitas", ["Tanggal", "Jam", "Admin", "Aktivitas"],
      rows.map(function (a) {
        var d = new Date(a.ts);
        function p(n) { return String(n).padStart(2, "0"); }
        return [d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()),
          p(d.getHours()) + ":" + p(d.getMinutes()), a.by, a.text];
      }));
  }

  document.addEventListener("DOMContentLoaded", function () {
    var map = {
      dlPesertaBtn: peserta, dlKasInBtn: kasMasuk, dlKasOutBtn: kasKeluar,
      dlBajuBtn: baju, dlActBtn: aktivitas
    };
    Object.keys(map).forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener("click", map[id]);
    });
  });

  window.KasKitaExport = { peserta: peserta, kasMasuk: kasMasuk, kasKeluar: kasKeluar, baju: baju, aktivitas: aktivitas };
})();
