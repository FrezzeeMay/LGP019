/* KasKita shirts.js: proyek baju, foto preview, target otomatis, setoran */
(function () {
  "use strict";
  function K() { return window.KasKita; }

  function shirtStatusOf(kasTotal, price) {
    if (kasTotal >= price && price > 0) return { key: "lunas", label: "Lunas", cls: "badge-lunas" };
    if (kasTotal > 0) return { key: "sebagian", label: "Sebagian", cls: "badge-sebagian" };
    return { key: "sedang", label: "Sedang Bayar", cls: "badge-sedang" };
  }

  function render() {
    var k = K(), st = k.state;
    var target = k.shirtTarget();
    var got = k.shirtCollected();
    var short = Math.max(0, target - got);
    var pct = target ? Math.min(100, (got / target) * 100) : 0;

    document.getElementById("shirtName").textContent = st.shirt.name || "Baju Angkatan";
    document.getElementById("shirtPriceLabel").textContent = k.fmtRp(st.shirt.price);
    document.getElementById("shirtCountLabel").textContent = st.participants.length + " orang";
    document.getElementById("shirtFormula").textContent =
      k.fmtRp(st.shirt.price) + " x " + st.participants.length + " = " + k.fmtRp(target);
    document.getElementById("shirtTarget").textContent = k.fmtRp(target);
    document.getElementById("shirtCollected").textContent = k.fmtRp(got);
    document.getElementById("shirtShort").textContent = k.fmtRp(short);
    document.getElementById("shirtProgressBar").style.width = pct + "%";
    document.getElementById("shirtProgressWrap").setAttribute("aria-valuenow", String(Math.round(pct)));
    document.getElementById("shirtPct").textContent = pct.toFixed(1) + "%";
    document.getElementById("shirtState").textContent = (got >= target && target > 0) ? "Lunas" : "Kurang " + k.fmtRp(short);

    // photo
    var img = document.getElementById("shirtImg");
    var ph = document.getElementById("shirtPlaceholder");
    if (st.shirt.photo) {
      img.src = st.shirt.photo;
      img.hidden = false;
      ph.style.display = "none";
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      ph.style.display = "";
    }

    // table: dibayar mengikuti total kas peserta (dibatasi target), tanpa input terpisah
    var q = (document.getElementById("bajuSearch").value || "").toLowerCase();
    var f = document.getElementById("bajuStatusFilter").value;
    var cf = document.getElementById("bajuCatFilter").value;
    var price = Number(st.shirt.price) || 0;
    var totals = k.totalsByPid();
    var rows = st.participants.filter(function (p) {
      if (q && p.name.toLowerCase().indexOf(q) < 0) return false;
      if (cf && window.KasKitaSizes && window.KasKitaSizes.normCat(p.sizeCat) !== cf) return false;
      var kasTotal = totals[p.id] || 0;
      var s = shirtStatusOf(kasTotal, price).key;
      if (f && s !== f) return false;
      return true;
    });
    var tb = document.getElementById("bajuBody");
    tb.innerHTML = rows.map(function (p, i) {
      var kasTotal = totals[p.id] || 0;
      var paid = price > 0 ? Math.min(kasTotal, price) : 0;
      var s = shirtStatusOf(kasTotal, price);
      var catName = window.KasKitaSizes ? window.KasKitaSizes.catLabel(p.sizeCat) : "";
      return "<tr><td>" + (i + 1) + "</td>" +
        '<td><span class="row-name">' + k.esc(p.name) + "</span></td>" +
        "<td>" + k.esc(p.size || "-") + ' <span class="size-cat">' + k.esc(catName) + "</span></td>" +
        '<td class="num">' + k.esc(k.fmtRp(price)) + "</td>" +
        '<td class="num"><strong>' + k.esc(k.fmtRp(paid)) + "</strong></td>" +
        '<td><span class="badge ' + s.cls + '">' + s.label + "</span></td></tr>";
    }).join("") || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Tidak ada data yang cocok.</td></tr>';
  }

  function exportCSV() {
    var k = K(), st = k.state;
    var q = (document.getElementById("bajuSearch").value || "").toLowerCase();
    var f = document.getElementById("bajuStatusFilter").value;
    var cf = document.getElementById("bajuCatFilter").value;
    var price = Number(st.shirt.price) || 0;
    var totals = k.totalsByPid();
    var rows = st.participants.filter(function (p) {
      if (q && p.name.toLowerCase().indexOf(q) < 0) return false;
      if (cf && window.KasKitaSizes && window.KasKitaSizes.normCat(p.sizeCat) !== cf) return false;
      var s = shirtStatusOf(totals[p.id] || 0, price).key;
      if (f && s !== f) return false;
      return true;
    });
    if (!rows.length) { k.toast("Tidak ada data untuk diunduh.", "err"); return; }
    k.downloadCSV("kaskita-baju-" + k.todayISO() + ".csv",
      ["No", "Nama", "Kategori", "Ukuran", "Target (Rp)", "Dibayar (Rp)", "Status"],
      rows.map(function (p, i) {
        var kasTotal = totals[p.id] || 0;
        var paid = price > 0 ? Math.min(kasTotal, price) : 0;
        var s = shirtStatusOf(kasTotal, price);
        var cat = window.KasKitaSizes ? window.KasKitaSizes.catLabel(p.sizeCat) : "Dewasa";
        return [i + 1, p.name, cat, p.size, price, paid, s.label];
      }));
    k.toast("Tabel baju diunduh (" + rows.length + " baris).");
  }

  function readFile(file) {
    var k = K();
    if (!file || !file.type || file.type.indexOf("image/") !== 0) {
      k.toast("Pilih file gambar.", "err");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      k.toast("Maksimal 5 MB.", "err");
      return;
    }
    var C = window.KasKitaCloud;
    // cloud tersambung: unggah ke Storage, tampil di semua perangkat + tercatat di Aktivitas
    if (C && C.enabled()) {
      k.toast("Mengunggah foto...");
      C.uploadShirtPhoto(file, k.state.shirt.photo)
        .then(function (url) {
          k.state.shirt.photo = url;
          k.save(); render();
          k.logActivity("mengganti foto desain baju");
          k.toast("Foto baju diperbarui di semua perangkat.");
        })
        .catch(function (ex) {
          k.toast("Gagal mengunggah: " + String((ex && ex.message) || "coba lagi"), "err");
        });
      return;
    }
    // mode lokal: simpan di perangkat ini saja
    if (file.size > 2.5 * 1024 * 1024) {
      k.toast("Maksimal 2,5 MB agar localStorage muat.", "err");
      return;
    }
    var r = new FileReader();
    r.onload = function () {
      k.state.shirt.photo = String(r.result);
      k.save(); render();
      k.logActivity("mengganti foto desain baju");
      k.toast("Foto baju diperbarui (perangkat ini saja).");
    };
    r.readAsDataURL(file);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var k = K();
    document.getElementById("bajuSearch").addEventListener("input", render);
    document.getElementById("bajuStatusFilter").addEventListener("change", render);
    document.getElementById("bajuCatFilter").addEventListener("change", render);

    // upload: klik, keyboard, drag-drop
    var drop = document.getElementById("shirtDrop");
    var file = document.getElementById("shirtFile");
    drop.addEventListener("click", function (e) {
      if (!k.requireAdmin()) return;
      if (e.target.closest("button")) return;
      file.click();
    });
    drop.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!k.requireAdmin()) return; file.click(); }
    });
    file.addEventListener("change", function () {
      if (file.files && file.files[0]) readFile(file.files[0]);
      file.value = "";
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("dragover"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("dragover"); });
    });
    drop.addEventListener("drop", function (e) {
      if (!k.requireAdmin()) return;
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readFile(f);
    });
    document.getElementById("shirtChangeBtn").addEventListener("click", function () { if (!k.requireAdmin()) return; file.click(); });
    document.getElementById("shirtRemoveBtn").addEventListener("click", function () {
      if (!k.requireAdmin()) return;
      if (!k.state.shirt.photo) { k.toast("Belum ada foto.", "err"); return; }
      k.askConfirm("Hapus foto baju?", "Foto desain akan dihapus dari semua perangkat.", "Hapus", function () {
        var C = window.KasKitaCloud;
        var old = k.state.shirt.photo;
        k.state.shirt.photo = null;
        k.save(); render();
        if (C && C.enabled()) {
          C.removeShirtPhoto(old).catch(function () {});
          k.logActivity("menghapus foto desain baju");
        }
        k.toast("Foto baju dihapus.");
      });
    });
  });

  window.KasKitaBaju = { render: render, exportCSV: exportCSV };
})();
