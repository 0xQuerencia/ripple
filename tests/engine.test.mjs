import test from 'node:test';
import assert from 'node:assert/strict';
import { demoEffects, validateEffects } from '../shared/engine.mjs';
import { SYSTEMS, EDGE_LIST } from '../shared/world.mjs';

test('world contains 12 connected systems', () => {
  assert.equal(SYSTEMS.length, 12);
  assert.ok(EDGE_LIST.length >= 20);
});

test('blackout demo has plausible direct downstream effects', () => {
  const effects = demoEffects({ frontier: ['power'], visited: ['power'] });
  assert.equal(effects.length, 3);
  assert.ok(effects.every(e => e.sourceId === 'power'));
});

test('Gemma cannot forge unconnected edges', () => {
  const effects = validateEffects([
    { sourceId: 'power', targetId: 'people', title: 'Impossible shortcut' },
    { sourceId: 'power', targetId: 'water', title: 'Water pumps may fail', explanation: 'Electricity is needed.' },
  ], { frontier: ['power'], visited: ['power'] });
  assert.deepEqual(effects.map(e => e.targetId), ['water']);
});

test('Gemma cannot re-affect visited targets or use unrelated frontier', () => {
  const effects = validateEffects([
    { sourceId: 'power', targetId: 'water' },
    { sourceId: 'nature', targetId: 'farming' },
  ], { frontier: ['power'], visited: ['power', 'water'] });
  assert.deepEqual(effects, []);
});

test('Gemma output is bounded and sanitized', () => {
  const effects = validateEffects([
    { sourceId: 'power', targetId: 'water', title: 'a'.repeat(400), explanation: 'b'.repeat(600), certainty: 'absolutely', severity: 'extreme' },
    { sourceId: 'power', targetId: 'water', title: 'Duplicate' },
    { sourceId: 'power', targetId: 'transport' },
  ], { frontier: ['power'], visited: ['power'], max: 2 });
  assert.equal(effects.length, 2);
  assert.equal(effects[0].title.length, 70);
  assert.equal(effects[0].explanation.length, 250);
  assert.equal(effects[0].certainty, 'possible');
  assert.equal(effects[0].severity, 'medium');
});
