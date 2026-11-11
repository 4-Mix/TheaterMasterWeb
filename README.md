# Impara il copione – versione per iPhone (PWA)

Una pagina web che si installa sulla schermata Home e si usa come un'app, anche senza internet.
Non serve un Mac né un account sviluppatore Apple. Funziona anche su Android.

Cosa fa: carichi il copione in PDF, scegli il tuo personaggio, e la voce del telefono legge le battute
degli altri. Quando tocca a te la prova si ferma. Puoi scegliere le scene e dare a ogni personaggio una
voce di donna o di uomo.

---

## Parte 1 – Pubblicare la pagina con GitHub Pages (una volta sola)

Per installarla sull'iPhone la pagina deve avere un indirizzo web. GitHub lo dà gratis.

1. Su https://github.com clicca **+ → New repository**.
   - Nome: `copione-web`
   - Visibilità: **Public**. GitHub Pages gratuito funziona solo con i repository pubblici.
     Nel repository c'è solo il codice dell'app: **il tuo copione non viene caricato da nessuna parte**,
     resta sul telefono.
   - Non spuntare "Add a README". Clicca **Create repository**.
2. Estrai lo zip `copione-pwa.zip` in una cartella.
3. Nella pagina del repository vuoto clicca **uploading an existing file**.
4. Apri la cartella estratta, seleziona **tutto il contenuto** (file e cartelle `lib`, `icons`, `tests`)
   e trascinalo nella pagina di GitHub. Aspetta che finisca il caricamento e clicca **Commit changes**.
5. Vai in **Settings → Pages**. Sotto **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main**, cartella **/ (root)**, poi **Save**.
6. Dopo uno o due minuti, ricarica la pagina Settings → Pages: in alto compare
   *"Your site is live at https://TUO-UTENTE.github.io/copione-web/"*. Quello è l'indirizzo dell'app.

> Dopo il commit controlla che nel repository compaiano le cartelle `lib` e `icons` e i file
> `index.html`, `app.js`, `parser.js`, `style.css`, `sw.js`. Se qualcosa manca, usa **Add file → Upload files**
> e trascina di nuovo solo quello che manca (le cartelle si possono trascinare intere).

---

## Parte 2 – Installare sull'iPhone

1. Apri l'indirizzo con **Safari** (non con altri browser).
2. Tocca il pulsante **Condividi** (il quadrato con la freccia in alto) → **Aggiungi alla schermata Home** → **Aggiungi**.
3. Apri **Copione** dalla schermata Home: parte a tutto schermo come un'app.

La prima volta serve internet per scaricarla; poi funziona anche offline.

---

## Parte 3 – Usarla

1. **Scegli il PDF** (dal telefono, da iCloud o dall'app File). Se il PDF è una scansione, apri
   **Incolla il testo** e incolla il copione. Con **Prova con un esempio** vedi subito come funziona.
2. Scegli il tuo personaggio.
3. **Scene** apre l'elenco con le caselle (anche più di una). **Voci** serve per ogni personaggio:
   - **Donna / Uomo** sceglie una voce adatta e ne regola il tono.
   - Se il telefono ha più voci italiane compare il menu con i loro nomi: provale con **Ascolta**.
   - La barra **Velocità** regola quanto parla veloce.
4. **Avvia o riprendi la prova**. Le battute degli altri vengono lette; alla tua l'app aspetta.
   Dì la battuta a voce e tocca **Fatto, avanti**. **Suggerimento** mostra la battuta; toccare una
   riga della lista ti riporta lì. Le scelte sulle voci vengono ricordate.

### Se non senti nulla o la voce è brutta
- Controlla il volume e l'interruttore del silenzioso sul lato dell'iPhone.
- Per voci migliori: **Impostazioni → Accessibilità → Contenuto letto → Voci → Italiano**, e scarica
  le voci in versione migliorata (es. Alice, Luca). Di solito Safari le usa subito.
- Se l'app non trova voci italiane lo dice nella schermata **Voci**.

### Formato del copione
- Nome del personaggio **in MAIUSCOLO** seguito da due punti: `ANGUS: Essere o non essere...`
- Scene segnate come `#SCENA 1 - INTRO#` (vanno bene anche `SCENA 2` o `ATTO I - SCENA 1`).
- Il testo tra parentesi è un'azione: si vede in corsivo e non viene letto.
- Le righe che nel PDF vanno a capo vengono riunite alla battuta.

---

## Aggiornare l'app
Per cambiare un file: nel repository apri il file, clicca la matita, modifica e **Commit changes**.
Dopo uno o due minuti la nuova versione è online; sul telefono compare dopo aver aperto l'app due volte
(la prima volta scarica l'aggiornamento, la seconda lo mostra). Se cambi molti file, aumenta il numero
`copione-v1` in `sw.js` per costringere i telefoni a ricaricarli.

## Contenuto
```
index.html, style.css, app.js     l'app
parser.js                         legge il formato del copione (scene, personaggi, azioni)
sw.js, manifest.webmanifest       installazione e funzionamento offline
lib/                              pdf.js (Mozilla, licenza Apache 2.0) per leggere i PDF
icons/                            icona dell'app
tests/parser.test.js              test del parser:  node --test tests/parser.test.js
```
