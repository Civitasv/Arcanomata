import { defaultPrograms, SPELL_KINDS, CHANNELS } from './program.js';

export const WORLD = {
  width: 900, height: 560, maxEnemies: 200, maxMarks: 240, maxTrace: 90,
  goalSeconds: 180
};
const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const matchesScope = (source, kind, scope) =>
  scope === 'any' || (scope === 'self' ? source === kind : source !== kind);
function random(w) {
  w.rng = (Math.imul(w.rng, 1664525) + 1013904223) >>> 0;
  return w.rng / 4294967296;
}
function closest(items, point, radius, filter = () => true) {
  let match = null, limit = radius * radius;
  for (const item of items) {
    if (!filter(item)) continue;
    const d = distance2(item, point);
    if (d < limit) { limit = d; match = item; }
  }
  return match;
}
export function spawnSpell(w, kind, x = w.player.x, y = w.player.y, energy = 65) {
  if (!SPELL_KINDS.includes(kind) || w.spells.length >= w.tuning.maxSpells) return null;
  if (!Number.isFinite(energy) || energy <= 0) return null;
  const angle = random(w) * TAU;
  const spell = {
    id: ++w.nextId, kind, x, y,
    vx: Math.cos(angle) * 27, vy: Math.sin(angle) * 27,
    energy, cooldowns: [0, 0, 0], age: 0, lastRule: '尚未触发',
    lastTargetId: null, lastTargetType: null, lastMovementTraceAt: -1, trace: []
  };
  w.spells.push(spell);
  w.metrics.peakSpells = Math.max(w.metrics.peakSpells, w.spells.length);
  return spell;
}
export function createWorld(seed = 1337) {
  const w = {
    rng: seed >>> 0, nextId: 0, time: 0, wave: 1, status: 'running',
    kills: 0, totalSignals: 0, crossSignals: 0, pulses: 0, energyShared: 0,
    metrics: { peakSpells: 0, peakEnemies: 0, peakMarks: 0, damageTaken: 0 },
    traces: [],
    player: { x: WORLD.width / 2, y: WORLD.height / 2, hp: 100, xp: 0, nextXp: 5, level: 1, invulnerable: 0 },
    tuning: { moveSpeed: 184, pulseRadius: 53, spellInterval: 2.7, maxSpells: 220, bonusEnergy: 0 },
    programs: defaultPrograms(), spells: [], enemies: [], marks: [],
    enemyTimer: 0.75, spellTimer: 2.5, upgradeChoices: []
  };
  spawnSpell(w, 'scout', w.player.x - 24, w.player.y, 90);
  spawnSpell(w, 'hunter', w.player.x + 24, w.player.y, 90);
  return w;
}
function spawnEnemy(w) {
  if (w.enemies.length >= WORLD.maxEnemies) return;
  const side = Math.floor(random(w) * 4), t = random(w);
  let x = 0, y = 0;
  if (side === 0) { x = t * WORLD.width; y = 0; }
  if (side === 1) { x = WORLD.width; y = t * WORLD.height; }
  if (side === 2) { x = t * WORLD.width; y = WORLD.height; }
  if (side === 3) { x = 0; y = t * WORLD.height; }
  w.enemies.push({
    id: ++w.nextId, x, y, hp: 3 + Math.floor((w.wave - 1) / 3),
    speed: 34 + w.wave * 3, radius: 12
  });
  w.metrics.peakEnemies = Math.max(w.metrics.peakEnemies, w.enemies.length);
}
function sense(w, spell, rule) {
  const sensor = rule.when;
  if (sensor === 'tick') return { target: null, active: true, type: 'clock' };
  if (sensor === 'enemy' || sensor === 'contact') {
    const target = closest(w.enemies, spell, sensor === 'contact' ? 28 : 190);
    return { target, active: Boolean(target), type: 'enemy' };
  }
  if (sensor === 'ally') {
    const target = closest(w.spells, spell, 116,
      s => s.id !== spell.id && matchesScope(s.kind, spell.kind, rule.scope));
    return { target, active: Boolean(target), type: 'spell' };
  }
  if (sensor === 'mark') {
    const target = closest(w.marks, spell, 165,
      m => m.channel === rule.channel && matchesScope(m.source, spell.kind, rule.scope));
    return { target, active: Boolean(target), type: 'mark' };
  }
  return { target: null, active: false, type: 'none' };
}
function velocityToward(spell, target, factor, dt) {
  const dx = target.x - spell.x, dy = target.y - spell.y;
  const d = Math.hypot(dx, dy) || 1;
  spell.vx += dx / d * factor * dt;
  spell.vy += dy / d * factor * dt;
}
function grantKill(w, spell) {
  w.kills++;
  if (spell) spell.energy = Math.min(165 + w.tuning.bonusEnergy, spell.energy + 12);
  w.player.xp++;
  if (w.player.xp >= w.player.nextXp && w.status === 'running') {
    w.player.xp -= w.player.nextXp;
    w.player.level++;
    w.player.nextXp += 3;
    w.status = 'upgrade';
    w.upgradeChoices = ['capacity', 'pulse', 'frequency'];
  }
}
function traceAction(w, spell, rule, index, perception, before) {
  spell.lastRule = rule.when + ' → ' + rule.do;
  spell.lastTargetId = perception.target?.id ?? null;
  spell.lastTargetType = perception.type;
  const cross = perception.target && (
    (perception.type === 'mark' && perception.target.source !== spell.kind) ||
    (perception.type === 'spell' && perception.target.kind !== spell.kind)
  );
  if (cross) w.crossSignals++;
  const activeMovement = ['seek', 'flee', 'orbit'].includes(rule.do);
  if (activeMovement && w.time - spell.lastMovementTraceAt < 0.3) return;
  if (activeMovement) spell.lastMovementTraceAt = w.time;
  const event = {
    t: Number(w.time.toFixed(2)), kind: spell.kind, spellId: spell.id,
    ruleIndex: index, when: rule.when, action: rule.do,
    targetId: perception.target?.id ?? null, targetType: perception.type,
    channel: rule.channel, deltaEnergy: Number((spell.energy - before).toFixed(2)),
    cross: Boolean(cross)
  };
  spell.trace.push(event);
  if (spell.trace.length > 6) spell.trace.shift();
  w.traces.push(event);
  if (w.traces.length > WORLD.maxTrace) w.traces.shift();
}
function execute(w, spell, rule, perception, index, dt) {
  const target = perception.target, action = rule.do, before = spell.energy;
  if (action === 'seek' || action === 'flee' || action === 'orbit') {
    if (!target) return false;
    if (action === 'seek') velocityToward(spell, target, 245, dt);
    if (action === 'flee') velocityToward(spell, target, -245, dt);
    if (action === 'orbit') {
      const dx = target.x - spell.x, dy = target.y - spell.y;
      const d = Math.hypot(dx, dy) || 1;
      spell.vx += (-dy / d * 185 + dx / d * 42) * dt;
      spell.vy += (dx / d * 185 + dy / d * 42) * dt;
    }
  } else if (action === 'mark') {
    if (spell.energy < 3 || w.marks.length >= WORLD.maxMarks) return false;
    const ttl = rule.channel === 'supply' ? 4 : rule.channel === 'danger' ? 2.4 : 3.2;
    w.marks.push({
      id: ++w.nextId, x: target ? target.x : spell.x, y: target ? target.y : spell.y,
      source: spell.kind, channel: CHANNELS.includes(rule.channel) ? rule.channel : 'beacon',
      ttl
    });
    spell.energy -= 3;
    w.totalSignals++;
    w.metrics.peakMarks = Math.max(w.metrics.peakMarks, w.marks.length);
    spell.cooldowns[index] = 0.9;
  } else if (action === 'pulse') {
    if (spell.energy < 5) return false;
    const nearby = w.enemies.filter(e => distance2(e, spell) <= w.tuning.pulseRadius ** 2);
    if (!nearby.length) return false;
    spell.energy -= 5;
    for (const enemy of nearby) {
      enemy.hp -= 3;
      if (enemy.hp <= 0) grantKill(w, spell);
    }
    w.enemies = w.enemies.filter(e => e.hp > 0);
    w.pulses++;
    spell.cooldowns[index] = 0.45;
  } else if (action === 'split') {
    if (spell.energy < 68 || w.spells.length >= w.tuning.maxSpells) return false;
    const childEnergy = spell.energy * 0.38;
    spell.energy -= childEnergy + 6;
    const child = spawnSpell(w, spell.kind, clamp(spell.x + 12, 0, WORLD.width),
      clamp(spell.y + 12, 0, WORLD.height), childEnergy);
    if (!child) { spell.energy += childEnergy + 6; return false; }
    spell.cooldowns[index] = 2.2;
    child.cooldowns[index] = 2.2;
  } else if (action === 'share') {
    if (!target || !('energy' in target) || spell.energy <= target.energy + 18) return false;
    const amount = Math.min(6, spell.energy - 18, Math.max(0, 165 - target.energy));
    if (amount <= 0) return false;
    spell.energy -= amount;
    target.energy += amount;
    w.energyShared += amount;
    spell.cooldowns[index] = 0.6;
  } else return false;
  traceAction(w, spell, rule, index, perception, before);
  return true;
}
function tickSpells(w, dt) {
  // Children begin evaluating rules on the next fixed tick only.
  for (const spell of [...w.spells]) {
    spell.age += dt;
    spell.energy = Math.max(0, spell.energy - (0.52 + Math.hypot(spell.vx, spell.vy) * 0.001) * dt);
    if (spell.energy <= 0) continue;
    spell.cooldowns = spell.cooldowns.map(c => Math.max(0, c - dt));
    const program = w.programs[spell.kind];
    let hasMovementTarget = false;
    for (let i = 0; i < program.length; i++) {
      if (spell.cooldowns[i] > 0) continue;
      const perception = sense(w, spell, program[i]);
      if (!perception.active) continue;
      const didAct = execute(w, spell, program[i], perception, i, dt);
      if (didAct && ['seek', 'flee', 'orbit'].includes(program[i].do)) hasMovementTarget = true;
    }
    // Gentle tether prevents idle agents drifting out of combat forever.
    if (!hasMovementTarget && distance2(spell, w.player) > 105 ** 2) {
      velocityToward(spell, w.player, 70, dt);
    }
    const speed = Math.hypot(spell.vx, spell.vy);
    if (speed > 125) { spell.vx *= 125 / speed; spell.vy *= 125 / speed; }
    spell.vx *= 0.984; spell.vy *= 0.984;
    spell.x = clamp(spell.x + spell.vx * dt, 8, WORLD.width - 8);
    spell.y = clamp(spell.y + spell.vy * dt, 8, WORLD.height - 8);
  }
  w.spells = w.spells.filter(s => s.energy > 0);
}
function tickEnemies(w, dt) {
  for (const enemy of w.enemies) {
    const dx = w.player.x - enemy.x, dy = w.player.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    enemy.x += dx / d * enemy.speed * dt;
    enemy.y += dy / d * enemy.speed * dt;
    if (d < enemy.radius + 11 && w.player.invulnerable <= 0) {
      const amount = Math.min(10, w.player.hp);
      w.player.hp -= amount;
      w.metrics.damageTaken += amount;
      w.player.invulnerable = 0.8;
    }
  }
}
export function stepWorld(w, input = { dx: 0, dy: 0 }, dt = 1 / 30) {
  if (w.status !== 'running') return w;
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) throw new Error('dt must be in (0, 0.1]');
  w.time += dt;
  w.wave = 1 + Math.floor(w.time / 22);
  w.player.invulnerable = Math.max(0, w.player.invulnerable - dt);
  const dx = Number.isFinite(input.dx) ? input.dx : 0;
  const dy = Number.isFinite(input.dy) ? input.dy : 0;
  const length = Math.max(1, Math.hypot(dx, dy));
  w.player.x = clamp(w.player.x + dx / length * w.tuning.moveSpeed * dt, 12, WORLD.width - 12);
  w.player.y = clamp(w.player.y + dy / length * w.tuning.moveSpeed * dt, 12, WORLD.height - 12);
  w.marks = w.marks.filter(m => (m.ttl -= dt) > 0);
  w.enemyTimer -= dt;
  if (w.enemyTimer <= 0) {
    spawnEnemy(w);
    w.enemyTimer += Math.max(0.42, 1.55 - w.wave * 0.09);
  }
  w.spellTimer -= dt;
  if (w.spellTimer <= 0) {
    const nextKind = Math.floor(w.time / w.tuning.spellInterval) % 2 === 0 ? 'scout' : 'hunter';
    spawnSpell(w, nextKind, w.player.x, w.player.y, 70 + w.tuning.bonusEnergy);
    w.spellTimer += w.tuning.spellInterval;
  }
  tickSpells(w, dt);
  tickEnemies(w, dt);
  if (w.player.hp <= 0) w.status = 'lost';
  else if (w.time >= WORLD.goalSeconds) w.status = 'won';
  return w;
}
export const UPGRADES = {
  capacity: { name: '生命容器', description: '新生法术多获得 15 能量' },
  pulse: { name: '共振脉冲', description: '脉冲半径增加 12' },
  frequency: { name: '潮汐频率', description: '法术自动生成间隔缩短 15%' }
};
export function chooseUpgrade(w, key) {
  if (w.status !== 'upgrade' || !Object.hasOwn(UPGRADES, key)) return false;
  if (key === 'capacity') w.tuning.bonusEnergy += 15;
  if (key === 'pulse') w.tuning.pulseRadius += 12;
  if (key === 'frequency') w.tuning.spellInterval = Math.max(0.75, w.tuning.spellInterval * 0.85);
  w.upgradeChoices = [];
  w.status = 'running';
  return true;
}
