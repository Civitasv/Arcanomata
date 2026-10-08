import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHANNELS, SCOPES, defaultPrograms, normalizePrograms, isCompatible } from '../src/core/program.js';
import { createWorld, stepWorld, spawnSpell, chooseUpgrade, WORLD } from '../src/core/world.js';
import { createReplay, recordTick, recordRuleEdit, recordUpgrade, replayRun } from '../src/core/replay.js';

test('rule grammar validates source/channel and action compatibility', () => {
  assert.deepEqual(CHANNELS, ['beacon', 'danger', 'supply']);
  assert.deepEqual(SCOPES, ['other', 'self', 'any']);
  assert.equal(isCompatible('tick', 'seek'), false);
  assert.equal(isCompatible('enemy', 'share'), false);
  assert.equal(isCompatible('ally', 'share'), true);
  const p = defaultPrograms();
  p.scout[0] = { when: 'mark', do: 'seek', channel: 'danger', scope: 'self' };
  p.hunter[0] = { when: 'enemy', do: 'share' };
  const result = normalizePrograms(p);
  assert.deepEqual(result.scout[0], p.scout[0]);
  assert.deepEqual(result.hunter[0], defaultPrograms().hunter[0]);
  assert.equal(normalizePrograms({ scout: [{ when: 'tick', do: 'split', channel: '__proto__', scope: 'none' }] })
    .scout[0].channel, 'beacon');
});

test('typed marks only activate compatible, permitted listeners', () => {
  const w = createWorld(777);
  const [scout, hunter] = w.spells;
  scout.vx = 0; scout.vy = 0; hunter.vx = 0; hunter.vy = 0;
  w.enemyTimer = 100; w.spellTimer = 100;
  w.enemies = [{ id: 900, x: scout.x + 60, y: scout.y, hp: 100, speed: 0, radius: 12 }];
  w.programs.scout = [
    { when: 'enemy', do: 'mark', channel: 'danger', scope: 'any' },
    { when: 'tick', do: 'split' }, { when: 'tick', do: 'split' }
  ];
  w.programs.hunter = [
    { when: 'mark', do: 'seek', channel: 'beacon', scope: 'other' },
    { when: 'tick', do: 'split' }, { when: 'tick', do: 'split' }
  ];
  stepWorld(w);
  assert.ok(w.marks.some(m => m.channel === 'danger' && m.source === 'scout'));
  assert.equal(w.crossSignals, 0, 'hunter beacon subscription cannot see danger marks');
  w.programs.hunter[0].channel = 'danger';
  stepWorld(w);
  assert.ok(w.crossSignals > 0, 'hunter now receives the matching channel');
  assert.ok(hunter.trace.some(e => e.cross && e.targetType === 'mark'));
  const previous = w.crossSignals;
  w.programs.hunter[0].scope = 'self';
  stepWorld(w);
  assert.equal(w.crossSignals, previous, 'self-only channel must not read another species');
});

test('cross-species energy sharing is conserved and bounded', () => {
  const w = createWorld(10);
  w.enemyTimer = 100; w.spellTimer = 100;
  w.enemies = [];
  const scout = w.spells.find(s => s.kind === 'scout');
  const hunter = w.spells.find(s => s.kind === 'hunter');
  scout.energy = 120; hunter.energy = 35;
  w.programs.scout = [
    { when: 'ally', do: 'share', scope: 'other', channel: 'supply' },
    { when: 'tick', do: 'split' }, { when: 'tick', do: 'split' }
  ];
  w.programs.hunter = [
    { when: 'tick', do: 'mark', channel: 'supply' },
    { when: 'tick', do: 'split' }, { when: 'tick', do: 'split' }
  ];
  const totalBefore = w.spells.reduce((sum, s) => sum + s.energy, 0);
  stepWorld(w);
  assert.ok(w.energyShared > 0);
  assert.ok(hunter.energy > 35, 'recipient receives donor energy');
  assert.ok(scout.energy < 120, 'donor pays');
  const totalAfter = w.spells.reduce((sum, s) => sum + s.energy, 0);
  assert.ok(totalAfter < totalBefore, 'upkeep and mark cost reduce total');
  assert.ok(w.spells.every(s => s.energy >= 0));
});

test('agent trace ties rule, target, channel and energy delta to behavior', () => {
  const w = createWorld(55);
  w.enemies = [{ id: 20, x: w.spells[0].x + 30, y: w.spells[0].y, hp: 6, speed: 0, radius: 12 }];
  stepWorld(w);
  const event = w.traces.find(e => e.action === 'mark');
  assert.ok(event);
  assert.equal(event.channel, 'beacon');
  assert.equal(event.targetId, 20);
  assert.equal(event.targetType, 'enemy');
  assert.equal(event.deltaEnergy, -3);
  assert.ok(w.traces.length <= WORLD.maxTrace);
});

test('recording rule edits, ticks and upgrades reconstructs exact world', () => {
  const seed = 2048, w = createWorld(seed);
  const tape = createReplay(seed, w.programs);
  const program = normalizePrograms(w.programs);
  program.scout[1] = { when: 'ally', do: 'share', scope: 'other', channel: 'supply' };
  assert.equal(recordRuleEdit(tape, 'scout', 1, program.scout[1]), true);
  w.programs.scout[1] = program.scout[1];
  for (let i = 0; i < 1000; i++) {
    if (w.status === 'upgrade') {
      assert.equal(chooseUpgrade(w, 'pulse'), true);
      recordUpgrade(tape, 'pulse');
    }
    if (w.status !== 'running') break;
    const input = { dx: (i % 120) < 60 ? 1 : -1, dy: i % 80 < 40 ? 1 : -1 };
    recordTick(tape, input);
    stepWorld(w, input);
  }
  const replayed = replayRun(JSON.parse(JSON.stringify(tape)));
  assert.deepEqual(replayed, w);
  assert.throws(() => replayRun({ ...tape, version: 99 }), /Invalid replay/);
  assert.throws(() => replayRun({ ...tape, inputs: [[123, 0]] }), /Invalid replay input/);
});

test('stress: 220 agents, 200 enemies, bounded marks and trace budget', () => {
  const w = createWorld(2026);
  w.spells = [];
  w.enemyTimer = 100; w.spellTimer = 100;
  w.tuning.maxSpells = 220;
  for (let i = 0; i < 220; i++) spawnSpell(w, i % 2 ? 'hunter' : 'scout', 200 + i, 220, 130);
  w.enemies = Array.from({ length: WORLD.maxEnemies }, (_, i) => ({
    id: 2000 + i, x: 150 + i * 2, y: 190 + i % 30, hp: 5, speed: 20, radius: 12
  }));
  for (let i = 0; i < 45; i++) {
    if (w.status === 'upgrade') chooseUpgrade(w, 'pulse');
    stepWorld(w, { dx: 1, dy: 0 });
    assert.ok(w.spells.length <= 220);
    assert.ok(w.marks.length <= WORLD.maxMarks);
    assert.ok(w.enemies.length <= WORLD.maxEnemies);
    assert.ok(w.traces.length <= WORLD.maxTrace);
  }
  assert.ok(w.metrics.peakSpells >= 220);
});

test('baseline run produces combat and bounded telemetry', () => {
  const w = createWorld(1984);
  for (let i = 0; i < 1350; i++) {
    if (w.status === 'upgrade') chooseUpgrade(w, 'pulse');
    if (w.status !== 'running') break;
    const a = i / 90;
    stepWorld(w, { dx: Math.cos(a), dy: Math.sin(a) });
  }
  assert.ok(w.kills >= 1, 'default rules should kill at least one enemy');
  assert.ok(w.metrics.peakSpells <= w.tuning.maxSpells);
  assert.ok(w.metrics.peakEnemies <= WORLD.maxEnemies);
  assert.ok(w.metrics.peakMarks <= WORLD.maxMarks);
  assert.ok(w.time > 8, 'start is not an immediate softlock');
});
