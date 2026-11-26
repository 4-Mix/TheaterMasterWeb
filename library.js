/*
 * Libreria dei copioni salvati nella memoria del telefono.
 * Funziona con qualsiasi "storage" che abbia getItem/setItem/removeItem (localStorage nel browser,
 * un oggetto finto nei test). Il testo di ogni copione sta in una chiave sua; l'elenco in un'altra.
 */
(function (root) {
  'use strict';

  // Impronta del testo (cyrb53): serve a non salvare due volte lo stesso copione.
  function hashText(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + '-' + str.length;
  }

  function createLibrary(storage, prefix) {
    prefix = prefix || 'copione.lib.';
    var INDEX = prefix + 'index';

    function textKey(id) { return prefix + 't.' + id; }

    function readIndex() {
      try {
        var raw = storage.getItem(INDEX);
        var arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr)) return [];
        return arr.filter(function (e) {
          return e && typeof e.id === 'string' && typeof e.title === 'string' && storage.getItem(textKey(e.id)) !== null;
        });
      } catch (e) { return []; }
    }

    function writeIndex(arr) { storage.setItem(INDEX, JSON.stringify(arr)); }

    function newId() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    // Dal più recente al meno recente (ultimo aperto per primo)
    function list() {
      return readIndex().sort(function (a, b) { return (b.openedAt || 0) - (a.openedAt || 0); });
    }

    // Salva un copione. Se lo stesso testo c'è già, non lo duplica: lo segna come appena aperto.
    // Può lanciare un errore se la memoria è piena.
    function save(title, text, summary, now) {
      now = now || Date.now();
      var hash = hashText(text);
      var all = readIndex();
      var found = all.filter(function (e) { return e.hash === hash; })[0];
      if (found) {
        found.openedAt = now;
        writeIndex(all);
        return found;
      }
      var entry = {
        id: newId(), title: title || 'Copione', summary: summary || '',
        addedAt: now, openedAt: now, lastCharacter: null, hash: hash
      };
      storage.setItem(textKey(entry.id), text);
      try {
        all.push(entry);
        writeIndex(all);
      } catch (e) {
        try { storage.removeItem(textKey(entry.id)); } catch (e2) { /* niente */ }
        throw e;
      }
      return entry;
    }

    function readText(id) {
      try { return storage.getItem(textKey(id)); } catch (e) { return null; }
    }

    function markOpened(id, character, now) {
      var all = readIndex();
      var e = all.filter(function (x) { return x.id === id; })[0];
      if (!e) return;
      e.openedAt = now || Date.now();
      if (character !== undefined) e.lastCharacter = character;
      writeIndex(all);
    }

    function remove(id) {
      var all = readIndex().filter(function (e) { return e.id !== id; });
      writeIndex(all);
      try { storage.removeItem(textKey(id)); } catch (e) { /* niente */ }
    }

    return { list: list, save: save, readText: readText, markOpened: markOpened, remove: remove };
  }

  var api = { createLibrary: createLibrary, hashText: hashText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CopioneLibrary = api;
})(typeof window !== 'undefined' ? window : globalThis);
