// Scarica (o aggiorna) ogni vault elencato in site.config.mjs → sections, in ./vaults/<slug>.
// Per usare una cartella locale invece di GitHub (es. per vedere le modifiche prima del push):
//   VAULT_DIR_FILOSOFIA="/percorso/del/vault" npm run dev
import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import config from "../site.config.mjs";

const sh = (cmd) => execSync(cmd, { stdio: "inherit" });
mkdirSync("vaults", { recursive: true });

for (const s of config.sections) {
  const envName = `VAULT_DIR_${s.slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  if (process.env[envName]) {
    console.log(`[${s.slug}] uso la cartella locale ${process.env[envName]}`);
    continue;
  }
  const dir = `vaults/${s.slug}`;
  const branch = s.branch ?? "main";
  try {
    if (existsSync(`${dir}/.git`)) {
      console.log(`[${s.slug}] aggiorno…`);
      sh(`git -C ${dir} fetch --quiet origin ${branch}`);
      sh(`git -C ${dir} reset --quiet --hard origin/${branch}`);
    } else {
      console.log(`[${s.slug}] clono ${s.repo}…`);
      // Storia completa (senza i file vecchi) per ricavare le date di modifica dai commit
      sh(`git clone --quiet --filter=blob:none --branch ${branch} ${s.repo} ${dir}`);
    }
  } catch (e) {
    if (existsSync(dir)) console.warn(`[${s.slug}] impossibile aggiornare, uso la copia esistente`);
    else throw e;
  }
}
