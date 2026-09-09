import test from 'node:test';
import assert from 'node:assert/strict';
import RPGState from '../src/systems/RPGState.js';

test('equipment requires ownership and changes outgoing and incoming damage', () => {
  const s = new RPGState();
  assert.equal(s.equip('leaf'), false);
  s.addItem('iron'); s.equip('iron');
  assert.equal(s.attack, 20);
  assert.equal(s.damage(14), 12);
  s.equip('vest');
  assert.equal(s.damage(14), 8);
  assert.equal(s.addItem('iron'), false);
});
test('skills spend MP once, enforce global and individual cooldowns and reject insufficient MP', () => {
  const s = new RPGState();
  assert.equal(s.cast('wave', 0), true);
  assert.equal(s.mp, 50);
  assert.equal(s.cast('spin', 100), false);
  assert.equal(s.cast('wave', 1500), false);
  assert.equal(s.cast('wave', 1600), true);
  s.mp = 0;
  assert.equal(s.cast('spin', 2000), false);
  assert.equal(s.cast('attack', 2000), true);
});
test('experience carries over multiple levels and skill ranks consume points with a cap', () => {
  const s = new RPGState();
  assert.equal(s.gainExp(200), 2);
  assert.equal(s.level, 3); assert.equal(s.exp, 20);
  assert.equal(s.skillPoints, 2); assert.equal(s.hp, 140);
  assert.equal(s.upgrade('wave'), true);
  assert.equal(s.upgrade('wave'), true);
  assert.equal(s.upgrade('wave'), false);
  assert.equal(s.multiplier('wave'), 2.3);
  s.skillPoints = 10;
  s.upgrade('wave'); s.upgrade('wave');
  assert.equal(s.upgrade('wave'), false);
  assert.equal(s.ranks.wave, 5);
});
test('potions clamp health and MP, enforce cooldown, cannot resurrect or waste at full resources', () => {
  const s = new RPGState();
  assert.equal(s.potion(0), false);
  s.damage(32); s.mp = 15;
  assert.equal(s.potion(0), true);
  assert.equal(s.hp, 100); assert.equal(s.mp, 45);
  assert.equal(s.potions, 4); assert.equal(s.potion(100), false);
  s.damage(1000);
  assert.equal(s.hp, 0); assert.equal(s.potion(2000), false);
  assert.equal(s.cast('attack', 3000), false);
});
