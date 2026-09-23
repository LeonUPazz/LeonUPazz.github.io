// Pubblica gli allegati del vault (immagini, PDF, audio…) mantenendo il loro percorso
import fs from "node:fs";
import { getVault, sections } from "../../../lib/vault.mjs";

const TYPES = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".avif": "image/avif", ".bmp": "image/bmp", ".pdf": "application/pdf",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".mp4": "video/mp4", ".webm": "video/webm",
};

export function getStaticPaths() {
  return sections.flatMap((s) =>
    getVault(s.slug).attachments.map((a) => ({ params: { section: s.slug, path: a.routePath }, props: { abs: a.abs, ext: a.ext } })),
  );
}

export function GET({ props }) {
  return new Response(fs.readFileSync(props.abs), { headers: { "Content-Type": TYPES[props.ext] ?? "application/octet-stream" } });
}
