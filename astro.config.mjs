// @ts-check
import { defineConfig } from "astro/config";
import config from "./site.config.mjs";

export default defineConfig({
  site: config.site,
  base: config.base,
  trailingSlash: "ignore",
  build: { format: "directory", assets: "assets" },
  vite: {
    server: { watch: { ignored: ["**/vault/.git/**"] } },
    // nomi dei file generati puliti (Astro altrimenti usa nomi come "_...slug_.astro…")
    build: {
      rollupOptions: {
        output: {
          entryFileNames: "assets/[hash].js",
          chunkFileNames: "assets/[hash].js",
          assetFileNames: (info) => {
            const name = (info.names?.[0] ?? info.name ?? "asset").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
            return `assets/${name}.[hash][extname]`;
          },
        },
      },
    },
  },
});
