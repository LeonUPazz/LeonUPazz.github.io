// ─────────────────────────────────────────────────────────────
//  Markdown "sapore Obsidian" → HTML
//  [[wikilink]], ![[embed]], callout, ==evidenziato==, %%commenti%%,
//  checkbox, formule $…$ / $$…$$, a capo singoli come in Obsidian.
// ─────────────────────────────────────────────────────────────
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import { visit, SKIP } from "unist-util-visit";
import { toString as hastToString } from "hast-util-to-string";
import { slug as githubSlug } from "github-slugger";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp"]);
const PH_OPEN = "\uE000";
const PH_CLOSE = "\uE001";
const PH_RE = new RegExp(`${PH_OPEN}(\\d+)${PH_CLOSE}`, "g");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Restituisce solo la sezione sotto un certo titolo (per ![[Nota#Titolo]]) */
export function extractSection(md, heading) {
  if (!heading) return md;
  const lines = md.split("\n");
  const want = githubSlug(heading);
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (!m) continue;
    if (start === -1 && githubSlug(m[2].trim()) === want) {
      start = i;
      level = m[1].length;
    } else if (start !== -1 && m[1].length <= level) {
      return lines.slice(start, i).join("\n");
    }
  }
  return start === -1 ? md : lines.slice(start).join("\n");
}

/** Sostituisce i wikilink con segnaposto, lasciando intatti blocchi di codice e codice inline */
function preprocess(md) {
  const links = [];
  const parts = md.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g);
  const out = parts.map((part, i) => {
    if (i % 2 === 1) return part; // codice: non toccare
    return part
      .replace(/%%[\s\S]*?%%/g, "") // commenti Obsidian
      .replace(/(!?)\[\[([^\]\n]+?)\]\]/g, (_, bang, inner) => {
        const [targetAndHeading, ...aliasParts] = inner.split("|");
        const alias = aliasParts.join("|").trim() || null;
        const hashIdx = targetAndHeading.indexOf("#");
        const target = (hashIdx === -1 ? targetAndHeading : targetAndHeading.slice(0, hashIdx)).trim();
        const heading = hashIdx === -1 ? null : targetAndHeading.slice(hashIdx + 1).replace(/^\^/, "").trim();
        links.push({ embed: !!bang, target, heading, alias });
        return `${PH_OPEN}${links.length - 1}${PH_CLOSE}`;
      })
      .replace(/==([^=\n]+)==/g, "<mark>$1</mark>")
      .replace(/\s\^[A-Za-z0-9-]+$/gm, ""); // id di blocco
  });
  return { md: out.join(""), links };
}

// ── plugin remark: segnaposto → link / immagini / embed ─────────
function remarkWikilinks(ctx) {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      if (!node.value.includes(PH_OPEN)) return;
      const children = [];
      let last = 0;
      for (const m of node.value.matchAll(PH_RE)) {
        if (m.index > last) children.push({ type: "text", value: node.value.slice(last, m.index) });
        children.push(wikilinkNode(ctx.links[+m[1]], ctx));
        last = m.index + m[0].length;
      }
      if (last < node.value.length) children.push({ type: "text", value: node.value.slice(last) });
      parent.children.splice(index, 1, ...children);
      return [SKIP, index + children.length];
    });
  };
}

function wikilinkNode(link, ctx) {
  const { vault, note } = ctx;
  const { embed, target, heading, alias } = link;
  const fromDir = note?.dir ?? "";

  // [[#Titolo]] → ancora nella stessa pagina
  if (!target && heading) {
    return { type: "link", url: `#${githubSlug(heading)}`, children: [{ type: "text", value: alias ?? heading }] };
  }

  const resolved = vault.resolve(target, fromDir);
  const shown = alias ?? (heading ? `${target.split("/").pop()} › ${heading}` : target.split("/").pop().replace(/\.md$/i, ""));

  if (!resolved) {
    ctx.missing.push(target);
    return { type: "html", value: `<span class="unresolved" title="Nota non ancora scritta">${esc(shown)}</span>` };
  }

  // Allegati (immagini, pdf, audio, video)
  if (!resolved.kind) {
    const ext = resolved.ext;
    if (embed && IMAGE_EXT.has(ext)) {
      // ![[img.png|300]] → larghezza
      const width = alias && /^\d+(x\d+)?$/.test(alias) ? alias.split("x")[0] : null;
      return { type: "html", value: `<img src="${esc(resolved.url)}" alt="${esc(width ? resolved.name : alias ?? resolved.name)}" loading="lazy"${width ? ` width="${width}"` : ""}>` };
    }
    if (embed && ext === ".pdf") {
      return { type: "html", value: `<div class="embed-pdf"><iframe src="${esc(resolved.url)}" title="${esc(resolved.name)}" loading="lazy"></iframe><a href="${esc(resolved.url)}">Apri il PDF: ${esc(resolved.name)}</a></div>` };
    }
    if (embed && [".mp3", ".ogg", ".m4a", ".wav"].includes(ext)) {
      return { type: "html", value: `<audio controls src="${esc(resolved.url)}"></audio>` };
    }
    if (embed && [".mp4", ".webm"].includes(ext)) {
      return { type: "html", value: `<video controls src="${esc(resolved.url)}"></video>` };
    }
    return { type: "link", url: resolved.url, children: [{ type: "text", value: alias ?? resolved.name }] };
  }

  ctx.found.add(resolved.id);
  const href = resolved.url + (heading ? `#${githubSlug(heading)}` : "");

  // ![[Nota]] → contenuto incorporato
  if (embed && resolved.kind === "note" && (ctx.depth ?? 0) < 2 && resolved !== note) {
    const inner = renderMarkdown(extractSection(resolved.body, heading), { vault, note: resolved, depth: (ctx.depth ?? 0) + 1 });
    return {
      type: "html",
      value: `<div class="embed"><a class="embed-title internal" href="${esc(href)}">${esc(shown)}</a><div class="embed-body">${inner.html}</div></div>`,
    };
  }

  return {
    type: "link",
    url: href,
    children: [{ type: "text", value: shown }],
    data: { hProperties: { className: ["internal"], "data-preview": resolved.id } },
  };
}

// ── plugin remark: callout  > [!note] Titolo ─────────────────────
const CALLOUT_ALIASES = {
  summary: "abstract", tldr: "abstract", hint: "tip", important: "tip", check: "success", done: "success",
  help: "question", faq: "question", caution: "warning", attention: "warning", fail: "failure", missing: "failure",
  error: "danger", cite: "quote",
};
const CALLOUT_LABELS = {
  note: "Nota", abstract: "Sintesi", info: "Info", todo: "Da fare", tip: "Suggerimento", success: "Fatto",
  question: "Domanda", warning: "Attenzione", failure: "Errore", danger: "Pericolo", bug: "Bug", example: "Esempio", quote: "Citazione",
};
function remarkCallouts() {
  return (tree) => {
    visit(tree, "blockquote", (node) => {
      const p = node.children[0];
      if (p?.type !== "paragraph" || p.children[0]?.type !== "text") return;
      const first = p.children[0];
      const m = first.value.match(/^\[!([\w-]+)\]([+-]?)[ \t]*([^\n]*)\n?/);
      if (!m) return;
      const raw = m[1].toLowerCase();
      const type = CALLOUT_ALIASES[raw] ?? raw;
      const fold = m[2];
      first.value = first.value.slice(m[0].length);
      // il titolo può contenere altri nodi inline fino al primo a capo: qui teniamo il testo semplice
      const titleText = m[3].trim() || CALLOUT_LABELS[type] || raw[0].toUpperCase() + raw.slice(1);
      if (!first.value) p.children.shift();
      if (p.children[0]?.type === "break") p.children.shift();
      if (!p.children.length) node.children.shift();
      node.data = { hName: fold ? "details" : "div", hProperties: { className: ["callout", `callout-${type}`], open: fold === "+" ? true : undefined } };
      node.children.unshift({
        type: "paragraph",
        data: { hName: fold ? "summary" : "div", hProperties: { className: ["callout-title"] } },
        children: [{ type: "text", value: titleText }],
      });
    });
  };
}

// ── plugin remark: rimuove le voci di elenco vuote ("- " a fine lista) ──
function remarkDropEmptyItems() {
  return (tree) => {
    visit(tree, "list", (node) => {
      node.children = node.children.filter((li) => li.children.length > 0);
    });
    visit(tree, (node, index, parent) => {
      if (node.type === "list" && node.children.length === 0 && parent) {
        parent.children.splice(index, 1);
        return [SKIP, index];
      }
    });
  };
}

// ── plugin rehype: raccoglie titoli e testo, sistema link esterni ──
function rehypeCollect(ctx) {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (/^h[1-6]$/.test(node.tagName) && node.properties?.id) {
        ctx.headings.push({ depth: +node.tagName[1], id: node.properties.id, text: hastToString(node).trim() });
      }
      if (node.tagName === "a" && /^https?:\/\//.test(node.properties?.href ?? "")) {
        node.properties.target = "_blank";
        node.properties.rel = ["noopener", "noreferrer"];
        node.properties.className = [...(node.properties.className ?? []), "external"];
      }
      if (node.tagName === "p") {
        const t = hastToString(node).trim();
        if (!t && !node.children.some((c) => c.type === "element")) {
          parent.children.splice(index, 1);
          return [SKIP, index];
        }
        ctx.paragraphs.push(t);
      }
      if (node.tagName === "li" && node.properties?.className?.includes("task-list-item")) {
        const input = node.children.find((c) => c.tagName === "input") ?? node.children[0]?.children?.find?.((c) => c.tagName === "input");
        if (input?.properties?.checked) node.properties.className.push("done");
      }
      if (node.tagName === "table" && parent) {
        parent.children[index] = { type: "element", tagName: "div", properties: { className: ["table-wrap"] }, children: [node] };
        return SKIP;
      }
    });
  };
}

export function renderMarkdown(body, { vault, note, depth = 0, section = null }) {
  const { md, links } = preprocess(section ? extractSection(body, section) : body);
  const ctx = { vault, note, depth, links, found: new Set(), missing: [], headings: [], paragraphs: [] };
  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkBreaks)
    .use(remarkWikilinks, ctx)
    .use(remarkCallouts)
    .use(remarkDropEmptyItems)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeKatex, { throwOnError: false, strict: false })
    .use(rehypeCollect, ctx)
    .use(rehypeStringify)
    .processSync(md);

  const long = ctx.paragraphs.filter((t) => t.length >= 40);
  return {
    html: String(file),
    headings: ctx.headings,
    links: ctx.found,
    missing: ctx.missing,
    text: (long.length ? long : ctx.paragraphs).join(" "),
  };
}
