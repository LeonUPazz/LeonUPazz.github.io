// Interazioni della sezione Filosofia: indice mobile, sommario attivo, anteprime dei link.

// ── indice del vault su mobile ──
const explorer = document.getElementById("explorer");
const toggle = document.getElementById("explorer-toggle");
toggle?.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = explorer.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (e) => {
  if (explorer?.classList.contains("open") && !explorer.contains(e.target)) {
    explorer.classList.remove("open");
    toggle?.setAttribute("aria-expanded", "false");
  }
});
// porta in vista la nota corrente nell'albero
const currentLink = explorer?.querySelector('[aria-current="page"]');
if (currentLink && explorer.scrollHeight > explorer.clientHeight) {
  const top = currentLink.getBoundingClientRect().top - explorer.getBoundingClientRect().top;
  explorer.scrollTop = top - explorer.clientHeight / 2;
}

// ── sommario: evidenzia la sezione visibile ──
const tocLinks = [...document.querySelectorAll(".toc a")];
if (tocLinks.length) {
  const targets = tocLinks.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
  const onScroll = () => {
    let current = targets[0];
    for (const t of targets) if (t.getBoundingClientRect().top < 120) current = t;
    tocLinks.forEach((a) => a.classList.toggle("active", decodeURIComponent(a.hash.slice(1)) === current?.id));
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// ── anteprima al passaggio del mouse sui link interni (come in Obsidian) ──
const base = document.documentElement.dataset.base ?? "";
let previews = null;
let pop = null;
let timer = null;
async function loadPreviews() {
  if (!previews) previews = fetch(`${base}/${document.querySelector("[data-section]")?.dataset.section}/previews.json`).then((r) => r.json()).catch(() => ({}));
  return previews;
}
function hide() {
  clearTimeout(timer);
  pop?.remove();
  pop = null;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
if (matchMedia("(hover: hover)").matches) {
  document.addEventListener("mouseover", (e) => {
    const a = e.target.closest?.("a[data-preview]");
    if (!a) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const data = (await loadPreviews())[a.dataset.preview];
      if (!data || !a.matches(":hover")) return;
      hide();
      pop = document.createElement("div");
      pop.className = "preview-pop";
      pop.innerHTML = `<span class="where">${esc(data.w || "Filosofia")}</span><strong>${esc(data.t)}</strong><p>${esc(data.e || "Nessun testo ancora.")}</p>`;
      document.body.append(pop);
      const r = a.getBoundingClientRect();
      const pw = pop.offsetWidth;
      const left = Math.min(Math.max(8, r.left + scrollX), scrollX + innerWidth - pw - 8);
      const below = r.bottom + pop.offsetHeight + 12 < innerHeight;
      pop.style.left = `${left}px`;
      pop.style.top = below ? `${r.bottom + scrollY + 8}px` : `${r.top + scrollY - pop.offsetHeight - 8}px`;
    }, 350);
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest?.("a[data-preview]")) hide();
  });
  addEventListener("scroll", hide, { passive: true });
}
