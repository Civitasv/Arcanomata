import { defaultPrograms, SPELL_KINDS } from './program.js';

export const WORLD = { width: 900, height: 560, maxEnemies: 180, maxMarks: 180, goalSeconds: 180 };
const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
function random(w) {
  w.rng = (Math.imul(w.rng, 1664525) + 1013904223) >>> 0;
  return w.rng / 4294967296;
}
function closest(items, point, radius, filter = () => true) {
  let match = null;
  let limit = radius * radius;
  for (const item of items) {
    if (!filter(item)) continue;
    const d = distance2(item, point);
    if (d < limit) { limit = d; match = item; }
  }
  return match;
}
export function spawnSpell(w, kind, x = w.player.x, y = w.player.y, energy = 65) {
  if (!SPELL_KINDS.includes(kind) || w.spells.length >= w.tuning.maxSpells) return null;
  const angle = random(w) * TAU;
  const spell = {
    id: ++w.nextId, kind, x, y,
    vx: Math.cos(angle) * 27, vy: Math.sin(angle) * 27,
    energy, cooldowns: [0, 0, 0], age: 0, lastRule: '尚未触发'
  };
  w.spells.push(spell);
  return spell;
}
export function createWorld(seed = 1337) {
  const w = {
    rng: seed >>> 0, nextId: 0, time: 0, wave: 1, status: 'running',
    kills: 0, totalSignals: 0, crossSignals: 0, pulses: 0,
    player: { x: WORLD.width / 2, y: WORLD.height / 2, hp: 100, xp: 0, nextXp: 5, level: 1, invulnerable: 0 },
    tuning: { moveSpeed: 180, pulseRadius: 44, spellInterval: 3.4, maxSpells: 120, bonusEnergy: 0 },
    programs: defaultPrograms(), spells: [], enemies: [], marks: [],
    enemyTimer: 0.75, spellTimer: 2.5, upgradeChoices: []
  };
  spawnSpell(w, 'scout', w.player.x - 24, w.player.y, 90);
  spawnSpell(w, 'hunter', w.player.x + 24, w.player.y, 90);
  return w;
}
function spawnEnemy(w) {
  if (w.enemies.length >= WORLD.maxEnemies) return;
  const side = Math.floor(random(w) * 4);
  const t = random(w);
  let x = 0, y = 0;
  if (side === 0) { x = t * WORLD.width; y = 0; }
  if (side === 1) { x = WORLD.width; y = t * WORLD.height; }
  if (side === 2) { x = t * WORLD.width; y = WORLD.height; }
  if (side === 3) { x = 0; y = t * WORLD.height; }
  w.enemies.push({
    id: ++w.nextId, x, y,
    hp: 3 + Math.floor((w.wave - 1) / 2),
    speed: 37 + w.wave * 3.5, radius: 12
  });
}
function sense(w, spell, sensor) {
  if (sensor === 'tick') return { target: null, active: true };
  if (sensor === 'enemy') {
    const target = closest(w.enemies, spell, 190);
    return { target, active: Boolean(target) };
  }
  if (sensor === 'contact') {
    const target = closest(w.enemies, spell, 23);
    return { target, active: Boolean(target) };
  }
  if (sensor === 'ally') {
    const target = closest(w.spells, spell, 110, s => s.id !== spell.id);
    return { target, active: Boolean(target) };
  }
  if (sensor === 'mark') {
    // Cross-species communication: a spell only senses marks written by another species.
    const target = closest(w.marks, spell, 155, m => m.source !== spell.kind);
    return { target, active: Boolean(target) };
  }
  return { target: null, active: false };
}
function velocityToward(spell, target, factor, dt) {
  const dx = target.x - spell.x;
  const dy = target.y - spell.y;
  const d = Math.hypot(dx, dy) || 1;
  spell.vx += dx / d * factor * dt;
  spell.vy += dy / d * factor * dt;
}
function grantKill(w, spell) {
  w.kills++;
  if (spell) spell.energy = Math.min(140 + w.tuning.bonusEnergy, spell.energy + 9);
  w.player.xp++;
  if (w.player.xp >= w.player.nextXp && w.status === 'running') {
    w.player.xp -= w.player.nextXp;
    w.player.level++;
    w.player.nextXp += 3;
    w.status = 'upgrade';
    w.upgradeChoices = ['capacity', 'pulse', 'frequency'];
  }
}
function execute(w, spell, rule, target, index, dt) {
  const action = rule.do;
  if (action === 'seek' || action === 'flee' || action === 'orbit') {
    if (!target) return false;
    if (action === 'seek') velocityToward(spell, target, 245, dt);
    if (action === 'flee') velocityToward(spell, target, -260, dt);
    if (action === 'orbit') {
      const dx = target.x - spell.x, dy = target.y - spell.y;
      const d = Math.hypot(dx, dy) || 1;
      spell.vx += (-dy / d * 180 + dx / d * 45) * dt;
      spell.vy += (dx / d * 180 + dy / d * 45) * dt;
    }
  } else if (action === 'mark') {
    if (spell.energy < 3 || w.marks.length >= WORLD.maxMarks) return false;
    w.marks.push({
      id: ++w.nextId, x: target ? target.x : spell.x, y: target ? target.y : spell.y,
      source: spell.kind, ttl: 3.2
    });
    spell.energy -= 3;
    w.totalSignals++;
    spell.cooldowns[index] = 1.0;
  } else if (action === 'pulse') {
    if (spell.energy < 5) return false;
    const nearby = w.enemies.filter(e => distance2(e, spell) <= w.tuning.pulseRadius ** 2);
    if (nearby.length === 0) return false;
    spell.energy -= 5;
    for (const enemy of nearby) {
      enemy.hp -= 3;
      if (enemy.hp <= 0) grantKill(w, spell);
    }
    w.enemies = w.enemies.filter(e => e.hp > 0);
    w.pulses++;
    spell.cooldowns[index] = 0.48;
  } else if (action === 'split') {
    if (spell.energy < 65 || w.spells.length >= w.tuning.maxSpells) return false;
    const childEnergy = spell.energy * 0.38;
    spell.energy -= childEnergy + 6;
    const child = spawnSpell(w, spell.kind, clamp(spell.x + 12, 0, WORLD.width), clamp(spell.y + 12, 0, WORLD.height), childEnergy);
    if (!child) { spell.energy += childEnergy + 6; return false; }
    spell.cooldowns[index] = 2.0;
    child.cooldowns[index] = 2.0;
  } else if (action === 'share') {
    if (!target || !('energy' in target) || spell.energy <= target.energy + 20) return false;
    const amount = Math.min(5, spell.energy - 12);
    if (amount <= 0) return false;
    spell.energy -= amount;
    target.energy += amount;
    spell.cooldowns[index] = 0.6;
  } else return false;
  spell.lastRule = rule.when + ' → ' + rule.do;
  if (rule.when === 'mark' && target?.source !== spell.kind) w.crossSignals++;
  return true;
}
function tickSpells(w, dt) {
  // Snapshot: newborn children do not execute before the following simulation step.
  for (const spell of [...w.spells]) {
    spell.age += dt;
    spell.energy -= (0.55 + Math.hypot(spell.vx, spell.vy) * 0.001) * dt;
    if (spell.energy <= 0) continue;
    spell.cooldowns = spell.cooldowns.map(c => Math.max(0, c - dt));
    const program = w.programs[spell.kind];
    for (let i = 0; i < program.length; i++) {
      if (spell.cooldowns[i] > 0) continue;
      const perception = sense(w, spell, program[i].when);
      if (perception.active) execute(w, spell, program[i], perception.target, i, dt);
    }
    const speed = Math.hypot(spell.vx, spell.vy);
    if (speed > 125) { spell.vx *= 125 / speed; spell.vy *= 125 / speed; }
    spell.vx *= 0.987; spell.vy *= 0.987;
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
      w.player.hp = Math.max(0, w.player.hp - 10);
      w.player.invulnerable = 0.7;
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
    w.enemyTimer += Math.max(0.32, 1.38 - w.wave * 0.11);
  }
  w.spellTimer -= dt;
  if (w.spellTimer <= 0) {
    spawnSpell(w, Math.floor(w.time / w.tuning.spellInterval) % 2 === 0 ? 'scout' : 'hunter',
      w.player.x, w.player.y, 65 + w.tuning.bonusEnergy);
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
