// ─────────────────────────────────────────────────────────────
//  Loader del vault Obsidian
//  Legge note (.md), mappe (.canvas) e allegati, risolve i [[wikilink]]
//  con le stesse regole di Obsidian e calcola backlink, date e albero.
// ─────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import matter from "gray-matter";
import config from "../../site.config.mjs";
import { renderMarkdown, extractSection } from "./markdown.mjs";

export const sections = config.sections;

/** Configurazione di una sezione dal suo slug */
export function getSection(slug) {
  const s = sections.find((x) => x.slug === slug);
  if (!s) throw new Error(`Sezione "${slug}" non trovata in site.config.mjs`);
  return s;
}

/** Cartella del vault: vaults/<slug>, oppure VAULT_DIR_<SLUG> per usare una cartella locale */
export function vaultDir(section) {
  const env = process.env[`VAULT_DIR_${section.slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
  return path.resolve(env ?? path.join("vaults", section.slug));
}

const ATTACHMENT_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp",
  ".pdf", ".mp3", ".mp4", ".webm", ".ogg", ".m4a", ".wav",
]);
export const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp"]);

const nfc = (s) => s.normalize("NFC");

/** Slug leggibile: "Talete - Filosofia Antica, F. Ferrari" → "talete-filosofia-antica-f-ferrari", "ἀρχή" → "αρχη" */
export function slugify(s) {
  return nfc(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // toglie accenti e spiriti
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** Prefisso del sito (base) per i link interni */
export function withBase(p) {
  const base = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "");
  return base + (p.startsWith("/") ? p : "/" + p);
}

function walk(dir, exclude, rel = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${entry.name}` : entry.name;
    if (isExcluded(r, exclude)) continue;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), exclude, r));
    else out.push(nfc(r));
  }
  return out;
}

function isExcluded(rel, exclude = []) {
  const n = nfc(rel);
  const base = n.split("/").pop();
  if (base.startsWith(".") || base === "node_modules") return true;
  return exclude.some((e) => n === e || n.startsWith(e + "/"));
}

/** Date di ultima modifica/creazione dai commit git (se il vault è una repo) */
function gitDates(VAULT_DIR) {
  const dates = new Map();
  try {
    const log = execSync(
      `git -c core.quotepath=off -C "${VAULT_DIR}" log --format=%x00%cI --name-only --no-renames`,
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
    );
    let current = null;
    for (const line of log.split("\n")) {
      if (line.startsWith("\u0000")) current = line.slice(1).trim();
      else if (line.trim() && current) {
        const f = nfc(line.trim());
        const d = dates.get(f);
        if (!d) dates.set(f, { updated: current, created: current });
        else d.created = current; // il log va dal più recente al più vecchio
      }
    }
  } catch {
    /* non è una repo git: userò le date del filesystem */
  }
  return dates;
}

function buildVault(section) {
  const VAULT_DIR = vaultDir(section);
  const SECTION = section.slug;
  if (!fs.existsSync(VAULT_DIR)) {
    throw new Error(`Vault "${section.title}" non trovato in ${VAULT_DIR}. Esegui "npm run vault".`);
  }
  const files = walk(VAULT_DIR, section.exclude ?? []);
  const dates = gitDates(VAULT_DIR);
  const notes = [];
  const attachments = [];
  const usedSlugs = new Set();

  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    const abs = path.join(VAULT_DIR, rel);
    if (ext === ".md" || ext === ".canvas") {
      const name = path.basename(rel, ext);
      const dir = path.dirname(rel) === "." ? "" : path.dirname(rel);
      const parentName = dir.split("/").pop();
      let segs = dir ? dir.split("/").map(slugify) : [];
      const isHome = !!section.home && rel === nfc(section.home);
      const isFolderNote = ext === ".md" && !!dir && name === parentName;
      if (!isHome && !isFolderNote) segs.push(slugify(name) || "nota");
      if (isHome) segs = [];
      let slug = segs.join("/");
      while (usedSlugs.has(slug)) slug += "-1";
      usedSlugs.add(slug);

      const raw = fs.readFileSync(abs, "utf8");
      const stat = fs.statSync(abs);
      const d = dates.get(rel);
      const note = {
        id: rel,
        kind: ext === ".md" ? "note" : "canvas",
        name,
        title: name,
        dir,
        slug,
        url: withBase(`/${SECTION}/${slug ? slug + "/" : ""}`),
        isHome,
        isFolderNote,
        updated: d?.updated ?? stat.mtime.toISOString(),
        created: d?.created ?? stat.birthtime.toISOString(),
        raw,
      };
      if (note.kind === "note") {
        let parsed;
        try {
          parsed = matter(raw);
        } catch {
          parsed = { data: {}, content: raw };
        }
        note.frontmatter = parsed.data ?? {};
        note.body = parsed.content;
        if (typeof note.frontmatter.title === "string") note.title = note.frontmatter.title;
        note.aliases = [].concat(note.frontmatter.aliases ?? note.frontmatter.alias ?? []).filter(Boolean).map(String);
      } else {
        try {
          note.canvas = JSON.parse(raw || "{}");
        } catch {
          note.canvas = { nodes: [], edges: [] };
        }
      }
      notes.push(note);
    } else if (ATTACHMENT_EXT.has(ext)) {
      attachments.push({
        id: rel,
        name: path.basename(rel),
        abs,
        ext,
        url: withBase(`/${SECTION}/_file/${rel.split("/").map(encodeURIComponent).join("/")}`),
        routePath: rel,
      });
    }
  }

  // Indici per la risoluzione dei link
  const byPath = new Map(); // "cartella/nome" (minuscolo, senza .md) → nota
  const byName = new Map(); // "nome" → [note]
  const addName = (key, item) => {
    const k = key.toLowerCase();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(item);
  };
  for (const n of notes) {
    const noExt = n.kind === "note" ? n.id.replace(/\.md$/i, "") : n.id;
    byPath.set(noExt.toLowerCase(), n);
    byPath.set(n.id.toLowerCase(), n);
    addName(n.kind === "note" ? n.name : n.name + ".canvas", n);
    for (const a of n.aliases ?? []) addName(a, n);
  }
  for (const a of attachments) {
    byPath.set(a.id.toLowerCase(), a);
    addName(a.name, a);
  }

  /** Risolve il bersaglio di un wikilink come fa Obsidian */
  function resolve(target, fromDir = "") {
    let t = nfc(target).trim().replace(/^\.?\//, "");
    if (!t) return null;
    const k = t.toLowerCase();
    // 1) percorso esatto dalla radice o relativo alla cartella corrente
    for (const cand of [k, fromDir ? `${fromDir.toLowerCase()}/${k}` : null]) {
      if (cand && byPath.has(cand)) return byPath.get(cand);
    }
    // 2) nome del file (il caso più comune)
    const base = k.split("/").pop();
    let list = byName.get(base) ?? byName.get(base.replace(/\.md$/, "")) ?? [];
    // 3) se il link contiene un percorso parziale, filtra per suffisso
    if (k.includes("/")) {
      const suffix = k.replace(/\.md$/, "");
      list = list.filter((n) => n.id.toLowerCase().replace(/\.md$/, "").endsWith(suffix));
    }
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    const sameDir = list.find((n) => path.dirname(n.id) === (fromDir || "."));
    return sameDir ?? [...list].sort((a, b) => a.id.length - b.id.length)[0];
  }

  const vault = { section, notes, attachments, resolve, byId: new Map(notes.map((n) => [n.id, n])) };

  // Rendering di tutte le note + raccolta dei link in uscita
  for (const n of notes) {
    n.outgoing = new Set();
    if (n.kind === "note") {
      const r = renderMarkdown(n.body, { vault, note: n });
      n.html = r.html;
      n.headings = r.headings;
      n.text = r.text;
      r.links.forEach((l) => n.outgoing.add(l));
      n.properties = renderProperties(n.frontmatter, vault, n);
      n.properties.forEach((p) => p.values.forEach((v) => v.note && n.outgoing.add(v.note.id)));
      n.excerpt = makeExcerpt(n);
    } else {
      for (const node of n.canvas.nodes ?? []) {
        if (node.type === "file") {
          const t = resolve(node.file, n.dir);
          if (t && t.kind) n.outgoing.add(t.id);
        }
      }
      n.headings = [];
      n.properties = [];
      n.excerpt = `Mappa con ${(n.canvas.nodes ?? []).filter((x) => x.type !== "group").length} elementi`;
    }
  }
  // Backlink
  for (const n of notes) n.backlinks = [];
  for (const n of notes) {
    for (const id of n.outgoing) {
      const t = vault.byId.get(id);
      if (t && t !== n && !t.backlinks.includes(n)) t.backlinks.push(n);
    }
  }
  for (const n of notes) n.backlinks.sort((a, b) => a.title.localeCompare(b.title, "it"));

  vault.tree = buildTree(notes);
  vault.home = notes.find((n) => n.isHome);
  return vault;
}

// ── Proprietà (frontmatter) ─────────────────────────────────────
const WL = /\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]/;
function renderProperties(fm, vault, note) {
  const hidden = new Set(["title", "aliases", "alias", "cssclasses", "cssclass", "tags", "publish", "draft"]);
  const props = [];
  for (const [key, value] of Object.entries(fm ?? {})) {
    if (hidden.has(key.toLowerCase())) continue;
    const arr = (Array.isArray(value) ? value : [value]).filter((v) => v !== null && v !== undefined && v !== "");
    if (!arr.length) continue;
    const values = arr.map((v) => {
      if (v instanceof Date) return { text: v.toLocaleDateString("it-IT", { timeZone: "UTC" }) };
      const s = String(v);
      const m = s.match(WL);
      if (m) {
        const target = vault.resolve(m[1], note.dir);
        return { text: m[3] ?? m[1].split("/").pop(), note: target?.kind ? target : null, href: target?.url, missing: !target };
      }
      if (/^https?:\/\//.test(s)) return { text: s.replace(/^https?:\/\//, ""), href: s, external: true };
      return { text: s };
    });
    props.push({ key, values });
  }
  const tags = [].concat(fm?.tags ?? []).filter(Boolean);
  if (tags.length) props.push({ key: "tags", values: tags.map((t) => ({ text: "#" + String(t).replace(/^#/, ""), tag: true })) });
  return props;
}

function makeExcerpt(n) {
  const desc = n.frontmatter?.description ?? n.frontmatter?.descrizione;
  if (desc) return String(desc);
  const t = (n.text ?? "").replace(/\s+/g, " ").trim();
  return t.length > 220 ? t.slice(0, 217).replace(/\s\S*$/, "") + "…" : t;
}

// ── Albero delle cartelle per la navigazione ────────────────────
function buildTree(notes) {
  const root = { name: "", path: "", folders: new Map(), notes: [], folderNote: null };
  for (const n of notes) {
    if (n.isHome) continue;
    let node = root;
    const parts = n.dir ? n.dir.split("/") : [];
    let acc = "";
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      if (!node.folders.has(p)) node.folders.set(p, { name: p, path: acc, folders: new Map(), notes: [], folderNote: null });
      node = node.folders.get(p);
    }
    if (n.isFolderNote) node.folderNote = n;
    else node.notes.push(n);
  }
  const sortRec = (node) => {
    node.notes.sort((a, b) => a.title.localeCompare(b.title, "it", { numeric: true }));
    node.children = [...node.folders.values()].sort((a, b) => a.name.localeCompare(b.name, "it"));
    node.children.forEach(sortRec);
    node.count = node.notes.length + (node.folderNote ? 1 : 0) + node.children.reduce((s, c) => s + c.count, 0);
  };
  sortRec(root);
  return root;
}

// ── Cache per sezione (in dev si ricarica se il vault cambia) ───
const cache = new Map();
export function getVault(slug) {
  const dev = import.meta.env?.DEV;
  const hit = cache.get(slug);
  if (hit && (!dev || Date.now() - hit.stamp < 1500)) return hit.vault;
  const vault = buildVault(getSection(slug));
  cache.set(slug, { vault, stamp: Date.now() });
  return vault;
}

export { extractSection };
