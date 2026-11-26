// Esegui con:  node --test tests/features.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../parser.js');
const Pacing = require('../pacing.js');
const T = require('../training.js');
const { createLibrary, hashText } = require('../library.js');

// ---------------------------------------------------------------- Pacing
test('pacing: testo vuoto usa il minimo', () => {
  assert.equal(Pacing.estimateMillis('', 0, 'normale'), Pacing.MIN_MS);
});
test('pacing: frase corta = 600 + 3*430 + 350', () => {
  assert.equal(Pacing.estimateMillis('Ciao a tutti.', 0, 'normale'), 2240);
});
test('pacing: la virgola aggiunge 150', () => {
  assert.equal(Pacing.estimateMillis('Ciao, a tutti.', 0, 'normale'), 2390);
});
test('pacing: i puntini contano una volta', () => {
  assert.equal(Pacing.estimateMillis('Ah...', 0, 'normale'), Pacing.estimateMillis('Ah.', 0, 'normale'));
});
test('pacing: ogni azione aggiunge un secondo', () => {
  assert.equal(Pacing.estimateMillis('Ciao a tutti.', 1, 'normale') - Pacing.estimateMillis('Ciao a tutti.', 0, 'normale'), 1000);
});
test('pacing: più testo, più tempo', () => {
  assert.ok(Pacing.estimateMillis('Essere o non essere, questo è il problema: se sia più nobile tollerare.', 0, 'normale') >
    Pacing.estimateMillis('Sì.', 0, 'normale'));
});
test('pacing: il ritmo cambia il tempo, calmo > normale > veloce', () => {
  const t = 'Dormire, forse sognare. Ah, questo è il problema.';
  const c = Pacing.estimateMillis(t, 0, 'calmo'), n = Pacing.estimateMillis(t, 0, 'normale'), v = Pacing.estimateMillis(t, 0, 'veloce');
  assert.ok(c > n && n > v);
});
test('pacing: ritmo sconosciuto = normale', () => {
  assert.equal(Pacing.estimateMillis('Ciao a tutti.', 0, 'boh'), 2240);
});
test('pacing: estimateLine conta le azioni della riga', () => {
  const s = P.parse('LAURA: (sorride) Che bello vederti, Marco!');
  const line = s.lines[0];
  assert.equal(Pacing.estimateLine(line, 'normale'), Pacing.estimateMillis('Che bello vederti, Marco!', 1, 'normale'));
});

// ---------------------------------------------------------------- Training
test('training: words divide sugli spazi', () => {
  assert.deepEqual(T.words('  Ciao   a tutti. '), ['Ciao', 'a', 'tutti.']);
});
test('training: le parole corte non si nascondono', () => {
  const w = ['il', 'cane', 'è', 'qui'];
  const m = T.maskedIndices(w, 'difficile', 1);
  for (const i of m) assert.ok(T.words(w[i]).length && [1, 3].includes(i));
});
test('training: stesso seme = stessi buchi; semi diversi cambiano', () => {
  const w = 'Essere o non essere questo è il problema se sia più nobile tollerare le percosse'.split(' ');
  assert.deepEqual([...T.maskedIndices(w, 'medio', 42)], [...T.maskedIndices(w, 'medio', 42)]);
  const seen = new Set();
  for (let s = 0; s < 30; s++) seen.add([...T.maskedIndices(w, 'medio', s)].sort().join(','));
  assert.ok(seen.size > 5);
});
test('training: i livelli nascondono la quota giusta, almeno una', () => {
  const w = Array.from({ length: 20 }, (_, i) => 'parola' + i);
  assert.equal(T.maskedIndices(w, 'facile', 7).size, 5);
  assert.equal(T.maskedIndices(w, 'medio', 7).size, 10);
  assert.equal(T.maskedIndices(w, 'difficile', 7).size, 15);
  assert.equal(T.maskedIndices(['casa'], 'facile', 7).size, 1);
  assert.equal(T.maskedIndices(['a', 'è'], 'difficile', 7).size, 0);
});
test('training: maskWord tiene punteggiatura e iniziale', () => {
  assert.equal(T.maskWord('problema:', true), 'p_______:');
  assert.equal(T.maskWord('problema:', false), '________:');
  assert.equal(T.maskWord('"Ciao!"', true), '"C___!"');
  assert.equal(T.maskWord('è', true), 'è');
});
test('training: speechWords salta le azioni e coincide con le parole del parlato', () => {
  const l = P.parse('MARCO: Ciao Giulia! (entra di corsa) Non ci credo.').lines[0];
  assert.deepEqual(T.speechWords(l.segments), ['Ciao', 'Giulia!', 'Non', 'ci', 'credo.']);
});
test('training: lineSeed cambia per riga e resta un intero positivo', () => {
  assert.notEqual(T.lineSeed(123456789, 0), T.lineSeed(123456789, 1));
  assert.ok(T.lineSeed(Date.now(), 5) >= 0);
});

// ---------------------------------------------------------------- Libreria
function fakeStorage() {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}

test('libreria: vuota all\'inizio, salva e rilegge', () => {
  const lib = createLibrary(fakeStorage());
  assert.deepEqual(lib.list(), []);
  const e = lib.save('Provino', 'LAURA: Ciao.', '1 personaggio', 1000);
  assert.equal(lib.list().length, 1);
  assert.equal(lib.readText(e.id), 'LAURA: Ciao.');
  assert.equal(e.title, 'Provino');
});
test('libreria: stesso testo non si duplica ma risale in cima', () => {
  const lib = createLibrary(fakeStorage());
  const a = lib.save('A', 'testo uno', '', 1000);
  lib.save('B', 'testo due', '', 2000);
  assert.equal(lib.list()[0].title, 'B');
  const again = lib.save('A bis', 'testo uno', '', 3000);
  assert.equal(again.id, a.id);
  assert.equal(lib.list().length, 2);
  assert.equal(lib.list()[0].id, a.id);
});
test('libreria: markOpened ricorda l\'ultimo personaggio e riordina', () => {
  const lib = createLibrary(fakeStorage());
  const a = lib.save('A', 'uno', '', 1000);
  lib.save('B', 'due', '', 2000);
  lib.markOpened(a.id, 'LAURA', 5000);
  assert.equal(lib.list()[0].id, a.id);
  assert.equal(lib.list()[0].lastCharacter, 'LAURA');
});
test('libreria: remove toglie elenco e testo', () => {
  const st = fakeStorage();
  const lib = createLibrary(st);
  const a = lib.save('A', 'uno', '', 1);
  lib.remove(a.id);
  assert.equal(lib.list().length, 0);
  assert.equal(lib.readText(a.id), null);
  assert.deepEqual([...st.m.keys()].filter((k) => k.includes('.t.')), []);
});
test('libreria: indice rovinato o testo mancante non rompono nulla', () => {
  const st = fakeStorage();
  const lib = createLibrary(st);
  st.setItem('copione.lib.index', '{non json');
  assert.deepEqual(lib.list(), []);
  const a = lib.save('A', 'uno', '', 1);
  st.removeItem('copione.lib.t.' + a.id);
  assert.deepEqual(lib.list(), []);
});
test('libreria: memoria piena -> errore e niente testo orfano', () => {
  const st = fakeStorage();
  const real = st.setItem;
  st.setItem = (k, v) => { if (k.endsWith('index')) throw new Error('QuotaExceededError'); real(k, v); };
  const lib = createLibrary(st);
  assert.throws(() => lib.save('A', 'uno', '', 1), /Quota/);
  assert.deepEqual([...st.m.keys()].filter((k) => k.includes('.t.')), []);
});
test('hash: stabile e sensibile al testo', () => {
  assert.equal(hashText('abc'), hashText('abc'));
  assert.notEqual(hashText('abc'), hashText('abd'));
});
