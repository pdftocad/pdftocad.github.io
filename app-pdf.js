import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
import { pdfPageToEntities, toDXF, PT_TO_MM } from "./cad-core.js";
import { drawPreview, stats } from "./preview.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

const $ = (s) => document.querySelector(s);
const zone = $("#drop"), input = $("#file"), pageSel = $("#page"), scaleN = $("#scale"),
  optText = $("#opt-text"), optFill = $("#opt-fill"), optHidden = $("#opt-hidden"),
  go = $("#go"), msg = $("#msg"), out = $("#out"), canvas = $("#preview"), dl = $("#download"), info = $("#fileinfo");
let pdf = null, file = null, dxf = null;

function status(t, err) { msg.innerHTML = ""; const s = document.createElement("span"); s.className = err ? "err" : "note"; s.textContent = t; msg.appendChild(s); }

TK.dropzone(zone, input, async (files) => {
  const f = files[0];
  if (!f || !(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) { status("Please choose a PDF file.", true); return; }
  file = f; out.hidden = true; status("Reading PDF…");
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
  } catch (e) { status("Could not open this PDF" + (/password/i.test(e.message) ? " — it is password-protected." : "."), true); return; }
  pageSel.innerHTML = "";
  for (let i = 1; i <= pdf.numPages; i++) pageSel.add(new Option("Page " + i, i));
  if (pdf.numPages > 1) pageSel.add(new Option("All pages (stacked)", "all"));
  pageSel.disabled = pdf.numPages < 2;
  info.textContent = f.name + " — " + pdf.numPages + " page" + (pdf.numPages > 1 ? "s" : "") + ", " + TK.fmtBytes(f.size);
  go.disabled = false; status("Ready. Choose options and click Convert.");
});

go.onclick = async () => {
  if (!pdf) return;
  go.disabled = true; status("Converting… large drawings can take a few seconds.");
  await new Promise(r => setTimeout(r, 30));
  try {
    const n = parseFloat(scaleN.value) || 1;
    const nums = pageSel.value === "all" ? [...Array(pdf.numPages).keys()].map(i => i + 1) : [+pageSel.value || 1];
    const parts = []; let offsetY = 0, raster = 0;
    for (const num of nums.slice().reverse()) {          // stack pages upward so page 1 is on top
      const page = await pdf.getPage(num);
      const r = await pdfPageToEntities(pdfjsLib, page, { text: optText.checked, fills: optFill.checked, hidden: !optHidden.checked });
      const ops = await page.getOperatorList();
      raster += ops.fnArray.filter(f => f === pdfjsLib.OPS.paintImageXObject || f === pdfjsLib.OPS.paintInlineImageXObject).length;
      parts.unshift({ ...r, scale: PT_TO_MM * n, offsetY });
      offsetY += (r.h * PT_TO_MM * n) * 1.1;
    }
    dxf = toDXF(parts);
    const st = stats(parts);
    drawPreview(canvas, parts);
    out.hidden = false;
    $("#stats").innerHTML = `<div class="stat"><b>${st.lines.toLocaleString()}</b><span>Lines &amp; polylines</span></div>` +
      `<div class="stat"><b>${st.text.toLocaleString()}</b><span>Text items</span></div>` +
      `<div class="stat"><b>${nums.length}</b><span>Page${nums.length > 1 ? "s" : ""}</span></div>` +
      `<div class="stat"><b>${TK.fmtBytes(dxf.length)}</b><span>DXF size</span></div>`;
    if (st.lines < 5 && raster) {
      status("This PDF looks like a scan or photo — it has no vector lines to convert. Use the Image to CAD converter instead.", true);
      $("#scan-hint").hidden = false;
    } else { status("Done. Check the preview, then download your DXF."); $("#scan-hint").hidden = true; }
  } catch (e) { console.error(e); status("Conversion failed: " + e.message, true); }
  go.disabled = false;
};

dl.onclick = () => { if (dxf) TK.download(new Blob([dxf], { type: "application/dxf" }), TK.baseName(file.name) + ".dxf"); };
