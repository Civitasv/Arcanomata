const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const test = window.__ARCA_TEST__;
const pause = document.getElementById('pauseBtn');
const reset = document.getElementById('restartBtn');
const run = () => {
  assert(test && test.getWorld && test.step, 'test hooks should be available only in smoke mode');
  assert(document.querySelectorAll('.spell-card').length === 2, 'two independent program editors');
  assert(document.querySelectorAll('.rule-row').length === 6, 'six programmable rules');
  assert(document.querySelectorAll('.rule-meta').length === 6, 'channel and source controls');
  assert(document.getElementById('arena').getContext('2d'), 'Canvas renderer created');
  assert(document.querySelector('button[data-dir="up"]'), 'touch D-pad exists');
  assert(getComputedStyle(document.querySelector('.spell-card')).display !== 'none', 'editor visible');
  const originalX = test.getWorld().player.x;
  test.step({ dx: 1, dy: 0 });
  assert(test.getWorld().player.x > originalX, 'movement input changes player position');
  pause.click();
  assert(test.getWorld().status === 'paused', 'pause works');
  const pausedTime = test.getWorld().time;
  test.step({ dx: 1, dy: 0 });
  assert(test.getWorld().time === pausedTime, 'paused simulation freezes');
  pause.click();
  assert(test.getWorld().status === 'running', 'resume works');

  const sensor = document.querySelector('.spell-card.scout .rule-row select[aria-label*="条件"]');
  const action = document.querySelector('.spell-card.scout .rule-row select[aria-label*="行为"]');
  const hunterBefore = JSON.stringify(test.getWorld().programs.hunter);
  sensor.value = 'ally'; sensor.dispatchEvent(new Event('change', { bubbles: true }));
  action.value = 'share'; action.dispatchEvent(new Event('change', { bubbles: true }));
  assert(test.getWorld().programs.scout[0].do === 'share', 'edited scout program');
  assert(JSON.stringify(test.getWorld().programs.hunter) === hunterBefore, 'hunter untouched');
  const scope = document.querySelector('.spell-card.scout .rule-meta select[aria-label*="目标来源"]');
  assert(!scope.closest('label').hidden, 'ally source control visible');
  scope.value = 'other'; scope.dispatchEvent(new Event('change', { bubbles: true }));
  assert(test.getWorld().programs.scout[0].scope === 'other', 'source scope edited');
  const channel = document.querySelector('.spell-card.scout .rule-meta select[aria-label*="信号通道"]');
  assert(channel && channel.options.length === 3, 'three typed channels');

  const first = test.getWorld().spells[0];
  const canvas = document.getElementById('arena');
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, clientX: rect.left + first.x * rect.width / canvas.width,
    clientY: rect.top + first.y * rect.height / canvas.height
  }));
  assert(document.getElementById('inspector').textContent.includes('#' + first.id), 'inspector select');
  document.getElementById('resetRulesBtn').click();
  assert(test.getWorld().programs.scout[0].do === 'mark', 'reset programs');

  const world = test.getWorld();
  world.player.xp = world.player.nextXp - 1;
  world.enemies = [{ id: 99999, x: world.spells[1].x + 10, y: world.spells[1].y, hp: 3, speed: 0, radius: 12 }];
  test.step();
  assert(world.status === 'upgrade', 'pulse kills and opens upgrade');
  const option = document.querySelector('.upgrade-choice');
  assert(option, 'upgrade modal renders choices');
  option.click();
  assert(world.status === 'running', 'choosing upgrade resumes gameplay');
  reset.click();
  assert(test.getWorld().time === 0, 'retry resets run');
  assert(document.getElementById('traceFeed'), 'causal trace panel present');
  document.body.dataset.smoke = 'PASS';
};
try { run(); }
catch (error) {
  document.body.dataset.smoke = 'FAIL: ' + error.stack;
  console.error('ARCA_BROWSE_SMOKE_FAILURE', error);
}
