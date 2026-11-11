// Esegui con:  node --test tests/parser.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../parser.js');

const sample = [
  'MARCO: Ciao Giulia! (entra di corsa) Non ci credo.',
  'GIULIA: (si volta, sorpresa) Marco?',
  'Che ci fai qui?',
  '(Marco si siede)',
  'MARCO: Sono venuto a dirti la verità.'
].join('\n');

const withScenes = [
  "Titolo dell'opera",
  'ATTO I - SCENA 1',
  'MARCO: Ciao.',
  'GIULIA: Ciao a te.',
  'SCENA 2: La cucina',
  'MARCO: Hai fame?',
  'GIULIA: Sì.',
  'SCENA III',
  'MARCO: Basta.'
].join('\n');

// Stesso formato del copione vero: scene segnate con #SCENA X - TITOLO#
const real = [
  '#SCENA 1 - INTRO#CERTA',
  '',
  'ANGUS: Essere o non essere... questo è il problema: se sia più nobile tollerare le percosse. Dormire! Sognare, forse. Ah...',
  '',
  'WILLIAM: Ahhh!!!',
  '',
  'COCUZZA: Ma questo attore è un vero cane!',
  '',
  "WILLIAM: Hai davvero ragione. Angus, non ci siamo, per la miseria! Siamo uomini, Amleto è un uomo! L'hai forse dimenticato?",
  '',
  '#SCENA 2 - PROVE#',
  '',
  'ANGUS: Dove ho sbagliato, Will?',
  'WILLIAM: Ma dal principio alla fine, santo Dio!'
].join('\n');

test('riconosce i personaggi', () => {
  assert.deepEqual(P.parse(sample).characters, ['MARCO', 'GIULIA']);
});

test('separa parlato e azioni', () => {
  const line = P.parse(sample).lines[0];
  assert.equal(line.spoken, 'Ciao Giulia! Non ci credo.');
  assert.deepEqual(line.segments.filter(s => s.type === 'action').map(s => s.text), ['entra di corsa']);
});

test('unisce le righe di continuazione', () => {
  const line = P.parse(sample).lines[1];
  assert.equal(line.spoken, 'Marco? Che ci fai qui?');
  assert.deepEqual(line.segments.filter(s => s.type === 'action').map(s => s.text), ['si volta, sorpresa']);
});

test('didascalia senza personaggio', () => {
  const line = P.parse(sample).lines[2];
  assert.equal(line.character, null);
  assert.deepEqual(line.segments, [{ type: 'action', text: 'Marco si siede' }]);
});

test('una frase con i due punti non diventa un personaggio', () => {
  const script = P.parse('ANGUS: Questo è il\nproblema: se sia più nobile\nWILLIAM: Ahhh!');
  assert.deepEqual(script.characters, ['ANGUS', 'WILLIAM']);
  assert.equal(script.lines[0].spoken, 'Questo è il problema: se sia più nobile');
});

test('nomi con numero e punteggiatura', () => {
  assert.deepEqual(P.parse('SOLDATO 1: Alt!\nDON G.: Chi va là?').characters, ['SOLDATO 1', 'DON G.']);
});

test('un orario non è un personaggio', () => {
  const script = P.parse('ANGUS: Ci vediamo alle\n12:30 davanti al teatro.');
  assert.deepEqual(script.characters, ['ANGUS']);
  assert.equal(script.lines[0].spoken, 'Ci vediamo alle 12:30 davanti al teatro.');
});

test('senza intestazioni una sola scena', () => {
  const script = P.parse(sample);
  assert.equal(script.scenes.length, 1);
  assert.equal(script.scenes[0].title, 'Tutto il copione');
  assert.equal(script.scenes[0].endLine, script.lines.length);
});

test('riconosce le scene senza cancelletti', () => {
  const script = P.parse(withScenes);
  assert.deepEqual(script.scenes.map(s => s.title), ['ATTO I - SCENA 1', 'SCENA 2: La cucina', 'SCENA III']);
  assert.deepEqual(script.characters, ['MARCO', 'GIULIA']);
});

test('il frontespizio non diventa una scena', () => {
  assert.equal(P.parse(withScenes).scenes.length, 3);
});

test('indici attivi di una o più scene', () => {
  const script = P.parse(withScenes);
  assert.deepEqual(P.activeIndices(script, new Set([1])), [3, 4]);
  assert.deepEqual(P.activeIndices(script, new Set([0, 2])), [1, 2, 5]);
});

test('unisce ATTO e SCENA su righe separate', () => {
  const script = P.parse('ATTO I\nSCENA 1\nMARCO: Ciao.');
  assert.equal(script.scenes.length, 1);
  assert.equal(script.scenes[0].title, 'ATTO I – SCENA 1');
});

test('una battuta che parte per "Atto" non è una scena', () => {
  const script = P.parse('MARCO: Ciao.\nAtto di coraggio, davvero.');
  assert.equal(script.scenes.length, 1);
  assert.equal(script.lines[0].spoken, 'Ciao. Atto di coraggio, davvero.');
});

test('scene con i cancelletti', () => {
  const script = P.parse(real);
  assert.deepEqual(script.scenes.map(s => s.title), ['SCENA 1 - INTRO', 'SCENA 2 - PROVE']);
  assert.deepEqual(script.characters, ['ANGUS', 'WILLIAM', 'COCUZZA']);
});

test('testo attaccato al secondo cancelletto', () => {
  const first = P.parse(real).lines[0];
  assert.equal(first.character, null);
  assert.equal(first.spoken, 'CERTA');
});

test('le scene partono dalla riga giusta', () => {
  const script = P.parse(real);
  const [s1, s2] = script.scenes;
  assert.equal(s1.size, 5);
  assert.equal(s2.size, 2);
  assert.equal(script.lines[s2.startLine].character, 'ANGUS');
  assert.equal(script.lines[s2.startLine].spoken, 'Dove ho sbagliato, Will?');
});

test('una battuta non continua attraverso una scena', () => {
  const script = P.parse('ANGUS: Ciao.\n#SCENA 2 - B#\nsenza nome');
  assert.equal(script.scenes.length, 2);
  assert.equal(script.lines[0].spoken, 'Ciao.');
  assert.equal(script.lines[1].character, null);
});

test('azione su più righe', () => {
  const script = P.parse('ANGUS: Ciao (si siede\ne sospira) amici.');
  assert.equal(script.lines[0].spoken, 'Ciao amici.');
  assert.deepEqual(script.lines[0].segments.filter(s => s.type === 'action').map(s => s.text), ['si siede e sospira']);
});
