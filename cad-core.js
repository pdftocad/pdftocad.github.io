/* PDFtoCAD core — converts PDF vectors and raster images into DXF (AutoCAD R12 ASCII).
   Runs entirely in the browser (also importable in Node for testing). */

const PT_TO_MM = 25.4 / 72;

/* ---------------- colours ---------------- */
const ACI = [[0,0,0],[255,0,0],[255,255,0],[0,255,0],[0,255,255],[0,0,255],[255,0,255],[255,255,255],[128,128,128],[192,192,192],[255,0,0],[255,127,127],[165,0,0],[165,82,82],[127,0,0],[127,63,63],[76,0,0],[76,38,38],[38,0,0],[38,19,19],[255,63,0],[255,159,127],[165,41,0],[165,103,82],[127,31,0],[127,79,63],[76,19,0],[76,47,38],[38,9,0],[38,23,19],[255,127,0],[255,191,127],[165,82,0],[165,124,82],[127,63,0],[127,95,63],[76,38,0],[76,57,38],[38,19,0],[38,28,19],[255,191,0],[255,223,127],[165,124,0],[165,145,82],[127,95,0],[127,111,63],[76,57,0],[76,66,38],[38,28,0],[38,33,19],[255,255,0],[255,255,127],[165,165,0],[165,165,82],[127,127,0],[127,127,63],[76,76,0],[76,76,38],[38,38,0],[38,38,19],[191,255,0],[223,255,127],[124,165,0],[145,165,82],[95,127,0],[111,127,63],[57,76,0],[66,76,38],[28,38,0],[33,38,19],[127,255,0],[191,255,127],[82,165,0],[124,165,82],[63,127,0],[95,127,63],[38,76,0],[57,76,38],[19,38,0],[28,38,19],[63,255,0],[159,255,127],[41,165,0],[103,165,82],[31,127,0],[79,127,63],[19,76,0],[47,76,38],[9,38,0],[23,38,19],[0,255,0],[127,255,127],[0,165,0],[82,165,82],[0,127,0],[63,127,63],[0,76,0],[38,76,38],[0,38,0],[19,38,19],[0,255,63],[127,255,159],[0,165,41],[82,165,103],[0,127,31],[63,127,79],[0,76,19],[38,76,47],[0,38,9],[19,88,23],[0,255,127],[127,255,191],[0,165,82],[82,165,124],[0,127,63],[63,127,95],[0,76,38],[38,76,57],[0,38,19],[19,88,28],[0,255,191],[127,255,223],[0,165,124],[82,165,145],[0,127,95],[63,127,111],[0,76,57],[38,76,66],[0,38,28],[19,88,88],[0,255,255],[127,255,255],[0,165,165],[82,165,165],[0,127,127],[63,127,127],[0,76,76],[38,76,76],[0,38,38],[19,88,88],[0,191,255],[127,223,255],[0,124,165],[82,145,165],[0,95,127],[63,111,127],[0,57,76],[38,66,126],[0,28,38],[19,88,88],[0,127,255],[127,191,255],[0,82,165],[82,124,165],[0,63,127],[63,95,127],[0,38,76],[38,57,126],[0,19,38],[19,28,88],[0,63,255],[127,159,255],[0,41,165],[82,103,165],[0,31,127],[63,79,127],[0,19,76],[38,47,126],[0,9,38],[19,23,88],[0,0,255],[127,127,255],[0,0,165],[82,82,165],[0,0,127],[63,63,127],[0,0,76],[38,38,126],[0,0,38],[19,19,88],[63,0,255],[159,127,255],[41,0,165],[103,82,165],[31,0,127],[79,63,127],[19,0,76],[47,38,126],[9,0,38],[23,19,88],[127,0,255],[191,127,255],[82,0,165],[124,82,165],[63,0,127],[95,63,127],[38,0,76],[57,38,126],[19,0,38],[28,19,88],[191,0,255],[223,127,255],[124,0,165],[145,82,165],[95,0,127],[111,63,127],[57,0,76],[66,38,76],[28,0,38],[88,19,88],[255,0,255],[255,127,255],[165,0,165],[165,82,165],[127,0,127],[127,63,127],[76,0,76],[76,38,76],[38,0,38],[88,19,88],[255,0,191],[255,127,223],[165,0,124],[165,82,145],[127,0,95],[127,63,111],[76,0,57],[76,38,66],[38,0,28],[88,19,88],[255,0,127],[255,127,191],[165,0,82],[165,82,124],[127,0,63],[127,63,95],[76,0,38],[76,38,57],[38,0,19],[88,19,28],[255,0,63],[255,127,159],[165,0,41],[165,82,103],[127,0,31],[127,63,79],[76,0,19],[76,38,47],[38,0,9],[88,19,23],[0,0,0],[101,101,101],[102,102,102],[153,153,153],[204,204,204],[255,255,255]];
function aciFor(r, g, b) {
  if (r == null) return 7;
  if (Math.max(r, g, b) < 45) return 7;               // black -> 7 (shows white/black in CAD)
  if (Math.min(r, g, b) > 225) return 7;
  let best = 1, bd = 1e9;
  for (let i = 1; i < 256; i++) {
    if (i === 7) continue;
    const c = ACI[i], d = (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/* ---------------- matrix helpers ---------------- */
const mul = (m, n) => [m[0]*n[0]+m[2]*n[1], m[1]*n[0]+m[3]*n[1], m[0]*n[2]+m[2]*n[3],
  m[1]*n[2]+m[3]*n[3], m[0]*n[4]+m[2]*n[5]+m[4], m[1]*n[4]+m[3]*n[5]+m[5]];
const ap = (m, x, y) => [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]];

function bez(p0, p1, p2, p3, n = 10) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
              u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]]);
  }
  return out;
}

/* ---------------- PDF -> entities ----------------
   Entity shapes: {t:"poly", pts:[[x,y]..], closed, color, layer} | {t:"text", x,y,h,rot,s,color}
   Coordinates in PDF display space (points, y down); converted to CAD later. */
export async function pdfPageToEntities(pdfjs, page, opts = {}) {
  const O = pdfjs.OPS;
  const vp = page.getViewport({ scale: 1 });
  const V = vp.transform;                      // PDF user space -> display (y down)
  const ol = await page.getOperatorList();
  const ents = [];
  let ctm = [1,0,0,1,0,0];
  const stack = [];
  let stroke = [0,0,0], fill = [0,0,0];
  const masks = [], textPos = [];
  let tm = [1,0,0,1,0,0], tlm = [1,0,0,1,0,0], opIndex = 0;
  const bbox = (pts) => { let a = 1e18, b = 1e18, c = -1e18, d = -1e18; for (const q of pts) { if (q[0] < a) a = q[0]; if (q[1] < b) b = q[1]; if (q[0] > c) c = q[0]; if (q[1] > d) d = q[1]; } return [a, b, c, d]; };
  let path = [];                               // array of subpaths (arrays of [x,y] in display space)
  let cur = null, start = null;

  const toD = (x, y) => { const p = ap(ctm, x, y); return ap(V, p[0], p[1]); };
  const flushPath = (doStroke, doFill) => {
    for (const sp of path) {
      if (sp.length < 2) continue;
      const closed = sp.closed || (sp.length > 2 && Math.abs(sp[0][0]-sp[sp.length-1][0]) < 1e-6 && Math.abs(sp[0][1]-sp[sp.length-1][1]) < 1e-6);
      if (doStroke) ents.push({ t: "poly", pts: sp, closed, color: aciFor(...stroke), layer: "LINES", i: opIndex });
      else if (doFill) {
        const white = fill[0] > 245 && fill[1] > 245 && fill[2] > 245;
        if (white) masks.push({ box: bbox(sp), i: opIndex });
        else if (opts.fills !== false) ents.push({ t: "poly", pts: sp, closed: true, color: aciFor(...fill), layer: "FILLS", i: opIndex });
      }
    }
    path = []; cur = null;
  };

  const F = ol.fnArray, A = ol.argsArray;
  for (let i = 0; i < F.length; i++) {
    const fn = F[i], a = A[i]; opIndex = i;
    switch (fn) {
      case O.beginText: tm = [1,0,0,1,0,0]; tlm = [1,0,0,1,0,0]; break;
      case O.setTextMatrix: tm = a.slice(0, 6); tlm = tm.slice(); break;
      case O.moveText: case O.setLeadingMoveText: tlm = mul(tlm, [1,0,0,1,a[0],a[1]]); tm = tlm.slice(); break;
      case O.showText: case O.showSpacedText: case O.nextLineShowText: case O.nextLineSetSpacingShowText: {
        const p = ap(ctm, tm[4], tm[5]); textPos.push({ p: ap(V, p[0], p[1]), i }); break; }
      case O.save: stack.push([ctm, stroke, fill]); break;
      case O.restore: if (stack.length) [ctm, stroke, fill] = stack.pop(); break;
      case O.transform: ctm = mul(ctm, a); break;
      case O.paintFormXObjectBegin: stack.push([ctm, stroke, fill]); if (a && a[0]) ctm = mul(ctm, a[0]); break;
      case O.paintFormXObjectEnd: if (stack.length) [ctm, stroke, fill] = stack.pop(); break;
      case O.setStrokeRGBColor: stroke = [a[0], a[1], a[2]]; break;
      case O.setFillRGBColor: fill = [a[0], a[1], a[2]]; break;
      case O.setStrokeGray: stroke = [a[0]*255, a[0]*255, a[0]*255]; break;
      case O.setFillGray: fill = [a[0]*255, a[0]*255, a[0]*255]; break;
      case O.constructPath: {
        const ops = a[0], c = a[1]; let k = 0;
        for (const op of ops) {
          if (op === O.moveTo) { cur = [toD(c[k], c[k+1])]; start = [c[k], c[k+1]]; path.push(cur); cur.last = [c[k], c[k+1]]; k += 2; }
          else if (op === O.lineTo) { if (!cur) { cur = []; path.push(cur); } cur.push(toD(c[k], c[k+1])); cur.last = [c[k], c[k+1]]; k += 2; }
          else if (op === O.curveTo || op === O.curveTo2 || op === O.curveTo3) {
            if (!cur) { cur = []; path.push(cur); }
            const p0 = cur.last || [c[k], c[k+1]];
            let p1, p2, p3;
            if (op === O.curveTo) { p1 = [c[k], c[k+1]]; p2 = [c[k+2], c[k+3]]; p3 = [c[k+4], c[k+5]]; k += 6; }
            else if (op === O.curveTo2) { p1 = p0; p2 = [c[k], c[k+1]]; p3 = [c[k+2], c[k+3]]; k += 4; }
            else { p1 = [c[k], c[k+1]]; p2 = [c[k+2], c[k+3]]; p3 = p2; k += 4; }
            for (const q of bez(p0, p1, p2, p3)) cur.push(toD(q[0], q[1]));
            cur.last = p3;
          }
          else if (op === O.closePath) { if (cur && cur.length) { cur.closed = true; if (start) cur.last = start; } }
          else if (op === O.rectangle) {
            const x = c[k], y = c[k+1], w = c[k+2], h = c[k+3]; k += 4;
            const r = [toD(x, y), toD(x+w, y), toD(x+w, y+h), toD(x, y+h)]; r.closed = true;
            path.push(r); cur = null;
          }
        }
        break;
      }
      case O.stroke: case O.closeStroke: flushPath(true, false); break;
      case O.fill: case O.eoFill: flushPath(false, true); break;
      case O.fillStroke: case O.eoFillStroke: case O.closeFillStroke: case O.closeEOFillStroke: flushPath(true, false); break;
      case O.endPath: path = []; cur = null; break;
    }
  }

  if (opts.text !== false) {
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const m = mul(V, it.transform);          // text space -> display
      const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
      const dx = m[0], dy = m[1];
      const rot = Math.atan2(-dy, dx) * 180 / Math.PI;
      let ti = -1, bd = size * 3;                     // match item to its showText op (for masking order)
      for (const tp of textPos) { const d = Math.hypot(tp.p[0]-m[4], tp.p[1]-m[5]); if (d < bd) { bd = d; ti = tp.i; } }
      ents.push({ t: "text", x: m[4], y: m[5], h: size * 0.7, rot, s: it.str, color: 7, i: ti, w: it.width || 0, dx, dy });
    }
  }
  // Drop content that the PDF hides under white boxes drawn on top of it (e.g. redactions).
  let out = ents;
  if (opts.hidden !== true && masks.length) {
    const inside = (x, y, i) => masks.some(k => k.i > i && x >= k.box[0] && x <= k.box[2] && y >= k.box[1] && y <= k.box[3]);
    out = ents.filter(e => {
      if (e.t === "poly") { const b = bbox(e.pts); return !inside((b[0]+b[2])/2, (b[1]+b[3])/2, e.i); }
      if (e.i < 0) return true;
      // estimate each character's position along the run and drop the covered ones
      const L = Math.hypot(e.dx, e.dy) || 1, ux = e.dx / L, uy = e.dy / L, n = e.s.length;
      let kept = "", any = false;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n * e.w, hid = inside(e.x + ux * t, e.y + uy * t, e.i);
        if (hid) any = true; else kept += e.s[k];
      }
      if (!any) return true;
      if (!kept.trim()) return false;
      if (!inside(e.x + ux * 0.5 * e.w / n, e.y + uy * 0.5 * e.w / n, e.i)) { e.s = kept.replace(/\s+$/, ""); return true; }
      return false;
    });
  }
  return { ents: out, w: vp.width, h: vp.height };
}

/* ---------------- Image -> entities (via ImageTracer) ---------------- */
export function imageToEntities(ImageTracer, imgd, opts = {}) {
  const thr = opts.threshold ?? 128, inv = !!opts.invert;
  const d = imgd.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i+3] / 255;
    const l = (0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]) * a + 255 * (1 - a);
    let dark = l < thr; if (inv) dark = !dark;
    const v = dark ? 0 : 255; d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
  }
  const td = ImageTracer.imagedataToTracedata(imgd, {
    numberofcolors: 2, colorsampling: 0, colorquantcycles: 1,
    pal: [{ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }],
    ltres: opts.ltres ?? 1, qtres: opts.qtres ?? 1, pathomit: opts.pathomit ?? 8,
    rightangleenhance: true, blurradius: 0, linefilter: false
  });
  const ents = [];
  td.layers.forEach((layer, li) => {
    const col = td.palette[li];
    if (!col || col.r > 128) return;         // only trace the dark (drawing) layer
    for (const p of layer) {
      const pts = [];
      for (const s of p.segments) {
        if (!pts.length) pts.push([s.x1, s.y1]);
        if (s.type === "L") pts.push([s.x2, s.y2]);
        else {                                // quadratic spline -> polyline
          const x0 = s.x1, y0 = s.y1;
          for (let k = 1; k <= 6; k++) {
            const t = k / 6, u = 1 - t;
            pts.push([u*u*x0 + 2*u*t*s.x2 + t*t*s.x3, u*u*y0 + 2*u*t*s.y2 + t*t*s.y3]);
          }
        }
      }
      if (pts.length > 2) ents.push({ t: "poly", pts, closed: true, color: 7, layer: p.isholepath ? "HOLES" : "OUTLINES" });
    }
  });
  return { ents, w: imgd.width, h: imgd.height };
}

/* ---------------- entities -> DXF (R12 ASCII) ---------------- */
const f = (n) => (Math.round(n * 10000) / 10000).toString();

export function toDXF(parts, opts = {}) {
  // parts: [{ents, w, h, scale, offsetY}] — display coords * scale, y flipped to CAD (y up)
  const layers = new Map();
  const body = [];
  let minx = 1e18, miny = 1e18, maxx = -1e18, maxy = -1e18;
  const X = (p, x) => x * p.scale + (p.offsetX || 0);
  const Y = (p, y) => (p.h - y) * p.scale + (p.offsetY || 0);
  const ext = (x, y) => { if (x < minx) minx = x; if (y < miny) miny = y; if (x > maxx) maxx = x; if (y > maxy) maxy = y; };
  const clean = (s) => s.replace(/[\r\n]+/g, " ").replace(/Ø|⌀/g, "%%c").replace(/°/g, "%%d").replace(/±/g, "%%p");

  for (const p of parts) {
    for (const e of p.ents) {
      const L = e.layer || "0"; layers.set(L, true);
      if (e.t === "poly") {
        const pts = e.pts.map(q => [X(p, q[0]), Y(p, q[1])]);
        if (pts.length === 2 && !e.closed) {
          body.push("0", "LINE", "8", L, "62", String(e.color), "10", f(pts[0][0]), "20", f(pts[0][1]), "30", "0",
                    "11", f(pts[1][0]), "21", f(pts[1][1]), "31", "0");
          ext(...pts[0]); ext(...pts[1]);
        } else {
          let ps = pts;
          if (e.closed && ps.length > 2 && Math.abs(ps[0][0]-ps[ps.length-1][0]) < 1e-6 && Math.abs(ps[0][1]-ps[ps.length-1][1]) < 1e-6) ps = ps.slice(0, -1);
          body.push("0", "POLYLINE", "8", L, "62", String(e.color), "66", "1", "10", "0", "20", "0", "30", "0", "70", e.closed ? "1" : "0");
          for (const q of ps) { body.push("0", "VERTEX", "8", L, "10", f(q[0]), "20", f(q[1]), "30", "0"); ext(q[0], q[1]); }
          body.push("0", "SEQEND", "8", L);
        }
      } else if (e.t === "text") {
        const x = X(p, e.x), y = Y(p, e.y);
        body.push("0", "TEXT", "8", "TEXT", "62", String(e.color), "10", f(x), "20", f(y), "30", "0",
                  "40", f(Math.max(0.01, e.h * p.scale)), "1", clean(e.s), "50", f(e.rot || 0));
        layers.set("TEXT", true); ext(x, y);
      }
    }
  }
  if (minx > maxx) { minx = miny = 0; maxx = maxy = 100; }
  const out = ["0", "SECTION", "2", "HEADER",
    "9", "$ACADVER", "1", "AC1009",
    "9", "$INSBASE", "10", "0", "20", "0", "30", "0",
    "9", "$EXTMIN", "10", f(minx), "20", f(miny), "30", "0",
    "9", "$EXTMAX", "10", f(maxx), "20", f(maxy), "30", "0",
    "9", "$MEASUREMENT", "70", "1",
    "0", "ENDSEC",
    "0", "SECTION", "2", "TABLES",
    "0", "TABLE", "2", "LTYPE", "70", "1",
    "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0.0",
    "0", "ENDTAB",
    "0", "TABLE", "2", "LAYER", "70", String(layers.size + 1),
    "0", "LAYER", "2", "0", "70", "0", "62", "7", "6", "CONTINUOUS"];
  const LC = { LINES: 7, FILLS: 8, TEXT: 7, OUTLINES: 7, HOLES: 7 };
  for (const L of layers.keys()) if (L !== "0") out.push("0", "LAYER", "2", L, "70", "0", "62", String(LC[L] || 7), "6", "CONTINUOUS");
  out.push("0", "ENDTAB",
    "0", "TABLE", "2", "STYLE", "70", "1",
    "0", "STYLE", "2", "STANDARD", "70", "0", "40", "0", "41", "1", "50", "0", "71", "0", "42", "2.5", "3", "txt", "4", "",
    "0", "ENDTAB", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES");
  return out.join("\r\n") + "\r\n" + body.join("\r\n") + "\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n";
}

export { PT_TO_MM };
