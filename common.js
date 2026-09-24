/* Shared helpers — everything runs in the visitor's browser; no files are uploaded. */
(function () {
  var root = document.documentElement;
  try { var t = localStorage.getItem("theme"); if (t) root.setAttribute("data-theme", t); } catch (e) {}
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-theme-toggle]");
    if (!b) return;
    var dark = root.getAttribute("data-theme") === "dark" ||
      (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    var next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
  });
})();

window.TK = {
  $: function (s, el) { return (el || document).querySelector(s); },
  fmtBytes: function (b) {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    return (b / 1048576).toFixed(2) + " MB";
  },
  download: function (blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  },
  baseName: function (n) { return n.replace(/\.[^.]+$/, ""); },
  /* Wire a drop zone + hidden file input. cb receives an array of File. */
  dropzone: function (zone, input, cb) {
    zone.addEventListener("click", function () { input.click(); });
    zone.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", function () { if (input.files.length) cb([].slice.call(input.files)); input.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove("over"); }); });
    zone.addEventListener("drop", function (e) { if (e.dataTransfer.files.length) cb([].slice.call(e.dataTransfer.files)); });
  },
  loadImage: function (file) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error("Could not read " + file.name)); };
      img.src = URL.createObjectURL(file);
    });
  },
  canvasBlob: function (canvas, type, q) {
    return new Promise(function (res) { canvas.toBlob(res, type, q); });
  },
  copy: function (text, btn) {
    navigator.clipboard.writeText(text).then(function () {
      if (!btn) return; var o = btn.textContent; btn.textContent = "Copied!";
      setTimeout(function () { btn.textContent = o; }, 1400);
    });
  }
};
