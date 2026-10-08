import { WORLD } from '../core/world.js';

const scoutColor = '#84e0c7';
const hunterColor = '#d7a4ff';
function glow(ctx, x, y, radius, color, strength = 0.3) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalAlpha = strength;
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill(); ctx.restore();
}
function circle(ctx, x, y, r, fill) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
}
function polygon(ctx, x, y, sides, radius, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + i / sides * Math.PI * 2;
    const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
export function drawWorld(ctx, world, selectedId = null) {
  const { width, height } = WORLD;
  ctx.fillStyle = '#0b1120'; ctx.fillRect(0, 0, width, height);
  const bg = ctx.createRadialGradient(450, 280, 20, 450, 280, 590);
  bg.addColorStop(0, '#172039'); bg.addColorStop(1, '#090d18');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(142,158,207,0.055)';
  for (let x = 0; x < width; x += 28) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += 28) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(223,191,133,0.13)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, width - 12, height - 12);
  ctx.translate(width / 2, height / 2);
  ctx.rotate(world.time * 0.012);
  for (const r of [115, 205, 280]) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  // Marks are world-space signals, not visual-only effects.
  for (const mark of world.marks) {
    const color = mark.source === 'scout' ? scoutColor : hunterColor;
    glow(ctx, mark.x, mark.y, 26, color, Math.min(0.16, mark.ttl * 0.05));
    ctx.strokeStyle = color;
    ctx.globalAlpha = Math.min(0.55, mark.ttl * 0.18);
    ctx.lineWidth = 1;
    polygon(ctx, mark.x, mark.y, 4, 6, Math.PI / 4);
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  for (const enemy of world.enemies) {
    glow(ctx, enemy.x, enemy.y, 22, '#f77a8a', 0.23);
    ctx.save(); ctx.translate(enemy.x, enemy.y);
    ctx.rotate(world.time * 0.55 + enemy.id);
    polygon(ctx, 0, 0, 4, enemy.radius, Math.PI / 4);
    ctx.fillStyle = '#ae566b'; ctx.fill();
    ctx.strokeStyle = '#ff9da8'; ctx.lineWidth = 1; ctx.stroke();
    circle(ctx, 0, 0, 3, '#ffd3d7');
    ctx.restore();
  }
  for (const spell of world.spells) {
    const color = spell.kind === 'scout' ? scoutColor : hunterColor;
    glow(ctx, spell.x, spell.y, 24, color, 0.42);
    ctx.save(); ctx.translate(spell.x, spell.y);
    ctx.rotate(world.time * (spell.kind === 'scout' ? 0.8 : -0.7) + spell.id);
    polygon(ctx, 0, 0, spell.kind === 'scout' ? 3 : 4, 7, -Math.PI / 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#f4f4fc'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
    if (spell.id === selectedId) {
      ctx.beginPath(); ctx.arc(spell.x, spell.y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff1bd'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff1bd'; ctx.font = '10px monospace';
      ctx.fillText(Math.floor(spell.energy) + ' E', spell.x + 18, spell.y - 12);
      const otherMark = world.marks.find(m => m.source !== spell.kind &&
        (m.x - spell.x) ** 2 + (m.y - spell.y) ** 2 < 155 ** 2);
      if (otherMark) {
        ctx.save(); ctx.setLineDash([3, 6]); ctx.beginPath();
        ctx.moveTo(spell.x, spell.y); ctx.lineTo(otherMark.x, otherMark.y);
        ctx.strokeStyle = '#fff1bd'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
    }
  }
  const p = world.player;
  glow(ctx, p.x, p.y, 62, '#ffd993', 0.35);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(world.time * 0.45);
  ctx.strokeStyle = p.invulnerable > 0 ? '#ff8898' : '#ffd993';
  ctx.lineWidth = 2;
  polygon(ctx, 0, 0, 6, 17, Math.PI / 6); ctx.stroke();
  ctx.rotate(-world.time * 1.1);
  polygon(ctx, 0, 0, 4, 10, Math.PI / 4);
  ctx.fillStyle = '#fff3cf'; ctx.fill(); ctx.restore();
  circle(ctx, p.x, p.y, 3, '#ffffff');
  // Small floating progress arc around player.
  ctx.beginPath(); ctx.arc(p.x, p.y, 23, -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * (p.hp / 100));
  ctx.strokeStyle = '#d6b77c'; ctx.lineWidth = 2; ctx.stroke();
  if (world.status === 'paused') {
    ctx.fillStyle = 'rgba(8,12,22,0.28)'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#eae0cb'; ctx.textAlign = 'center'; ctx.font = 'bold 21px sans-serif';
    ctx.fillText('演化已暂停', width / 2, height / 2 - 75);
    ctx.textAlign = 'left';
  }
}
