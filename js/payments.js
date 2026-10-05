/* KasKita payments.js: kas, tambah/edit/hapus transaksi + riwayat per peserta */
(function () {
  "use strict";
  function K() { return window.KasKita; }
  var historyPid = null;

  function fillUserOptions(selectId, selectedId) {
    var k = K();
    var sel = document.getElementById(selectId);
    var act = k.state.participants.filter(function (p) { return p.active; });
    var list = act.length ? act : k.state.participants;
    sel.innerHTML = list.map(function (p) {
      var cat = window.KasKitaSizes ? window.KasKitaSizes.normCat(p.sizeCat) : "dewasa";
      var catName = window.KasKitaSizes ? window.KasKitaSizes.catLabel(cat) : "Dewasa";
      return '<option value="' + k.esc(p.id) + '"' + (p.id === selectedId ? " selected" : "") + ">" +
        k.esc(p.name) + " (" + k.esc(p.size) + ", " + k.esc(catName) + ")</option>";
    }).join("") || '<option value="">Tidak ada peserta</option>';
  }

  function render() {
    var k = K(), st = k.state;
    var q = (document.getElementById("kasSearch").value || "").toLowerCase();
    var sort = document.getElementById("kasSort").value;
    var totals = k.totalsByPid();
    var rows = st.participants.filter(function (p) {
      return !q || p.name.toLowerCase().indexOf(q) >= 0;
    });
    rows.sort(function (a, b) {
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      var ta = totals[a.id] || 0, tb = totals[b.id] || 0;
      return sort === "total-asc" ? ta - tb : tb - ta;
    });
    var tb = document.getElementById("kasBody");
    tb.innerHTML = rows.map(function (p, i) {
      var t = totals[p.id] || 0;
      var n = st.payments.filter(function (x) { return x.participantId === p.id; }).length;
      return "<tr><td>" + (i + 1) + "</td>" +
        '<td><span class="row-name">' + k.esc(p.name) + '</span><br><span class="row-sub">' + n + " transaksi</span></td>" +
        '<td><button class="mini-btn" type="button" data-hist="' + k.esc(p.id) + '">Lihat Riwayat</button></td>' +
        '<td class="num"><strong>' + k.esc(k.fmtRp(t)) + "</strong></td></tr>";
    }).join("");
    var hasPay = st.payments.length > 0;
    document.getElementById("kasEmpty").hidden = hasPay;
    document.getElementById("kasTable").style.display = hasPay ? "" : "none";

    document.getElementById("kasGrandTotal").textContent = k.fmtRp(k.grandTotal());
    document.getElementById("kasSummaryMeta").textContent =
      st.payments.length + " transaksi dari " + st.participants.length + " peserta. Total dihitung otomatis.";
    renderExpenses();
    renderSaldo();
  }

  function expTotal() {
    return K().state.expenses.reduce(function (a, x) { return a + Number(x.amount || 0); }, 0);
  }

  function renderSaldo() {
    var k = K();
    var masuk = k.grandTotal();
    var keluar = expTotal();
    document.getElementById("kasInTotal").textContent = k.fmtRp(masuk);
    document.getElementById("kasOutTotal").textContent = k.fmtRp(keluar);
    document.getElementById("kasSaldo").textContent = k.fmtRp(masuk - keluar);
  }

  function renderExpenses() {
    var k = K(), st = k.state;
    var q = (document.getElementById("expSearch").value || "").toLowerCase();
    var rows = st.expenses.filter(function (x) {
      var hay = (x.title + " " + (x.note || "")).toLowerCase();
      return !q || hay.indexOf(q) >= 0;
    }).sort(function (a, b) { return b.date.localeCompare(a.date); });
    var admin = !!k.currentUser();
    var tb = document.getElementById("expBody");
    tb.innerHTML = rows.map(function (x, i) {
      var acts = admin
        ? '<td><div class="row-actions">' +
          '<button class="mini-btn" type="button" data-xedit="' + k.esc(x.id) + '">Edit</button>' +
          '<button class="mini-btn danger" type="button" data-xdel="' + k.esc(x.id) + '">Hapus</button>' +
          "</div></td>"
        : "<td></td>";
      return "<tr><td>" + (i + 1) + "</td>" +
        '<td><span class="row-name">' + k.esc(x.title) + "</span>" + (x.note ? '<br><span class="row-sub">' + k.esc(x.note) + "</span>" : "") + "</td>" +
        "<td>" + k.esc(k.fmtDate(x.date)) + "</td>" +
        '<td class="num"><strong>' + k.esc(k.fmtRp(x.amount)) + "</strong></td>" + acts + "</tr>";
    }).join("");
    var empty = rows.length === 0;
    document.getElementById("expEmpty").hidden = !empty;
    document.getElementById("expTable").style.display = empty ? "none" : "";
    document.getElementById("expGrandTotal").textContent = k.fmtRp(expTotal());
    document.getElementById("expSummaryMeta").textContent = st.expenses.length + " pengeluaran. Otomatis mengurangi saldo.";
  }

  function switchKasTab(which) {
    ["in", "out"].forEach(function (w) {
      var btn = document.querySelector('[data-kastab="' + w + '"]');
      var panel = document.getElementById("panel-kas-" + w);
      var on = w === which;
      if (btn) { btn.classList.toggle("is-active", on); btn.setAttribute("aria-selected", String(on)); }
      if (panel) panel.hidden = !on;
    });
  }

  function openExpenseNew() {
    var k = K();
    if (!k.requireAdmin()) return;
    document.getElementById("mxTitle").textContent = "Catat Pengeluaran";
    document.getElementById("xId").value = "";
    document.getElementById("xTitle").value = "";
    document.getElementById("xAmount").value = "";
    document.getElementById("xDate").value = k.todayISO();
    document.getElementById("xNote").value = "";
    document.getElementById("xTitleErr").hidden = true;
    document.getElementById("xAmountErr").hidden = true;
    k.openModal("modal-expense");
  }

  function openNew(presetPid) {
    if (!K().requireAdmin()) return;
    fillUserOptions("payUser", presetPid || null);
    document.getElementById("mpayTitle").textContent = "Tambah Pembayaran";
    document.getElementById("payId").value = "";
    document.getElementById("payAmount").value = "";
    document.getElementById("payDate").value = K().todayISO();
    document.getElementById("payNote").value = "";
    document.getElementById("payAmountErr").hidden = true;
    K().openModal("modal-payment");
  }
  function openEditTx(id) {
    var k = K();
    if (!k.requireAdmin()) return;
    var t = k.state.payments.find(function (x) { return x.id === id; });
    if (!t) return;
    fillUserOptions("payUser", t.participantId);
    document.getElementById("mpayTitle").textContent = "Edit Pembayaran";
    document.getElementById("payId").value = t.id;
    document.getElementById("payAmount").value = t.amount;
    document.getElementById("payDate").value = t.date;
    document.getElementById("payNote").value = t.note || "";
    k.openModal("modal-payment");
  }

  function exportCSV(kind) {
    var k = K(), st = k.state;
    if (kind === "out") {
      var q = (document.getElementById("expSearch").value || "").toLowerCase();
      var rows = st.expenses.filter(function (x) {
        return !q || (x.title + " " + (x.note || "")).toLowerCase().indexOf(q) >= 0;
      }).sort(function (a, b) { return b.date.localeCompare(a.date); });
      if (!rows.length) { k.toast("Tidak ada data untuk diunduh.", "err"); return; }
      k.downloadCSV("kaskita-pengeluaran-" + k.todayISO() + ".csv",
        ["No", "Keterangan", "Tanggal", "Nominal (Rp)", "Catatan", "Admin"],
        rows.map(function (x, i) { return [i + 1, x.title, x.date, x.amount, x.note || "", x.by || ""]; }));
      k.toast("Tabel pengeluaran diunduh (" + rows.length + " baris).");
      return;
    }
    var q2 = (document.getElementById("kasSearch").value || "").toLowerCase();
    var sort = document.getElementById("kasSort").value;
    var totals = k.totalsByPid();
    var list = st.participants.filter(function (p) {
      return !q2 || p.name.toLowerCase().indexOf(q2) >= 0;
    });
    list.sort(function (a, b) {
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      var ta = totals[a.id] || 0, tb = totals[b.id] || 0;
      return sort === "total-asc" ? ta - tb : tb - ta;
    });
    if (!list.length) { k.toast("Tidak ada data untuk diunduh.", "err"); return; }
    k.downloadCSV("kaskita-pemasukan-" + k.todayISO() + ".csv",
      ["No", "Nama", "Kategori", "Ukuran", "Jumlah Transaksi", "Total (Rp)"],
      list.map(function (p, i) {
        var cat = window.KasKitaSizes ? window.KasKitaSizes.catLabel(p.sizeCat) : "Dewasa";
        var n = st.payments.filter(function (x) { return x.participantId === p.id; }).length;
        return [i + 1, p.name, cat, p.size, n, totals[p.id] || 0];
      }));
    k.toast("Tabel pemasukan diunduh (" + list.length + " baris).");
  }

  function openHistory(pid) {
    historyPid = pid;
    renderHistory();
    document.getElementById("mhTitle").textContent = "Riwayat " + K().participantName(pid);
    K().openModal("modal-history");
  }
  function renderHistory() {
    var k = K();
    var list = k.state.payments
      .filter(function (t) { return t.participantId === historyPid; })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
    var tb = document.getElementById("historyBody");
    var canEdit = !!k.currentUser();
    tb.innerHTML = list.map(function (t) {
      // riwayat bersifat permanen: hanya bisa dilihat dan diedit, tidak bisa dihapus
      var acts = canEdit
        ? '<td><div class="row-actions">' +
          '<button class="mini-btn" type="button" data-tedit="' + k.esc(t.id) + '">Edit</button>' +
          "</div></td>"
        : "<td></td>";
      return "<tr><td>" + k.esc(k.fmtDate(t.date)) + (t.note ? '<br><span class="row-sub">' + k.esc(t.note) + "</span>" : "") + "</td>" +
        '<td class="num"><strong>' + k.esc(k.fmtRp(t.amount)) + "</strong></td>" +
        "<td>" + k.esc(t.by || "-") + "</td>" + acts + "</tr>";
    }).join("");
    document.getElementById("historyEmpty").hidden = list.length > 0;
    var total = list.reduce(function (a, t) { return a + Number(t.amount || 0); }, 0);
    document.getElementById("historyTotal").textContent = k.fmtRp(total);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var k = K();
    document.getElementById("kasSearch").addEventListener("input", render);
    document.getElementById("kasSort").addEventListener("change", render);
    document.getElementById("expSearch").addEventListener("input", renderExpenses);

    // tabs pemasukan / pengeluaran
    Array.prototype.slice.call(document.querySelectorAll("[data-kastab]")).forEach(function (b) {
      b.addEventListener("click", function () { switchKasTab(b.getAttribute("data-kastab")); });
    });

    document.getElementById("expBody").addEventListener("click", function (e) {
      var ed = e.target.closest("[data-xedit]");
      if (ed) {
        if (!k.requireAdmin()) return;
        var t = k.state.expenses.find(function (x) { return x.id === ed.getAttribute("data-xedit"); });
        if (!t) return;
        document.getElementById("mxTitle").textContent = "Edit Pengeluaran";
        document.getElementById("xId").value = t.id;
        document.getElementById("xTitle").value = t.title;
        document.getElementById("xAmount").value = t.amount;
        document.getElementById("xDate").value = t.date;
        document.getElementById("xNote").value = t.note || "";
        k.openModal("modal-expense");
        return;
      }
      var del = e.target.closest("[data-xdel]");
      if (del) {
        if (!k.requireAdmin()) return;
        var id = del.getAttribute("data-xdel");
        var gone = k.state.expenses.find(function (x) { return x.id === id; });
        k.askConfirm(
          "Hapus pengeluaran?",
          "Hapus pengeluaran " + k.fmtRp(gone ? gone.amount : 0) + " (" + (gone ? gone.title : "") + ")? Saldo bertambah kembali.",
          "Hapus",
          function () {
            k.state.expenses = k.state.expenses.filter(function (x) { return x.id !== id; });
            k.save(); k.refreshAll();
            k.logActivity("menghapus pengeluaran " + (gone ? gone.title : ""));
            k.toast("Pengeluaran dihapus, saldo diperbarui.");
          }
        );
      }
    });

    document.getElementById("expenseForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!k.requireAdmin()) return;
      var title = document.getElementById("xTitle").value.trim();
      var amount = Math.round(Number(document.getElementById("xAmount").value) || 0);
      var date = document.getElementById("xDate").value;
      var note = document.getElementById("xNote").value.trim();
      if (title.length < 2) { document.getElementById("xTitleErr").hidden = false; return; }
      if (!(amount >= 1000)) { document.getElementById("xAmountErr").hidden = false; return; }
      if (!date) { k.toast("Isi tanggal dulu.", "err"); return; }
      var u = k.currentUser();
      var by = u ? u.name : "Admin";
      var id = document.getElementById("xId").value;
      if (id) {
        var t = k.state.expenses.find(function (x) { return x.id === id; });
        if (t) { t.title = title; t.amount = amount; t.date = date; t.note = note; }
        k.save(); k.refreshAll();
        k.logActivity("mengedit pengeluaran " + title);
        k.toast("Pengeluaran berhasil diperbarui.");
      } else {
        k.state.expenses.push({ id: k.uid("exp"), title: title, amount: amount, date: date, note: note, by: by });
        k.save(); k.refreshAll();
        k.logActivity("mencatat pengeluaran " + k.fmtRp(amount) + " untuk " + title);
        k.toast("Pengeluaran " + k.fmtRp(amount) + " dicatat.");
      }
      k.closeModal();
    });

    document.getElementById("kasBody").addEventListener("click", function (e) {
      var h = e.target.closest("[data-hist]");
      if (h) openHistory(h.getAttribute("data-hist"));
    });

    document.getElementById("historyBody").addEventListener("click", function (e) {
      var ed = e.target.closest("[data-tedit]");
      if (ed) { openEditTx(ed.getAttribute("data-tedit")); }
    });

    document.getElementById("paymentForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!k.requireAdmin()) return;
      var pid = document.getElementById("payUser").value;
      var amount = Math.round(Number(document.getElementById("payAmount").value) || 0);
      var date = document.getElementById("payDate").value;
      var note = document.getElementById("payNote").value.trim();
      if (!pid) { k.toast("Pilih peserta dulu.", "err"); return; }
      if (!(amount >= 1000)) { document.getElementById("payAmountErr").hidden = false; return; }
      if (!date) { k.toast("Isi tanggal dulu.", "err"); return; }
      var id = document.getElementById("payId").value;
      var u = k.currentUser();
      var by = u ? u.name : "Admin";
      if (id) {
        var t = k.state.payments.find(function (x) { return x.id === id; });
        if (t) { t.participantId = pid; t.amount = amount; t.date = date; t.note = note; }
        k.save(); k.refreshAll();
        if (historyPid) renderHistory();
        k.logActivity("mengedit pembayaran " + k.participantName(pid));
        k.toast("Pembayaran berhasil diperbarui.");
      } else {
        k.state.payments.push({ id: k.uid("pay"), participantId: pid, amount: amount, date: date, note: note, by: by });
        k.save(); k.refreshAll();
        k.logActivity("menambahkan pembayaran " + k.fmtRp(amount) + " untuk " + k.participantName(pid));
        k.toast("Pembayaran " + k.fmtRp(amount) + " dicatat oleh " + by + ".");
      }
      k.closeModal();
    });
  });

  window.KasKitaKas = { render: render, openNew: openNew, openHistory: openHistory, openExpenseNew: openExpenseNew, expTotal: expTotal, exportCSV: exportCSV };
})();
