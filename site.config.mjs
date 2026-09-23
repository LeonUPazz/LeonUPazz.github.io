// ─────────────────────────────────────────────────────────────
//  Configurazione del sito — modifica qui nome, link e sezioni.
// ─────────────────────────────────────────────────────────────

// Cartelle/file che non vengono mai pubblicati (valgono per ogni vault)
const EXCLUDE_DEFAULT = [".obsidian", ".git", ".github", ".trash", "README.md", "Template", "Templates"];

export default {
  // Nome mostrato in alto a sinistra e nel titolo delle pagine
  title: "Note Varie",
  // Breve descrizione (meta tag per i motori di ricerca e le anteprime dei link)
  description: "Appunti di filosofia e altre note.",
  // Lingua del sito
  lang: "it",
  // Autore (compare nel footer)
  author: "Leonardo",

  // URL finale del sito. Se usi un dominio tuo, mettilo qui (es. "https://tuodominio.it")
  site: process.env.SITE_URL || "https://leonupazz.github.io",
  // Sottopercorso: "/" per un sito utente (LeonUPazz.github.io) o dominio proprio;
  // "/nome-repo" se pubblichi come sito di progetto.
  base: process.env.BASE_PATH || "/",

  // ── Sezioni: ogni sezione è un vault Obsidian su GitHub ──────
  // Per aggiungerne una, copia il blocco qui sotto e cambia i campi (vedi README).
  sections: [
    {
      slug: "filosofia",                              // indirizzo: /filosofia/
      title: "Filosofia",                             // nome nel menu e nei titoli
      intro: "Riassunti dei testi, analisi delle opere e appunti dei corsi.",
      repo: "https://github.com/LeonUPazz/Filosofia", // repository del vault
      branch: "main",
      home: "Filosofia.md",                           // nota che fa da indice del vault (facoltativa)
      showHomeNote: false,                            // mostrare anche il testo di quella nota sotto le schede?
      exclude: [...EXCLUDE_DEFAULT, "Contributi"],    // cartelle/file da non pubblicare
    },
    // {
    //   slug: "matematica",
    //   title: "Matematica",
    //   intro: "Appunti di analisi, algebra e storia della matematica.",
    //   repo: "https://github.com/LeonUPazz/Matematica",
    //   branch: "main",
    //   home: "Matematica.md",
    //   showHomeNote: false,
    //   exclude: [...EXCLUDE_DEFAULT],
    // },
  ],

  // Contatti per segnalazioni/contributi. Se `email` è vuota si usa la pagina "Issues"
  // della repository del vault a cui appartiene la nota.
  contact: {
    email: "",
    github: "https://github.com/LeonUPazz",
  },
};
