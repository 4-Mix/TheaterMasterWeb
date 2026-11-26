/*
 * Modalità Training: di ogni tua battuta si nascondono solo alcune parole.
 * La scelta dipende da un "seme": con lo stesso seme i buchi restano nello stesso posto
 * (lo schermo viene ridisegnato spesso), con un seme diverso cambiano a ogni prova.
 */
(function (root) {
  'use strict';

  // Le parole molto corte (il, di, è...) non si nascondono: non sono quelle difficili da ricordare.
  var MIN_LETTERS = 3;

  var LEVELS = {
    facile: { label: 'Facile', fraction: 0.25, showInitial: true, description: 'Un quarto delle parole nascosto, con l\'iniziale.' },
    medio: { label: 'Medio', fraction: 0.5, showInitial: true, description: 'Metà delle parole nascosta, con l\'iniziale.' },
    difficile: { label: 'Difficile', fraction: 0.75, showInitial: false, description: 'Tre quarti delle parole nascosto, senza iniziale.' }
  };

  var MODES = {
    mostra: { label: 'Mostra', description: 'Le tue battute sono sempre visibili.' },
    nascondi: { label: 'Nascondi', description: 'Le tue battute sono coperte finché non tocca a te.' },
    training: { label: 'Training', description: 'Di ogni tua battuta restano nascoste solo alcune parole: devi ricordarle.' }
  };

  function isLetter(ch) { return /[\p{L}\p{N}]/u.test(ch); }
  function letterCount(word) { return Array.from(word).filter(isLetter).length; }

  // Divide un testo in parole. Lo usano sia la scelta dei buchi sia il disegno della riga: gli indici coincidono.
  function words(text) {
    return String(text).trim().split(/\s+/).filter(function (w) { return w !== ''; });
  }

  // Le parole da pronunciare, nell'ordine; le azioni sono escluse.
  function speechWords(segments) {
    var out = [];
    segments.forEach(function (s) { if (s.type === 'speech') out = out.concat(words(s.text)); });
    return out;
  }

  // Seme per una riga: cambia da riga a riga, così non si nascondono sempre le stesse posizioni.
  function lineSeed(seed, lineIndex) {
    return (Math.imul(seed | 0, 1000003) + lineIndex) >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Indici (nella lista `list`) delle parole da nascondere. Almeno una, se ce n'è una adatta.
  function maskedIndices(list, levelKey, seed) {
    var level = LEVELS[levelKey] || LEVELS.medio;
    var eligible = [];
    list.forEach(function (w, i) { if (letterCount(w) >= MIN_LETTERS) eligible.push(i); });
    if (!eligible.length) return new Set();
    var count = Math.min(eligible.length, Math.max(1, Math.round(eligible.length * level.fraction)));
    var rnd = mulberry32(seed >>> 0);
    for (var i = eligible.length - 1; i > 0; i--) {       // mescolamento di Fisher-Yates
      var j = Math.floor(rnd() * (i + 1));
      var tmp = eligible[i]; eligible[i] = eligible[j]; eligible[j] = tmp;
    }
    return new Set(eligible.slice(0, count));
  }

  // "problema:" diventa "p_______:" (con l'iniziale) o "________:" (senza). La punteggiatura resta.
  function maskWord(word, showInitial) {
    var pending = !!showInitial;
    return Array.from(word).map(function (c) {
      if (!isLetter(c)) return c;
      if (pending) { pending = false; return c; }
      return '_';
    }).join('');
  }

  var api = {
    MIN_LETTERS: MIN_LETTERS, LEVELS: LEVELS, MODES: MODES,
    words: words, speechWords: speechWords, lineSeed: lineSeed,
    maskedIndices: maskedIndices, maskWord: maskWord
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Training = api;
})(typeof window !== 'undefined' ? window : globalThis);
