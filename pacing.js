/*
 * Autoplay: quanto tempo serve per dire una battuta.
 * Lo stesso calcolo della versione Android. Dipende dal testo: ogni parola, una pausa a fine frase
 * e una più breve alle virgole, un secondo per ogni azione tra parentesi e un respiro iniziale.
 */
(function (root) {
  'use strict';

  var MS_PER_WORD = 430;       // circa 140 parole al minuto: un ritmo da prova
  var SENTENCE_PAUSE_MS = 350;
  var COMMA_PAUSE_MS = 150;
  var ACTION_MS = 1000;
  var LEAD_IN_MS = 600;
  var MIN_MS = 1500;

  // Ritmo dell'autoplay: moltiplica il tempo stimato
  var SPEEDS = {
    calmo: { label: 'Calmo', factor: 1.35 },
    normale: { label: 'Normale', factor: 1 },
    veloce: { label: 'Veloce', factor: 0.75 }
  };

  function estimateMillis(spokenText, actionCount, speed) {
    var factor = (SPEEDS[speed] || SPEEDS.normale).factor;
    var text = spokenText || '';
    var words = text.split(/\s+/).filter(function (w) { return /[\p{L}\p{N}]/u.test(w); }).length;
    // "..." conta come una sola pausa, non tre
    var sentences = (text.match(/[.!?…]+/g) || []).length;
    var commas = (text.match(/[,;:]/g) || []).length;
    var base = LEAD_IN_MS + words * MS_PER_WORD + sentences * SENTENCE_PAUSE_MS +
      commas * COMMA_PAUSE_MS + (actionCount || 0) * ACTION_MS;
    return Math.max(MIN_MS, Math.round(base * factor));
  }

  // line: una riga del parser ({ spoken, segments })
  function estimateLine(line, speed) {
    var actions = line.segments.filter(function (s) { return s.type === 'action'; }).length;
    return estimateMillis(line.spoken, actions, speed);
  }

  var api = {
    SPEEDS: SPEEDS, MIN_MS: MIN_MS, ACTION_MS: ACTION_MS,
    estimateMillis: estimateMillis, estimateLine: estimateLine
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pacing = api;
})(typeof window !== 'undefined' ? window : globalThis);
