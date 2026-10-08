import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createWorld, stepWorld, chooseUpgrade, WORLD } from '../src/core/world.js';

const samples = [];
const seeds = [42, 1337, 2026];
const dt = 1 / 30;
function run(seed, immortal = false) {
  const world = createWorld(seed), elapsed = [];
  const start = performance.now();
  let steps = 0, upgrades = 0;
  while (steps < 5600 && !['won', 'lost'].includes(world.status)) {
    if (world.status === 'upgrade') {
      chooseUpgrade(world, upgrades % 2 ? 'capacity' : 'pulse');
      upgrades++;
    }
    // Fixed clock and deterministic spiral motion. For the soak test only,
    // restore HP before each tick to measure all 180s of increasing wave load.
    if (immortal) world.player.hp = 100;
    const t = steps * dt;
    const input = { dx: Math.cos(t * 0.85), dy: Math.sin(t * 0.85) };
    const before = performance.now();
    stepWorld(world, input, dt);
    elapsed.push(performance.now() - before);
    steps++;
  }
  elapsed.sort((a, b) => a - b);
  const quantile = q => Number((elapsed[Math.min(elapsed.length - 1, Math.floor(elapsed.length * q))] || 0).toFixed(4));
  return {
    mode: immortal ? '180s-immortal-soak' : 'normal-gameplay', seed,
    worldSeconds: Number(world.time.toFixed(2)), status: world.status,
    kills: world.kills, level: world.player.level, survivingSpells: world.spells.length,
    crossSignals: world.crossSignals, energyShared: Number(world.energyShared.toFixed(2)),
    pulses: world.pulses, peakSpells: world.metrics.peakSpells,
    peakEnemies: world.metrics.peakEnemies, peakMarks: world.metrics.peakMarks,
    damageTaken: world.metrics.damageTaken, recordedTicks: steps,
    cpuP50Ms: quantile(0.5), cpuP95Ms: quantile(0.95),
    cpuP99Ms: quantile(0.99), wallMs: Number((performance.now() - start).toFixed(2))
  };
}
for (const seed of seeds) {
  samples.push(run(seed));
  samples.push(run(seed, true));
}
for (const sample of samples) {
  if (sample.peakSpells > 220 || sample.peakEnemies > WORLD.maxEnemies || sample.peakMarks > WORLD.maxMarks) {
    throw new Error('Entity cap exceeded in seed ' + sample.seed);
  }
  if (sample.mode.includes('soak') && sample.status !== 'won') {
    throw new Error('180s soak failed for seed ' + sample.seed + ': ' + sample.status);
  }
}
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/three-minute-benchmark.json', JSON.stringify({
  schema: 1, description: 'Node fixed-tick CPU timings, not browser FPS or user-played outcomes.',
  seeds, samples
}, null, 2));
process.stdout.write(JSON.stringify(samples, null, 2) + '\n');
