// Dati per il grafo: globale (tutto il vault) o locale (vicini di una nota)
export function graphData(vault, center = null, depth = 1) {
  let included;
  if (center) {
    included = new Set([center]);
    let frontier = [center];
    for (let d = 0; d < depth; d++) {
      const next = [];
      for (const n of frontier) {
        for (const id of n.outgoing) {
          const t = vault.byId.get(id);
          if (t && !included.has(t)) { included.add(t); next.push(t); }
        }
        for (const b of n.backlinks) if (!included.has(b)) { included.add(b); next.push(b); }
      }
      frontier = next;
    }
  } else {
    included = new Set(vault.notes);
  }
  const nodes = [...included].map((n) => ({
    id: n.id,
    title: n.isHome ? "Filosofia" : n.title,
    url: n.url,
    group: n.dir.split("/")[0] || "—",
    current: n === center || undefined,
  }));
  const links = [];
  const seen = new Set();
  for (const n of included) {
    for (const id of n.outgoing) {
      const t = vault.byId.get(id);
      if (!t || !included.has(t) || t === n) continue;
      const key = [n.id, t.id].sort().join("→");
      if (seen.has(key)) continue;
      seen.add(key);
      links.push([n.id, t.id]);
    }
  }
  return { nodes, links };
}
