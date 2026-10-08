import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, spawnSpell, chooseUpgrade, WORLD } from '../src/core/world.js';
import { normalizePrograms, defaultPrograms } from '../src/core/program.js';

test('same seed and input sequence produce identical simulation', () => {
  const a = createWorld(42), b = createWorld(42);
  for (let i = 0; i < 450; i++) {
    const input = { dx: i % 30 < 15 ? 1 : -1, dy: i % 60 < 30 ? 0 : 1 };
    for (const world of [a, b]) {
      if (world.status === 'upgrade') chooseUpgrade(world, 'pulse');
      stepWorld(world, input);
    }
  }
  assert.deepEqual(a, b);
});

test('program input is whitelisted, preserves both species independently', () => {
  const p = defaultPrograms();
  p.hunter[0] = { when: 'mark', do: 'orbit' };
  p.scout[0] = { when: 'bad', do: 'eval' };
  const safe = normalizePrograms(p);
  assert.deepEqual(safe.scout[0], { when: 'enemy', do: 'mark' });
  assert.deepEqual(safe.hunter[0], { when: 'mark', do: 'orbit' });
  assert.notStrictEqual(safe.hunter[0], p.hunter[0]);
});

test('scout mark can guide independently programmed hunter', () => {
  const w = createWorld(7);
  const scout = w.spells.find(s => s.kind === 'scout');
  const hunter = w.spells.find(s => s.kind === 'hunter');
  w.enemies = [{ id: 555, x: scout.x + 72, y: scout.y, hp: 10, speed: 0, radius: 12 }];
  w.programs.scout = [{ when: 'enemy', do: 'mark' }, { when: 'tick', do: 'flee' }, { when: 'tick', do: 'flee' }];
  w.programs.hunter = [{ when: 'mark', do: 'seek' }, { when: 'tick', do: 'flee' }, { when: 'tick', do: 'flee' }];
  const previousVx = hunter.vx;
  stepWorld(w);
  assert.ok(w.marks.some(m => m.source === 'scout'));
  assert.ok(w.crossSignals > 0, 'hunter consumed a mark from scout');
  assert.ok(hunter.vx > previousVx, 'hunter accelerates towards scout mark');
});

test('split preserves bounded resources and agent count', () => {
  const w = createWorld(9);
  w.spells = [];
  const original = spawnSpell(w, 'scout', 400, 280, 90);
  w.programs.scout = [{ when: 'tick', do: 'split' }, { when: 'tick', do: 'seek' }, { when: 'tick', do: 'seek' }];
  const before = original.energy;
  stepWorld(w);
  assert.equal(w.spells.length, 2);
  assert.ok(w.spells.reduce((sum, s) => sum + s.energy, 0) < before, 'replication incurs cost');
  w.tuning.maxSpells = 2;
  for (let i = 0; i < 200; i++) stepWorld(w);
  assert.ok(w.spells.length <= 2);
});

test('world bounds and paused state are enforced', () => {
  const w = createWorld(13);
  for (let i = 0; i < 100; i++) stepWorld(w, { dx: 10, dy: -10 });
  assert.ok(w.player.x <= WORLD.width - 12 && w.player.y >= 12);
  w.status = 'paused';
  const time = w.time;
  stepWorld(w);
  assert.equal(w.time, time);
});

test('upgrades require the proper game state', () => {
  const w = createWorld();
  assert.equal(chooseUpgrade(w, 'pulse'), false);
  w.status = 'upgrade';
  assert.equal(chooseUpgrade(w, 'pulse'), true);
  assert.equal(w.tuning.pulseRadius, 56);
  assert.equal(w.status, 'running');
  assert.equal(chooseUpgrade(w, '__proto__'), false);
});
