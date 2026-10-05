/* KasKita participants.js: CRUD peserta + tabel Data Peserta + rekap ukuran.
   Rekap ukuran memakai tabel tersendiri, terpisah dari tabel peserta. */
(function () {
  "use strict";
  function K() { return window.KasKita; }
  function SZ() { return window.KasKitaSizes; }

  function getCat() {
    var r = document.querySelector('input[name="pcat"]:checked');
    return SZ().normCat(r ? r.value : "dewasa");
  }
  function setCat(v) {
    var r = document.querySelector('input[name="pcat"][value="' + SZ().normCat(v) + '"]');
    if (r) r.checked = true;
  }
  function getSize() {
    var r = document.querySelector('#pSizePills input[name="psize"]:checked');
    var cat = getCat();
    if (r && SZ().valid(cat, r.value)) return r.value;
    return SZ().def(cat);
  }
  // gambar ulang pilihan ukuran sesuai kategori, pertahankan yang lama kalau masih valid
  function renderPills(keep) {
    var cat = getCat();
    var cur = keep || getSize();
    if (!SZ().valid(cat, cur)) cur = SZ().def(cat);
    var box = document.getElementById("pSizePills");
    box.innerHTML = SZ().sizes(cat).map(function (s) {
      var label = s === "XXXL" ? "3XL" : s;
      return '<label><input type="radio" name="psize" value="' + K().esc(s) + '"' +
        (s === cur ? " checked" : "") + "><span>" + K().esc(label) + "</span></label>";
    }).join("");
    renderSizeDetail();
  }
  function renderSizeDetail() {
    var el = document.getElementById("pSizeDetail");
    if (!el) return;
    var cat = getCat(), d = SZ().detail(cat, getSize());
    if (!d) { el.textContent = ""; return; }
    el.textContent = cat === "anak"
      ? d.size + " Anak: lebar " + d.lebar + " × panjang " + d.panjang + " cm, usia " + d.usia + "."
      : d.size + " Dewasa: lebar " + d.lebar + " × panjang " + d.panjang + " × dada " + d.dada + " cm.";
  }
  function sizeCell(p) {
    var cat = SZ().normCat(p.sizeCat);
    return K().esc(p.size) + ' <span class="size-cat">' + K().esc(SZ().catLabel(cat)) + "</span>";
  }

  // opsi filter ukuran mengikuti kategori yang dipilih
  function renderSizeOptions() {
    var cf = document.getElementById("pesertaCatFilter").value;
    var sel = document.getElementById("pesertaSizeFilter");
    var cur = sel.value;
    var opts = ['<option value="">Semua ukuran</option>'];
    ["dewasa", "anak"].forEach(function (cat) {
      if (cf && cf !== cat) return;
      SZ().sizes(cat).forEach(function (s) {
        var v = cat + "|" + s;
        opts.push('<option value="' + v + '"' + (cur === v ? " selected" : "") + ">" +
          K().esc(s) + " (" + K().esc(SZ().catLabel(cat)) + ")</option>");
      });
    });
    sel.innerHTML = opts.join("");
  }

  function render() {
    var k = K(), st = k.state;
    var q = (document.getElementById("pesertaSearch").value || "").toLowerCase();
    var cf = document.getElementById("pesertaCatFilter").value;
    var sf = document.getElementById("pesertaSizeFilter").value;
    var af = document.getElementById("pesertaStatusFilter").value;
    var totals = k.totalsByPid();
    var rows = st.participants.filter(function (p) {
      var pcat = SZ().normCat(p.sizeCat);
      if (q && p.name.toLowerCase().indexOf(q) < 0) return false;
      if (cf && pcat !== cf) return false;
      if (sf && (pcat + "|" + p.size) !== sf) return false;
      if (af === "aktif" && !p.active) return false;
      if (af === "nonaktif" && p.active) return false;
      return true;
    });
    var tb = document.getElementById("pesertaBody");
    tb.innerHTML = rows.map(function (p, i) {
      var t = totals[p.id] || 0;
      var badge = p.active ? '<span class="badge badge-aktif">Aktif</span>' : '<span class="badge badge-nonaktif">Nonaktif</span>';
      var admin = !!k.currentUser();
      var actions = admin
        ? '<td><div class="row-actions">' +
          '<button class="mini-btn" type="button" data-pedit="' + k.esc(p.id) + '">Edit</button>' +
          '<button class="mini-btn danger" type="button" data-pdel="' + k.esc(p.id) + '">Hapus</button>' +
          "</div></td>"
        : "<td></td>";
      return "<tr><td>" + (i + 1) + "</td>" +
        '<td><span class="row-name">' + k.esc(p.name) + "</span></td>" +
        "<td>" + sizeCell(p) + "</td>" +
        '<td class="num">' + k.esc(k.fmtRp(t)) + "</td>" +
        "<td>" + badge + "</td>" + actions + "</tr>";
    }).join("");
    var empty = rows.length === 0;
    document.getElementById("pesertaEmpty").hidden = !empty;
    document.getElementById("pesertaTable").style.display = empty ? "none" : "";

    // rekap ukuran per kategori: Dewasa dulu, lalu Anak-anak
    var counts = {};
    st.participants.forEach(function (p) {
      var key = SZ().normCat(p.sizeCat) + "|" + p.size;
      counts[key] = (counts[key] || 0) + 1;
    });
    document.getElementById("sizeBody").innerHTML = ["dewasa", "anak"].map(function (cat) {
      var head = '<tr class="size-group"><td colspan="2"><strong>' + k.esc(SZ().catLabel(cat)) + "</strong></td></tr>";
      var body = SZ().sizes(cat).map(function (s) {
        return "<tr><td><strong>" + k.esc(s) + "</strong></td>" +
          '<td class="num">' + (counts[cat + "|" + s] || 0) + " orang</td></tr>";
      }).join("");
      return head + body;
    }).join("");
  }

  function filteredRows() {
    var q = (document.getElementById("pesertaSearch").value || "").toLowerCase();
    var cf = document.getElementById("pesertaCatFilter").value;
    var sf = document.getElementById("pesertaSizeFilter").value;
    var af = document.getElementById("pesertaStatusFilter").value;
    return K().state.participants.filter(function (p) {
      var pcat = SZ().normCat(p.sizeCat);
      if (q && p.name.toLowerCase().indexOf(q) < 0) return false;
      if (cf && pcat !== cf) return false;
      if (sf && (pcat + "|" + p.size) !== sf) return false;
      if (af === "aktif" && !p.active) return false;
      if (af === "nonaktif" && p.active) return false;
      return true;
    });
  }
  function exportCSV() {
    var k = K();
    var totals = k.totalsByPid();
    var rows = filteredRows();
    if (!rows.length) { k.toast("Tidak ada data untuk diunduh.", "err"); return; }
    var out = rows.map(function (p, i) {
      var n = k.state.payments.filter(function (t) { return t.participantId === p.id; }).length;
      return [i + 1, p.name, SZ().catLabel(p.sizeCat), p.size, n, totals[p.id] || 0, p.active ? "Aktif" : "Nonaktif"];
    });
    k.downloadCSV("kaskita-peserta-" + k.todayISO() + ".csv",
      ["No", "Nama", "Kategori", "Ukuran", "Jumlah Transaksi", "Total Kas (Rp)", "Status"], out);
    k.toast("Tabel peserta diunduh (" + out.length + " baris).");
  }

  function openNew() {
    if (!K().requireAdmin()) return;
    document.getElementById("mpTitle").textContent = "Tambah Peserta";
    document.getElementById("pId").value = "";
    document.getElementById("pName").value = "";
    setCat("dewasa");
    renderPills(SZ().def("dewasa"));
    document.getElementById("pActive").checked = true;
    document.getElementById("pNameErr").hidden = true;
    K().openModal("modal-participant");
  }
  function openEdit(id) {
    var k = K();
    if (!k.requireAdmin()) return;
    var p = k.state.participants.find(function (x) { return x.id === id; });
    if (!p) return;
    document.getElementById("mpTitle").textContent = "Edit Peserta";
    document.getElementById("pId").value = p.id;
    document.getElementById("pName").value = p.name;
    setCat(SZ().normCat(p.sizeCat));
    renderPills(p.size);
    document.getElementById("pActive").checked = !!p.active;
    k.openModal("modal-participant");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var k = K();
    renderSizeOptions();
    ["pesertaSearch", "pesertaSizeFilter", "pesertaStatusFilter"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", render);
      document.getElementById(id).addEventListener("change", render);
    });
    document.getElementById("pesertaCatFilter").addEventListener("change", function () {
      renderSizeOptions();
      document.getElementById("pesertaSizeFilter").value = "";
      render();
    });
    // ganti kategori di form -> gambar ulang pilihan ukuran
    Array.prototype.slice.call(document.querySelectorAll('input[name="pcat"]')).forEach(function (r) {
      r.addEventListener("change", function () { renderPills(); });
    });
    document.getElementById("pSizePills").addEventListener("change", renderSizeDetail);

    document.getElementById("pesertaBody").addEventListener("click", function (e) {
      var ed = e.target.closest("[data-pedit]");
      if (ed) { openEdit(ed.getAttribute("data-pedit")); return; }
      var del = e.target.closest("[data-pdel]");
      if (del) {
        if (!k.requireAdmin()) return;
        var id = del.getAttribute("data-pdel");
        var p = k.state.participants.find(function (x) { return x.id === id; });
        k.askConfirm("Hapus peserta?", "Hapus " + (p ? p.name : "peserta") + "? Transaksi kas miliknya ikut terhapus.", "Hapus", function () {
          k.state.participants = k.state.participants.filter(function (x) { return x.id !== id; });
          k.state.payments = k.state.payments.filter(function (t) { return t.participantId !== id; });
          delete k.state.shirtPaid[id];
          k.save(); k.refreshAll();
          k.logActivity("menghapus peserta " + (p ? p.name : ""));
          k.toast("Peserta dihapus.");
        });
      }
    });

    document.getElementById("participantForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!k.requireAdmin()) return;
      var name = document.getElementById("pName").value.trim();
      var cat = getCat();
      var size = getSize();
      var active = document.getElementById("pActive").checked;
      if (name.length < 2) { document.getElementById("pNameErr").hidden = false; return; }
      var id = document.getElementById("pId").value;
      if (id) {
        var p = k.state.participants.find(function (x) { return x.id === id; });
        if (p) { p.name = name; p.size = size; p.sizeCat = cat; p.active = active; }
        k.save(); k.refreshAll();
        k.logActivity("mengedit peserta " + name);
        k.toast("Peserta berhasil diperbarui.");
      } else {
        var dupe = k.state.participants.some(function (x) { return x.name.toLowerCase() === name.toLowerCase(); });
        if (dupe) { k.toast("Nama peserta sudah ada.", "err"); return; }
        var nid = k.uid("p");
        k.state.participants.push({ id: nid, name: name, size: size, sizeCat: cat, active: active });
        k.save(); k.refreshAll();
        k.logActivity("menambah peserta baru, " + name + " (" + size + " " + SZ().catLabel(cat) + ")");
        k.toast("Peserta " + name + " ditambahkan.");
      }
      k.closeModal();
    });
  });

  window.KasKitaPeserta = { render: render, openNew: openNew, openEdit: openEdit, exportCSV: exportCSV };
})();
