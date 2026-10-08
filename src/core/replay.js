import { normalizePrograms, normalizeRule, SPELL_KINDS } from './program.js';
import { createWorld, stepWorld, chooseUpgrade } from './world.js';

export const REPLAY_VERSION = 1;
export const STEP_SECONDS = 1 / 30;
export function createReplay(seed, programs) {
  return { version: REPLAY_VERSION, seed: seed >>> 0,
    programs: normalizePrograms(programs), inputs: [], events: [] };
}
export function recordTick(tape, input) {
  const axis = v => Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
  tape.inputs.push([axis(input.dx), axis(input.dy)]);
}
export function recordRuleEdit(tape, kind, index, rule) {
  if (!SPELL_KINDS.includes(kind) || !Number.isInteger(index) || index < 0 || index > 2) return false;
  const fallback = tape.programs[kind][index];
  const safe = normalizeRule(rule, fallback);
  if (safe.when !== rule.when || safe.do !== rule.do) return false;
  tape.events.push({ at: tape.inputs.length, type: 'rule', kind, index, rule: safe });
  return true;
}
export function recordUpgrade(tape, key) {
  tape.events.push({ at: tape.inputs.length, type: 'upgrade', key });
}
export function replayRun(tape) {
  if (!tape || tape.version !== REPLAY_VERSION || !Number.isInteger(tape.seed) ||
      !Array.isArray(tape.inputs) || !Array.isArray(tape.events) ||
      tape.inputs.length > 6000 || tape.events.length > 1500) {
    throw new Error('Invalid replay header or size');
  }
  const w = createWorld(tape.seed);
  w.programs = normalizePrograms(tape.programs);
  let eventIndex = 0;
  const events = tape.events;
  for (let tick = 0; tick <= tape.inputs.length; tick++) {
    while (eventIndex < events.length && events[eventIndex].at === tick) {
      const evt = events[eventIndex++];
      if (evt.type === 'rule' && SPELL_KINDS.includes(evt.kind) &&
          Number.isInteger(evt.index) && evt.index >= 0 && evt.index < 3) {
        w.programs[evt.kind][evt.index] =
          normalizeRule(evt.rule, w.programs[evt.kind][evt.index]);
      } else if (evt.type === 'upgrade') {
        if (!chooseUpgrade(w, evt.key)) throw new Error('Replay upgrade out of order');
      } else throw new Error('Unknown replay event');
    }
    if (tick === tape.inputs.length) break;
    if (w.status !== 'running') throw new Error('Replay tick while not running');
    const item = tape.inputs[tick];
    if (!Array.isArray(item) || item.length !== 2 || !item.every(v => Number.isFinite(v) && v >= -1 && v <= 1)) {
      throw new Error('Invalid replay input');
    }
    stepWorld(w, { dx: item[0], dy: item[1] }, STEP_SECONDS);
  }
  if (eventIndex !== events.length) throw new Error('Unconsumed replay events');
  return w;
}
