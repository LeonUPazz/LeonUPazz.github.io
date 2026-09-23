// Grafo dei collegamenti (stile Obsidian), disegnato su <canvas> senza librerie.
// Trascina per spostare, rotella/pizzico per zoom, clic su un nodo per aprire la nota.

const PALETTE = ["#2c46a0", "#9a7424", "#3f7d5a", "#a1463d", "#6b4fa0", "#2f7f8f", "#8a5a2b", "#5f6b7a"];
const PALETTE_DARK = ["#93a8f0", "#d6b267", "#7cc79b", "#e0877d", "#b59cf0", "#78c7d6", "#d6a26b", "#a3adbb"];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
}

function initGraph(canvas) {
  const data = JSON.parse(canvas.dataset.graph);
  const local = canvas.dataset.mode === "local";
  const groups = [...new Set(data.nodes.map((n) => n.group))];
  const nodes = data.nodes.map((n, i) => {
    const a = (i / data.nodes.length) * Math.PI * 2;
    const r = n.current ? 0 : 80 + Math.random() * 60;
    return { ...n, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0, deg: 0 };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links = data.links.map(([a, b]) => ({ s: byId.get(a), t: byId.get(b) })).filter((l) => l.s && l.t);
  links.forEach((l) => { l.s.deg++; l.t.deg++; });
  const neighbors = new Map(nodes.map((n) => [n, new Set()]));
  links.forEach((l) => { neighbors.get(l.s).add(l.t); neighbors.get(l.t).add(l.s); });

  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  let scale = local ? 1 : 0.9, ox = 0, oy = 0;
  let hover = null, drag = null, panning = null, alpha = 1;
  let colors = {};

  function readColors() {
    const pal = isDark() ? PALETTE_DARK : PALETTE;
    colors = {
      bg: cssVar("--card"), ink: cssVar("--ink"), ink2: cssVar("--ink-3"), rule: cssVar("--rule"), accent: cssVar("--lapis"),
      group: (g) => pal[groups.indexOf(g) % pal.length],
    };
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    draw();
  }

  const radius = (n) => (local ? 3.5 : 2.5) + Math.sqrt(n.deg) * (local ? 1.1 : 0.9) + (n.current ? 2 : 0);

  function tick() {
    const k = alpha;
    // repulsione
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d2 = dx * dx + dy * dy || 0.01;
        if (d2 > 160000) continue;
        const f = (local ? 900 : 2600) / d2;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        a.vx -= dx * f * k; a.vy -= dy * f * k;
        b.vx += dx * f * k; b.vy += dy * f * k;
      }
    }
    // molle
    const L = local ? 70 : 70;
    for (const l of links) {
      const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = ((d - L) / d) * 0.04 * k;
      l.s.vx += dx * f; l.s.vy += dy * f;
      l.t.vx -= dx * f; l.t.vy -= dy * f;
    }
    // gravità verso il centro
    for (const n of nodes) {
      n.vx -= n.x * 0.004 * k; n.vy -= n.y * 0.004 * k;
      if (n === drag?.node) continue;
      if (local && n.current) { n.x *= 0.9; n.y *= 0.9; n.vx = n.vy = 0; continue; }
      n.vx *= 0.82; n.vy *= 0.82;
      n.x += n.vx; n.y += n.vy;
    }
    alpha = Math.max(alpha * 0.985, drag ? 0.3 : 0);
  }

  function toScreen(n) { return [W / 2 + (n.x + ox) * scale, H / 2 + (n.y + oy) * scale]; }
  function toWorld(px, py) { return [(px - W / 2) / scale - ox, (py - H / 2) / scale - oy]; }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const focus = hover ?? nodes.find((n) => n.current) ?? null;
    const lit = focus ? neighbors.get(focus) : null;
    ctx.lineWidth = 1;
    for (const l of links) {
      const on = focus && (l.s === focus || l.t === focus);
      ctx.strokeStyle = on ? colors.accent : colors.rule;
      ctx.globalAlpha = focus && !on && hover ? 0.35 : 1;
      const [x1, y1] = toScreen(l.s), [x2, y2] = toScreen(l.t);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    for (const n of nodes) {
      const [x, y] = toScreen(n);
      const dim = hover && n !== hover && !lit?.has(n);
      ctx.globalAlpha = dim ? 0.3 : 1;
      ctx.fillStyle = n.current ? colors.accent : colors.group(n.group);
      ctx.beginPath(); ctx.arc(x, y, radius(n) * Math.max(0.7, Math.min(scale, 1.6)), 0, Math.PI * 2); ctx.fill();
      if (n.current) { ctx.strokeStyle = colors.bg; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; }
    }
    // etichette
    ctx.font = `${local ? 11 : 11}px ${cssVar("--sans")}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const n of nodes) {
      const show = local
        ? nodes.length <= 12 || n.current || n === hover || (hover && lit?.has(n))
        : scale > 1.6 || n === hover || (hover && lit?.has(n)) || n.deg >= 10;
      if (!show) continue;
      const [x, y] = toScreen(n);
      const dim = hover && n !== hover && !lit?.has(n);
      ctx.globalAlpha = dim ? 0.25 : 1;
      const label = n.title.length > 28 ? n.title.slice(0, 26) + "…" : n.title;
      ctx.lineWidth = 3; ctx.strokeStyle = colors.bg; ctx.strokeText(label, x, y + radius(n) + 3);
      ctx.fillStyle = n === hover || n.current ? colors.ink : colors.ink2;
      ctx.fillText(label, x, y + radius(n) + 3);
      ctx.lineWidth = 1;
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    if (alpha > 0.002) { tick(); draw(); }
    requestAnimationFrame(loop);
  }

  function pick(px, py) {
    const [wx, wy] = toWorld(px, py);
    let best = null, bd = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.x - wx, n.y - wy);
      const r = radius(n) / Math.min(scale, 1) + 4;
      if (d < r && d < bd) { best = n; bd = d; }
    }
    return best;
  }
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  let downAt = null;
  canvas.addEventListener("pointerdown", (e) => {
    const [px, py] = pos(e);
    downAt = [px, py];
    const n = pick(px, py);
    canvas.setPointerCapture(e.pointerId);
    if (n) { drag = { node: n }; alpha = Math.max(alpha, 0.3); }
    else panning = { px, py, ox, oy };
  });
  canvas.addEventListener("pointermove", (e) => {
    const [px, py] = pos(e);
    if (drag) {
      const [wx, wy] = toWorld(px, py);
      drag.node.x = wx; drag.node.y = wy; drag.node.vx = drag.node.vy = 0;
      alpha = Math.max(alpha, 0.3);
    } else if (panning) {
      ox = panning.ox + (px - panning.px) / scale; oy = panning.oy + (py - panning.py) / scale; draw();
    } else {
      const h = pick(px, py);
      if (h !== hover) { hover = h; canvas.style.cursor = h ? "pointer" : "grab"; canvas.title = h ? h.title : ""; draw(); }
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    const [px, py] = pos(e);
    const moved = downAt && Math.hypot(px - downAt[0], py - downAt[1]) > 4;
    if (drag && !moved && drag.node.url) location.href = drag.node.url;
    drag = null; panning = null;
  });
  canvas.addEventListener("pointerleave", () => { if (!drag) { hover = null; draw(); } });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    scale = Math.min(4, Math.max(0.2, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    draw();
  }, { passive: false });

  readColors();
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener("themechange", () => { readColors(); draw(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); draw(); });
  // pre-calcolo della disposizione, poi animazione dolce
  for (let i = 0; i < (local ? 120 : 200); i++) tick();
  alpha = 0.3;
  // adatta lo zoom per far stare tutto (lasciando spazio alle etichette)
  {
    const r = canvas.getBoundingClientRect();
    const maxX = Math.max(...nodes.map((n) => Math.abs(n.x))) + (local ? 70 : 40);
    const maxY = Math.max(...nodes.map((n) => Math.abs(n.y))) + (local ? 30 : 30);
    scale = Math.min(local ? 1.3 : 2, r.width / 2 / maxX, r.height / 2 / maxY);
  }
  loop();
}

document.querySelectorAll("canvas[data-graph]").forEach(initGraph);
