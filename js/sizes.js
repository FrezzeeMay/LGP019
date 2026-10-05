/* KasKita sizes.js: daftar ukuran baju per kategori (Dewasa / Anak-anak).
   Satuan cm. Anak memakai kolom Usia, Dewasa memakai Lebar x Panjang x Lebar Dada. */
(function () {
  "use strict";

  var CATS = {
    dewasa: { label: "Dewasa", short: "D" },
    anak: { label: "Anak-anak", short: "A" }
  };

  // urutan tampil + angka resmi (cm)
  var DEWASA = [
    { size: "S", lebar: 50, panjang: 71, dada: 49 },
    { size: "M", lebar: 52, panjang: 72, dada: 52 },
    { size: "L", lebar: 54, panjang: 75, dada: 55 },
    { size: "XL", lebar: 56, panjang: 78, dada: 58 },
    { size: "XXL", lebar: 60, panjang: 81, dada: 61 },
    { size: "XXXL", lebar: 63, panjang: 84, dada: 63 }
  ];
  var ANAK = [
    { size: "XXS", lebar: 36, panjang: 49, usia: "1-2 thn" },
    { size: "XS", lebar: 38, panjang: 54, usia: "3-4 thn" },
    { size: "S", lebar: 40, panjang: 57, usia: "5-6 thn" },
    { size: "M", lebar: 42, panjang: 60, usia: "7-8 thn" },
    { size: "L", lebar: 44, panjang: 63, usia: "9-10 thn" },
    { size: "XL", lebar: 46, panjang: 65, usia: "11 thn" },
    { size: "XXL", lebar: 48, panjang: 67, usia: "12 thn" }
  ];

  function normCat(c) { return c === "anak" ? "anak" : "dewasa"; }
  function list(cat) { return normCat(cat) === "anak" ? ANAK : DEWASA; }
  function sizes(cat) {
    return list(cat).map(function (r) { return r.size; });
  }
  function valid(cat, size) {
    return sizes(cat).indexOf(size) >= 0;
  }
  function def(cat) { return normCat(cat) === "anak" ? "S" : "M"; }
  function detail(cat, size) {
    var rows = list(cat);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].size === size) return rows[i];
    }
    return null;
  }
  // label ringkas untuk tabel, cth: "M" + "Anak" atau "L" + "Dewasa"
  function catLabel(cat) { return CATS[normCat(cat)].label; }

  function openGuide() {
    var K = window.KasKita;
    var esc = K ? K.esc : function (s) { return String(s); };
    var db = document.getElementById("guideDewasaBody");
    if (db) {
      db.innerHTML = DEWASA.map(function (r) {
        return "<tr><td><strong>" + esc(r.size) + "</strong></td>" +
          '<td class="num">' + r.lebar + " cm</td>" +
          '<td class="num">' + r.panjang + " cm</td>" +
          '<td class="num">' + r.dada + " cm</td></tr>";
      }).join("");
    }
    var ab = document.getElementById("guideAnakBody");
    if (ab) {
      ab.innerHTML = ANAK.map(function (r) {
        return "<tr><td><strong>" + esc(r.size) + "</strong></td>" +
          '<td class="num">' + r.lebar + " cm</td>" +
          '<td class="num">' + r.panjang + " cm</td>" +
          "<td>" + esc(r.usia) + "</td></tr>";
      }).join("");
    }
    if (K) K.openModal("modal-guide");
  }

  window.KasKitaSizes = {
    CATS: CATS, DEWASA: DEWASA, ANAK: ANAK,
    normCat: normCat, list: list, sizes: sizes,
    valid: valid, def: def, detail: detail, catLabel: catLabel,
    openGuide: openGuide
  };
})();
