# Note Varie

Sito statico fatto con [Astro](https://astro.build) che pubblica uno o più vault Obsidian. Ogni vault è una **sezione** del sito: per ora c'è solo **Filosofia** (`/filosofia/`), dal vault [LeonUPazz/Filosofia](https://github.com/LeonUPazz/Filosofia). La home mostra, per ogni sezione, le note aggiornate più di recente.

I vault **non** stanno in questa repo: vengono scaricati durante la build. Tu continui a lavorare solo in Obsidian e a fare push sulle repo dei vault; il sito si aggiorna da solo.

## Cosa supporta del formato Obsidian

| Obsidian | Sul sito |
|---|---|
| `[[Nota]]`, `[[Nota\|alias]]`, `[[cartella/Nota]]`, `[[Nota#Titolo]]` | link risolti come in Obsidian (nome del file, percorso, alias nel frontmatter) |
| link a note non ancora scritte | testo rosso tratteggiato "nota non ancora scritta", nessun link rotto |
| proprietà (frontmatter) con link, es. `Categorie: [[Presocratici]]` | scheda in cima alla nota, con link cliccabili |
| backlink | colonna "Citato in" + grafo locale |
| `![[immagine.png]]`, `![[file.pdf]]`, `![[Nota]]`, `![[Nota#Sezione]]` | immagini, PDF, note incorporate |
| `.canvas` | mappa navigabile (trascina, zoom, pulsante "Adatta") |
| `$…$`, `$$…$$` | formule (KaTeX) |
| `- [ ]` / `- [x]` | checkbox |
| `> [!note]`, `> [!question]-` … | callout (anche richiudibili) |
| `==evidenziato==`, `%%commento%%` | evidenziato / commento nascosto |
| a capo singolo | a capo, come in Obsidian |
| nota con lo stesso nome della cartella (`Corsi/Corsi.md`) | pagina della cartella (`/filosofia/corsi/`) |
| proprietà `Nascita` / `Morte` | linea del tempo nella pagina iniziale della sezione (compare solo se almeno due note le hanno) |

In più: ricerca full-text (tasto `/`), anteprima delle note al passaggio del mouse, grafo completo di ogni sezione (es. `/filosofia/grafo/`), tema chiaro/scuro, date "Aggiornato il" prese dai commit.

**Cosa non viene pubblicato**: `.obsidian/`, `README.md`, cartelle `Template(s)`, qualsiasi file/cartella che inizia con un punto e, per Filosofia, `Contributi/`. Si cambia nel campo `exclude` della sezione in `site.config.mjs`.

## Pubblicarlo su GitHub Pages (gratis) — una volta sola

1. **Crea una repo** chiamata `LeonUPazz.github.io` (con questo nome il sito sarà su `https://leonupazz.github.io`) e caricaci il contenuto di questa cartella:
   ```bash
   cd sito
   git init && git add . && git commit -m "Primo commit del sito"
   git branch -M main
   git remote add origin https://github.com/LeonUPazz/LeonUPazz.github.io.git
   git push -u origin main
   ```
2. Nella repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Vai su **Actions → "Pubblica il sito" → Run workflow** (oppure fai un push). Dopo circa un minuto il sito è online.

> Se preferisci un'altra repo (es. `sito`), il sito sarà su `https://leonupazz.github.io/sito/`: in **Settings → Secrets and variables → Actions → Variables** aggiungi `BASE_PATH` = `/sito`.

### Aggiornamento automatico quando modifichi il vault

Il sito si ricostruisce già **ogni notte** da solo. Per averlo aggiornato **subito dopo ogni push sul vault**:

1. Crea un token: GitHub → Settings → Developer settings → **Fine-grained tokens** → *Generate new token*
   - Repository access: *Only select repositories* → la repo del **sito**
   - Permissions → Repository permissions → **Contents: Read and write**
2. Nella repo **Filosofia**: Settings → Secrets and variables → Actions → *New repository secret*
   - Nome: `SITE_DISPATCH_TOKEN`, valore: il token appena creato
3. Copia `extra/vault-workflow/aggiorna-sito.yml` nella repo Filosofia in `.github/workflows/aggiorna-sito.yml` (e controlla che `SITE_REPO` sia il nome giusto della repo del sito).

Per ogni altro vault che aggiungerai si ripetono i punti 2 e 3 nella sua repo (il token può essere lo stesso).

Da quel momento: scrivi in Obsidian → push → dopo circa un minuto e mezzo il sito è aggiornato.

### Dominio personale

1. Compra il dominio (es. `nomecognome.it`) e aggiungi nel DNS i record indicati da GitHub ([guida](https://docs.github.com/it/pages/configuring-a-custom-domain-for-your-github-pages-site)).
2. Nella repo del sito: Settings → Pages → Custom domain.
3. In Settings → Secrets and variables → Actions → Variables aggiungi `SITE_URL` = `https://nomecognome.it`.

## Lavorare in locale

Serve Node.js 22 o più recente.

```bash
npm install
npm run dev          # scarica il vault da GitHub e apre http://localhost:4321
```

Per vedere in anteprima le modifiche **prima** di fare push sul vault, punta direttamente alla cartella di Obsidian con la variabile `VAULT_DIR_<SLUG>` (lo slug della sezione in maiuscolo):

```bash
VAULT_DIR_FILOSOFIA="/percorso/del/vault/Filosofia" npm run dev
```

`npm run build` crea il sito finale in `dist/` (con l'indice della ricerca).

## Aggiungere un'altra sezione (un altro vault)

Ogni sezione è un vault Obsidian in una sua repo GitHub, esattamente come Filosofia. Esempio con un vault di matematica:

1. **Crea il vault come repo GitHub**, per esempio `LeonUPazz/Matematica`, e fai push delle note (come hai fatto per Filosofia). Se vuoi una pagina indice, crea una nota con lo stesso nome del vault (`Matematica.md`) nella cartella principale.
2. **Aggiungi la sezione in `site.config.mjs`**, dentro `sections` (c'è già un esempio commentato da copiare):
   ```js
   {
     slug: "matematica",                               // indirizzo: /matematica/
     title: "Matematica",                              // nome nel menu e nei titoli
     intro: "Appunti di analisi, algebra e storia della matematica.",
     repo: "https://github.com/LeonUPazz/Matematica",
     branch: "main",
     home: "Matematica.md",                            // nota indice (facoltativa)
     showHomeNote: false,
     exclude: [...EXCLUDE_DEFAULT],                    // aggiungi cartelle private, es. "Bozze"
   },
   ```
   L'ordine delle sezioni nella lista è l'ordine nel menu e nella home.
3. **Fai push della repo del sito.** La build scaricherà anche il nuovo vault in `vaults/matematica/` e creerà `/matematica/`, con il suo indice delle cartelle, i suoi link, il suo grafo e le sue anteprime. Il menu in alto e la home si aggiornano da soli; la ricerca cerca in tutte le sezioni.
4. *(Facoltativo)* Aggiornamento immediato: copia `extra/vault-workflow/aggiorna-sito.yml` anche nella repo del nuovo vault e aggiungici il secret `SITE_DISPATCH_TOKEN` (vedi sopra). Altrimenti la sezione si aggiorna comunque ogni notte.

Note:
- Le sezioni sono indipendenti: un `[[link]]` in Matematica cerca solo tra le note di Matematica.
- Lo `slug` diventa l'indirizzo, quindi scegli qualcosa di breve, minuscolo e senza spazi. Se lo cambi dopo, i vecchi link smettono di funzionare.
- Se una repo è **privata**, la build su GitHub non può scaricarla: i vault pubblicati devono essere pubblici (oppure serve un token di lettura nel workflow).

Per sezioni che **non** sono vault (una pagina progetti, un blog…): crea un file in `src/pages/`, es. `src/pages/progetti.astro` usando `src/pages/404.astro` come modello, e aggiungi una voce alla lista `nav` in cima a `src/layouts/Base.astro`.

## Personalizzare

- **Nome del sito, descrizione, sezioni, email per le segnalazioni**: `site.config.mjs`. Se imposti `contact.email`, il link "Segnalalo" in fondo alle note apre un'email; altrimenti apre una "issue" nella repo del vault.
- **Home**: `src/pages/index.astro`.
- **Colori e caratteri**: variabili in cima a `src/styles/global.css`.

## Struttura

```
site.config.mjs            configurazione (nome del sito, sezioni/vault)
scripts/fetch-vault.mjs    scarica/aggiorna ogni vault in ./vaults/<slug>
src/lib/vault.mjs          legge un vault: link, backlink, date, albero delle cartelle
src/lib/markdown.mjs       Markdown in stile Obsidian → HTML
src/pages/index.astro      home
src/pages/[section]/       pagine di ogni sezione: note, grafo, anteprime, allegati
src/components/            esploratore, canvas, linea del tempo
.github/workflows/         pubblicazione su GitHub Pages
extra/vault-workflow/      workflow da copiare nella repo di ogni vault
```

## Licenza degli appunti

Il footer indica [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.it): chiunque può usare e condividere gli appunti citandoti, **ma non venderli**, e le versioni modificate devono restare con la stessa licenza. Se scegli un'altra licenza, cambia il footer in `src/layouts/Base.astro` e aggiungi un file `LICENSE` alla repo del vault.
