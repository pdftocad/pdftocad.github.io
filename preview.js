/* Draw converted entities on a canvas so the visitor can check the result before downloading. */
const PALETTE = { 1: "#e5332a", 2: "#d4b300", 3: "#1a9e3a", 4: "#0aa5b8", 5: "#1f5eff", 6: "#c026d3", 8: "#8a8f99" };

export function stats(parts) {
  let lines = 0, text = 0;
  for (const p of parts) for (const e of p.ents) { if (e.t === "text") text++; else lines++; }
  return { lines, text };
}

export function drawPreview(canvas, parts) {
  // world coords in mm: x*scale, flipped y with offset (same as DXF)
  let minx = 1e18, miny = 1e18, maxx = -1e18, maxy = -1e18;
  const X = (p, x) => x * p.scale, Y = (p, y) => (p.h - y) * p.scale + (p.offsetY || 0);
  for (const p of parts) {
    const add = (x, y) => { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; };
    add(0, Y(p, p.h)); add(p.w * p.scale, Y(p, 0));
  }
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 800, ratio = (maxy - miny) / (maxx - minx || 1);
  const H = Math.min(Math.max(W * ratio, 200), 900);
  canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  const pad = 10, k = Math.min((W - 2 * pad) / (maxx - minx || 1), (H - 2 * pad) / (maxy - miny || 1));
  const ox = pad + ((W - 2 * pad) - (maxx - minx) * k) / 2, oy = pad + ((H - 2 * pad) - (maxy - miny) * k) / 2;
  const sx = (x) => ox + (x - minx) * k, sy = (y) => H - (oy + (y - miny) * k);
  ctx.lineWidth = 0.6;
  for (const p of parts) {
    for (const e of p.ents) {
      const col = PALETTE[e.color] || "#1b2233";
      if (e.t === "poly") {
        ctx.strokeStyle = col; ctx.beginPath();
        e.pts.forEach((q, i) => { const x = sx(X(p, q[0])), y = sy(Y(p, q[1])); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        if (e.closed) ctx.closePath();
        ctx.stroke();
      } else if (e.t === "text") {
        const hpx = e.h * p.scale * k * 1.35;
        if (hpx < 2) continue;
        ctx.save(); ctx.translate(sx(X(p, e.x)), sy(Y(p, e.y))); ctx.rotate(-(e.rot || 0) * Math.PI / 180);
        ctx.fillStyle = col; ctx.font = hpx.toFixed(1) + "px Arial, sans-serif"; ctx.fillText(e.s, 0, 0); ctx.restore();
      }
    }
  }
}
