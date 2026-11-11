/* Impara il copione: logica dell'app (nessuna dipendenza oltre a pdf.js e parser.js) */
(function () {
  'use strict';

  var Parser = window.ScriptParser;
  var synth = 'speechSynthesis' in window ? window.speechSynthesis : null;

  // ---------------------------------------------------------------- utilità

  function $(sel) { return document.querySelector(sel); }

  // Crea un elemento. Il testo va sempre inserito come testo (mai come HTML): il PDF è un input esterno.
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
        else if (k === 'checked' || k === 'disabled' || k === 'value') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) appendKids(el, arguments[i]);
    return el;
  }

  function appendKids(el, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { appendKids(el, k); }); return; }
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }

  var LS = {
    get: function (key, fallback) {
      try {
        var v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    }
  };

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // ---------------------------------------------------------------- stato

  var state = {
    view: 'import',            // import | characters | rehearsal
    script: null,
    title: '',
    mine: null,
    selected: new Set(),       // indici delle scene scelte
    current: 0,                // indice della riga in corso
    playing: false,
    waiting: false,            // tocca a me
    hint: false,
    hideMine: LS.get('copione.hide', true),
    voices: LS.get('copione.voices', {}),   // { NOME: { gender: 'donna'|'uomo', voice: voiceURI|null } }
    rate: LS.get('copione.rate', 1),
    loading: false,
    error: ''
  };

  var ui = null;                // riferimenti agli elementi della schermata di prova
  var runId = 0;                // cambia a ogni pausa: ferma il ciclo di prova in corso
  var userResolve = null;

  var SAMPLE = [
    '#SCENA 1 - IL PROVINO#',
    '',
    "(Un teatro vuoto. Sul palco c'è una sola sedia.)",
    '',
    'REGISTA: Benvenuta! Si accomodi pure, (indica la sedia) il provino comincia subito.',
    'LAURA: Grazie. (si siede, un po\' nervosa) Devo dire il monologo?',
    'REGISTA: Prima una domanda: perché vuole fare l\'attrice?',
    'LAURA: Perché sul palco, per qualche minuto, posso essere chiunque.',
    'REGISTA: Risposta ottima. Ora, il testo!',
    '',
    '#SCENA 2 - IL MONOLOGO#',
    '',
    'LAURA: (si alza, respira) Signori, vi chiedo un istante di silenzio.',
    'REGISTA: Più piano, Laura. Lo senta nello stomaco, non lo urli.',
    'LAURA: (abbassa la voce) Signori... un istante di silenzio.',
    'ELENA: (entra dal fondo) Scusate il ritardo! Ho perso la parte?',
    'REGISTA: Per fortuna no. Sedetevi entrambe: ricominciamo da capo.'
  ].join('\n');

  // ---------------------------------------------------------------- lettura del PDF

  // Ricostruisce le righe di una pagina dalle posizioni dei pezzi di testo.
  function itemsToLines(items) {
    var pieces = items
      .filter(function (it) { return typeof it.str === 'string' && it.str.trim() !== ''; })
      .map(function (it) {
        return { s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0, h: it.height || 10 };
      });
    pieces.sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });

    var rows = [];
    var cur = null;
    pieces.forEach(function (p) {
      if (!cur || Math.abs(cur.y - p.y) > 3) {
        cur = { y: p.y, items: [] };
        rows.push(cur);
      }
      cur.items.push(p);
    });

    return rows.map(function (row) {
      row.items.sort(function (a, b) { return a.x - b.x; });
      var out = '';
      var prev = null;
      row.items.forEach(function (p) {
        if (prev) {
          var gap = p.x - (prev.x + prev.w);
          if (gap > p.h * 0.15 && !/\s$/.test(out) && !/^\s/.test(p.s)) out += ' ';
        }
        out += p.s;
        prev = p;
      });
      return out.trim();
    });
  }

  function pdfToText(file) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    return file.arrayBuffer().then(function (buf) {
      return window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
    }).then(function (pdf) {
      var chain = Promise.resolve([]);
      var pages = [];
      var _loop = function (n) {
        chain = chain.then(function () {
          return pdf.getPage(n).then(function (page) { return page.getTextContent(); })
            .then(function (tc) { pages.push(itemsToLines(tc.items)); });
        });
      };
      for (var n = 1; n <= pdf.numPages; n++) _loop(n);
      return chain.then(function () {
        // Via le righe che sono solo un numero (numeri di pagina)
        return [].concat.apply([], pages)
          .filter(function (l) { return !/^\d{1,4}$/.test(l.trim()); })
          .join('\n');
      });
    });
  }

  function loadFile(file) {
    state.loading = true;
    state.error = '';
    render();
    var isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    var reading = isPdf ? pdfToText(file) : file.text();
    reading.then(function (text) {
      state.loading = false;
      openScript(text, file.name.replace(/\.[^.]+$/, ''));
    }).catch(function (e) {
      state.loading = false;
      state.error = 'Non riesco a leggere il file (' + (e && e.message ? e.message : e) + '). Prova con un altro PDF.';
    }).then(render);
  }

  // Analizza il testo e passa alla scelta del personaggio. Ritorna false se non trova battute.
  function openScript(text, title) {
    var script = Parser.parse(text);
    if (!script.characters.length) {
      state.error = 'Non ho trovato battute nel formato NOME: testo. ' +
        'Se il PDF è una scansione (foto delle pagine) il testo non si può leggere: incolla il testo qui sotto.';
      return false;
    }
    state.error = '';
    state.script = script;
    state.title = title || 'Copione';
    state.mine = null;
    state.selected = new Set(script.scenes.map(function (_, i) { return i; }));
    state.current = firstActive();
    state.view = 'characters';
    LS.set('copione.last', { title: state.title, text: text });
    return true;
  }

  function firstActive() {
    var a = Parser.activeIndices(state.script, state.selected);
    return a.length ? a[0] : 0;
  }

  // ---------------------------------------------------------------- voci

  var allVoices = [];

  function loadVoices() {
    var list = synth ? synth.getVoices() : [];
    allVoices = list.filter(function (v) { return /^it([-_]|$)/i.test(v.lang); });
  }

  // Le voci non dicono se sono maschili o femminili: riconosco quelle più comuni dal nome.
  var FEMALE = ['alice', 'federica', 'paola', 'elsa', 'isabella', 'lucia', 'silvia'];
  var MALE = ['luca', 'diego', 'cosimo', 'giorgio', 'marco', 'benigno'];

  function voiceGender(v) {
    var n = v.name.toLowerCase();
    if (FEMALE.some(function (f) { return n.indexOf(f) !== -1; })) return 'donna';
    if (MALE.some(function (m) { return n.indexOf(m) !== -1; })) return 'uomo';
    return null;
  }

  var MALE_NAMES_IN_A = ['LUCA', 'ANDREA', 'NICOLA', 'GIANLUCA', 'ELIA', 'MATTIA'];

  // Un'ipotesi iniziale: i nomi italiani che finiscono per "A" sono di solito femminili.
  function guessGender(name) {
    var first = name.trim().split(/\s+/)[0];
    return /A$/.test(first) && MALE_NAMES_IN_A.indexOf(first) === -1 ? 'donna' : 'uomo';
  }

  function voiceSetting(name) {
    return state.voices[name] || { gender: guessGender(name), voice: null };
  }

  function saveVoice(name, setting) {
    state.voices[name] = setting;
    LS.set('copione.voices', state.voices);
  }

  var WOMEN_PITCH = [1.15, 1.3, 1.05, 1.22];
  var MEN_PITCH = [0.85, 0.75, 0.95, 0.8];

  // Sceglie voce e tono per un personaggio.
  function pickVoice(name) {
    var s = voiceSetting(name);
    var idx = Math.max(0, state.script ? state.script.characters.indexOf(name) : 0);
    var base = (s.gender === 'donna' ? WOMEN_PITCH : MEN_PITCH)[idx % 4];

    if (s.voice) {
      var chosen = allVoices.filter(function (v) { return v.voiceURI === s.voice; })[0];
      if (chosen) return { voice: chosen, pitch: 1 };
    }
    var pool = allVoices.filter(function (v) { return voiceGender(v) === s.gender; });
    if (pool.length) return { voice: pool[idx % pool.length], pitch: 1 + (base - 1) * 0.4 };

    var fallback = allVoices.filter(function (v) { return v.default; })[0] || allVoices[0] || null;
    return { voice: fallback, pitch: base };
  }

  // iOS permette di parlare solo dopo un gesto dell'utente: con questa "sblocco" la prima volta.
  var unlocked = false;
  function unlockSpeech() {
    if (!synth || unlocked) return;
    unlocked = true;
    try {
      var u = new SpeechSynthesisUtterance('');
      u.volume = 0;
      synth.speak(u);
    } catch (e) { /* niente */ }
  }

  // Spezza il testo in frasi: i testi lunghi in un colpo solo a volte si interrompono.
  function chunks(text) {
    var parts = text.match(/[^.!?…]+[.!?…]*\s*/g) || [text];
    var out = [];
    var cur = '';
    parts.forEach(function (p) {
      if ((cur + p).length > 180 && cur) { out.push(cur.trim()); cur = p; } else { cur += p; }
    });
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  var keepAlive = null; // tiene un riferimento all'ultima frase: evita che il browser la scarti

  function speakChunk(text, voice, pitch) {
    return new Promise(function (resolve) {
      if (!synth) { resolve(); return; }
      var u = new SpeechSynthesisUtterance(text);
      u.lang = voice ? voice.lang : 'it-IT';
      if (voice) u.voice = voice;
      u.pitch = pitch;
      u.rate = state.rate;
      var done = false;
      var timer = null;
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      }
      u.onend = finish;
      u.onerror = finish;
      // Rete di sicurezza: su alcuni telefoni "fine frase" a volte non arriva mai.
      timer = setTimeout(finish, 4000 + text.length * 180);
      keepAlive = u;
      synth.speak(u);
    });
  }

  function speakLine(line, myRun) {
    var pick = pickVoice(line.character);
    var parts = chunks(line.spoken);
    var chain = Promise.resolve();
    parts.forEach(function (part) {
      chain = chain.then(function () {
        if (myRun !== runId) return null;
        return speakChunk(part, pick.voice, pick.pitch);
      });
    });
    return chain;
  }

  function preview(name) {
    pause();
    unlockSpeech();
    loadVoices();
    var pick = pickVoice(name);
    var nice = name.charAt(0) + name.slice(1).toLowerCase();
    setTimeout(function () {
      speakChunk('Ciao, sono ' + nice + '. Questa è la mia voce.', pick.voice, pick.pitch);
    }, 150);
  }

  // ---------------------------------------------------------------- schermo sempre acceso

  var wake = null;
  function requestWake() {
    try {
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(function (l) { wake = l; }).catch(function () {});
      }
    } catch (e) { /* niente */ }
  }
  function releaseWake() {
    try { if (wake) wake.release(); } catch (e) { /* niente */ }
    wake = null;
  }

  // ---------------------------------------------------------------- prova a battute

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function waitForUser() {
    state.waiting = true;
    renderControls();
    return new Promise(function (resolve) { userResolve = resolve; });
  }

  function start() {
    if (!state.script || !state.mine || state.playing) return;
    unlockSpeech();
    loadVoices();
    var active = Parser.activeIndices(state.script, state.selected);
    if (!active.length) return;

    var myRun = ++runId;
    state.playing = true;
    state.error = '';
    requestWake();
    renderControls();

    var pos = -1;
    for (var k = 0; k < active.length; k++) { if (active[k] >= state.current) { pos = k; break; } }
    if (pos < 0) pos = 0;

    function step() {
      if (myRun !== runId) return;
      if (pos >= active.length) {
        state.playing = false;
        state.waiting = false;
        releaseWake();
        setCurrent(active[0]);
        renderControls();
        return;
      }
      var i = active[pos];
      var line = state.script.lines[i];
      setCurrent(i);

      var turn;
      if (line.character === null) turn = sleep(700);
      else if (line.character === state.mine) turn = waitForUser();
      else if (line.spoken) turn = speakLine(line, myRun);
      else turn = Promise.resolve();

      turn.then(function () {
        if (myRun !== runId) return;
        state.waiting = false;
        pos++;
        step();
      });
    }
    step();
  }

  function userDone() {
    if (!userResolve) return;
    var r = userResolve;
    userResolve = null;
    state.waiting = false;
    renderControls();
    r();
  }

  function showHint() {
    state.hint = true;
    paintLine(state.current);
  }

  function pause() {
    runId++;
    if (synth) { try { synth.cancel(); } catch (e) { /* niente */ } }
    if (userResolve) { var r = userResolve; userResolve = null; r(); }
    state.playing = false;
    state.waiting = false;
    releaseWake();
    renderControls();
  }

  function jumpTo(i) {
    pause();
    setCurrent(i);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.playing) pause();
  });

  // ---------------------------------------------------------------- disegno delle righe

  function paintLine(i) {
    if (!ui) return;
    var el = ui.lineEls[i];
    if (!el) return;
    var line = state.script.lines[i];
    var isMine = line.character !== null && line.character === state.mine;
    var isCur = i === state.current;
    var hidden = state.hideMine && isMine && i >= state.current && !(isCur && state.hint);

    el.className = 'line' + (line.character === null ? ' stage' : '') + (isMine ? ' mine' : '') + (isCur ? ' current' : '');
    if (isCur) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');

    var body = h('div', { class: 'text' });
    if (hidden) {
      body.append(h('span', { class: 'veil', text: '••••••••  la tua battuta' }));
    } else {
      line.segments.forEach(function (seg, k) {
        if (k) body.append(' ');
        if (seg.type === 'action') body.append(h('span', { class: 'action', text: '(' + seg.text + ')' }));
        else body.append(seg.text);
      });
    }
    el.replaceChildren();
    if (line.character !== null) el.append(h('div', { class: 'who', text: line.character }));
    el.append(body);
  }

  function paintAll() {
    if (!ui) return;
    Object.keys(ui.lineEls).forEach(function (i) { paintLine(Number(i)); });
  }

  function setCurrent(i) {
    var prev = state.current;
    state.current = i;
    state.hint = false;
    if (!ui) return;
    var touched = new Set([prev, i].concat(ui.mineIdx));
    touched.forEach(paintLine);
    var el = ui.lineEls[i];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // ---------------------------------------------------------------- schermate

  function importView() {
    var fileInput = h('input', {
      type: 'file',
      accept: 'application/pdf,.pdf,text/plain,.txt',
      class: 'sr-only',
      onchange: function (e) {
        var f = e.target.files && e.target.files[0];
        if (f) loadFile(f);
        e.target.value = '';
      }
    });
    var area = h('textarea', { rows: '7', placeholder: 'Incolla qui il testo del copione' });
    var last = LS.get('copione.last', null);

    var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    var standalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

    return h('div', { class: 'view' },
      h('div', { class: 'scroll' },
        h('img', { class: 'logo', src: 'icons/icon-192.png', alt: '', width: '64', height: '64' }),
        h('h2', { text: 'Impara il copione' }),
        h('p', { class: 'lead', text: 'Carica il copione in PDF, scegli il tuo personaggio: la voce del telefono legge le battute degli altri e aspetta le tue.' }),
        h('div', { class: 'stack' },
          state.loading
            ? h('div', { class: 'spinner', role: 'status', 'aria-label': 'Sto leggendo il PDF' })
            : h('label', { class: 'btn primary block' }, 'Scegli il PDF', fileInput),
          state.error ? h('p', { class: 'error', role: 'alert', text: state.error }) : null,
          last && !state.loading
            ? h('button', {
              class: 'btn block', type: 'button', onclick: function () { openScript(last.text, last.title); render(); }
            }, 'Riapri “' + last.title + '”')
            : null,
          h('details', { class: 'paste' },
            h('summary', { text: 'Incolla il testo' }),
            area,
            h('div', { style: 'height:10px' }),
            h('button', {
              class: 'btn block', type: 'button', onclick: function () {
                if (area.value.trim()) { openScript(area.value, 'Testo incollato'); render(); }
              }
            }, 'Usa questo testo')
          ),
          h('button', {
            class: 'btn plain block', type: 'button', onclick: function () { openScript(SAMPLE, 'Il provino (esempio)'); render(); }
          }, 'Prova con un esempio')
        ),
        isIOS && !standalone
          ? h('p', { class: 'tip', text: 'Per averla come app: tocca Condividi in Safari, poi “Aggiungi alla schermata Home”.' })
          : null,
        h('p', { class: 'tip', text: 'Il PDF viene letto sul telefono e non viene caricato su nessun server.' })
      )
    );
  }

  function selectCharacter(name) {
    state.mine = name;
    state.current = firstActive();
    state.view = 'rehearsal';
    render();
  }

  function charactersView() {
    var s = state.script;
    var counts = {};
    s.lines.forEach(function (l) { if (l.character) counts[l.character] = (counts[l.character] || 0) + 1; });
    // i personaggi con più battute stanno in alto; gli errori di lettura (pochissime battute) in fondo
    var names = s.characters.slice().sort(function (a, b) { return counts[b] - counts[a]; });

    return h('div', { class: 'view' },
      h('div', { class: 'scroll' },
        h('h2', { text: 'Chi sei?' }),
        h('p', {
          class: 'lead',
          text: plural(names.length, 'personaggio', 'personaggi') + ', ' + plural(s.lines.length, 'riga', 'righe') +
            (s.scenes.length > 1 ? ', ' + plural(s.scenes.length, 'scena', 'scene') : '')
        }),
        h('div', { class: 'chars' }, names.map(function (n) {
          return h('button', { class: 'char', type: 'button', onclick: function () { selectCharacter(n); } },
            h('span', { class: 'name', text: n }),
            h('span', { class: 'count', text: plural(counts[n], 'battuta', 'battute') })
          );
        }))
      )
    );
  }

  function rehearsalView() {
    var s = state.script;
    ui = { lineEls: {}, mineIdx: [], list: null, controls: null };

    var list = h('div', { class: 'lines', role: 'list' });
    s.scenes.forEach(function (scene, si) {
      if (!state.selected.has(si)) return;
      if (s.scenes.length > 1) list.append(h('h3', { class: 'scene-title', text: scene.title }));
      for (var i = scene.startLine; i < scene.endLine; i++) {
        (function (idx) {
          var div = h('div', { role: 'listitem', onclick: function () { jumpTo(idx); } });
          ui.lineEls[idx] = div;
          if (s.lines[idx].character === state.mine) ui.mineIdx.push(idx);
          list.append(div);
        })(i);
      }
    });
    ui.list = list;
    ui.controls = h('div', { class: 'controls' });

    var hide = h('input', {
      type: 'checkbox',
      checked: state.hideMine,
      onchange: function (e) {
        state.hideMine = e.target.checked;
        LS.set('copione.hide', state.hideMine);
        paintAll();
      }
    });

    var buttons = [];
    if (s.scenes.length > 1) {
      buttons.push(h('button', { class: 'btn small', type: 'button', onclick: openScenes },
        'Scene (' + state.selected.size + '/' + s.scenes.length + ')'));
    }
    buttons.push(h('button', { class: 'btn small', type: 'button', onclick: openVoices }, 'Voci'));

    var view = h('div', { class: 'view' },
      h('div', { class: 'toolbar' },
        h('div', { class: 'me' },
          h('div', { class: 'who-am-i' }, 'Sei ', h('strong', { text: state.mine })),
          h('button', { class: 'btn plain small', type: 'button', onclick: goBack }, 'Cambia')
        ),
        h('div', { class: 'row' }, buttons)
      ),
      h('label', { class: 'check' }, hide, 'Nascondi le mie battute'),
      list,
      ui.controls
    );

    paintAll();
    renderControls();
    requestAnimationFrame(function () {
      var el = ui && ui.lineEls[state.current];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    });
    return view;
  }

  function renderControls() {
    if (!ui || !ui.controls) return;
    var c = ui.controls;
    c.replaceChildren();
    if (ui.list) ui.list.classList.toggle('live', state.playing);

    if (state.error) c.append(h('p', { class: 'error', role: 'alert', text: state.error }));
    if (state.waiting) {
      c.append(
        h('p', { class: 'your-turn', text: 'Tocca a te!' }),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: userDone }, 'Fatto, avanti'),
          h('button', { class: 'btn', type: 'button', onclick: showHint }, 'Suggerimento')
        )
      );
    }
    if (state.playing) {
      c.append(h('button', { class: 'btn block', type: 'button', onclick: pause }, 'Pausa'));
    } else {
      c.append(h('button', { class: 'btn primary block', type: 'button', onclick: start }, 'Avvia o riprendi la prova'));
    }
  }

  // ---------------------------------------------------------------- scene

  function closeOverlay(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function openScenes() {
    pause();
    var s = state.script;
    var temp = new Set(state.selected);
    var boxes = [];
    var ok = h('button', { class: 'btn primary', type: 'button' }, 'Conferma');

    var overlay = h('div', { class: 'backdrop', onclick: function (e) { if (e.target === overlay) closeOverlay(overlay); } });

    function sync() {
      ok.disabled = temp.size === 0;
      boxes.forEach(function (b, i) { b.checked = temp.has(i); });
    }

    var rows = s.scenes.map(function (scene, i) {
      var mine = s.lines.slice(scene.startLine, scene.endLine).filter(function (l) { return l.character === state.mine; }).length;
      var cb = h('input', {
        type: 'checkbox',
        checked: temp.has(i),
        onchange: function (e) { if (e.target.checked) temp.add(i); else temp.delete(i); sync(); }
      });
      boxes.push(cb);
      return h('label', { class: 'scene-row' }, cb,
        h('span', {},
          h('span', { class: 't', text: scene.title }),
          h('span', { class: 's', text: plural(scene.size, 'riga', 'righe') + ', tue: ' + mine })
        )
      );
    });

    ok.addEventListener('click', function () {
      if (!temp.size) return;
      closeOverlay(overlay);
      state.selected = temp;
      state.current = firstActive();
      render();
    });

    overlay.append(h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Scegli le scene' },
      h('div', { class: 'sheet-head' },
        h('h3', { text: 'Scegli le scene' }),
        h('span', {},
          h('button', {
            class: 'btn plain small', type: 'button',
            onclick: function () { temp = new Set(s.scenes.map(function (_, i) { return i; })); sync(); }
          }, 'Tutte'),
          h('button', {
            class: 'btn plain small', type: 'button',
            onclick: function () { temp = new Set(); sync(); }
          }, 'Nessuna')
        )
      ),
      h('div', { class: 'sheet-body' }, rows),
      h('div', { class: 'sheet-foot' },
        h('button', { class: 'btn', type: 'button', onclick: function () { closeOverlay(overlay); } }, 'Annulla'),
        ok
      )
    ));
    document.body.append(overlay);
    sync();
  }

  // ---------------------------------------------------------------- voci

  function openVoices() {
    pause();
    loadVoices();
    var s = state.script;
    var others = s.characters.filter(function (n) { return n !== state.mine; });

    var panel = h('div', { class: 'panel', role: 'dialog', 'aria-label': 'Voci dei personaggi' });
    var list = h('div', {});

    function draw() {
      list.replaceChildren();
      others.forEach(function (name) { list.append(voiceCard(name)); });
    }

    function voiceCard(name) {
      var setting = voiceSetting(name);
      var genderBtn = function (label, value) {
        return h('button', {
          class: 'btn small' + (setting.gender === value ? ' active' : ''),
          type: 'button',
          'aria-pressed': setting.gender === value ? 'true' : 'false',
          onclick: function () { saveVoice(name, { gender: value, voice: null }); draw(); }
        }, label);
      };

      var card = h('section', { class: 'voice' },
        h('h4', { text: name }),
        h('div', { class: 'row' },
          genderBtn('Donna', 'donna'),
          genderBtn('Uomo', 'uomo'),
          h('button', { class: 'btn small', type: 'button', onclick: function () { preview(name); } }, 'Ascolta')
        )
      );

      if (allVoices.length > 1) {
        var select = h('select', {
          'aria-label': 'Voce di ' + name,
          onchange: function (e) { saveVoice(name, { gender: setting.gender, voice: e.target.value || null }); }
        }, h('option', { value: '', text: 'Voce automatica' }),
          allVoices.map(function (v) {
            return h('option', { value: v.voiceURI, text: v.name + (v.localService ? '' : ' (online)') });
          })
        );
        select.value = setting.voice || '';
        card.append(select);
      }
      return card;
    }

    var rateLabel = h('label', { for: 'rate', text: 'Velocità della voce: ' + state.rate.toFixed(2) + '×' });
    var rate = h('input', {
      id: 'rate', type: 'range', min: '0.6', max: '1.4', step: '0.05',
      oninput: function (e) {
        state.rate = Number(e.target.value);
        LS.set('copione.rate', state.rate);
        rateLabel.textContent = 'Velocità della voce: ' + state.rate.toFixed(2) + '×';
      }
    });
    rate.value = String(state.rate);

    draw();
    panel.append(
      h('div', { id: 'panel-top', class: 'panel-top', style: 'background:var(--curtain);color:#fff;display:flex;align-items:center;justify-content:space-between;padding:env(safe-area-inset-top) 16px 0 16px;min-height:calc(56px + env(safe-area-inset-top))' },
        h('h3', { style: 'margin:0;font:600 20px var(--serif)', text: 'Voci' }),
        h('button', { class: 'top-btn', type: 'button', onclick: function () { pause(); closeOverlay(panel); } }, 'Fatto')
      ),
      h('div', { class: 'scroll' },
        allVoices.length === 0
          ? h('p', { class: 'note', text: 'Su questo telefono non trovo voci italiane. Su iPhone: Impostazioni, Accessibilità, Contenuto letto, Voci, Italiano. Intanto Donna e Uomo cambiano solo il tono.' })
          : h('p', { class: 'note', text: 'Donna e Uomo scelgono una voce adatta e ne regolano il tono. Con più voci italiane installate puoi sceglierne una a mano: premi Ascolta per provarla.' }),
        h('div', { class: 'field' }, rateLabel, rate),
        list
      )
    );
    document.body.append(panel);
  }

  // ---------------------------------------------------------------- navigazione

  function goBack() {
    if (state.view === 'rehearsal') {
      pause();
      state.mine = null;
      state.view = 'characters';
    } else if (state.view === 'characters') {
      state.view = 'import';
      state.script = null;
    }
    render();
  }

  function render() {
    var view = $('#view');
    view.replaceChildren();
    ui = null;
    $('#back').hidden = state.view === 'import';
    $('#title').textContent = state.view === 'import' ? 'Impara il copione' : (state.title || 'Copione');

    if (state.view === 'import') view.append(importView());
    else if (state.view === 'characters') view.append(charactersView());
    else view.append(rehearsalView());
  }

  // ---------------------------------------------------------------- avvio

  $('#back').addEventListener('click', goBack);

  if (synth) {
    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }

  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* l'app funziona anche senza */ });
    });
  }
})();
