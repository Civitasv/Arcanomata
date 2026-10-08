import { createWorld, stepWorld, chooseUpgrade, UPGRADES, WORLD } from '../core/world.js';
import { ACTIONS, SENSORS, LABELS, SPELL_KINDS, defaultPrograms, normalizePrograms } from '../core/program.js';
import { drawWorld } from './render.js';

const byId = id => document.getElementById(id);
const canvas = byId('arena');
const ctx = canvas.getContext('2d', { alpha: false });
const keys = new Set();
const touch = new Set();
const params = new URLSearchParams(location.search);
const paramSeed = Number(params.get('seed'));
let seed = params.has('seed') && Number.isFinite(paramSeed) ? paramSeed >>> 0 : (Date.now() >>> 0);
let world = createWorld(seed);
let selectedId = null;
let previous = performance.now();
let accumulator = 0;
let lastUi = 0;
let modalState = '';
const FIXED_STEP = 1 / 30;

function readSavedPrograms() {
  try { return normalizePrograms(JSON.parse(localStorage.getItem('arcanomata:programs'))); }
  catch { return defaultPrograms(); }
}
world.programs = readSavedPrograms();

function savePrograms() {
  try { localStorage.setItem('arcanomata:programs', JSON.stringify(world.programs)); }
  catch { /* localStorage is optional in private browsing */ }
}
function option(value, text) {
  const element = document.createElement('option');
  element.value = value;
  element.textContent = text;
  return element;
}
function renderEditor() {
  const root = byId('programs');
  root.replaceChildren();
  for (const kind of SPELL_KINDS) {
    const card = document.createElement('section');
    card.className = 'spell-card ' + kind;
    const heading = document.createElement('div');
    heading.className = 'spell-card-head';
    const title = document.createElement('div');
    title.innerHTML = '<div class="spell-icon" aria-hidden="true">' + (kind === 'scout' ? '✧' : '✦') + '</div>';
    const texts = document.createElement('div');
    const eyebrow = document.createElement('div');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = kind.toUpperCase() + ' / AUTONOMOUS AGENT';
    const h3 = document.createElement('h3'); h3.textContent = LABELS[kind];
    texts.append(eyebrow, h3);
    title.append(texts);
    const count = document.createElement('span');
    count.className = 'spell-count';
    count.textContent = kind === 'scout' ? '侦察 · 广播' : '感知 · 猎杀';
    heading.append(title, count);
    card.append(heading);
    world.programs[kind].forEach((rule, index) => {
      const line = document.createElement('div');
      line.className = 'rule-row';
      const marker = document.createElement('div');
      marker.className = 'rule-number';
      marker.textContent = String(index + 1).padStart(2, '0');
      const pair = document.createElement('div');
      pair.className = 'rule-selects';
      const sensor = document.createElement('select');
      const action = document.createElement('select');
      sensor.setAttribute('aria-label', LABELS[kind] + ' 规则 ' + (index + 1) + ' 条件');
      action.setAttribute('aria-label', LABELS[kind] + ' 规则 ' + (index + 1) + ' 行为');
      for (const key of SENSORS) sensor.append(option(key, LABELS[key]));
      for (const key of ACTIONS) action.append(option(key, LABELS[key]));
      sensor.value = rule.when; action.value = rule.do;
      const update = () => {
        world.programs[kind][index] = { when: sensor.value, do: action.value };
        savePrograms();
      };
      sensor.addEventListener('change', update); action.addEventListener('change', update);
      const arrow = document.createElement('span'); arrow.textContent = '→';
      arrow.className = 'rule-arrow';
      pair.append(sensor, arrow, action);
      line.append(marker, pair);
      card.append(line);
    });
    root.append(card);
  }
}
function resetRun(newSeed = false) {
  if (newSeed) seed = Date.now() >>> 0;
  const program = normalizePrograms(world.programs);
  world = createWorld(seed);
  world.programs = program;
  selectedId = null;
  accumulator = 0;
  modalState = '';
  byId('overlay').classList.add('hidden');
  byId('seedDisplay').textContent = 'SEED ' + seed;
  updateUi(true);
}
function timeLabel(seconds) {
  const s = Math.floor(seconds);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
function updateUi(force = false) {
  byId('seedDisplay').textContent = 'SEED ' + seed;
  byId('phase').textContent = '第 ' + String(world.wave).padStart(2, '0') + ' 波 · ' + (world.status === 'running' ? '演化中' : '暂停');
  byId('runStatus').textContent = world.status.toUpperCase();
  byId('time').innerHTML = timeLabel(world.time) + ' <small>/ 03:00</small>';
  byId('health').innerHTML = Math.ceil(world.player.hp) + ' <small>/ 100</small>';
  byId('spells').textContent = world.spells.length;
  byId('kills').textContent = world.kills;
  byId('level').textContent = 'LV. ' + String(world.player.level).padStart(2, '0');
  byId('xpText').textContent = world.player.xp + ' / ' + world.player.nextXp + ' XP';
  byId('xpFill').style.width = (world.player.xp / world.player.nextXp * 100) + '%';
  byId('crossSignals').textContent = world.crossSignals;
  byId('marksWritten').textContent = world.totalSignals;
  byId('pulseCount').textContent = world.pulses;
  byId('pauseBtn').textContent = world.status === 'paused' ? '继续 · P' : '暂停 · P';
  const selected = world.spells.find(s => s.id === selectedId);
  if (selected) {
    byId('inspector').textContent = LABELS[selected.kind] + ' #' + selected.id +
      ' · 能量 ' + Math.floor(selected.energy) + ' · 寿命 ' + Math.floor(selected.age) +
      ' 秒 · 最近行为：' + selected.lastRule;
  } else {
    byId('inspector').textContent = '点击法术实体以查看感知和行为记录。法术会实时继承当前物种的程序。';
  }
  if (force || modalState !== world.status) {
    modalState = world.status;
    updateOverlay();
  }
}
function updateOverlay() {
  const overlay = byId('overlay');
  const body = byId('modalContent');
  body.replaceChildren();
  if (!['upgrade', 'won', 'lost'].includes(world.status)) {
    overlay.classList.add('hidden');
    return;
  }
  overlay.classList.remove('hidden');
  const label = document.createElement('div'); label.className = 'eyebrow';
  label.textContent = world.status === 'upgrade' ? 'EVOLUTION / NEW POSSIBILITY' : 'SIMULATION COMPLETE';
  const title = document.createElement('h2');
  title.textContent = world.status === 'upgrade' ? '选择下一次变异' : world.status === 'won' ? '世界存活了下来' : '魔法核心消亡';
  const note = document.createElement('p');
  note.textContent = world.status === 'upgrade'
    ? '每次升级只能选择一种环境优势，你编写的法术规则将继续生效。'
    : '存活 ' + timeLabel(world.time) + ' · 击败 ' + world.kills + ' 个敌人 · 跨种族响应 ' + world.crossSignals + ' 次。';
  body.append(label, title, note);
  const actions = document.createElement('div'); actions.className = 'modal-actions';
  if (world.status === 'upgrade') {
    for (const key of world.upgradeChoices) {
      const button = document.createElement('button');
      button.className = 'upgrade-choice';
      const strong = document.createElement('strong'); strong.textContent = UPGRADES[key].name;
      const small = document.createElement('span'); small.textContent = UPGRADES[key].description;
      button.append(strong, small);
      button.addEventListener('click', () => { chooseUpgrade(world, key); modalState = ''; updateUi(true); });
      actions.append(button);
    }
  } else {
    const button = document.createElement('button'); button.className = 'primary-button';
    button.textContent = '用相同种子重新演化';
    button.addEventListener('click', () => resetRun(false));
    actions.append(button);
  }
  body.append(actions);
}
function togglePause() {
  if (world.status === 'running') world.status = 'paused';
  else if (world.status === 'paused') world.status = 'running';
  updateUi(true);
}
window.addEventListener('keydown', event => {
  const editing = ['SELECT', 'INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (editing) return;
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  keys.add(key);
  if (!event.repeat && key === 'p') togglePause();
  if (!event.repeat && key === 'r') resetRun(false);
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => { keys.clear(); touch.clear(); });
canvas.addEventListener('pointerdown', event => {
  const box = canvas.getBoundingClientRect();
  const x = (event.clientX - box.left) * WORLD.width / box.width;
  const y = (event.clientY - box.top) * WORLD.height / box.height;
  let best = null, bestDist = 22 * 22;
  for (const spell of world.spells) {
    const d = (spell.x - x) ** 2 + (spell.y - y) ** 2;
    if (d < bestDist) { best = spell; bestDist = d; }
  }
  selectedId = best?.id ?? null;
  updateUi(true);
});
for (const button of document.querySelectorAll('[data-dir]')) {
  const dir = button.dataset.dir;
  button.addEventListener('pointerdown', event => {
    event.preventDefault(); touch.add(dir); button.setPointerCapture(event.pointerId);
  });
  const release = () => touch.delete(dir);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}
byId('pauseBtn').addEventListener('click', togglePause);
byId('restartBtn').addEventListener('click', () => resetRun(false));
byId('newSeedBtn').addEventListener('click', () => resetRun(true));
byId('resetRulesBtn').addEventListener('click', () => {
  world.programs = defaultPrograms(); savePrograms(); renderEditor();
});
function inputDirection() {
  return {
    dx: Number(keys.has('d') || keys.has('arrowright') || touch.has('right')) -
      Number(keys.has('a') || keys.has('arrowleft') || touch.has('left')),
    dy: Number(keys.has('s') || keys.has('arrowdown') || touch.has('down')) -
      Number(keys.has('w') || keys.has('arrowup') || touch.has('up'))
  };
}
function frame(now) {
  accumulator = Math.min(accumulator + Math.min((now - previous) / 1000, 0.1), 0.25);
  previous = now;
  const input = inputDirection();
  while (accumulator >= FIXED_STEP) {
    stepWorld(world, input, FIXED_STEP);
    accumulator -= FIXED_STEP;
  }
  drawWorld(ctx, world, selectedId);
  if (now - lastUi > 125) { updateUi(); lastUi = now; }
  requestAnimationFrame(frame);
}
renderEditor();
resetRun(false);
requestAnimationFrame(frame);
