export const SPELL_KINDS = ['scout', 'hunter'];
export const SENSORS = ['enemy', 'ally', 'mark', 'contact', 'tick'];
export const ACTIONS = ['seek', 'flee', 'orbit', 'mark', 'pulse', 'split', 'share'];
export const LABELS = {
  scout: '探路火种', hunter: '猎杀火种',
  enemy: '感知敌人', ally: '感知同伴', mark: '异种印记', contact: '接触敌人', tick: '持续运行',
  seek: '趋近目标', flee: '远离目标', orbit: '环绕目标',
  mark: '刻画印记', pulse: '释放脉冲', split: '自我分裂', share: '转移能量'
};
const defaults = {
  scout: [
    { when: 'enemy', do: 'mark' },
    { when: 'enemy', do: 'flee' },
    { when: 'tick', do: 'split' }
  ],
  hunter: [
    { when: 'mark', do: 'seek' },
    { when: 'enemy', do: 'seek' },
    { when: 'contact', do: 'pulse' }
  ]
};
export function defaultPrograms() {
  return structuredClone(defaults);
}
export function normalizePrograms(value) {
  const result = defaultPrograms();
  if (!value || typeof value !== 'object') return result;
  for (const kind of SPELL_KINDS) {
    if (!Array.isArray(value[kind])) continue;
    for (let i = 0; i < 3; i++) {
      const proposed = value[kind][i];
      if (proposed && SENSORS.includes(proposed.when) && ACTIONS.includes(proposed.do)) {
        result[kind][i] = { when: proposed.when, do: proposed.do };
      }
    }
  }
  return result;
}
