import { imageToEntities, toDXF } from "./cad-core.js";
import { drawPreview, stats } from "./preview.js";

const $ = (s) => document.querySelector(s);
const zone = $("#drop"), input = $("#file"), thr = $("#thr"), thrv = $("#thrv"), inv = $("#inv"),
  detail = $("#detail"), speck = $("#speck"), width = $("#width"), bw = $("#bw"),
  go = $("#go"), msg = $("#msg"), out = $("#out"), canvas = $("#preview"), dl = $("#download"), info = $("#fileinfo");
let img = null, file = null, dxf = null;
const MAXPX = 2400;

function status(t, err) { msg.innerHTML = ""; const s = document.createElement("span"); s.className = err ? "err" : "note"; s.textContent = t; msg.appendChild(s); }

function scaled() {
  const k = Math.min(1, MAXPX / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  return { c, x };
}
function showBW() {        // live black & white preview so the threshold is easy to set
  if (!img) return;
  const { c, x } = scaled(), d = x.getImageData(0, 0, c.width, c.height), a = d.data, t = +thr.value, iv = inv.checked;
  for (let i = 0; i < a.length; i += 4) { let dark = (0.299*a[i] + 0.587*a[i+1] + 0.114*a[i+2]) < t; if (iv) dark = !dark; const v = dark ? 0 : 255; a[i] = a[i+1] = a[i+2] = v; }
  x.putImageData(d, 0, 0);
  const W = bw.clientWidth || 600; bw.width = W; bw.height = Math.round(W * c.height / c.width);
  bw.getContext("2d").drawImage(c, 0, 0, bw.width, bw.height); bw.hidden = false;
}

TK.dropzone(zone, input, async (files) => {
  const f = files[0];
  if (!f || !/^image\//.test(f.type)) { status("Please choose a JPG, PNG or WebP image.", true); return; }
  file = f; out.hidden = true;
  try { img = await TK.loadImage(f); } catch (e) { status(e.message, true); return; }
  info.textContent = f.name + " — " + img.naturalWidth + " × " + img.naturalHeight + " px, " + TK.fmtBytes(f.size);
  width.value = Math.round(img.naturalWidth * 0.2646);          // 96 dpi → mm
  go.disabled = false; showBW(); status("Adjust the threshold until your lines look solid black, then click Convert.");
});
thr.oninput = () => { thrv.textContent = thr.value; showBW(); };
inv.onchange = showBW;

go.onclick = async () => {
  if (!img) return;
  go.disabled = true; status("Tracing… this can take up to 30 seconds for large images.");
  await new Promise(r => setTimeout(r, 30));
  try {
    const { c, x } = scaled(), d = x.getImageData(0, 0, c.width, c.height);
    const det = { low: [2, 2], medium: [1, 1], high: [0.5, 0.5] }[detail.value];
    const r = imageToEntities(window.ImageTracer, d, { threshold: +thr.value, invert: inv.checked, ltres: det[0], qtres: det[1], pathomit: +speck.value });
    const mm = parseFloat(width.value) || c.width * 0.2646;
    const parts = [{ ...r, scale: mm / c.width }];
    dxf = toDXF(parts);
    drawPreview(canvas, parts);
    const st = stats(parts);
    $("#stats").innerHTML = `<div class="stat"><b>${st.lines.toLocaleString()}</b><span>Traced shapes</span></div>` +
      `<div class="stat"><b>${Math.round(mm)} mm</b><span>Drawing width</span></div>` +
      `<div class="stat"><b>${TK.fmtBytes(dxf.length)}</b><span>DXF size</span></div>`;
    out.hidden = false;
    status(st.lines ? "Done. Check the preview, then download your DXF." : "Nothing was traced — try moving the threshold slider.", !st.lines);
  } catch (e) { console.error(e); status("Tracing failed: " + e.message, true); }
  go.disabled = false;
};
dl.onclick = () => { if (dxf) TK.download(new Blob([dxf], { type: "application/dxf" }), TK.baseName(file.name) + ".dxf"); };
