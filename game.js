// game.js — игровая система: опыт и уровни, карта пути, боссы, сокровища, задания и колесо шута.
import * as db from './database.js';
import { icon } from './icons.js';
import { $, $$, esc, D, money, plural, bus, modal, form, toast, undoToast, confirmDialog, seg, empty, heading, sound, rand, pick, say, sleep, resizeImage, pickFile, clamp } from './ui.js';
import { P, G, Pt, L, E, C, setMood, heroes, daggerSVG, dagger, coin, star4 } from './art.js';
import { BOSSES, BOSS_ART, bossSVG, bossG, setBossState, chestSVG, treasureTier } from './bosses.js';
import { MAP, stageScene } from './scenes.js';
import { burst, flyText } from './animations.js';

export const PER_LEVEL = 100, MAX_LEVEL = 40;
export { BOSSES };

// ---------------- опыт и уровни ----------------
export function totalXP() { return db.all('xpLog').reduce((s, x) => s + (x.amount || 0), 0); }
export function levelInfo(xp = totalXP()) {
  const done = xp >= MAX_LEVEL * PER_LEVEL;
  const level = done ? MAX_LEVEL : Math.floor(xp / PER_LEVEL) + 1;
  const inLevel = done ? PER_LEVEL : xp % PER_LEVEL;
  const nextBoss = BOSSES.find(b => xp < b.level * PER_LEVEL) || null;
  return { xp, level, inLevel, done, nextBoss, toBoss: nextBoss ? nextBoss.level * PER_LEVEL - xp : 0, glory: Math.max(0, xp - MAX_LEVEL * PER_LEVEL) };
}
const openedSet = () => new Set(db.gstate('opened', []));
export function bossState(b, xp = totalXP()) {
  if (xp >= b.level * PER_LEVEL) return openedSet().has(b.level) ? 'opened' : 'defeated';
  const lvl = Math.floor(xp / PER_LEVEL) + 1;
  if (lvl === b.level) return 'fight';
  if (lvl >= b.level - 4) return 'waiting';
  return 'locked';
}
export const STATE_LABEL = { locked: 'ещё не открыт', waiting: 'ожидает', fight: 'противостояние', defeated: 'побеждён', opened: 'сокровище открыто' };
export function treasure(level) { return db.get('treasures', 'L' + level) || null; }

// ---------------- задания и цели ----------------
export const KIND = { regular: 'Регулярная', weekly: 'Еженедельная', monthly: 'Ежемесячная', once: 'Разовая', wheel: 'Для колеса' };
const PERIODIC = ['regular', 'weekly', 'monthly'];
export function quests() { return db.all('quests').sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt); }
export function runs() { return db.all('questRuns'); }
export function activeRuns() { return runs().filter(r => r.status === 'active').sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')); }
function currentPeriod(q, t) {
  if (q.kind === 'weekly') return { key: D.isoWeek(t), start: D.weekStart(t), due: D.weekEnd(t) };
  if (q.kind === 'monthly') return { key: t.slice(0, 7), start: D.monthStart(t), due: D.monthEnd(t) };
  const n = Math.max(1, parseInt(q.everyDays) || 1), anchor = q.createdDate || t;
  const idx = Math.max(0, Math.floor(D.diff(anchor, t) / n)); const start = D.add(anchor, idx * n);
  return { key: 'r' + idx, start, due: D.add(start, n - 1) };
}
const mkRun = (q, key, start, due, source) => ({ id: `${q.id}:${key}`, questId: q.id, periodKey: key, title: q.title, description: q.description || '', xp: q.xp, steps: Math.max(1, q.steps || 1), progress: 0, start, due, status: 'active', source, createdAt: Date.now() });
export async function refreshQuests() {
  const t = D.today(); const ops = [];
  for (const q of db.all('quests')) {
    if (q.status !== 'active') continue;
    if (PERIODIC.includes(q.kind)) {
      const p = currentPeriod(q, t);
      if (!db.get('questRuns', `${q.id}:${p.key}`)) ops.push({ store: 'questRuns', put: mkRun(q, p.key, p.start, p.due, 'schedule') });
    } else if (q.kind === 'once' && !q.inWheel) {
      if (!db.get('questRuns', `${q.id}:once`)) ops.push({ store: 'questRuns', put: mkRun(q, 'once', q.createdDate || t, q.deadline || '', 'schedule') });
    }
  }
  for (const r of runs()) if (r.status === 'active' && r.due && r.due < t) { ops.push({ store: 'questRuns', put: { ...r, status: 'expired', endedAt: Date.now() } }); }
  if (ops.length) await db.commit(ops);
  const expired = ops.filter(o => o.put && o.put.status === 'expired');
  if (expired.length) db.journal('quest', `Просрочено заданий: ${expired.length} (${expired.map(o => o.put.title).slice(0, 3).join(', ')})`);
}
export function streak(q) {
  if (!PERIODIC.includes(q.kind)) return 0;
  const rs = runs().filter(r => r.questId === q.id && r.source === 'schedule').sort((a, b) => b.start.localeCompare(a.start));
  let n = 0, i = 0;
  if (rs[0] && rs[0].status === 'active') i = 1;
  for (; i < rs.length; i++) { if (rs[i].status === 'done') n++; else break; }
  return n;
}
export async function stepRun(runId, origin) {
  const r = db.get('questRuns', runId);
  if (!r || r.status !== 'active') { toast('Это задание уже завершено'); return; }
  const progress = (r.progress || 0) + 1;
  if (progress < r.steps) {
    await db.commit([{ store: 'questRuns', put: { ...r, progress } }]);
    sound.play('step'); toast(`Шаг ${progress} из ${r.steps}: «${r.title}»`);
    return;
  }
  await completeRun(r, origin);
}
export async function completeRun(r, origin) {
  const before = totalXP();
  const fresh = { ...r, progress: r.steps, status: 'done', doneAt: Date.now(), doneDate: D.today() };
  try {
    await db.commit([{ store: 'questRuns', put: fresh }, { store: 'xpLog', add: { id: 'run:' + r.id, amount: r.xp, ts: Date.now(), date: D.today(), source: 'quest', refId: r.id, title: r.title } }]);
  } catch (e) {
    if (e && e.name === 'ConstraintError') { toast('Опыт за это задание уже начислен'); return; }
    throw e;
  }
  const after = totalXP();
  db.journal('quest', `Выполнено задание «${r.title}»: +${r.xp} опыта`);
  sound.play('fanfare');
  if (origin) { const rc = origin.getBoundingClientRect(); flyText(rc.left + rc.width / 2, rc.top, `+${r.xp} опыта`); burst(rc.left + rc.width / 2, rc.top + rc.height / 2, 14); }
  bus.emit('xp', { from: before, to: after, title: r.title });
  const lb = Math.floor(before / PER_LEVEL), la = Math.floor(after / PER_LEVEL);
  toast(la > lb ? `Задание выполнено! +${r.xp} опыта — новый уровень ${Math.min(MAX_LEVEL, la + 1)}!` : `Задание выполнено! +${r.xp} опыта`, { kind: 'good', action: { label: 'Отменить', fn: async () => {
    await db.commit([{ store: 'questRuns', put: r, keepStamp: true }, { store: 'xpLog', del: 'run:' + r.id }]);
    bus.emit('xp', { from: after, to: totalXP(), undo: true }); toast('Выполнение отменено, опыт возвращён');
  } } });
}
export async function abandonRun(runId) {
  const r = db.get('questRuns', runId); if (!r) return;
  if (!await confirmDialog({ title: 'Отказаться от задания?', text: `«${r.title}» уйдёт в летопись как оставленное, опыт не начислится.`, ok: 'Отказаться' })) return;
  await db.commit([{ store: 'questRuns', put: { ...r, status: 'abandoned', endedAt: Date.now() } }]);
  undoToast('Задание оставлено', () => db.commit([{ store: 'questRuns', put: r, keepStamp: true }]));
}
export async function startRun(q, source = 'manual') {
  const t = D.today(); const key = (source === 'wheel' ? 'w' : 'm') + Date.now().toString(36);
  const due = q.kind === 'once' && q.deadline ? q.deadline : D.add(t, Math.max(1, parseInt(q.durationDays) || 7) - 1);
  const run = mkRun(q, key, t, due, source);
  await db.commit([{ store: 'questRuns', put: run }]);
  db.journal('quest', `Принято задание «${q.title}» до ${D.dmy(due)}`);
  return run;
}
export function wheelCandidates() {
  const act = new Set(activeRuns().map(r => r.questId));
  const done = new Set(runs().filter(r => r.status === 'done').map(r => r.questId));
  return quests().filter(q => q.status === 'active' && q.inWheel && !PERIODIC.includes(q.kind) && !act.has(q.id) && (q.repeatable || !done.has(q.id)));
}
export function questRow(r, { compact = false } = {}) {
  const q = db.get('quests', r.questId);
  const st = q ? streak(q) : 0;
  const left = r.due ? D.diff(D.today(), r.due) : null;
  const dueTxt = r.due ? (left === 0 ? 'сегодня последний день' : left === 1 ? 'до завтра' : `ещё ${left} ${plural(left, ['день', 'дня', 'дней'])}`) : 'без срока';
  const pips = r.steps > 1 ? `<div class="pips">${Array.from({ length: Math.min(r.steps, 20) }, (_, i) => `<i class="${i < r.progress ? 'on' : ''}"></i>`).join('')}</div>` : '';
  return `<div class="quest" data-run="${r.id}"><div class="qmain"><div class="qt">${esc(r.title)}</div>
    <div class="qm"><span class="xp">+${r.xp} опыта</span><span>${q ? KIND[q.kind] : ''}</span><span>${dueTxt}</span>${r.steps > 1 ? `<span>шаг ${r.progress}/${r.steps}</span>` : ''}${st ? `<span class="streak">${icon('candle')}серия ${st}</span>` : ''}</div>${pips}</div>
    ${compact ? '' : `<button class="icon-btn sm" data-abandon="${r.id}" title="Отказаться">${icon('close')}</button>`}
    <button class="qbtn ${r.steps > 1 && r.progress + 1 < r.steps ? 'step' : ''}" data-step="${r.id}" aria-label="${r.steps > 1 && r.progress + 1 < r.steps ? 'Отметить шаг' : 'Выполнено'}">${r.steps > 1 && r.progress + 1 < r.steps ? `+1` : icon('check')}</button></div>`;
}
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-step]'); if (s) { e.preventDefault(); stepRun(s.dataset.step, s); return; }
  const a = e.target.closest('[data-abandon]'); if (a) { e.preventDefault(); abandonRun(a.dataset.abandon); }
});

// ---------------- карта пути ----------------
const NODE_X = (i) => 110 + i * 110, MAP_W = NODE_X(MAX_LEVEL) + 150, MAP_H = 260, DY = 120, WORLD_H = MAP_H + DY + 50;
export const MAP_SIZE = { w: MAP_W, h: WORLD_H, dy: DY };
const NODE_Y = (i) => Math.round(172 + 26 * Math.sin(i * .78) + 10 * Math.sin(i * 2.1 + 1));
const nodes = Array.from({ length: MAX_LEVEL + 1 }, (_, i) => [NODE_X(i), NODE_Y(i)]);
function segPts(i) { // контрольные точки сегмента i: nodes[i] → nodes[i+1]
  const p0 = nodes[Math.max(0, i - 1)], p1 = nodes[i], p2 = nodes[i + 1], p3 = nodes[Math.min(MAX_LEVEL, i + 2)];
  return [p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2];
}
function bez(s, t) { const m = 1 - t; const f = (k) => m * m * m * s[0][k] + 3 * m * m * t * s[1][k] + 3 * m * t * t * s[2][k] + t * t * t * s[3][k]; return [f(0), f(1)]; }
export function heroPoint(xp) { const v = clamp(xp, 0, MAX_LEVEL * PER_LEVEL); const i = Math.min(MAX_LEVEL - 1, Math.floor(v / PER_LEVEL)); const t = v >= MAX_LEVEL * PER_LEVEL ? 1 : (v % PER_LEVEL) / PER_LEVEL; return bez(segPts(i), t); }
const segD = (i) => { const s = segPts(i); return `M${s[0][0]} ${s[0][1]}C${s[1][0].toFixed(1)} ${s[1][1].toFixed(1)} ${s[2][0].toFixed(1)} ${s[2][1].toFixed(1)} ${s[3][0]} ${s[3][1]}`; };
const REGION_COL = ['#b9c27f', '#a4a493', '#9fbf8a', '#d8c070', '#8f9a62', '#8a7f8c', '#6f8a5a', '#c9b98a'];
function regionArt(r) {
  const x0 = NODE_X(r * 5), x1 = NODE_X(r * 5 + 5), mid = (x0 + x1) / 2, M = MAP;
  switch (r) {
    case 0: return M.hill(x0 + 90, 120, 260, 50, '#a9b46e') + M.windmill(x0 + 210, 112, 1) + M.tree(x0 + 300, 125, .9) + M.tree(x0 + 330, 130, .7) + M.stall(x1 - 120, 118, 1, P.red) + M.stall(x1 - 70, 112, .9, P.gold) + M.stall(x1 - 165, 124, .8, P.greenL) + M.rock(x0 + 160, 238, .8) + M.tree(x0 + 420, 250, .7);
    case 1: return M.mountain(x0 + 120, 130, 240, 100) + M.mountain(x0 + 260, 130, 200, 80, false) + M.mountain(mid + 120, 130, 300, 115) + M.mountain(x1 - 60, 132, 220, 95) + Pt(`M${x1 - 70} 132C${x1 - 70} 108 ${x1 - 30} 108 ${x1 - 30} 132Z`, '#2a2420') + M.rock(x0 + 230, 236, 1.1) + M.rock(mid + 60, 244, .9);
    case 2: return M.waves(x0 + 140, x0 + 330, 214, '#7fa6b8') + M.bridge(x0 + 170, 206, 120) + M.house(mid + 80, 118, 1.1, P.burgD) + M.tree(x0 + 60, 122, .9) + M.tree(mid, 124, 1) + Pt(`M${x1 - 120} 126h12v-44h-12Z`, P.wood) + Pt(`M${x1 - 114} 90L${x1 - 30} 84L${x1 - 30} 92L${x1 - 114} 98Z`, P.white, 'k1') + M.house(x1 - 160, 124, .8);
    case 3: return M.tent(x0 + 90, 124, 1.1, P.burg) + M.tent(x0 + 160, 118, .9, P.gold) + M.tent(mid + 40, 126, 1.2, P.greenD) + M.tent(x1 - 150, 120, 1, P.red) + L(`M${x0 + 60} 72Q${mid} 104 ${x1 - 60} 72`, 'k1') + Array.from({ length: 9 }, (_, i) => Pt(`M${x0 + 80 + i * 45} ${80 + Math.sin(i / 8 * Math.PI) * 18}l14 1l-7 12Z`, [P.burg, P.gold, P.greenD][i % 3], 'k1')).join('') + M.stall(mid + 140, 232, .9, P.gold);
    case 4: return Pt(`M${x0 + 60} 238q60-16 130 0q-60 12-130 0Z`, '#7f9b86', 'k1') + Pt(`M${mid + 20} 120q80-14 160 0q-80 12-160 0Z`, '#7f9b86', 'k1') + M.reeds(x0 + 70, 236) + M.reeds(x0 + 190, 238) + M.reeds(mid + 30, 120) + M.reeds(mid + 170, 118) + M.reeds(x1 - 80, 240) + Pt(`M${x0 + 300} 126l-4-40l-14-14M${x0 + 296} 96l12-14`, 'none').replace('fill="none"', 'fill="none" class="k"') + `<ellipse cx="${mid}" cy="100" rx="200" ry="14" fill="#fff" opacity=".35"/>`;
    case 5: return M.hill(mid + 20, 132, 380, 70, '#776c78') + M.castle(mid + 40, 98, 1.1) + Pt(`M${x0 + 80} 128l-2-36l-12-12M${x0 + 78} 102l12-10`, 'none').replace('fill="none"', 'fill="none" class="k"') + M.crow(x0 + 140, 70) + M.crow(mid + 160, 54) + M.rock(x1 - 70, 242, 1) + M.rock(x0 + 120, 240, .8);
    case 6: return Array.from({ length: 11 }, (_, i) => M.fir(x0 + 30 + i * 50, 128 + (i % 2) * 6, .9 + (i % 3) * .15, i % 2 ? P.greenD : '#2f4a2e')).join('') + M.hut(mid + 30, 128, 1.1) + M.fir(x0 + 60, 250, .7) + M.fir(mid + 150, 252, .8) + M.fir(x1 - 40, 250, .7);
    case 7: return `<rect x="${mid - 40}" y="60" width="${x1 - mid + 190}" height="72" fill="#7fa6b8" opacity=".55"/>` + M.waves(mid - 40, x1 + 150, 104, '#5d8aa0') + M.ship(mid + 60, 98, 1) + Pt(`M${x0} 132Q${mid - 60} 120 ${mid - 40} 132Z`, '#d9c79a', 'k1') + M.waves(x0 + 140, x1 + 150, 234, '#7fa6b8');
  }
  return '';
}
const SKY_ART = [
  (x0, x1) => { let s = ''; const k = (x, h, dome) => Pt(`M${x - 14} 150V${150 - h}H${x + 14}V150Z`, '#efe6d2', 'k1') + Pt(`M${x - 12} ${150 - h}C${x - 14} ${150 - h - 14} ${x - 4} ${150 - h - 18} ${x} ${150 - h - 30}C${x + 4} ${150 - h - 18} ${x + 14} ${150 - h - 14} ${x + 12} ${150 - h}Z`, dome, 'k1') + L(`M${x} ${150 - h - 30}v-10M${x - 4} ${150 - h - 36}h8`, 'k1');
    s += Pt(`M${x0 + 20} 150V112H${x0 + 260}V150Z`, '#e4d6b8', 'k1') + Array.from({ length: 9 }, (_, i) => Pt(`M${x0 + 20 + i * 30} 112v-8h14v8Z`, '#e4d6b8', 'k1')).join('');
    s += k(x0 + 70, 70, P.gold) + k(x0 + 120, 92, P.blue) + k(x0 + 170, 78, P.green) + k(x0 + 220, 60, P.gold) + k(x0 + 380, 54, P.green) + Pt(`M${x0 + 360} 150V104H${x0 + 400}V150Z`, '#f0e8d6', 'k1');
    return s; },
  (x0, x1) => Pt(`M${x0 - 40} 150L${x0 + 60} 70L${x0 + 140} 110L${x0 + 260} 40L${x0 + 380} 120L${x0 + 470} 60L${x1 + 40} 150Z`, '#a7b3c2', '') + Pt(`M${x0 + 230} 64L${x0 + 260} 40L${x0 + 292} 66L${x0 + 270} 60Z`, '#f6f1e6', ''),
  (x0, x1) => Pt(`M${x0} 150Q${x0 + 120} 126 ${x0 + 250} 140T${x1} 136V150Z`, '#b9c79a', '') + [x0 + 160, x0 + 300].map(x => Pt(`M${x - 10} 140V112H${x + 10}V140Z`, '#efe6d2', 'k1') + Pt(`M${x - 9} 112C${x - 10} 100 ${x} 96 ${x} 86C${x} 96 ${x + 10} 100 ${x + 9} 112Z`, P.blue, 'k1')).join(''),
  (x0, x1) => Array.from({ length: 6 }, (_, i) => Pt(`M${x0 + 40 + i * 80} 150L${x0 + 60 + i * 80} 116L${x0 + 80 + i * 80} 150Z`, [P.red, P.gold, P.green][i % 3], 'k1')).join(''),
  (x0, x1) => `<ellipse cx="${(x0 + x1) / 2}" cy="132" rx="${(x1 - x0) / 2}" ry="22" fill="#fff" opacity=".45"/>` + Pt(`M${x0 + 60} 150q40-30 80 0M${x0 + 260} 150q30-24 60 0`, '#90a58e', ''),
  (x0, x1) => Pt(`M${x0} 150L${x0 + 120} 96L${x0 + 220} 122L${x0 + 330} 80L${x1} 150Z`, '#7c7086', '') + Pt(`M${x0 + 300} 150V70H${x0 + 316}V58L${x0 + 324} 44L${x0 + 332} 58V70H${x0 + 348}V150Z`, '#4a4352', ''),
  (x0, x1) => Array.from({ length: 14 }, (_, i) => Pt(`M${x0 + i * 40} 150L${x0 + 20 + i * 40} ${96 + (i % 3) * 10}L${x0 + 40 + i * 40} 150Z`, '#5b7a62', '')).join(''),
  (x0, x1) => `<rect x="${x0 + 200}" y="120" width="${x1 - x0}" height="30" fill="#9cc0d0"/>` + `<g class="far-sail">${Pt(`M${x0 + 340} 126L${x0 + 360} 126L${x0 + 356} 132H${x0 + 344}Z`, P.wood, '')}${Pt(`M${x0 + 350} 126V104L${x0 + 362} 122Z`, P.cream, '')}</g>`
];
function skyBand() {
  let s = `<rect width="${MAP_W}" height="${DY + 160}" fill="url(#skyg)"/>`;
  s += Array.from({ length: 14 }, (_, i) => `<g class="cloud" style="animation-duration:${(80 + (i % 5) * 22)}s;animation-delay:-${i * 13}s"><ellipse cx="${i * 340 + 80}" cy="${30 + (i % 3) * 22}" rx="${46 + (i % 4) * 12}" ry="13" fill="#fffaf0" opacity=".85"/><ellipse cx="${i * 340 + 110}" cy="${24 + (i % 3) * 22}" rx="30" ry="12" fill="#fffaf0" opacity=".85"/></g>`).join('');
  s += `<g class="horizon" transform="translate(0 ${DY - 18})">${SKY_ART.map((f, r) => f(NODE_X(r * 5), NODE_X(r * 5 + 5))).join('')}</g>`;
  s += Array.from({ length: 6 }, (_, i) => `<g class="bird" style="animation-delay:-${i * 3.1}s"><path class="k1 nf" d="M${300 + i * 760} ${46 + (i % 3) * 14}q6-6 12 0q6-6 12 0"/></g>`).join('');
  return s;
}
function signposts() {
  let s = '';
  for (let r = 0; r < 8; r++) {
    const x = r ? NODE_X(r * 5) - 70 : NODE_X(0) + 40, y = (r ? NODE_Y(r * 5) : NODE_Y(0)) + 40;
    const b = BOSSES[r];
    s += `<g class="signpost">${Pt(`M${x - 2} ${y + 34}v-58h4v58Z`, P.woodD, 'k1')}<g class="sign-board">${Pt(`M${x + 2} ${y - 24}h${b.place.length * 6.2 + 14}l8 7l-8 7h-${b.place.length * 6.2 + 14}Z`, '#d9b98a', 'k1')}<text x="${x + 8}" y="${y - 13.5}" style="font:600 10px Lora,serif;fill:#3d2a1c">${esc(b.place)}</text></g></g>`;
  }
  // развилки: тропинки к колодцу, избушке и пристани
  [[8, 'well', -1], [17, 'hut', 1], [26, 'well', 1], [34, 'pier', -1]].forEach(([i, k, side]) => {
    const [x, y] = nodes[i]; const ex = x + 70, ey = y + side * 52;
    s += `<path d="M${x} ${y}Q${x + 30} ${y + side * 10} ${ex} ${ey}" fill="none" stroke="#efe0bf" stroke-width="7" stroke-linecap="round"/><path d="M${x} ${y}Q${x + 30} ${y + side * 10} ${ex} ${ey}" fill="none" stroke="#a07a4c" stroke-width="1.5" stroke-dasharray="4 6"/>`;
    if (k === 'well') s += `<g transform="translate(${ex} ${ey + 6})">${Pt('M-12 0v-12h24V0Z', '#9a8f80')}${L('M-12-12v-18M12-12v-18M-14-30h28', 'k')}${Pt('M-3-26h6v8h-6Z', P.wood, 'k1')}</g>`;
    if (k === 'hut') s += MAP.hut(ex, ey + 8, .6);
    if (k === 'pier') s += `<g transform="translate(${ex} ${ey})">${Pt('M-20 0h40v5h-40Z', P.wood)}${L('M-16 5v10M0 5v10M16 5v10', 'k1')}</g>`;
  });
  // ступени на горном перевале
  for (let v = 5.2; v < 9.8; v += .22) { const [x, y] = heroPoint(v * PER_LEVEL); const [x2, y2] = heroPoint(v * PER_LEVEL + 3); const a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2; s += `<path class="k1 nf" d="M${(x - Math.cos(a) * 6).toFixed(1)} ${(y - Math.sin(a) * 6).toFixed(1)}L${(x + Math.cos(a) * 6).toFixed(1)} ${(y + Math.sin(a) * 6).toFixed(1)}" opacity=".55"/>`; }
  // далёкие путники на дальней дороге
  s += `<g class="walker" style="animation-duration:70s">${C(600, 108, 3, P.red, '')}${Pt('M597 111h6l1 9h-8Z', P.red, '')}</g><g class="walker" style="animation-duration:95s;animation-delay:-40s">${C(2200, 104, 3, P.blue, '')}${Pt('M2197 107h6l1 9h-8Z', P.blue, '')}</g>`;
  return s;
}
function foreground() {
  const B = DY + MAP_H - 8;
  let s = `<path d="M0 ${B + 10}Q${MAP_W / 4} ${B} ${MAP_W / 2} ${B + 12}T${MAP_W} ${B + 8}V${WORLD_H}H0Z" fill="#8fa06a" opacity=".85"/>`;
  for (let x = 30; x < MAP_W; x += 90) s += `<g class="grass" style="animation-delay:-${(x % 7) * .4}s">${L(`M${x} ${B + 46}q-3-14 2-24M${x + 6} ${B + 46}q2-12-1-20M${x + 12} ${B + 46}q4-10 8-16`, 'k1')}</g>` + ((x / 90) % 4 === 1 ? C(x + 30, B + 34, 3.5, [P.red, P.gold, P.cream, P.blueL][(x / 90) % 4 | 0], 'k1') : '');
  return s;
}
function obstacles() {
  const M = MAP; let s = '';
  [[2, 'rock'], [7, 'rock'], [12, 'log'], [18, 'rock'], [23, 'puddle'], [28, 'rock'], [32, 'log'], [38, 'rock']].forEach(([i, k]) => {
    const [x, y] = heroPointRaw(i * PER_LEVEL + 50);
    if (k === 'rock') s += M.rock(x + 6, y + 30, .7);
    if (k === 'log') s += `<g transform="translate(${x - 18} ${y + 26}) rotate(-8)">${Pt('M0 0h40v9H0Z', P.wood)}${E(40, 4.5, 3, 4.5, P.woodL, 'k1')}</g>`;
    if (k === 'puddle') s += E(x + 8, y + 30, 22, 5, '#7f9b86', 'k1');
  });
  return s;
}
function heroPointRaw(v) { return heroPoint(v); }
export function mapSVG(xp) {
  const li = levelInfo(xp); const opened = openedSet();
  const stops = REGION_COL.map((c, r) => `<stop offset="${((NODE_X(r * 5) + NODE_X(r * 5 + 5)) / 2 / MAP_W).toFixed(3)}" stop-color="${c}"/>`).join('');
  let roads = '', done = '', nodesS = '', flags = '', bosses = '', chests = '';
  for (let i = 0; i < MAX_LEVEL; i++) { roads += segD(i); done += `<path class="road-seg" data-seg="${i}" d="${segD(i)}" fill="none" stroke="#7a4a1e" stroke-width="7" stroke-linecap="round" stroke-dasharray="0 9999"/>`; }
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const [x, y] = nodes[i]; const isBoss = i % 5 === 0; const passed = xp >= i * PER_LEVEL; const cur = li.level === i && !li.done;
    nodesS += `<g class="map-node ${passed ? 'passed' : ''} ${cur ? 'current' : ''}" data-node="${i}"><circle class="ring" cx="${x}" cy="${y}" r="13" fill="none" stroke="#e8c86e" stroke-width="3"/><circle class="stone" cx="${x}" cy="${y}" r="${isBoss ? 12 : 9}" fill="${passed ? '#c9a043' : '#efe0bf'}" stroke="#2a1b12" stroke-width="2"/><text x="${x}" y="${y + 4}" text-anchor="middle" style="font:700 ${isBoss ? 11 : 10}px Lora,serif;fill:#2a1b12">${i}</text></g>`;
    if (!isBoss) flags += `<g class="map-flag ${passed ? 'up' : ''}" data-flag="${i}"><line x1="${x + 12}" y1="${y - 6}" x2="${x + 12}" y2="${y - 34}" stroke="#2a1b12" stroke-width="1.6"/><path class="fl" d="M${x + 12} ${y - 34}h14l-4 5l4 5h-14Z" fill="${passed ? '#7a1f2b' : '#c4beb2'}" stroke="#2a1b12" stroke-width="1"/></g>`;
    else {
      const b = BOSSES.find(x => x.level === i); const st = bossState(b, xp); const tr = treasure(i);
      bosses += `<g class="map-boss" data-boss="${b.id}" transform="translate(${x + 4} ${y - 128}) scale(.5)">${bossG(b.id, st)}</g>`;
      const open = st === 'opened';
      const tier = tr ? treasureTier(tr.cost).tier : 1; const band = [0, '#b0703a', '#cfd2d4', '#c9a043', '#c9a043', '#e8c86e'][tier];
      chests += `<g class="map-chest ${open ? 'open' : ''}" data-boss="${b.id}" transform="translate(${x + 30} ${y + 14})"><circle class="shine" cx="14" cy="4" r="22" fill="#ffe9a6" opacity=".7"/>${Pt('M0 6h28v16H0Z', tier >= 4 ? P.burgD : P.wood, 'k1')}<g class="lidm">${Pt('M0 6C0-4 28-4 28 6Z', tier >= 4 ? P.burgD : P.woodD, 'k1')}</g>${Pt('M0 12h28v3H0Z', band, 'k1')}${C(14, 14, 2.4, P.gold, 'k1')}${tr ? '' : `<text x="14" y="36" text-anchor="middle" style="font:600 9px Lora,serif;fill:#5b4231">?</text>`}</g>`;
    }
  }
  const [hx, hy] = heroPoint(xp);
  return `<svg class="art map-svg" viewBox="0 0 ${MAP_W} ${WORLD_H}" width="${MAP_W}" height="${WORLD_H}">
    <defs><linearGradient id="landg" x1="0" x2="${MAP_W}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>
      <linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc0dc"/><stop offset=".7" stop-color="#f3e6c6"/><stop offset="1" stop-color="#e9d7ae"/></linearGradient>
      <pattern id="mapPaper" patternUnits="userSpaceOnUse" width="512" height="512"><image href="paper-fiber.jpg" width="512" height="512"/></pattern></defs>
    <rect width="${MAP_W}" height="${WORLD_H}" fill="#e9d7ae"/>${skyBand()}
    <g class="world" transform="translate(0 ${DY})">
    <rect y="132" width="${MAP_W}" height="${MAP_H - 132}" fill="#e9d7ae"/>
    <path d="M0 140C400 120 800 150 1200 132S2000 150 2400 134S3200 150 3600 136S4400 146 ${MAP_W} 138V${MAP_H}H0Z" fill="url(#landg)" opacity=".6"/>
    ${Array.from({ length: 8 }, (_, r) => `<g class="region r${r}">${regionArt(r)}</g>`).join('')}
    <g class="town">${MAP.house(40, 150, 1, P.burg)}${MAP.church(80, 146, 1.1)}${MAP.house(118, 128, .8, P.greenD)}${MAP.castle(54, 112, .55, '#8a7a6a')}<text x="70" y="250" text-anchor="middle" style="font:italic 600 13px Lora,serif;fill:#5b4231">Стольный град</text></g>
    ${BOSSES.map((b, r) => `<text x="${(NODE_X(r * 5) + NODE_X(r * 5 + 5)) / 2}" y="24" text-anchor="middle" style="font:italic 600 14px Lora,serif;fill:#5b4231;letter-spacing:.04em">${esc(b.place)}</text>`).join('')}
    <path d="${roads}" fill="none" stroke="#efe0bf" stroke-width="13" stroke-linecap="round"/>
    <path d="${roads}" fill="none" stroke="#a07a4c" stroke-width="2" stroke-dasharray="6 7" stroke-linecap="round"/>
    ${signposts()}${done}${obstacles()}${chests}${flags}${nodesS}${bosses}
    <g class="hero-pos" transform="translate(${(hx - 40).toFixed(1)} ${(hy - 84).toFixed(1)}) scale(.9)">${heroes()}</g>
    </g>${foreground()}
    <rect width="${MAP_W}" height="${WORLD_H}" fill="url(#mapPaper)" opacity=".18" style="mix-blend-mode:multiply" pointer-events="none"/>
  </svg>`;
}
/** Отрисовать пройденную дорогу до xp (мгновенно). */
export function paintRoad(svg, xp) {
  $$('.road-seg', svg).forEach(p => {
    const i = +p.dataset.seg; const len = p.getTotalLength();
    const frac = clamp((xp - i * PER_LEVEL) / PER_LEVEL, 0, 1);
    p.style.strokeDasharray = `${(len * frac).toFixed(1)} 9999`;
  });
}
export function placeHero(svg, xp) { const [x, y] = heroPoint(xp); const h = svg.querySelector('.hero-pos'); h && h.setAttribute('transform', `translate(${(x - 40).toFixed(1)} ${(y - 84).toFixed(1)}) scale(.9)`); }
/** Окно карты: масштаб щипком/колесом/кнопками, перетаскивание, ограничение краёв — ничего не теряется. */
export function mapView(wrap) {
  if (wrap._view) return wrap._view;
  const v = wrap._view = { s: 0, tx: 0, ty: 0, anim: 0 };
  const W = () => wrap.clientWidth, H = () => wrap.clientHeight;
  v.minS = () => Math.min(W() / MAP_W, H() / WORLD_H);
  v.baseS = () => H() / WORLD_H;
  v.maxS = () => Math.max(v.baseS() * 2.6, 1.4);
  v.clamp = () => {
    v.s = clamp(v.s, v.minS(), v.maxS());
    const sw = MAP_W * v.s, sh = WORLD_H * v.s;
    v.tx = sw <= W() ? (W() - sw) / 2 : clamp(v.tx, W() - sw, 0);
    v.ty = sh <= H() ? (H() - sh) / 2 : clamp(v.ty, H() - sh, 0);
  };
  v.apply = () => { const svg = wrap.querySelector('svg'); if (!svg) return; if (!v.s) v.s = v.baseS(); v.clamp(); svg.style.transform = `translate(${v.tx.toFixed(1)}px, ${v.ty.toFixed(1)}px) scale(${v.s.toFixed(4)})`; wrap.classList.toggle('zoomed-out', v.s < v.baseS() * .98); };
  v.zoomAt = (k, cx = W() / 2, cy = H() / 2) => { const ns = clamp(v.s * k, v.minS(), v.maxS()); const wx = (cx - v.tx) / v.s, wy = (cy - v.ty) / v.s; v.s = ns; v.tx = cx - wx * ns; v.ty = cy - wy * ns; v.apply(); };
  v.centerOn = (x, y, smooth = false, s = v.s || v.baseS()) => {
    const tx = W() * .4 - x * s, ty = H() * .55 - y * s;
    if (!smooth || document.body.classList.contains('anim-off')) { v.s = s; v.tx = tx; v.ty = ty; v.apply(); return; }
    const s0 = v.s, x0 = v.tx, y0 = v.ty, t0 = performance.now(); cancelAnimationFrame(v.anim);
    const fr = (now) => { const k = clamp((now - t0) / 650, 0, 1), e = 1 - Math.pow(1 - k, 3); v.s = s0 + (s - s0) * e; v.tx = x0 + (tx - x0) * e; v.ty = y0 + (ty - y0) * e; v.apply(); if (k < 1) v.anim = requestAnimationFrame(fr); };
    v.anim = requestAnimationFrame(fr);
  };
  // жесты
  const pts = new Map(); let moved = 0, last = null, pinch = null;
  wrap.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; last = { x: e.clientX, y: e.clientY }; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: v.s }; } });
  wrap.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = wrap.getBoundingClientRect();
    if (pts.size >= 2 && pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top; v.zoomAt((pinch.s * d / pinch.d) / v.s, cx, cy); moved += 10; return; }
    const dx = e.clientX - last.x, dy = e.clientY - last.y; last = { x: e.clientX, y: e.clientY }; moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 4) { wrap.classList.add('dragging'); if (wrap.setPointerCapture && !wrap.hasPointerCapture(e.pointerId)) try { wrap.setPointerCapture(e.pointerId); } catch (er) {} }
    v.tx += dx; v.ty += dy; v.apply();
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) setTimeout(() => wrap.classList.remove('dragging'), 0); };
  wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
  wrap.addEventListener('click', (e) => { if (moved > 8) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  wrap.addEventListener('wheel', (e) => { e.preventDefault(); const r = wrap.getBoundingClientRect(); if (e.ctrlKey || e.metaKey) v.zoomAt(Math.exp(-e.deltaY * .01), e.clientX - r.left, e.clientY - r.top); else { v.tx -= (e.deltaX || e.deltaY); v.apply(); } }, { passive: false });
  wrap.addEventListener('dblclick', (e) => { const r = wrap.getBoundingClientRect(); v.zoomAt(1.6, e.clientX - r.left, e.clientY - r.top); });
  new ResizeObserver(() => v.apply()).observe(wrap);
  return v;
}
export function scrollToHero(wrap, xp, smooth = false) {
  const v = mapView(wrap); const [x, y] = heroPoint(xp);
  v.centerOn(x, y + DY - 30, smooth, Math.max(v.s || 0, v.baseS()) === v.s ? v.s : v.baseS());
}
/** Анимированный путь героя от xp0 до xp1: шаги, флажки, приближение и победа над боссом. */
export async function walk(wrap, xp0, xp1, onBoss) {
  const svg = wrap.querySelector('svg'); if (!svg) return;
  const hero = svg.querySelector('.heroes'); const reduce = document.body.classList.contains('anim-off');
  if (reduce || xp0 === xp1) { paintRoad(svg, xp1); placeHero(svg, xp1); scrollToHero(wrap, xp1); return; }
  const dir = xp1 > xp0 ? 1 : -1; const dist = Math.abs(xp1 - xp0);
  const dur = clamp(dist * 22, 900, 6500);
  hero && hero.classList.add('walking');
  if (dir < 0) hero && hero.setAttribute('transform', 'translate(90 0) scale(-1 1)');
  const t0 = performance.now(); let lastStep = 0;
  const bossesCrossed = BOSSES.filter(b => dir > 0 && xp0 < b.level * PER_LEVEL && xp1 >= b.level * PER_LEVEL);
  const flagsCrossed = new Set();
  await new Promise(res => {
    const frame = (now) => {
      const k = clamp((now - t0) / dur, 0, 1); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const v = xp0 + (xp1 - xp0) * e;
      placeHero(svg, v); paintRoad(svg, v); scrollToHero(wrap, v);
      if (now - lastStep > 180) { sound.play('step'); lastStep = now; }
      const lvl = Math.floor(v / PER_LEVEL);
      for (let i = 1; i <= lvl; i++) if (!flagsCrossed.has(i) && i * PER_LEVEL > xp0) { flagsCrossed.add(i); const f = svg.querySelector(`[data-flag="${i}"]`); if (f) { f.classList.add('up'); f.querySelector('.fl').setAttribute('fill', '#7a1f2b'); } const n = svg.querySelector(`[data-node="${i}"]`); n && n.classList.add('passed'); n && n.querySelector('.stone').setAttribute('fill', '#c9a043'); }
      if (k < 1) requestAnimationFrame(frame); else res();
    };
    requestAnimationFrame(frame);
  });
  hero && hero.classList.remove('walking'); hero && hero.removeAttribute('transform');
  $$('.map-node', svg).forEach(n => n.classList.toggle('current', +n.dataset.node === levelInfo(xp1).level && !levelInfo(xp1).done));
  // приближение к боссу
  const li = levelInfo(xp1);
  if (li.nextBoss && li.level === li.nextBoss.level) {
    const bg = svg.querySelector(`.map-boss[data-boss="${li.nextBoss.id}"] .boss`);
    if (bg && bg.getAttribute('data-state') !== 'fight') { setBossState(bg, 'fight'); bg.classList.add('boss-near'); say(wrap.parentElement, bg, pick(li.nextBoss.taunts), { ms: 3400 }); }
  }
  for (const b of bossesCrossed) {
    const bg = svg.querySelector(`.map-boss[data-boss="${b.id}"] .boss`);
    if (bg) { setBossState(bg, 'defeated'); say(wrap.parentElement, bg, b.defeat, { ms: 3600 }); }
    sound.play('fanfare');
    const ch = svg.querySelector(`.map-chest[data-boss="${b.id}"]`); ch && ch.classList.add('open');
    await sleep(1400);
    onBoss && await onBoss(b);
  }
  if (Math.floor(xp1 / PER_LEVEL) > Math.floor(xp0 / PER_LEVEL) && !bossesCrossed.length && dir > 0) sound.play('level');
}

// ---------------- боссы и сокровища ----------------
export function openBoss(id) {
  const b = BOSSES.find(x => x.id === id); if (!b) return;
  const xp = totalXP(); const st = bossState(b, xp); const tr = treasure(b.level);
  const lvlStart = (b.level - 1) * PER_LEVEL, toWin = Math.max(0, b.level * PER_LEVEL - xp);
  const quote = st === 'defeated' || st === 'opened' ? b.defeat : st === 'locked' ? 'Этот враг пока скрыт туманом. Пройдите путь до его земель.' : (st === 'fight' ? pick(b.taunts) : b.intro);
  const trHTML = tr ? `<div class="treasure-slot">${chestSVG(tr.cost, st === 'opened')}<div>${tr.image ? `<img class="timg" src="${tr.image}" alt="">` : ''}<div style="font-size:19px;font-weight:700;color:var(--burg2)">${esc(tr.name)}</div><div>${money(tr.cost)} · <span class="muted">${treasureTier(tr.cost).name}</span></div>${tr.description ? `<div class="small" style="margin-top:4px">${esc(tr.description)}</div>` : ''}<p class="small muted" style="margin:6px 0 0">Сокровище — мотивация. Его стоимость не списывается из казны.</p></div></div>`
    : `<div class="treasure-slot">${chestSVG(0, false)}<div><b>Сокровище не назначено</b><p class="small muted" style="margin:4px 0 0">Назначьте желанную покупку — после победы над ${esc(b.ins || b.name)} откроется сундук с ней.</p></div></div>`;
  const m = modal({ cls: 'boss-modal', wide: true, title: b.name, art: bossSVG(b.id, st === 'opened' ? 'defeated' : st),
    body: `<div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-bottom:6px"><span class="boss-state ${st}">${STATE_LABEL[st]}</span><span class="muted">${esc(b.place)} · уровень ${b.level}</span></div>
      <p style="margin:6px 0">${esc(b.nature)}</p><p class="ital" style="font-size:18px;margin:8px 0;color:var(--burg2)">«${esc(quote)}»</p>
      ${st === 'fight' || st === 'waiting' ? `<div class="kv"><span>До победы</span><b>${toWin} ${plural(toWin, ['шаг', 'шага', 'шагов'])}</b></div><div class="rope red" style="margin-top:6px"><i style="width:${clamp((xp - (b.level - 5) * PER_LEVEL) / (5 * PER_LEVEL) * 100, 0, 100)}%"></i></div>` : ''}
      ${heading('Сокровищница')}${trHTML}`,
    actions: [
      ...(tr ? [{ label: 'Удалить', kind: 'btn-ghost', icon: 'trash', onClick: async () => { if (!await confirmDialog({ title: 'Удалить сокровище?', text: `«${tr.name}» исчезнет из сокровищницы.`, ok: 'Удалить', danger: true })) return false; await db.commit([{ store: 'treasures', del: tr.id }]); undoToast('Сокровище удалено', () => db.commit([{ store: 'treasures', put: tr, keepStamp: true }])); } }] : []),
      ...((st === 'defeated') ? [{ label: 'Открыть сундук', kind: 'btn-gold', icon: 'chest', onClick: () => { setTimeout(() => openTreasureScene(b), 120); } }] : []),
      { label: tr ? 'Изменить сокровище' : 'Назначить сокровище', kind: st === 'defeated' ? 'btn-ink' : 'btn-gold', icon: 'edit', onClick: () => { setTimeout(() => editTreasure(b.level), 120); } }
    ] });
  const art = m.el.querySelector('.boss-art .boss'); if (art && st === 'fight') art.classList.add('boss-near');
}
const PRIZE_ICONS = ['gift', 'ship', 'crown', 'lute', 'dice', 'book', 'horse', 'house', 'shirt', 'goblet', 'chest', 'mirror', 'cup', 'paw', 'star', 'sword', 'map', 'candle'];
export function editTreasure(level) {
  const tr = treasure(level);
  const free = BOSSES.map(b => ({ value: b.level, label: `${b.name} (ур. ${b.level})${treasure(b.level) && b.level !== level ? ' — занято' : ''}` }));
  let image = tr ? tr.image || '' : '';
  const f = form([
    { name: 'name', label: 'Название', type: 'text', required: true, value: tr ? tr.name : '', placeholder: 'Например: новая настольная игра' },
    { name: 'cost', label: 'Стоимость', type: 'money', value: tr ? tr.cost : '', required: true, min: 1, half: true },
    { name: 'level', label: 'Босс-хранитель', type: 'select', options: free, value: level, half: true },
    { name: 'description', label: 'Описание', type: 'textarea', value: tr ? tr.description : '', placeholder: 'Почему хочется именно это' },
    { name: 'icon', label: 'Значок', type: 'icon', icons: PRIZE_ICONS, value: tr ? tr.icon || 'gift' : 'gift' }
  ]);
  const imgBox = document.createElement('div'); imgBox.className = 'field';
  const drawImg = () => { imgBox.innerHTML = `<label>Изображение</label><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${image ? `<img src="${image}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px;box-shadow:0 0 0 2px var(--gold)">` : '<span class="muted small">Можно добавить фото желанной вещи</span>'}<button type="button" class="btn btn-ink sm" data-img>${icon('upload')}${image ? 'Заменить' : 'Выбрать фото'}</button>${image ? `<button type="button" class="btn btn-ghost sm" data-noimg>${icon('trash')}Убрать</button>` : ''}</div>`; };
  drawImg(); f.el.appendChild(imgBox);
  imgBox.addEventListener('click', async (e) => {
    if (e.target.closest('[data-noimg]')) { image = ''; drawImg(); return; }
    if (e.target.closest('[data-img]')) { const file = await pickFile('image/*'); if (!file) return; try { image = await resizeImage(file, 520); drawImg(); } catch (err) { toast(err.message, { kind: 'bad' }); } }
  });
  const preview = document.createElement('div'); preview.className = 'small muted'; preview.style.gridColumn = '1/-1';
  const upd = () => { const v = f.values(); preview.innerHTML = v.cost ? `Вид сундука: <b>${treasureTier(v.cost).name}</b> — чем дороже мечта, тем богаче ларец.` : ''; };
  f.on('cost', upd); upd(); f.el.appendChild(preview);
  modal({ title: tr ? 'Сокровище' : 'Назначить сокровище', body: f.el, wide: true, actions: [{ label: 'Отмена', kind: 'btn-ghost' }, { label: 'Сохранить', kind: 'btn-gold', icon: 'check', onClick: async () => {
    if (!f.validate()) return false;
    const v = f.values(); const to = Number(v.level);
    const rec = { id: 'L' + to, level: to, name: v.name.trim(), cost: v.cost, description: (v.description || '').trim(), icon: v.icon, image, createdAt: tr ? tr.createdAt : Date.now() };
    const ops = [{ store: 'treasures', put: rec }];
    if (to !== level) { const other = treasure(to); if (tr) ops.push({ store: 'treasures', del: 'L' + level }); if (other) ops.push({ store: 'treasures', put: { ...other, id: 'L' + level, level } }); }
    await db.commit(ops); db.journal('treasure', `Сокровище «${rec.name}» (${money(rec.cost)}) у босса уровня ${to}`);
    toast('Сокровище сохранено', { kind: 'good' });
  } }] });
}
export function openTreasureScene(b) {
  return new Promise((resolve) => {
    const tr = treasure(b.level);
    const prize = tr ? (tr.image ? `<img src="${tr.image}" alt="">` : icon(tr.icon || 'gift')) : icon('star');
    const m = modal({ cls: 'treasure-modal', title: `Победа над ${b.ins || b.name}!`, dismissible: false,
      body: `<div class="treasure-stage"><div class="rays"></div>${chestSVG(tr ? tr.cost : 0, false)}<div class="prize">${prize}</div></div>
        ${tr ? `<div class="treasure-name">${esc(tr.name)}</div><div class="treasure-cost">${money(tr.cost)} · ${treasureTier(tr.cost).name}</div>${tr.description ? `<p>${esc(tr.description)}</p>` : ''}<p class="small" style="color:#c9b089">Сундук открыт — мечта заслужена. Покупка остаётся на ваше усмотрение: казна не тронута.</p>`
          : `<div class="treasure-name">Сундук пуст!</div><p>Вы не назначили сокровище этому боссу. Самое время решить, чем себя наградить.</p>`}
        <p class="ital" style="color:#e5cf9e">«${esc(b.defeat)}»</p>`,
      actions: [...(tr ? [] : [{ label: 'Назначить сокровище', kind: 'btn-ink', onClick: async () => { await mark(); setTimeout(() => editTreasure(b.level), 150); } }]), { label: tr ? 'Забрать в летопись' : 'Позже', kind: 'btn-gold', icon: 'crown', onClick: async () => { await mark(); } }],
      onClose: () => resolve() });
    async function mark() { const s = openedSet(); s.add(b.level); await db.setGState('opened', [...s]); db.journal('boss', `Победа над ${b.ins || b.name}${tr ? `, открыто сокровище «${tr.name}»` : ''}`); }
    const stage = m.el.querySelector('.treasure-stage'), ch = m.el.querySelector('.chest-art');
    sound.play('creak');
    setTimeout(() => { ch.setAttribute('data-open', '1'); stage.classList.add('open'); sound.play('coins'); const r = ch.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height * .4, 26, true); }, 700);
  });
}

// ---------------- экран колеса ----------------
const SPIN_LINES = ['Ох, сейчас узнаем, кому сегодня не повезло!', 'А вот и судьба ваша, государь!', 'Ставлю три гроша на неприятности!', 'Крутись, родимое, крутись!', 'Держите шапки, бояре!', 'Ой-ой-ой, что-то будет!', 'Колесо Фортуны не любит скупых!', 'Глаза закрою — так страшнее!', 'Кто не рискует, тот не пьёт квас!', 'Сейчас как выпадет что-нибудь благородное…', 'Звенят бубенцы — к заданию!', 'А ну, кинжал мой, не подведи!', 'Колесо скрипит — значит, к добру. Наверное.', 'Шут крутит — царь платит!', 'Быстрее, быстрее! Ой, голова кружится…'];
const AFTER_LINES = ['Удачи, царь-батюшка!', 'В добрый путь!', 'Ну что, государь, сами напросились!', 'Да это же сущие пустяки… Наверное.', 'Попал! Я всегда попадаю. Иногда.', 'Хе-хе, вот это вам досталось!', 'Сам бы взялся, да бубенцы мешают.', 'Задание благородное, почти рыцарское!', 'Не благодарите, благодарите кинжал!', 'Пусть казна прибудет, а живот не убудет!', 'С таким заданием и до босса рукой подать!', 'Ох и хитро выпало, ох и мудро!', 'Принимайте, пока судьба не передумала!', 'Ну-ка, покажите, кто тут царь!', 'Я бы на вашем месте начал прямо сейчас.'];
const IDLE_LINES = ['Покрутим колесо, государь?', 'Кинжал наточен, колесо смазано!', 'Скучно без заданий, ох скучно…', 'Я тут подумал… нет, забыл.', 'Бубенцы звенят — шут не спит!'];
let wEl = null, wTab = 'wheel', spinning = false, angle = 0, sectors = [], qKindFilter = 'all';
const R = 230;
function sectorPath(i, n) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; const p = (a) => `${(R * Math.sin(a)).toFixed(1)} ${(-R * Math.cos(a)).toFixed(1)}`; return `M0 0L${p(a0)}A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}Z`; }
const SECT_COL = ['#c23b22', '#f3e3bd', '#1f6b52', '#e8c86e', '#2b6a9c', '#efdcb0', '#5e4a7a', '#c98a2e'];
function wheelMarkup(list) {
  const n = Math.max(1, list.length);
  const items = list.length ? list : [{ id: '', title: 'Добавьте задания' }];
  let s = `<g class="wheel-rot" style="transform:rotate(${angle}deg)">`;
  items.forEach((q, i) => {
    const col = SECT_COL[i % SECT_COL.length] === SECT_COL[0] && i === n - 1 && n % 2 ? '#5b3f6e' : SECT_COL[i % SECT_COL.length];
    const dark = ['#c23b22', '#1f6b52', '#2b6a9c', '#5e4a7a', '#5b3f6e'].includes(col);
    const mid = (i + .5) / n * 360; const lim = n > 9 ? 17 : 19; const t = q.title.length > lim ? q.title.slice(0, lim - 1).trim() + '…' : q.title;
    s += `<g class="wheel-sector ${dark ? 'dark' : ''}" data-i="${i}"><path d="${sectorPath(i, n)}" fill="${col}" stroke="#2a1b12" stroke-width="2.4"/><text transform="rotate(${(mid - 90).toFixed(2)}) translate(${R - 16} 6)" text-anchor="end" style="font-size:${n > 9 ? 15 : n > 6 ? 17 : 19}px">${esc(t)}</text></g>`;
  });
  s += `<circle r="${R}" fill="url(#wheelShade)"/><circle r="${R}" fill="none" stroke="#1d1a2b" stroke-width="5"/><circle r="${R + 12}" fill="none" stroke="url(#stWood)" stroke-width="22"/><circle r="${R + 23}" fill="none" stroke="#1d1a2b" stroke-width="2"/><circle r="${R + 1}" fill="none" stroke="#1d1a2b" stroke-width="2"/><circle r="${R + 12}" fill="none" stroke="rgba(255,225,170,.22)" stroke-width="3" transform="translate(-2 -3)"/>
    <defs><radialGradient id="wheelShade"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient></defs>`;
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; s += `<circle cx="${((R + 12) * Math.sin(a)).toFixed(1)}" cy="${(-(R + 12) * Math.cos(a)).toFixed(1)}" r="4" fill="#e8c86e" stroke="#2a1b12" stroke-width="1.2"/>`; }
  s += `<circle r="46" fill="#c9a043" stroke="#2a1b12" stroke-width="3"/><circle r="34" fill="#e8c86e" stroke="#2a1b12" stroke-width="1.5"/>
    <path d="M-14 -4c4-4 8-4 10 0M4 -4c4-4 8-4 10 0" fill="none" stroke="#2a1b12" stroke-width="2"/><path d="M-10 10q10 8 20 0" fill="none" stroke="#2a1b12" stroke-width="2"/><circle cx="-9" cy="3" r="2.5" fill="#d9705c" opacity=".6"/><circle cx="9" cy="3" r="2.5" fill="#d9705c" opacity=".6"/>`;
  s += `<g class="stuck-dagger"></g></g>`;
  return s;
}
export function sectorAt(ang, n) { const a = ((-ang % 360) + 360) % 360; return Math.floor(a / (360 / n)) % n; }
function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildSectors() { const c = wheelCandidates(); sectors = c.length > 12 ? shuffle(c).slice(0, 12) : c; }

export const wheelScreen = {
  mount(root) {
    wEl = root;
    root.innerHTML = `<div class="screen-head"><h1>Колесо заданий</h1><span class="sub">шут Гороховый к вашим услугам</span><span class="grow"></span></div>
      <div class="tabs">${seg('wtab', [{ value: 'wheel', label: 'Колесо', icon: 'wheel' }, { value: 'quests', label: 'Задания и цели', icon: 'scroll' }, { value: 'hist', label: 'Летопись подвигов', icon: 'book' }], wTab, 'wide')}</div>
      <div class="w-body"></div>`;
    root.addEventListener('click', onWheelClick);
    db.on(['quests', 'questRuns', 'xpLog'], () => { if (wEl.classList.contains('active') && !spinning) renderWheelTab(); });
  },
  show() { renderWheelTab(); },
  hide() {}
};
function renderWheelTab() {
  $$('[data-seg="wtab"] .seg-b', wEl).forEach(b => b.classList.toggle('on', b.dataset.val === wTab));
  const body = wEl.querySelector('.w-body');
  if (wTab === 'wheel') renderWheel(body); else if (wTab === 'quests') renderQuests(body); else renderHistory(body);
}
function renderWheel(body) {
  buildSectors();
  const act = activeRuns();
  body.innerHTML = `<div class="wheel-layout"><div><div class="scene-box stage-box"><svg class="art scene" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMid slice">${stageScene()}</svg></div>
      <div class="spin-bar"><button class="btn btn-gold spin-btn" data-act="spin" ${sectors.length ? '' : 'disabled'}>${icon('wheel')}Крутить колесо</button></div></div>
    <div class="side-col"><div class="paper">${heading('Принятые задания', `<button class="btn btn-ghost sm hd-act" data-wtab="quests">${icon('edit')}Все задания</button>`)}
      ${act.length ? act.map(r => questRow(r)).join('') : empty('Нет принятых заданий', 'Крутите колесо — шут подберёт испытание')}</div>
      <div class="paper"><p class="small" style="margin:0">${sectors.length ? `На колесе ${sectors.length} ${plural(sectors.length, ['задание', 'задания', 'заданий'])}${wheelCandidates().length > sectors.length ? ` из ${wheelCandidates().length} (каждый раз выбираются случайно)` : ''}. Выбор делает честный генератор случайных чисел, а колесо лишь показывает результат.` : 'Для колеса нет свободных заданий: все уже приняты или отключены. Добавьте новые во вкладке «Задания и цели».'}</p></div></div></div>`;
  body.querySelector('.wheel-holder').innerHTML = wheelMarkup(sectors);
  const j = body.querySelector('.jester'); setMood(j, 'idle');
}
async function onWheelClick(e) {
  const t = e.target.closest('[data-seg="wtab"] .seg-b, [data-wtab]');
  if (t) { wTab = t.dataset.val || t.dataset.wtab; renderWheelTab(); return; }
  if (e.target.closest('[data-act="spin"]')) return spin().catch(err => { console.error('SPINERR', err && err.stack); spinning = false; });
  if (e.target.closest('.jester') && !spinning) { const j = wEl.querySelector('.jester'); say(wEl.querySelector('.stage-box'), j.querySelector('.head'), pick(IDLE_LINES), { ms: 2400 }); setMood(j, 'laugh'); setTimeout(() => setMood(j, 'idle'), 1200); return; }
  const qa = e.target.closest('[data-qact]'); if (qa) return questAction(qa.dataset.q, qa.dataset.qact);
  const kf = e.target.closest('[data-qkind]'); if (kf) { qKindFilter = kf.dataset.qkind; renderWheelTab(); return; }
  if (e.target.closest('[data-act="new-quest"]')) return editQuest();
}
// Шут: точка хвата руками в собственных координатах рисунка (руки подняты над головой).
const HAND = { x: 100, y: 48 }, REST = { x: 660, y: 258, s: 1.06 }, WC = { x: 400, y: 300 }, RIM = R + 14;
const RIDE_LINES = ['И-эх, поехали-и-и!', 'Держите меня семеро!', 'Ой, мамочки-и-и!', 'Остановите колесо, я сойду-у-у!', 'Голова кругом, бубенцы в ушах!'];
function rigSet(pos, x, y, a, sc) { pos.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(1)}) scale(${sc.toFixed(3)}) translate(${-HAND.x} ${-HAND.y})`); }
const restRig = () => ({ x: REST.x + REST.s * HAND.x, y: REST.y + REST.s * HAND.y, a: 0, s: REST.s });
const rimPt = (th) => ({ x: WC.x + RIM * Math.sin(th * Math.PI / 180), y: WC.y - RIM * Math.cos(th * Math.PI / 180) });
const lerp = (a, b, t) => a + (b - a) * t;
function angLerp(a, b, t) { let d = ((b - a) % 360 + 540) % 360 - 180; return a + d * t; }
function tween(dur, fn) { if (document.body.classList.contains('anim-off')) { fn(1); return Promise.resolve(); } return new Promise(res => { const t0 = performance.now(); const fr = (now) => { const x = clamp((now - t0) / dur, 0, 1); fn(x); if (x < 1) requestAnimationFrame(fr); else res(); }; requestAnimationFrame(fr); }); }
function shout(box, text, ms = 1600) { const h = box.querySelector('.jester .head'); say(box, h, text, { ms, cls: 'shout' }); }

async function spin() {
  if (spinning) return; buildSectors(); if (!sectors.length) return;
  spinning = true;
  const box = wEl.querySelector('.stage-box'), holder = box.querySelector('.wheel-holder'), j = box.querySelector('.jester'), pos = box.querySelector('.jester-pos');
  const off = document.body.classList.contains('anim-off');
  holder.innerHTML = wheelMarkup(sectors);
  box.querySelectorAll('.dagger-layer > *').forEach(d => d.remove()); j.classList.remove('thrown');
  const rot = holder.querySelector('.wheel-rot'); const btn = wEl.querySelector('[data-act="spin"]'); btn.disabled = true;
  // 1) честный жребий ДО анимации
  const n = sectors.length; const k = rand(n); const chosen = sectors[k];
  const width = 360 / n; const delta = (rand(1000) / 1000 - .5) * width * .7;
  const target = (((-(k + .5) * width + delta) % 360) + 360) % 360;
  const cur = ((angle % 360) + 360) % 360; const spins = 4 + rand(3);
  const final = angle + spins * 360 + ((target - cur + 360) % 360);
  // 2) шут нервничает, приседает и прыгает на обод
  setMood(j, 'nervous'); say(box, j.querySelector('.head'), pick(SPIN_LINES), { ms: 2200 });
  await sleep(off ? 0 : 900);
  const r0 = restRig(); const th0 = 58; const grab = rimPt(th0);
  j.classList.add('crouch'); await sleep(off ? 0 : 260); j.classList.remove('crouch');
  setMood(j, 'cling'); sound.play('whoosh');
  await tween(520, (x) => { const e = x * x * (3 - 2 * x); const hop = Math.sin(x * Math.PI) * 120; rigSet(pos, lerp(r0.x, grab.x, e), lerp(r0.y, grab.y, e) - hop, lerp(0, 8, e), lerp(REST.s, .66, e)); });
  sound.play('wood');
  // 3) его вес раскручивает колесо, он едет вместе с ним: от восторга к ужасу
  sound.play('creakLong');
  const dur = off ? 300 : 6200, start = angle, t0 = performance.now();
  let lastSector = -1, phase = 'ride', rel = null, prevAng = start, prevT = t0, speed = 0;
  await new Promise(res => {
    const fr = (now) => {
      const x = clamp((now - t0) / dur, 0, 1);
      const e = x < .1 ? (x / .1) * (x / .1) * .045 : .045 + (1 - .045) * (1 - Math.pow(1 - (x - .1) / .9, 3)); // разгон, потом долгое торможение
      angle = start + (final - start) * e; rot.style.transform = `rotate(${angle}deg)`;
      const dt = Math.max(1, now - prevT); speed = lerp(speed, (angle - prevAng) / dt * 1000, .25); prevAng = angle; prevT = now;
      const sct = sectorAt(angle, n); if (sct !== lastSector) { lastSector = sct; sound.play('tick'); }
      const th = th0 + (angle - start);
      if (!rel) {
        if (phase === 'ride' && x > .16) { phase = 'terror'; setMood(j, 'terror'); shout(box, pick(RIDE_LINES)); }
        else if (phase === 'ride' && x > .03 && j.getAttribute('data-mood') !== 'ride') { setMood(j, 'ride'); shout(box, 'И-эх, поехали-и-и!', 1200); }
        if (phase === 'terror' && x > .5) { phase = 'cling'; setMood(j, 'cling'); shout(box, 'Держусь… держу-у-усь…', 1500); }
        const w = clamp(Math.abs(speed) / 380, 0, 1);               // центробежная сила против тяжести
        const sway = Math.sin(now / 120) * 10 * (1 - w) + Math.sin(now / 47) * 4 * w;
        const p = rimPt(th); rigSet(pos, p.x, p.y, angLerp(0, th + 180, Math.pow(w, .8)) + sway, .66);
        const thm = ((th % 360) + 360) % 360;
        if ((x > .72 && thm > 70 && thm < 150) || x > .97) { rel = { t: now, x: p.x, y: p.y, a: angLerp(0, th + 180, Math.pow(w, .8)) + sway }; setMood(j, 'terror'); shout(box, 'А-а-а-а!', 1100); sound.play('whoosh'); }
      } else {
        const u = clamp((now - rel.t) / 650, 0, 1); const r1 = restRig();
        const hop = Math.sin(u * Math.PI) * 110;
        rigSet(pos, lerp(rel.x, r1.x, u), lerp(rel.y, r1.y, u) - hop, rel.a + (360 - ((rel.a % 360) + 360) % 360) * u, lerp(.66, REST.s, u));
        if (u >= 1 && !rel.landed) { rel.landed = true; rigSet(pos, r1.x, r1.y, 0, REST.s); j.classList.remove('land'); void j.getBoundingClientRect(); j.classList.add('land'); sound.play('wood'); setMood(j, 'dizzy'); }
      }
      if (x < 1 || (rel && !rel.landed)) requestAnimationFrame(fr); else res();
    };
    requestAnimationFrame(fr);
  });
  if (!rel || !rel.landed) { const r1 = restRig(); rigSet(pos, r1.x, r1.y, 0, REST.s); setMood(j, 'dizzy'); }
  angle = final; rot.style.transform = `rotate(${angle}deg)`;
  const landed = sectorAt(angle, n);
  if (landed !== k) console.warn('Сектор под указателем не совпал с выбором', landed, k);
  await sleep(off ? 0 : 800);
  // 4) замах, бросок, удар
  await throwDagger(box, j, rot);
  const sec = rot.querySelector(`.wheel-sector[data-i="${k}"]`); sec && sec.classList.add('win');
  setMood(j, 'laugh'); say(box, j.querySelector('.head'), pick(AFTER_LINES), { ms: 3000 });
  await sleep(900);
  spinning = false; btn.disabled = false; setMood(j, 'idle'); j.classList.remove('land');
  showResult(chosen);
}
/** Бросок кинжала: замах, полёт по дуге с вращением, удар, вход в дерево, отдача колеса, дрожь рукояти. */
async function throwDagger(box, j, rot) {
  const svg = box.querySelector('svg.scene'), layer = svg.querySelector('.dagger-layer'), off = document.body.classList.contains('anim-off');
  setMood(j, 'windup'); sound.play('creak');
  await sleep(off ? 0 : 620);
  setMood(j, 'throw');
  await sleep(off ? 0 : 110);
  const toSvg = (cx, cy) => { const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
  const hr = j.querySelector('.dagger-in-hand').getBoundingClientRect();
  const p0 = toSvg(hr.left + hr.width / 2, hr.top + hr.height / 2);
  j.classList.add('thrown'); sound.play('whoosh');
  const hit = { x: WC.x - 6, y: WC.y - R + 34 };                    // чуть ниже указателя, в выигрышном секторе
  const dx = hit.x - p0.x, dy = hit.y - p0.y, len = Math.hypot(dx, dy);
  const A = Math.atan2(-dx / len, dy / len) * 180 / Math.PI;           // остриё по направлению полёта
  const ctrl = { x: (p0.x + hit.x) / 2 + 30, y: Math.min(p0.y, hit.y) - 150 };
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.setAttribute('class', 'thrown-dagger');
  const SC = 2.5, TIP = 46;
  g.innerHTML = `<g class="dg">${dagger()}</g>`; layer.appendChild(g);
  const place = (x, y, a) => g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${a.toFixed(1)}) scale(${SC}) translate(0 ${-TIP})`);
  await tween(470, (u) => { const x = (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * ctrl.x + u * u * hit.x, y = (1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * ctrl.y + u * u * hit.y; place(x, y, A - 720 * (1 - u) * (1 - u * .15)); });
  // удар: металл о дерево, остриё уходит вглубь
  sound.play('wood'); sound.play('ting');
  const ux = dx / len, uy = dy / len; const depth = 9;
  await tween(70, (u) => place(hit.x + ux * depth * u, hit.y + uy * depth * u, A));
  chips(layer, hit.x, hit.y, ux, uy);
  // переносим кинжал в колесо: теперь он торчит из сектора и двигается вместе с ним
  const base = angle; const inv = (x, y) => { const a = -base * Math.PI / 180, X = x - WC.x, Y = y - WC.y; return { x: X * Math.cos(a) - Y * Math.sin(a), y: X * Math.sin(a) + Y * Math.cos(a) }; };
  const tip = inv(hit.x + ux * depth, hit.y + uy * depth);
  const stuck = rot.querySelector('.stuck-dagger'); stuck.innerHTML = ''; layer.removeChild(g);
  const sg = document.createElementNS('http://www.w3.org/2000/svg', 'g'); sg.innerHTML = `<g class="dg">${dagger()}</g>`; stuck.appendChild(sg);
  const la = A - base;
  const setStuck = (wob) => sg.setAttribute('transform', `translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)}) rotate(${(la + wob).toFixed(2)}) scale(${SC}) translate(0 ${-TIP})`);
  setStuck(0);
  // отдача колеса и дрожь рукояти (затухающие колебания)
  await tween(700, (u) => {
    const recoil = 2.6 * Math.exp(-u * 6) * Math.cos(u * 26); rot.style.transform = `rotate(${(base + recoil).toFixed(2)}deg)`;
    setStuck(7 * Math.exp(-u * 5) * Math.sin(u * 95));
  });
  rot.style.transform = `rotate(${base}deg)`; setStuck(0);
}
function chips(layer, x, y, ux, uy) {
  if (document.body.classList.contains('anim-off')) return;
  for (let i = 0; i < 9; i++) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    c.setAttribute('d', `M${x} ${y}l${(3 + Math.random() * 4).toFixed(1)} ${(-1 - Math.random() * 2).toFixed(1)}l${(-1 - Math.random() * 2).toFixed(1)} ${(3 + Math.random() * 3).toFixed(1)}Z`);
    c.setAttribute('fill', ['#b98d5c', '#8a6038', '#d9b48a'][i % 3]); c.setAttribute('class', 'chip-wood'); layer.appendChild(c);
    const vx = (-ux * 60 + (Math.random() - .5) * 120), vy = (-uy * 60 - 40 - Math.random() * 60);
    c.animate([{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(${vx}px, ${vy + 120}px) rotate(${(Math.random() - .5) * 600}deg)`, opacity: 0 }], { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.2,.6,.6,1)', fill: 'forwards' }).finished.then(() => c.remove()).catch(() => c.remove());
  }
}
function showResult(q) {
  const dueDays = q.kind === 'once' && q.deadline ? D.diff(D.today(), q.deadline) + 1 : Math.max(1, parseInt(q.durationDays) || 7);
  modal({ title: 'Жребий брошен!', cls: 'result', body: `<div class="result-card"><p class="muted small" style="margin:0">Кинжал шута указал на задание:</p><div class="rt">${esc(q.title)}</div>${q.description ? `<p style="margin:0">${esc(q.description)}</p>` : ''}
    <div class="stats"><div><b>${q.steps || 1}</b><span>${plural(q.steps || 1, ['шаг', 'шага', 'шагов'])}</span></div><div><b>+${q.xp}</b><span>опыта</span></div><div><b>${dueDays}</b><span>${plural(dueDays, ['день', 'дня', 'дней'])} срок</span></div></div>
    <p class="small muted">Опыт двигает героев по дороге: 1 опыт = 1 шаг, 100 шагов = уровень.</p></div>`,
    actions: [{ label: 'Не сейчас', kind: 'btn-ghost' }, { label: 'Принять задание', kind: 'btn-gold', icon: 'check', onClick: async () => { const r = await startRun(q, 'wheel'); toast(`Задание принято до ${D.dm(r.due)}`, { kind: 'good' }); sound.play('pop'); } }] });
}

// ---------------- управление заданиями ----------------
function renderQuests(body) {
  const all = quests().filter(q => q.status !== 'archived');
  const arch = quests().filter(q => q.status === 'archived');
  const list = qKindFilter === 'all' ? all : qKindFilter === 'archived' ? arch : all.filter(q => q.kind === qKindFilter);
  const act = new Map(activeRuns().map(r => [r.questId, r]));
  body.innerHTML = `<div class="paper"><div class="ops-actions"><div class="chips">${[['all', 'Все'], ...Object.entries(KIND), ['archived', `Архив (${arch.length})`]].map(([v, l]) => `<button class="chip ${qKindFilter === v ? 'on' : ''}" data-qkind="${v}">${l}</button>`).join('')}</div><span class="grow"></span><button class="btn btn-gold" data-act="new-quest">${icon('plus')}Новое задание</button></div>
    ${list.length ? `<ul class="ledger">${list.map(q => { const r = act.get(q.id); const st = streak(q);
      return `<li class="lrow" style="cursor:default"><span class="cat-ic" style="--c:${q.status === 'paused' ? '#8a7058' : q.kind === 'wheel' ? '#7a1f2b' : '#3d5a3a'}">${icon(q.kind === 'wheel' ? 'wheel' : PERIODIC.includes(q.kind) ? 'repeat' : 'flag')}</span>
      <div class="main"><div class="t">${esc(q.title)}${q.example ? ' <span class="tag">пример</span>' : ''}</div><div class="m">${KIND[q.kind]}${q.kind === 'regular' ? ` · каждые ${q.everyDays} ${plural(q.everyDays, ['день', 'дня', 'дней'])}` : ''} · +${q.xp} опыта · ${q.steps} ${plural(q.steps, ['шаг', 'шага', 'шагов'])}${q.kind === 'wheel' || (q.kind === 'once' && q.inWheel) ? ` · срок ${q.durationDays} дн.` : ''}${q.kind === 'once' && q.deadline ? ` · до ${D.dmy(q.deadline)}` : ''}${q.inWheel && !PERIODIC.includes(q.kind) ? ' · на колесе' : ''}${q.status === 'paused' ? ' · отключено' : ''}${r ? ' · <b>в работе</b>' : ''}${st ? ` · серия ${st}` : ''}</div></div>
      ${!r && q.status === 'active' && !PERIODIC.includes(q.kind) ? `<button class="btn btn-ink sm" data-q="${q.id}" data-qact="start">Взять</button>` : ''}
      <button class="icon-btn sm" data-q="${q.id}" data-qact="${q.status === 'archived' ? 'unarchive' : q.status === 'paused' ? 'resume' : 'pause'}" title="${q.status === 'archived' ? 'Вернуть из архива' : q.status === 'paused' ? 'Включить' : 'Временно отключить'}">${icon(q.status === 'active' ? 'lock' : 'repeat')}</button>
      <button class="icon-btn sm" data-q="${q.id}" data-qact="edit" title="Изменить">${icon('edit')}</button></li>`; }).join('')}</ul>` : empty('Здесь пока пусто', 'Создайте задание: цель, награду в опыте и срок')}</div>
    <p class="small muted" style="margin:10px 4px">Регулярные, еженедельные и ежемесячные задания сами появляются в каждом новом периоде. За одно задание в одном периоде опыт начисляется только один раз. Просроченные задания уходят в летопись без опыта.</p>`;
}
async function questAction(id, act) {
  const q = db.get('quests', id); if (!q) return;
  if (act === 'edit') return editQuest(q);
  if (act === 'start') { const r = await startRun(q, 'manual'); toast(`Задание взято до ${D.dm(r.due)}`, { kind: 'good' }); return; }
  const status = act === 'pause' ? 'paused' : 'active';
  await db.commit([{ store: 'quests', put: { ...q, status } }]);
  toast(act === 'pause' ? 'Задание отключено' : 'Задание снова активно');
  if (status === 'active') refreshQuests();
}
export function editQuest(q = null) {
  const f = form([
    { name: 'title', label: 'Название', type: 'text', required: true, value: q ? q.title : '' },
    { name: 'description', label: 'Описание', type: 'textarea', value: q ? q.description : '' },
    { name: 'kind', label: 'Тип', type: 'segmented', options: Object.entries(KIND).map(([v, l]) => ({ value: v, label: l })), value: q ? q.kind : 'wheel' },
    { name: 'xp', label: 'Опыт за выполнение', type: 'number', required: true, value: q ? q.xp : 30, min: 1, half: true, hint: '1 опыт = 1 шаг героев' },
    { name: 'steps', label: 'Шагов в задании', type: 'number', required: true, value: q ? q.steps : 1, min: 1, half: true, hint: 'Сколько отметок до выполнения' },
    { name: 'everyDays', label: 'Повторять каждые N дней', type: 'number', value: q ? q.everyDays || 1 : 1, min: 1, half: true, show: v => v.kind === 'regular' },
    { name: 'durationDays', label: 'Срок выполнения, дней', type: 'number', value: q ? q.durationDays || 7 : 7, min: 1, half: true, show: v => v.kind === 'wheel' || (v.kind === 'once' && v.inWheel) },
    { name: 'deadline', label: 'Выполнить до', type: 'date', value: q ? q.deadline || '' : '', half: true, show: v => v.kind === 'once' && !v.inWheel, hint: 'Пусто — без срока' },
    { name: 'inWheel', type: 'checkbox', text: 'Участвует в колесе случайных заданий', value: q ? !!q.inWheel : true, show: v => v.kind === 'wheel' || v.kind === 'once' },
    { name: 'repeatable', type: 'checkbox', text: 'Можно выполнять повторно', value: q ? q.repeatable !== false : true, show: v => v.kind === 'wheel' || v.kind === 'once' }
  ]);
  const doneN = q ? runs().filter(r => r.questId === q.id && r.status === 'done').length : 0;
  modal({ title: q ? 'Задание' : 'Новое задание', body: f.el, wide: true, actions: [
    ...(q ? [{ label: 'Удалить', kind: 'btn-danger', icon: 'trash', onClick: async () => {
      if (!await confirmDialog({ title: 'Удалить задание?', text: doneN ? `Задание выполнялось ${doneN} раз — история и полученный опыт сохранятся в летописи.` : 'Задание будет удалено.', ok: 'Удалить', danger: true })) return false;
      const act = activeRuns().filter(r => r.questId === q.id);
      await db.commit([{ store: 'quests', del: q.id }, ...act.map(r => ({ store: 'questRuns', put: { ...r, status: 'abandoned', endedAt: Date.now() } }))]);
      undoToast('Задание удалено', () => db.commit([{ store: 'quests', put: q, keepStamp: true }, ...act.map(r => ({ store: 'questRuns', put: r, keepStamp: true }))]));
    } }, { label: q.status === 'archived' ? 'Из архива' : 'В архив', kind: 'btn-ink', icon: 'book', onClick: async () => {
      const act = activeRuns().filter(r => r.questId === q.id);
      await db.commit([{ store: 'quests', put: { ...q, status: q.status === 'archived' ? 'active' : 'archived' } }, ...(q.status === 'archived' ? [] : act.map(r => ({ store: 'questRuns', put: { ...r, status: 'abandoned', endedAt: Date.now() } })))]);
      toast(q.status === 'archived' ? 'Задание возвращено' : 'Задание в архиве'); if (q.status === 'archived') refreshQuests();
    } }] : [{ label: 'Отмена', kind: 'btn-ghost' }]),
    { label: 'Сохранить', kind: 'btn-gold', icon: 'check', onClick: async () => {
      if (!f.validate()) return false;
      const v = f.values();
      const rec = { ...(q || {}), id: q ? q.id : db.uid('q'), title: v.title.trim(), description: (v.description || '').trim(), kind: v.kind, xp: Math.round(v.xp), steps: Math.max(1, Math.round(v.steps)),
        everyDays: Math.max(1, Math.round(v.everyDays || 1)), durationDays: Math.max(1, Math.round(v.durationDays || 7)), deadline: v.deadline || '', inWheel: (v.kind === 'wheel' || v.kind === 'once') ? !!v.inWheel : false,
        repeatable: !!v.repeatable, status: q ? (q.status === 'archived' ? 'archived' : q.status) : 'active', createdAt: q ? q.createdAt : Date.now(), createdDate: q ? q.createdDate : D.today(), example: false, order: q ? q.order : quests().length };
      const ops = [{ store: 'quests', put: rec }];
      // изменения награды/шагов распространяются на текущее активное выполнение (без двойного начисления)
      for (const r of activeRuns().filter(r => r.questId === rec.id)) ops.push({ store: 'questRuns', put: { ...r, title: rec.title, xp: rec.xp, steps: rec.steps, progress: Math.min(r.progress, rec.steps - 1) } });
      await db.commit(ops); await refreshQuests();
      toast(q ? 'Задание сохранено' : 'Задание создано', { kind: 'good' });
    } }] });
}
function renderHistory(body) {
  const list = runs().filter(r => r.status !== 'active').sort((a, b) => (b.doneAt || b.endedAt || 0) - (a.doneAt || a.endedAt || 0));
  const xp = totalXP(), li = levelInfo(xp);
  const done = list.filter(r => r.status === 'done');
  body.innerHTML = `<div class="paper"><div class="sum-row"><div class="sum"><div class="l">Всего опыта</div><div class="v">${xp}</div><span class="d">уровень ${li.level}${li.done ? ' · путь пройден' : ''}</span></div><div class="sum"><div class="l">Выполнено</div><div class="v">${done.length}</div><span class="d">${plural(done.length, ['задание', 'задания', 'заданий'])}</span></div><div class="sum"><div class="l">Просрочено</div><div class="v">${list.filter(r => r.status === 'expired').length}</div><span class="d">без опыта</span></div><div class="sum"><div class="l">Побеждено боссов</div><div class="v">${BOSSES.filter(b => xp >= b.level * PER_LEVEL).length} / 8</div></div></div>
    ${list.length ? `<ul class="ledger">${list.slice(0, 300).map(r => `<li class="lrow" style="cursor:default"><span class="cat-ic" style="--c:${r.status === 'done' ? '#4a6f36' : r.status === 'expired' ? '#9b2c2c' : '#8a7058'}">${icon(r.status === 'done' ? 'check' : r.status === 'expired' ? 'hourglass' : 'close')}</span>
      <div class="main"><div class="t">${esc(r.title)}</div><div class="m">${r.status === 'done' ? 'выполнено ' + D.dm(D.fmt(new Date(r.doneAt))) : r.status === 'expired' ? 'просрочено, срок был ' + D.dm(r.due) : 'оставлено'}${r.source === 'wheel' ? ' · с колеса' : ''}</div></div>
      <div class="amt ${r.status === 'done' ? 'inc' : 'trn'}">${r.status === 'done' ? '+' + r.xp : '0'}</div></li>`).join('')}</ul>` : empty('Летопись пока пуста', 'Выполненные и просроченные задания будут записаны здесь')}</div>`;
}
