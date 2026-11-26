# Impara il copione – versione per iPhone (PWA)

Una pagina web che si installa sulla schermata Home e si usa come un'app, anche senza internet.
Non serve un Mac né un account sviluppatore Apple. Funziona anche su Android.

Cosa fa: carichi il copione in PDF, scegli il tuo personaggio, e la voce del telefono legge le battute
degli altri. Quando tocca a te la prova si ferma (o, con l'**Autoplay**, prosegue da sola). Puoi scegliere
le scene, dare a ogni personaggio una voce di donna o di uomo, **salvare i copioni** sul telefono e
allenare la memoria con la modalità **Training**.

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
> `index.html`, `app.js`, `parser.js`, `pacing.js`, `training.js`, `library.js`, `style.css`, `sw.js`. Se qualcosa manca, usa **Add file → Upload files**
> e trascina di nuovo solo quello che manca (le cartelle si possono trascinare intere).

---

## Parte 2 – Installare sull'iPhone

1. Apri l'indirizzo con **Safari** (non con altri browser).
2. Tocca il pulsante **Condividi** (il quadrato con la freccia in alto) → **Aggiungi alla schermata Home** → **Aggiungi**.
3. Apri **Copione** dalla schermata Home: parte a tutto schermo come un'app.

La prima volta serve internet per scaricarla; poi funziona anche offline.

---

## Parte 3 – Usarla

1. **Aggiungi un copione (PDF)** (dal telefono, da iCloud o dall'app File). Se il PDF è una scansione, apri
   **Incolla il testo** e incolla il copione. Con **Prova con un esempio** vedi subito come funziona.
   Il copione viene **salvato sul telefono**: la prossima volta lo trovi in **I miei copioni**
   (l'ultimo usato in cima, con il personaggio che stavi provando). Lo stesso testo non si duplica;
   per toglierne uno tocca **Elimina**.
2. Scegli il tuo personaggio.
3. **Scene** apre l'elenco con le caselle (anche più di una). **Voci** serve per ogni personaggio:
   - **Donna / Uomo** sceglie una voce adatta e ne regola il tono.
   - Se il telefono ha più voci italiane compare il menu con i loro nomi: provale con **Ascolta**.
   - La barra **Velocità** regola quanto parla veloce.
4. **Avvia o riprendi la prova**. Le battute degli altri vengono lette; alla tua l'app aspetta.
   Dì la battuta a voce e tocca **Fatto, avanti**. **Suggerimento** mostra la battuta; toccare una
   riga della lista ti riporta lì. Le scelte sulle voci vengono ricordate.

### Modo di prova (barra **Modo**)
- **Le tue battute**: *Mostra* (sempre visibili), *Nascondi* (coperte finché non tocca a te) oppure
  **Training**: di ogni tua battuta restano nascoste **solo alcune parole** (quelle da 3 lettere in su),
  per costringerti a ricordarle. *Facile* 25% con l'iniziale, *Medio* 50% con l'iniziale,
  *Difficile* 75% senza iniziale. I buchi cambiano a ogni nuova prova dall'inizio; **Suggerimento**
  mostra la battuta intera.
- **Autoplay**: quando tocca a te, l'app passa **da sola** alla battuta successiva dopo il tempo stimato
  dal testo (circa 0,43 s a parola, più pause per punti e virgole, 1 s per ogni azione, minimo 1,5 s).
  Una barra mostra il tempo che resta; **Avanti subito** salta l'attesa. **Ritmo** calmo / normale / veloce.

### Dove sono salvati i copioni
Nella memoria del browser, sul telefono: non vanno su nessun server. Installando l'app sulla schermata Home
restano finché non la elimini. Se invece la usi **dentro Safari senza installarla**, iOS può cancellare i dati
di un sito che non apri per circa una settimana: per questo conviene installarla. Se elimini l'app o cancelli
i dati di Safari, i copioni vanno persi: tieni i PDF originali.

### Se non senti nulla o la voce è brutta
- **Il tasto laterale dell'iPhone**: se è sul silenzioso (si vede l'arancione) Safari spegne la voce delle
  pagine web anche se gli eventi della sintesi partono normalmente. È la causa più comune. Alza anche il volume.
- Nella schermata **Voci** c'è **Prova l'audio**: premilo per sentire subito se la voce funziona.
  Se la voce proprio non parte, l'app lo scrive sotto i pulsanti invece di restare muta.
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
`copione-v2` in `sw.js` per costringere i telefoni a ricaricarli.

## Contenuto
```
index.html, style.css, app.js     l'app
parser.js                         legge il formato del copione (scene, personaggi, azioni)
pacing.js                         tempo di attesa dell'autoplay, calcolato dal testo
training.js                       modalità Mostra / Nascondi / Training, scelta delle parole nascoste
library.js                        copioni salvati nella memoria del telefono
sw.js, manifest.webmanifest       installazione e funzionamento offline
lib/                              pdf.js (Mozilla, licenza Apache 2.0) per leggere i PDF
icons/                            icona dell'app
tests/parser.test.js              test del parser:  node --test tests/parser.test.js
tests/features.test.js            test di autoplay, training e libreria:  node --test tests/features.test.js
```
