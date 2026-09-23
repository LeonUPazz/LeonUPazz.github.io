// Indice leggero per le anteprime dei link (titolo, cartella, estratto)
import { getVault, sections } from "../../lib/vault.mjs";

export function getStaticPaths() {
  return sections.map((s) => ({ params: { section: s.slug } }));
}

export function GET({ params }) {
  const vault = getVault(params.section);
  const out = {};
  for (const n of vault.notes) {
    out[n.id] = { t: n.isHome ? vault.section.title : n.title, w: n.dir, e: n.excerpt };
  }
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
}
