import { createWorld, stepWorld, chooseUpgrade, UPGRADES, WORLD } from '../core/world.js';
import { ACTIONS, SENSORS, CHANNELS, SCOPES, LABELS, SPELL_KINDS, isCompatible, normalizeRule, defaultPrograms, normalizePrograms } from '../core/program.js';
import { createReplay, recordTick, recordRuleEdit, recordUpgrade, replayRun } from '../core/replay.js';
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
let tape = null;
let avgFrameMs = 0;
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
      const meta = document.createElement('div');
      meta.className = 'rule-meta';
      const channelLabel = document.createElement('label');
      channelLabel.textContent = '信号通道 ';
      const channel = document.createElement('select');
      channel.setAttribute('aria-label', LABELS[kind] + ' 规则 ' + (index + 1) + ' 信号通道');
      for (const key of CHANNELS) channel.append(option(key, LABELS[key]));
      channel.value = rule.channel;
      channelLabel.append(channel);
      const scopeLabel = document.createElement('label');
      scopeLabel.textContent = '目标来源 ';
      const scope = document.createElement('select');
      scope.setAttribute('aria-label', LABELS[kind] + ' 规则 ' + (index + 1) + ' 目标来源');
      for (const key of SCOPES) scope.append(option(key, LABELS[key]));
      scope.value = rule.scope;
      scopeLabel.append(scope);
      meta.append(channelLabel, scopeLabel);
      const updateVisible = () => {
        const showsChannel = sensor.value === 'mark' || action.value === 'mark';
        channelLabel.hidden = !showsChannel;
        scopeLabel.hidden = !['mark', 'ally'].includes(sensor.value);
        for (const opt of action.options) opt.disabled = !isCompatible(sensor.value, opt.value);
      };
      const update = (which) => {
        if (!isCompatible(sensor.value, action.value)) {
          if (which === 'action' && action.value === 'share') sensor.value = 'ally';
          else action.value = sensor.value === 'tick' ? 'split' : 'seek';
        }
        const next = normalizeRule({
          when: sensor.value, do: action.value, channel: channel.value, scope: scope.value
        }, world.programs[kind][index]);
        world.programs[kind][index] = next;
        if (tape) recordRuleEdit(tape, kind, index, next);
        updateVisible();
        savePrograms();
        updateUi(true);
      };
      sensor.addEventListener('change', () => update('sensor'));
      action.addEventListener('change', () => update('action'));
      channel.addEventListener('change', () => update('channel'));
      scope.addEventListener('change', () => update('scope'));
      const arrow = document.createElement('span'); arrow.textContent = '→';
      arrow.className = 'rule-arrow';
      pair.append(sensor, arrow, action);
      line.append(marker, pair);
      card.append(line, meta);
      updateVisible();
    });
    root.append(card);
  }
}
function resetRun(newSeed = false) {
  if (newSeed) seed = Date.now() >>> 0;
  const program = normalizePrograms(world.programs);
  world = createWorld(seed);
  world.programs = program;
  tape = createReplay(seed, program);
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
  byId('energyShared').textContent = Math.floor(world.energyShared);
  byId('frameTime').textContent = avgFrameMs.toFixed(1) + 'ms';
  byId('pauseBtn').textContent = world.status === 'paused' ? '继续 · P' : '暂停 · P';
  const selected = world.spells.find(s => s.id === selectedId);
  if (selected) {
    byId('inspector').textContent = LABELS[selected.kind] + ' #' + selected.id +
      ' · 能量 ' + Math.floor(selected.energy) + ' · 寿命 ' + Math.floor(selected.age) +
      ' 秒 · 最近行为：' + selected.lastRule + ' · 目标 #' +
      (selected.lastTargetId ?? '无');
  } else {
    byId('inspector').textContent = '点击法术实体查看它的目标、能量和近期规则记录。';
  }
  const feed = byId('traceFeed');
  feed.replaceChildren();
  const events = selected ? selected.trace : world.traces.slice(-6);
  for (const item of [...events].reverse()) {
    const div = document.createElement('div');
    div.className = 'trace-event' + (item.cross ? ' trace-cross' : '');
    const cause = item.when === 'mark' ? LABELS[item.channel] + '印记' : LABELS[item.when];
    div.textContent = item.t.toFixed(1) + 's · #' + item.spellId + ' R' +
      (item.ruleIndex + 1) + ' ' + cause + ' → ' + LABELS[item.action] +
      ' · 目标 ' + (item.targetId ?? '无') +
      ' · ΔE ' + item.deltaEnergy;
    feed.append(div);
  }
  if (!events.length) feed.textContent = '尚无行为记录。';
  byId('metrics').textContent = '峰值法术 ' + world.metrics.peakSpells +
    ' / 敌人 ' + world.metrics.peakEnemies +
    ' / 印记 ' + world.metrics.peakMarks +
    ' · 承受伤害 ' + world.metrics.damageTaken;
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
      button.addEventListener('click', () => {
        if (chooseUpgrade(world, key)) recordUpgrade(tape, key);
        modalState = ''; updateUi(true);
      });
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
  world.programs = defaultPrograms();
  for (const kind of SPELL_KINDS) for (let i = 0; i < 3; i++) {
    recordRuleEdit(tape, kind, i, world.programs[kind][i]);
  }
  savePrograms(); renderEditor();
});
byId('exportReplayBtn').addEventListener('click', () => {
  try {
    const reconstructed = replayRun(tape);
    const current = structuredClone(world);
    if (current.status === 'paused') current.status = 'running';
    if (JSON.stringify(reconstructed) !== JSON.stringify(current)) {
      throw new Error('当前状态与录制事件不一致');
    }
    const blob = new Blob([JSON.stringify(tape)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'arcanomata-' + seed + '.replay.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    byId('replayStatus').textContent = '回放验证通过 · 已导出';
  } catch (error) {
    byId('replayStatus').textContent = '回放验证失败：' + error.message;
  }
});
byId('importReplayBtn').addEventListener('click', () => byId('importReplayFile').click());
byId('importReplayFile').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const candidate = JSON.parse(await file.text());
    const reconstructed = replayRun(candidate);
    world = reconstructed;
    seed = candidate.seed >>> 0;
    tape = candidate;
    selectedId = null;
    accumulator = 0;
    savePrograms();
    renderEditor(); updateUi(true);
    byId('replayStatus').textContent = '已还原记录的最终演化状态';
  } catch (error) {
    byId('replayStatus').textContent = '导入失败：' + error.message;
  } finally { event.target.value = ''; }
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
  const started = performance.now();
  while (accumulator >= FIXED_STEP) {
    if (world.status === 'running') {
      recordTick(tape, input);
      stepWorld(world, input, FIXED_STEP);
    }
    accumulator -= FIXED_STEP;
  }
  drawWorld(ctx, world, selectedId);
  avgFrameMs = avgFrameMs * 0.9 + (performance.now() - started) * 0.1;
  if (now - lastUi > 125) { updateUi(); lastUi = now; }
  requestAnimationFrame(frame);
}
renderEditor();
resetRun(false);
if (params.get('smoke') === '1') {
  window.__ARCA_TEST__ = {
    getWorld: () => world,
    getTape: () => tape,
    step: (input = { dx: 0, dy: 0 }) => {
      if (world.status === 'running') { recordTick(tape, input); stepWorld(world, input, FIXED_STEP); }
      updateUi(true);
    }
  };
  import('../../tests/browser-acceptance.js').catch(error => {
    document.body.dataset.smoke = 'FAIL ' + error.message;
  });
}
requestAnimationFrame(frame);
