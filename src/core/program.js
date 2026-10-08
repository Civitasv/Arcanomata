export const SPELL_KINDS = ['scout', 'hunter'];
export const SENSORS = ['enemy', 'ally', 'mark', 'contact', 'tick'];
export const ACTIONS = ['seek', 'flee', 'orbit', 'mark', 'pulse', 'split', 'share'];
export const CHANNELS = ['beacon', 'danger', 'supply'];
export const SCOPES = ['other', 'self', 'any'];
export const LABELS = {
  scout: '探路火种', hunter: '猎杀火种',
  enemy: '感知敌人', ally: '感知同伴', mark: '魔法信号', contact: '接触敌人', tick: '持续运行',
  seek: '趋近目标', flee: '远离目标', orbit: '环绕目标',
  pulse: '释放脉冲', split: '自我分裂', share: '转移能量',
  beacon: '引导', danger: '危险', supply: '补给',
  other: '其他物种', self: '相同物种', any: '任意来源'
};
export const DEFAULT_CHANNEL = 'beacon';
export const DEFAULT_SCOPE = 'other';
const defaults = {
  scout: [
    { when: 'enemy', do: 'mark', channel: 'beacon', scope: 'other' },
    { when: 'enemy', do: 'flee', channel: 'beacon', scope: 'other' },
    { when: 'tick', do: 'split', channel: 'beacon', scope: 'other' }
  ],
  hunter: [
    { when: 'mark', do: 'seek', channel: 'beacon', scope: 'other' },
    { when: 'enemy', do: 'seek', channel: 'beacon', scope: 'other' },
    { when: 'enemy', do: 'pulse', channel: 'beacon', scope: 'other' }
  ]
};
export function isCompatible(when, action) {
  if (!SENSORS.includes(when) || !ACTIONS.includes(action)) return false;
  if (action === 'share') return when === 'ally';
  if (['seek', 'flee', 'orbit'].includes(action)) return when !== 'tick';
  return true;
}
export function defaultPrograms() {
  return structuredClone(defaults);
}
export function normalizeRule(proposed, fallback) {
  if (!proposed || !isCompatible(proposed.when, proposed.do)) return { ...fallback };
  return {
    when: proposed.when,
    do: proposed.do,
    channel: CHANNELS.includes(proposed.channel) ? proposed.channel : DEFAULT_CHANNEL,
    scope: SCOPES.includes(proposed.scope) ? proposed.scope : DEFAULT_SCOPE
  };
}
export function normalizePrograms(value) {
  const result = defaultPrograms();
  if (!value || typeof value !== 'object') return result;
  for (const kind of SPELL_KINDS) {
    if (!Array.isArray(value[kind])) continue;
    for (let i = 0; i < 3; i++) {
      result[kind][i] = normalizeRule(value[kind][i], result[kind][i]);
    }
  }
  return result;
}
