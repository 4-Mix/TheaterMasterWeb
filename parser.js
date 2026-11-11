/*
 * Parser del copione: trasforma il testo in personaggi, battute, azioni e scene.
 *
 * Formato:
 *   #SCENA 1 - TITOLO#                     inizio di una scena
 *   NOME: battuta (azione) altra battuta   i nomi sono in MAIUSCOLO
 *   (didascalia da sola)                   riga senza personaggio
 * Le righe senza "NOME:" continuano la battuta precedente (nel PDF le righe vanno a capo).
 */
(function (root) {
  'use strict';

  // Scrive una parola in modo che non conti maiuscolo/minuscolo: "scena" -> [sS][cC][eE]...
  function ci(word) {
    return word.split('').map(function (c) { return '[' + c.toLowerCase() + c.toUpperCase() + ']'; }).join('');
  }

  var NUM_WORDS = ['primo', 'secondo', 'terzo', 'quarto', 'quinto', 'unico', 'prima', 'seconda', 'terza',
    'quarta', 'quinta', 'sesta', 'settima', 'ottava', 'nona', 'decima', 'unica'];
  // Numeri ammessi dopo ATTO / SCENA: 1, 2 ... oppure I, II, III ... oppure primo, seconda ...
  var NUM = '(?:\\d+|[IVXLC]+|(?:' + NUM_WORDS.map(ci).join('|') + '))';
  var SCENE_WORD = '(?:' + ['scena', 'scene', 'quadro'].map(ci).join('|') + ')';
  var ACT_WORD = '(?:' + ['atto', 'act'].map(ci).join('|') + ')';

  // NOME: testo   (il nome non può contenere parentesi, due punti o #; deve essere in MAIUSCOLO)
  var LINE_START = /^\s*([^:()#\n]{1,40}?)\s*:\s*(.*)$/;
  var PARENTHESIS = /\(([^)]*)\)/g;
  // Scena segnata con i cancelletti: "#SCENA 1 - INTRO#". Il testo dopo il secondo # è una riga normale.
  var HASH_HEADING = /^#\s*([^#]+?)\s*#(.*)$/;
  // Altre forme senza cancelletti: "SCENA 2", "Scena II: La cucina", "ATTO I - SCENA 1", "[Atto primo]"
  var SCENE_HEADING = new RegExp(
    '^[\\s\\[(\\-–—=*#_]*(?:' +
    ACT_WORD + '\\s+' + NUM + '\\b(?:[\\s,.:;\\-–—]*' + SCENE_WORD + '\\s+' + NUM + '\\b)?' +
    '|' + SCENE_WORD + '\\s+' + NUM + '\\b)'
  );

  function trimChars(s, chars) {
    var start = 0;
    var end = s.length;
    while (start < end && chars.indexOf(s.charAt(start)) !== -1) start++;
    while (end > start && chars.indexOf(s.charAt(end - 1)) !== -1) end--;
    return s.slice(start, end);
  }

  // Un nome di personaggio è scritto tutto in MAIUSCOLO e contiene almeno una lettera.
  function isCharacterName(name) {
    return /\p{L}/u.test(name) && name === name.toUpperCase();
  }

  function cleanTitle(s) {
    return trimChars(s, ' -–—:.');
  }

  // Se la riga è l'intestazione di una scena (senza #) ritorna il titolo, altrimenti null.
  function headingTitle(line) {
    if (line.length > 80 || !SCENE_HEADING.test(line)) return null;
    return trimChars(line, ' []-–—=*#_');
  }

  function addHeading(headings, title, position, merge) {
    var last = headings.length ? headings[headings.length - 1] : null;
    if (merge && last && last.start === position) {
      // Due intestazioni di fila ("ATTO I" e poi "SCENA 1"): le unisco
      last.title = last.title + ' – ' + title;
    } else {
      headings.push({ title: title, start: position });
    }
  }

  function isOpenParenthesis(text) {
    var open = (text.match(/\(/g) || []).length;
    var close = (text.match(/\)/g) || []).length;
    return open > close;
  }

  // Divide "Ciao (sorride) come stai?" in [parlato, azione, parlato].
  function splitSegments(text) {
    var result = [];
    var cursor = 0;
    var m;
    PARENTHESIS.lastIndex = 0;
    while ((m = PARENTHESIS.exec(text)) !== null) {
      var before = text.slice(cursor, m.index).trim();
      if (before) result.push({ type: 'speech', text: before });
      var action = m[1].trim();
      if (action) result.push({ type: 'action', text: action });
      cursor = m.index + m[0].length;
    }
    var tail = text.slice(cursor).trim();
    if (tail) result.push({ type: 'speech', text: tail });
    return result;
  }

  function buildScenes(headings, lines) {
    var total = lines.length;
    if (!headings.length) return [{ title: 'Tutto il copione', startLine: 0, endLine: total, size: total }];

    var scenes = [];
    // Quello che sta prima della prima intestazione diventa la scena "Inizio",
    // ma solo se contiene davvero delle battute (non il frontespizio).
    var firstStart = headings[0].start;
    if (firstStart > 0 && lines.slice(0, firstStart).some(function (l) { return l.character !== null; })) {
      scenes.push({ title: 'Inizio', startLine: 0, endLine: firstStart, size: firstStart });
    }
    headings.forEach(function (hd, i) {
      var end = i + 1 < headings.length ? headings[i + 1].start : total;
      if (end > hd.start) scenes.push({ title: hd.title, startLine: hd.start, endLine: end, size: end - hd.start });
    });
    return scenes.length ? scenes : [{ title: 'Tutto il copione', startLine: 0, endLine: total, size: total }];
  }

  function parse(raw) {
    var blocks = [];   // { character: string|null, text: string }
    var headings = []; // { title, start }  start = indice della prima riga della scena

    raw.split(/\r\n|\r|\n/).forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line) return;

      // Prima di tutto controllo se è l'intestazione di una scena
      var hash = HASH_HEADING.exec(line);
      if (hash) {
        addHeading(headings, cleanTitle(hash[1]), blocks.length, false);
        line = hash[2].trim();
        if (!line) return;
      } else {
        var title = headingTitle(line);
        if (title !== null) {
          addHeading(headings, title, blocks.length, true);
          return;
        }
      }

      var m = LINE_START.exec(line);
      var match = m && isCharacterName(m[1]) ? m : null;
      var last = blocks.length ? blocks[blocks.length - 1] : null;

      // Una battuta non può continuare attraverso l'inizio di una nuova scena
      var canContinue = blocks.length > 0 &&
        (headings.length === 0 || headings[headings.length - 1].start < blocks.length);

      if (match) {
        blocks.push({ character: match[1].trim().toUpperCase(), text: match[2] });
      } else if (line.charAt(0) === '(' &&
        (!canContinue || (last.character !== null && !isOpenParenthesis(last.text)))) {
        // Riga senza "NOME:" che inizia con "(" => didascalia a sé
        blocks.push({ character: null, text: line });
      } else if (canContinue) {
        // Altrimenti è la continuazione della battuta precedente
        last.text += ' ' + line;
      } else {
        blocks.push({ character: null, text: line });
      }
    });

    var lines = blocks.map(function (b, i) {
      var segments = splitSegments(b.text);
      return {
        index: i,
        character: b.character,
        segments: segments,
        // Solo il testo da pronunciare, senza le azioni
        spoken: segments.filter(function (s) { return s.type === 'speech'; })
          .map(function (s) { return s.text.trim(); }).join(' ').replace(/\s+/g, ' ').trim()
      };
    });

    var characters = [];
    lines.forEach(function (l) {
      if (l.character !== null && characters.indexOf(l.character) === -1) characters.push(l.character);
    });

    return { lines: lines, scenes: buildScenes(headings, lines), characters: characters };
  }

  // Indici (nella lista `lines`) delle righe che fanno parte delle scene scelte, in ordine.
  function activeIndices(script, selected) {
    var out = [];
    script.scenes.forEach(function (scene, i) {
      if (!selected.has(i)) return;
      for (var k = scene.startLine; k < scene.endLine; k++) out.push(k);
    });
    return out;
  }

  var api = { parse: parse, activeIndices: activeIndices, splitSegments: splitSegments };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScriptParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
