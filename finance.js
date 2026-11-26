// finance.js — казна: операции, статьи, регулярные платежи и экран Казначея.
import * as db from './database.js';
import { icon, ICON_CHOICES_FIN } from './icons.js';
import { $, $$, esc, D, money, parseMoney, plural, bus, modal, form, toast, undoToast, confirmDialog, seg, empty, heading, sound, pick, say, sleep } from './ui.js';
import { setMood } from './art.js';
import { deskRoomScene } from './scenes.js';
import { renderAnalytics } from './analytics.js';

// ---------------- домен ----------------
export const TYPE_LABEL = { income: 'Доход', expense: 'Расход', transfer: 'Перевод', invest: 'В ларец', divest: 'Из ларца', revalue: 'Переоценка ларца' };
export const INVEST_CAT = 'c_invest', DIVEST_CAT = 'c_divest';
export const isFlow = (o) => o.type === 'income' || o.type === 'expense';
/** Как операция меняет большой сундук (свободные деньги). */
export function cashDelta(o) { return o.type === 'income' || o.type === 'divest' ? o.amount : o.type === 'expense' || o.type === 'invest' ? -o.amount : 0; }
/** Как операция меняет ларец инвестиций. */
export function investDelta(o) { return o.type === 'invest' ? o.amount : o.type === 'divest' ? -o.amount : o.type === 'revalue' ? (o.dir < 0 ? -o.amount : o.amount) : 0; }
export function cats(kind) { return db.all('categories').filter(c => !kind || c.kind === kind).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'ru')); }
export function catById(id) { return id ? db.get('categories', id) : null; }
export function catName(id) { const c = catById(id); return c ? c.name : 'Без статьи'; }
export function members() { return db.setting('members', []) || []; }
export function ops() { return db.all('operations'); }
export function realOps() { return db.all('operations').filter(isFlow); }
export function opsBetween(from, to, type) { return db.all('operations').filter(o => o.date >= from && o.date <= to && (type ? o.type === type : isFlow(o))); }
/** Свободные деньги — большой сундук. */
export function balance(upTo = D.today()) {
  let b = Math.round(Number(db.setting('openingBalance', 0)) || 0);
  for (const o of db.all('operations')) if (o.date <= upTo) b += cashDelta(o);
  return b;
}
/** Инвестиции — малый ларец. */
export function investBalance(upTo = D.today()) {
  let b = Math.round(Number(db.setting('openingInvest', 0)) || 0);
  for (const o of db.all('operations')) if (o.date <= upTo) b += investDelta(o);
  return b;
}
export const capital = (upTo = D.today()) => balance(upTo) + investBalance(upTo);
export function plannedOps() { const t = D.today(); return db.all('operations').filter(o => o.date > t && o.type !== 'transfer'); }

export async function saveOp(op, { silent = false } = {}) {
  const isNew = !op.id || !db.get('operations', op.id);
  const rec = { id: op.id || db.uid('op'), type: op.type, amount: Math.round(Math.abs(op.amount)), categoryId: op.categoryId || null, title: (op.title || '').trim(), note: (op.note || '').trim(),
    date: op.date || D.today(), member: op.member || '', place: (op.place || '').trim(), recurringId: op.recurringId || null, importKey: op.importKey || null,
    createdAt: op.createdAt || Date.now(), from: op.from || '', to: op.to || '', ...(op.type === 'revalue' ? { dir: op.dir < 0 ? -1 : 1 } : {}) };
  const prev = isNew ? null : db.get('operations', rec.id);
  await db.commit([{ store: 'operations', put: rec }]);
  if (!silent) {
    const verb = { income: 'доход', expense: 'расход', invest: 'перевод в ларец', divest: 'возврат из ларца', revalue: 'переоценка ларца' }[rec.type] || 'запись';
    db.journal(rec.type, `${isNew ? 'Записан' : 'Исправлен'} ${verb}: ${money(rec.amount)} · ${catName(rec.categoryId)}${rec.title ? ' · ' + rec.title : ''}`);
    const delta = (prev ? -signed(prev) : 0) + signed(rec), dInv = (prev ? -signedInv(prev) : 0) + signedInv(rec);
    if (delta || dInv) bus.emit('money', { delta, invest: dInv, op: rec });
  }
  return rec;
}
const signed = (o) => o.date > D.today() ? 0 : cashDelta(o);
const signedInv = (o) => o.date > D.today() ? 0 : investDelta(o);
export async function deleteOp(id) {
  const o = db.get('operations', id); if (!o) return;
  await db.commit([{ store: 'operations', del: id }]);
  db.journal('delete', `Удалена запись: ${money(o.amount)} · ${catName(o.categoryId)}`);
  if (signed(o) || signedInv(o)) bus.emit('money', { delta: -signed(o), invest: -signedInv(o), op: o, deleted: true });
  undoToast('Запись удалена', async () => { await db.commit([{ store: 'operations', put: o, keepStamp: true }]); if (signed(o) || signedInv(o)) bus.emit('money', { delta: signed(o), invest: signedInv(o), op: o }); });
}

// ---------------- регулярные платежи ----------------
export const FREQ = { daily: 'Ежедневно', weekly: 'Еженедельно', monthly: 'Ежемесячно', yearly: 'Ежегодно', custom: 'Свой интервал' };
const UNIT_W = { day: ['день', 'дня', 'дней'], week: ['неделю', 'недели', 'недель'], month: ['месяц', 'месяца', 'месяцев'], year: ['год', 'года', 'лет'] };
function normRule(r) {
  if (r.freq === 'custom') return { unit: r.unit || 'day', step: Math.max(1, parseInt(r.interval) || 1) };
  return { unit: { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[r.freq] || 'month', step: 1 };
}
export function ruleText(r) {
  const { unit, step } = normRule(r);
  if (r.freq !== 'custom') { let s = FREQ[r.freq]; if (r.freq === 'monthly') s += `, ${r.dayOfMonth || D.parse(r.start).getDate()}-го числа`; return s; }
  return `Каждые ${step} ${plural(step, UNIT_W[unit])}`;
}
/** Все даты срабатывания правила в интервале (after, to]. */
export function occurrences(r, after, to) {
  const out = []; if (!r.start || !D.valid(r.start)) return out;
  const { unit, step } = normRule(r);
  const end = r.end && D.valid(r.end) ? (r.end < to ? r.end : to) : to;
  let first = r.start;
  const dom = r.dayOfMonth ? Math.min(31, Math.max(1, parseInt(r.dayOfMonth))) : D.parse(r.start).getDate();
  if (unit === 'month' || unit === 'year') { first = D.addMonths(D.monthStart(r.start), 0, dom); if (first < r.start) first = D.addMonths(D.monthStart(r.start), 1, dom); }
  for (let k = 0; k < 20000; k++) {
    let d;
    if (unit === 'day') d = D.add(first, k * step);
    else if (unit === 'week') d = D.add(first, k * step * 7);
    else d = D.addMonths(D.monthStart(first), k * step * (unit === 'year' ? 12 : 1), dom);
    if (d > end) break;
    if (!after || d > after) out.push(d);
  }
  return out;
}
export function nextOccurrence(r) { const t = D.today(); const l = occurrences(r, r.lastGenerated && r.lastGenerated > t ? r.lastGenerated : t, D.add(t, 800)); return l[0] || null; }
export async function processRecurring() {
  const today = D.today(); const ops = []; let created = 0;
  for (const r of db.all('recurring')) {
    if (!r.active) continue;
    const dates = occurrences(r, r.lastGenerated || '', today);
    for (const d of dates) {
      const id = `rec_${r.id}_${d}`;
      if (db.get('operations', id)) continue;
      ops.push({ store: 'operations', put: { id, type: r.type, amount: r.amount, categoryId: r.categoryId || null, title: r.title || '', note: r.note || '', date: d, member: r.member || '', place: r.place || '', recurringId: r.id, createdAt: Date.now() } });
      created++;
    }
    if (!r.lastGenerated || r.lastGenerated < today) ops.push({ store: 'recurring', put: { ...r, lastGenerated: today } });
  }
  if (ops.length) await db.commit(ops);
  if (created) db.journal('recurring', `Регулярные платежи: создано записей — ${created}`);
  return { created };
}

// ---------------- экран Казначея ----------------
const SIGHS = ['Эх… опять считать.', 'Ох, грехи наши денежные…', 'Так-с, что у нас сегодня…', 'Перо, чернила, терпение…', 'Ну-с, посмотрим, кто сколько потратил.', 'Где мои очки… А, на носу.'];
const AFTER_INC = ['Приход записан. Любо-дорого!', 'Вот это я понимаю — запись!', 'Пополнение! Пишу с удовольствием.'];
const AFTER_EXP = ['Расход записан. Эх…', 'Записал. Не одобряю, но записал.', 'Казна тоньше, перо тупее…'];
let el = null, tab = 'list', lastVisit = 0, dirty = false;
const F = { q: '', type: 'all', cat: '', member: '', period: 'all', from: '', to: '', sort: 'date-desc', limit: 120 };
const treasurerEl = () => el && el.querySelector('.treasurer');

export const screen = {
  mount(root) {
    el = root;
    el.innerHTML = `<div class="screen-head"><h1>Казначей</h1><span class="sub">книга доходов и расходов</span><span class="grow"></span></div>
      <div class="scene-box desk-box"><svg class="art scene" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice">${deskRoomScene()}</svg></div>
      <div class="scroll-roll"><div class="roller"></div><div class="sheet-clip"><div class="sheet" id="fin-sheet">
        <div class="ops-actions">
          <button class="btn btn-green big-add" data-act="add-inc">${icon('plus')}Добавить доход</button>
          <button class="btn btn-burg big-add" data-act="add-exp">${icon('minus')}Добавить расход</button>
          <span class="grow"></span>
        </div>
        ${seg('fintab', [{ value: 'list', label: 'Записи', icon: 'list' }, { value: 'stats', label: 'Аналитика', icon: 'chart' }, { value: 'rec', label: 'Регулярные', icon: 'repeat' }, { value: 'cats', label: 'Статьи', icon: 'star' }], tab, 'wide tabs')}
        <div class="fin-body"></div>
      </div></div><div class="roller"></div></div>`;
    el.addEventListener('click', onClick);
    el.addEventListener('input', (e) => { if (e.target.id === 'op-search') { F.q = e.target.value; F.limit = 120; renderList(true); } });
    el.addEventListener('change', onChange);
    db.on(['operations', 'categories', 'recurring', 'settings'], () => { if (el && el.classList.contains('active')) render(); else dirty = true; });
    bus.on('money', ({ delta = 0, invest = 0 }) => { if (el && el.classList.contains('active')) bigReaction(delta, invest); });
  },
  show(root, params = {}) {
    if (params.tab) tab = params.tab;
    $$('[data-seg="fintab"] .seg-b', el).forEach(b => b.classList.toggle('on', b.dataset.val === tab));
    render();
    entrance();
    if (params.add) setTimeout(() => openOpForm({ type: params.add }), 300);
    scheduleIdle();
  },
  hide() { clearTimeout(idleT); }
};
// Казначей живёт своей жизнью: считает монеты, поправляет пенсне, поглядывает на государя, вздыхает.
let idleT = 0, reacting = false;
const GLANCES = ['Хм…', 'Всё сходится, государь.', 'Вы что-то хотели записать?', 'Перо не любит спешки.', 'Копеечка к копеечке…'];
function scheduleIdle() {
  clearTimeout(idleT);
  idleT = setTimeout(async () => {
    const t = treasurerEl();
    if (!t || !el.classList.contains('active')) return;
    if (!reacting && !document.body.classList.contains('anim-off') && !document.querySelector('.modal-wrap.open')) {
      const act = pick(['counting', 'glasses', 'look', 'sigh', 'counting', 'write']);
      setMood(t, act);
      if (act === 'look' && Math.random() < .5) say(el.querySelector('.desk-box'), t.querySelector('.head'), pick(GLANCES), { ms: 2000 });
      if (act === 'counting') sound.play('coin');
      await sleep(act === 'counting' ? 3200 : act === 'glasses' ? 1700 : 2300);
      if (!reacting) setMood(t, 'idle');
    }
    scheduleIdle();
  }, 7000 + Math.random() * 7000);
}
async function bigReaction(delta, invest) {
  const t = treasurerEl(); if (!t) return;
  const b = Math.abs(balance()) || 1, big = Math.abs(delta) >= Math.max(2000000, b * .1) || Math.abs(invest) >= 2000000;
  if (!big) return;
  reacting = true; await sleep(250);
  if (invest && delta) { setMood(t, 'glasses'); await sleep(900); setMood(t, 'joy'); say(el.querySelector('.desk-box'), t.querySelector('.head'), invest > 0 ? 'В ларец? Разумно, разумно…' : 'Из ларца? Записываю с подтверждением.', { ms: 2200 }); }
  else if (delta > 0) { setMood(t, 'surprised'); say(el.querySelector('.desk-box'), t.querySelector('.head'), 'Ого! Вот это прибыток!', { ms: 2000 }); }
  else { setMood(t, 'surprised'); await sleep(600); setMood(t, 'sigh'); say(el.querySelector('.desk-box'), t.querySelector('.head'), 'Ох… крупная трата. Записал.', { ms: 2200 }); }
  await sleep(2200); setMood(t, 'idle'); reacting = false;
}

async function entrance() {
  const clip = el.querySelector('.sheet-clip'), t = treasurerEl(), box = el.querySelector('.desk-box');
  const fast = Date.now() - lastVisit < 5 * 60 * 1000 || document.body.classList.contains('anim-off');
  lastVisit = Date.now();
  if (fast) { clip.style.height = 'auto'; setMood(t, 'write'); setTimeout(() => setMood(t, 'idle'), 1400); return; }
  clip.style.transition = 'none'; clip.style.height = '0px'; void clip.offsetHeight; clip.style.transition = '';
  setMood(t, 'sigh'); say(box, t.querySelector('.head'), pick(SIGHS), { ms: 2200 });
  await sleep(900); setMood(t, 'dip'); sound.play('creak');
  await sleep(550); setMood(t, 'write'); sound.play('quill');
  clip.style.height = clip.scrollHeight + 'px';
  setTimeout(() => { clip.style.height = 'auto'; }, 1000);
  await sleep(2200); setMood(t, 'idle');
}
function scribble(text) {
  const t = treasurerEl(); if (!t) return;
  setMood(t, 'write'); sound.play('quill');
  if (text) say(el.querySelector('.desk-box'), t.querySelector('.head'), text, { ms: 2400 });
  setTimeout(() => setMood(t, 'idle'), 1800);
}

function render() {
  dirty = false;
  const body = el.querySelector('.fin-body');
  if (tab === 'list') renderListShell(body);
  else if (tab === 'stats') renderAnalytics(body);
  else if (tab === 'rec') renderRules(body);
  else renderCats(body);
}

function onChange(e) {
  const t = e.target;
  if (t.matches('[data-f]')) { F[t.dataset.f] = t.value; F.limit = 120; if (t.dataset.f === 'period') { renderListShell(el.querySelector('.fin-body')); return; } renderList(); }
}
async function onClick(e) {
  const b = e.target.closest('[data-act],[data-seg] .seg-b,.lrow[data-op],[data-rule],[data-cat-act]');
  if (!b) return;
  const segEl = b.closest('[data-seg]');
  if (segEl && b.classList.contains('seg-b')) {
    if (segEl.dataset.seg === 'fintab') { tab = b.dataset.val; $$('.seg-b', segEl).forEach(x => x.classList.toggle('on', x === b)); render(); return; }
    if (segEl.dataset.seg === 'ftype') { F.type = b.dataset.val; $$('.seg-b', segEl).forEach(x => x.classList.toggle('on', x === b)); renderList(); return; }
    if (segEl.dataset.seg === 'catkind') { catKind = b.dataset.val; renderCats(el.querySelector('.fin-body')); return; }
    return;
  }
  const act = b.dataset.act;
  if (act === 'add-inc') return openOpForm({ type: 'income' });
  if (act === 'add-exp') return openOpForm({ type: 'expense' });
  if (act === 'more') { F.limit += 200; renderList(); return; }
  if (act === 'add-rule') return openOpForm({ type: 'expense', recurring: true });
  if (act === 'add-cat') return openCatForm({ kind: catKind });
  if (b.matches('.lrow[data-op]')) return openOpDetails(b.dataset.op);
  if (b.dataset.rule) return ruleAction(b.dataset.rule, b.dataset.ra);
  if (b.dataset.catAct) return catAction(b.dataset.cat, b.dataset.catAct);
}

// ---------- список записей ----------
function periodRange(p) {
  const t = D.today();
  switch (p) {
    case 'month': return [D.monthStart(t), D.monthEnd(t)];
    case 'prev': { const s = D.addMonths(D.monthStart(t), -1, 1); return [s, D.monthEnd(s)]; }
    case 'd30': return [D.add(t, -29), t];
    case 'week': return [D.weekStart(t), D.weekEnd(t)];
    case 'custom': return [F.from || '0000-01-01', F.to || '9999-12-31'];
    default: return ['0000-01-01', '9999-12-31'];
  }
}
function renderListShell(body) {
  const catOpts = `<option value="">Все статьи</option><option value="__none">Без статьи</option>` + cats().map(c => `<option value="${c.id}" ${F.cat === c.id ? 'selected' : ''}>${esc(c.name)} · ${{ income: 'доход', expense: 'расход', invest: 'ларец', divest: 'ларец' }[c.kind] || ''}</option>`).join('');
  const mem = members();
  body.innerHTML = `<div class="toolbar">
      <label class="search">${icon('search')}<input id="op-search" type="search" placeholder="Поиск по записям, статьям, суммам…" value="${esc(F.q)}"></label>
      ${seg('ftype', [{ value: 'all', label: 'Все' }, { value: 'income', label: 'Доходы' }, { value: 'expense', label: 'Расходы' }, { value: 'cash', label: 'Сундук' }, { value: 'invest', label: 'Ларец' }], F.type)}
    </div>
    <div class="toolbar">
      <div class="field" style="flex:1 1 160px"><select data-f="cat" aria-label="Статья">${catOpts}</select></div>
      ${mem.length ? `<div class="field" style="flex:1 1 130px"><select data-f="member" aria-label="Кто"><option value="">Все</option>${mem.map(m => `<option ${F.member === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>` : ''}
      <div class="field" style="flex:1 1 150px"><select data-f="period" aria-label="Период">${[['all', 'За всё время'], ['month', 'Этот месяц'], ['prev', 'Прошлый месяц'], ['week', 'Эта неделя'], ['d30', '30 дней'], ['custom', 'Свой период']].map(([v, l]) => `<option value="${v}" ${F.period === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field" style="flex:1 1 170px"><select data-f="sort" aria-label="Сортировка">${[['date-desc', 'Сначала новые'], ['date-asc', 'Сначала старые'], ['amt-desc', 'Сначала крупные'], ['amt-asc', 'Сначала мелкие']].map(([v, l]) => `<option value="${v}" ${F.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    ${F.period === 'custom' ? `<div class="range-row"><div class="field"><label>С</label><div class="inp"><input type="date" data-f="from" value="${F.from}"></div></div><div class="field"><label>По</label><div class="inp"><input type="date" data-f="to" value="${F.to}"></div></div></div>` : ''}
    <div class="list-sum muted small"></div><div class="op-list"></div>`;
  renderList();
}
function filtered() {
  const [from, to] = periodRange(F.period);
  const q = F.q.trim().toLowerCase().replace(/ё/g, 'е');
  const qNum = q.replace(/\s/g, '').replace(',', '.');
  let list = db.all('operations').filter(o => o.date >= from && o.date <= to);
  if (F.type === 'income' || F.type === 'expense') list = list.filter(o => o.type === F.type);
  else if (F.type === 'cash') list = list.filter(o => cashDelta(o) !== 0);
  else if (F.type === 'invest') list = list.filter(o => investDelta(o) !== 0);
  if (F.cat) list = list.filter(o => F.cat === '__none' ? !o.categoryId : o.categoryId === F.cat);
  if (F.member) list = list.filter(o => o.member === F.member);
  if (q) list = list.filter(o => {
    const hay = `${o.title} ${o.note} ${o.place} ${catName(o.categoryId)} ${o.member} ${TYPE_LABEL[o.type]}`.toLowerCase().replace(/ё/g, 'е');
    return hay.includes(q) || (/^\d+(\.\d+)?$/.test(qNum) && String(o.amount / 100).startsWith(qNum));
  });
  const s = F.sort;
  list.sort((a, b) => s === 'amt-desc' ? b.amount - a.amount : s === 'amt-asc' ? a.amount - b.amount : s === 'date-asc' ? (a.date.localeCompare(b.date) || a.createdAt - b.createdAt) : (b.date.localeCompare(a.date) || b.createdAt - a.createdAt));
  return list;
}
export function opRow(o, { showDate = false } = {}) {
  const c = catById(o.categoryId);
  const INV = { invest: ['chest', '#b8923a', 'из сундука в ларец · имущество не меняется'], divest: ['chest', '#2b6a9c', 'из ларца в сундук · имущество не меняется'], revalue: ['chart', '#5e4a7a', o.dir < 0 ? 'стоимость ларца снизилась' : 'стоимость ларца выросла'] }[o.type];
  const ic = o.type === 'transfer' ? 'transfer' : INV ? INV[0] : c ? c.icon : 'star';
  const col = o.type === 'transfer' ? '#8a7058' : INV ? INV[1] : c ? c.color : '#8a7058';
  const title = o.type === 'transfer' ? `Перевод${o.from || o.to ? `: ${o.from || '?'} → ${o.to || '?'}` : ''}` : INV ? (o.title || TYPE_LABEL[o.type]) : (o.title || (c ? c.name : 'Без статьи'));
  const meta = [o.type === 'transfer' ? 'между своими кошельками, на казну не влияет' : INV ? INV[2] : (o.title ? (c ? c.name : 'Без статьи') : ''), o.place, o.note].filter(Boolean).join(' · ');
  const tags = (o.recurringId ? `<span class="tag rec">${icon('repeat')}регулярный</span> ` : '') + (o.date > D.today() ? `<span class="tag plan">${icon('calendar')}запланирован</span> ` : '');
  const sign = o.type === 'income' ? '+' : o.type === 'expense' ? '−' : o.type === 'invest' ? '⇢ ' : o.type === 'divest' ? '⇠ ' : o.type === 'revalue' ? (o.dir < 0 ? '−' : '+') : '';
  return `<li class="lrow" data-op="${o.id}"><span class="cat-ic" style="--c:${col}">${icon(ic)}</span>
    <div class="main"><div class="t">${esc(title)}</div><div class="m">${o.member ? `<i class="who" title="${esc(o.member)}">${esc(o.member[0])}</i>` : ''}${showDate ? D.dm(o.date) + ' · ' : ''}${tags}${esc(meta)}</div></div>
    <div class="amt ${o.type === 'income' ? 'inc' : o.type === 'expense' ? 'exp' : INV ? 'inv' : 'trn'}">${sign}${money(o.amount).replace(/^[−+]/, '')}</div></li>`;
}
function renderList(keepFocus) {
  const box = el.querySelector('.op-list'); if (!box) return;
  const list = filtered();
  const inc = list.filter(o => o.type === 'income').reduce((s, o) => s + o.amount, 0), exp = list.filter(o => o.type === 'expense').reduce((s, o) => s + o.amount, 0);
  const inv = list.filter(o => o.type === 'invest').reduce((s, o) => s + o.amount, 0), div = list.filter(o => o.type === 'divest').reduce((s, o) => s + o.amount, 0);
  const head = F.type === 'cash' ? `<b>Большой сундук сейчас: ${money(balance())}</b> · ` : F.type === 'invest' ? `<b>Ларец инвестиций сейчас: ${money(investBalance())}</b> · ` : '';
  el.querySelector('.list-sum').innerHTML = list.length ? `${head}Найдено ${list.length} ${plural(list.length, ['запись', 'записи', 'записей'])} · доходы <b class="inc-c">${money(inc)}</b> · расходы <b class="exp-c">${money(exp)}</b>${inv || div ? ` · в ларец <b class="inv-c">${money(inv)}</b>${div ? `, из ларца <b class="inv-c">${money(div)}</b>` : ''}` : ''}` : (head ? head.replace(/ · $/, '') : '');
  if (!list.length) { box.innerHTML = db.count('operations') ? empty('Ничего не нашлось', 'Измените условия поиска или фильтры') : empty('Книга пока пуста', 'Добавьте первый доход или расход — казначей всё запишет'); return; }
  const byDate = F.sort.startsWith('date');
  let html = '<ul class="ledger">', day = '';
  for (const o of list.slice(0, F.limit)) {
    if (byDate && o.date !== day) {
      day = o.date;
      const dayOps = list.filter(x => x.date === day);
      const dsum = dayOps.reduce((s, x) => s + (F.type === 'invest' ? investDelta(x) : cashDelta(x)), 0);
      html += `<li class="lday"><span>${D.rel(day)}${D.rel(day) !== D.dm(day) ? ', ' + D.dm(day) : ''} · ${D.weekday(day)}</span><span class="muted">${money(dsum, { sign: true })}</span></li>`;
    }
    html += opRow(o, { showDate: !byDate });
  }
  html += '</ul>';
  if (list.length > F.limit) html += `<div style="text-align:center;margin-top:12px"><button class="btn btn-ink" data-act="more">Показать ещё (${list.length - F.limit})</button></div>`;
  box.innerHTML = html;
}

// ---------- форма операции ----------
function catPicker(kind, value) {
  const sys = db.get('categories', kind === 'expense' ? INVEST_CAT : DIVEST_CAT);
  return `<div class="iconpick catpick">${cats(kind).map(c => `<button type="button" class="ip cat-tile ${c.id === value ? 'on' : ''}" data-cat="${c.id}" style="--c:${c.color}">${icon(c.icon)}<span>${esc(c.name)}</span></button>`).join('')}<button type="button" class="ip cat-tile add" data-newcat>${icon('plus')}<span>Новая статья</span></button>${sys ? `<button type="button" class="ip cat-tile sys ${sys.id === value ? 'on' : ''}" data-cat="${sys.id}" style="--c:${sys.color}">${icon(sys.icon)}<span>${esc(sys.name)}</span></button>` : ''}</div>`;
}
const kindsFor = (type) => type === 'expense' ? ['expense', 'invest'] : ['income', 'divest'];
export function openOpForm(init = {}) {
  const existing = init.id ? db.get('operations', init.id) : null;
  if (existing && existing.type === 'revalue') return openRevalue({ id: existing.id });
  const rule = init.ruleId ? db.get('recurring', init.ruleId) : null;
  const base = rule ? { type: rule.type, amount: rule.amount, categoryId: rule.categoryId, title: rule.title, note: rule.note, member: rule.member, place: rule.place, date: rule.start, recurring: true, freq: rule.freq, interval: rule.interval || 1, unit: rule.unit || 'day', dayOfMonth: rule.dayOfMonth || '', end: rule.end || '' }
    : existing ? { ...existing } : { type: init.type || 'expense', categoryId: init.categoryId || '', date: D.today(), member: db.setting('lastMember', members()[0] || ''), recurring: !!init.recurring, freq: 'monthly', interval: 1, unit: 'day' };
  if (base.type === 'invest') base.type = 'expense'; if (base.type === 'divest') base.type = 'income';
  let type = base.type, catId = base.categoryId || '';
  const mem = members();
  const titles = [...new Set(db.all('operations').map(o => o.title).filter(Boolean))].slice(0, 300);
  const places = [...new Set(db.all('operations').map(o => o.place).filter(Boolean))].slice(0, 200);
  const f = form([
    { name: 'type', type: 'segmented', options: [{ value: 'income', label: 'Доход', icon: 'arrowUp' }, { value: 'expense', label: 'Расход', icon: 'arrowDown' }], value: type },
    { name: 'amount', label: 'Сумма', type: 'money', required: true, value: base.amount ?? '', min: 1, minMsg: 'Сумма должна быть больше нуля', placeholder: '0' },
    { name: 'date', label: rule || base.recurring ? 'Дата первого платежа' : 'Дата', type: 'date', required: true, value: base.date, half: true },
    { name: 'member', label: 'Кто', type: mem.length ? 'segmented' : 'text', options: mem.map(m => ({ value: m, label: m })), value: base.member || '', half: true, show: () => mem.length > 0 },
    { name: 'title', label: 'Описание', type: 'text', value: base.title || '', placeholder: 'Например: «Самокат», «Аренда»', list: 'dl-titles' },
    { name: 'place', label: 'Магазин или место покупки', type: 'text', value: base.place || '', placeholder: 'Необязательно', list: 'dl-places', half: true },
    { name: 'note', label: 'Комментарий', type: 'text', value: base.note || '', placeholder: 'Необязательно', half: true },
    { name: 'recurring', type: 'checkbox', text: 'Регулярный платёж', value: !!base.recurring, show: () => !existing || !existing.recurringId },
    { name: 'freq', label: 'Повторять', type: 'segmented', options: Object.entries(FREQ).map(([v, l]) => ({ value: v, label: l })), value: base.freq || 'monthly', show: v => v.recurring },
    { name: 'interval', label: 'Каждые', type: 'number', value: base.interval || 1, half: true, min: 1, show: v => v.recurring && v.freq === 'custom' },
    { name: 'unit', label: 'Единица', type: 'select', options: [{ value: 'day', label: 'дней' }, { value: 'week', label: 'недель' }, { value: 'month', label: 'месяцев' }], value: base.unit || 'day', half: true, show: v => v.recurring && v.freq === 'custom' },
    { name: 'dayOfMonth', label: 'Число месяца', type: 'number', value: base.dayOfMonth || '', half: true, hint: 'Если в месяце нет такого числа — в последний день', show: v => v.recurring && (v.freq === 'monthly' || v.freq === 'yearly' || (v.freq === 'custom' && v.unit === 'month')), check: x => x !== null && x !== '' && (x < 1 || x > 31) ? 'От 1 до 31' : '' },
    { name: 'end', label: 'Дата окончания', type: 'date', value: base.end || '', half: true, hint: 'Пусто — бессрочно', show: v => v.recurring }
  ], base);
  const wrap = document.createElement('div'); wrap.style.gridColumn = '1 / -1';
  wrap.innerHTML = `<datalist id="dl-titles">${titles.map(t => `<option value="${esc(t)}">`).join('')}</datalist><datalist id="dl-places">${places.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    <div class="field"><label>Статья</label><div class="cat-holder"></div></div>${existing && existing.recurringId ? `<p class="small muted">${icon('repeat')} Запись создана регулярным платежом. Изменения коснутся только её — правило меняется во вкладке «Регулярные».</p>` : ''}${existing && existing.importKey ? `<p class="small muted">${icon('download')} Запись перенесена из прежнего приложения.</p>` : ''}`;
  const quick = document.createElement('div'); quick.className = 'chips'; quick.style.marginTop = '-4px';
  quick.innerHTML = `<button type="button" class="chip" data-d="0">Сегодня</button><button type="button" class="chip" data-d="-1">Вчера</button><button type="button" class="chip" data-d="-2">Позавчера</button>`;
  f.el.insertBefore(wrap, f.el.querySelector('[data-name="title"]'));
  f.el.querySelector('[data-name="date"]').appendChild(quick);
  quick.addEventListener('click', e => { const c = e.target.closest('[data-d]'); if (c) f.set('date', D.add(D.today(), +c.dataset.d)); });
  const holder = wrap.querySelector('.cat-holder');
  const invNote = document.createElement('div'); invNote.className = 'inv-note'; holder.after(invNote);
  const drawCats = () => {
    holder.innerHTML = catPicker(type, catId);
    invNote.innerHTML = catId === INVEST_CAT ? `${icon('chest')}<div><b>Это не расход.</b> Сумма переложится из большого сундука в ларец инвестиций: свободных денег станет меньше, инвестиций — больше, общее имущество не изменится. В аналитике трат не появится.<br><span class="muted">Сейчас в ларце ${money(investBalance())}.</span></div>`
      : catId === DIVEST_CAT ? `${icon('chest')}<div><b>Возврат из инвестиций.</b> Деньги вернутся из ларца в большой сундук. Это не доход, общее имущество не изменится. Потребуется отдельное подтверждение.<br><span class="muted">В ларце сейчас ${money(investBalance())}.</span></div>` : '';
    invNote.hidden = !invNote.innerHTML;
  };
  drawCats();
  holder.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-cat],[data-newcat]'); if (!t) return; e.stopPropagation();
    if (t.hasAttribute('data-newcat')) { const c = await openCatForm({ kind: type }); if (c) { catId = c.id; drawCats(); } return; }
    catId = t.dataset.cat; drawCats();
  });
  f.on('type', v => { type = v; if (catId && catById(catId) && !kindsFor(type).includes(catById(catId).kind)) catId = ''; drawCats(); });
  f.on('title', v => { // подсказка статьи по прежним записям с таким описанием
    if (catId || !v) return;
    const prev = db.all('operations').filter(o => o.title === v && o.type === type).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (prev && prev.categoryId) { catId = prev.categoryId; drawCats(); }
  });
  const title = rule ? 'Регулярный платёж' : existing ? 'Исправить запись' : (type === 'income' ? 'Новый доход' : 'Новый расход');
  modal({ title, body: f.el, wide: true, actions: [
    ...(existing ? [{ label: 'Удалить', kind: 'btn-danger', icon: 'trash', onClick: async () => { if (await confirmDialog({ title: 'Удалить запись?', text: `${money(existing.amount)} · ${catName(existing.categoryId)}. Её можно будет вернуть кнопкой «Отменить».`, ok: 'Удалить', danger: true })) { await deleteOp(existing.id); return true; } return false; } }] : []),
    { label: 'Отмена', kind: 'btn-ghost' },
    { label: 'Сохранить', kind: 'btn-gold', icon: 'check', onClick: async () => {
      if (!f.validate()) return false;
      const v = f.values();
      if (!catId) { const ok = await confirmDialog({ title: 'Без статьи?', text: 'Статья не выбрана. Записать без статьи?', ok: 'Записать' }); if (!ok) return false; }
      const realType = catId === INVEST_CAT ? 'invest' : catId === DIVEST_CAT ? 'divest' : v.type;
      if (realType === 'divest') {
        if (v.recurring) { f.error('recurring', 'Возврат из ларца нельзя сделать регулярным: каждый подтверждается отдельно'); return false; }
        const avail = investBalance() + (existing && existing.type === 'divest' ? existing.amount : 0);
        if (v.amount > avail) { f.error('amount', `В ларце только ${money(avail)}. Если стоимость выросла, сначала укажите её в ларце.`); return false; }
        if (!await confirmDialog({ title: 'Вернуть деньги из инвестиций?', text: `${money(v.amount)} переложатся из ларца в большой сундук. Это не доход — общее имущество не изменится. Подтверждаете?`, ok: 'Вернуть в сундук', danger: true })) return false;
      }
      if (v.member) await db.setSetting('lastMember', v.member);
      if (v.recurring && (!existing || !existing.recurringId)) {
        const r = { id: rule ? rule.id : db.uid('r'), type: realType, amount: v.amount, categoryId: catId || null, title: v.title, note: v.note, member: v.member, place: v.place,
          freq: v.freq, interval: v.interval || 1, unit: v.unit, dayOfMonth: v.dayOfMonth || '', start: v.date, end: v.end || '', active: true,
          lastGenerated: rule ? rule.lastGenerated : null, createdAt: rule ? rule.createdAt : Date.now() };
        if (r.end && r.end < r.start) { f.error('end', 'Окончание раньше начала'); return false; }
        if (rule && rule.start !== r.start && rule.lastGenerated) r.lastGenerated = rule.lastGenerated;
        if (existing && !existing.recurringId) await db.commit([{ store: 'operations', del: existing.id }]);
        await db.commit([{ store: 'recurring', put: r }]);
        const before = balance(), ib = investBalance();
        const { created } = await processRecurring();
        const after = balance();
        if (after !== before || investBalance() !== ib) bus.emit('money', { delta: after - before, invest: investBalance() - ib });
        db.journal('recurring', `${rule ? 'Изменён' : 'Создан'} регулярный платёж: ${money(r.amount)} · ${ruleText(r)}`);
        toast(created ? `Правило сохранено. Записей за прошедшие даты: ${created}` : `Правило сохранено. Ближайший платёж: ${D.dm(nextOccurrence(r) || r.start)}`, { kind: 'good' });
        scribble(v.type === 'income' ? pick(AFTER_INC) : pick(AFTER_EXP));
        return true;
      }
      const rec = await saveOp({ ...(existing || {}), type: realType, amount: v.amount, categoryId: catId || null, title: v.title, note: v.note, date: v.date, member: v.member, place: v.place });
      sound.play(rec.type === 'income' ? 'coins' : rec.type === 'expense' ? 'loss' : 'lock');
      scribble(rec.type === 'income' ? pick(AFTER_INC) : rec.type === 'expense' ? pick(AFTER_EXP) : 'Переложил в ларец. Бумаги в порядке.');
      if (!existing) toast(`${{ income: 'Доход записан', expense: 'Расход записан', invest: 'Переложено в ларец', divest: 'Возвращено в сундук' }[rec.type]}: ${money(rec.amount)}`, { kind: 'good' });
      if (rec.date > D.today()) toast('Запись в будущем — в казну попадёт в свой день');
      return true;
    } }] });
}

function openOpDetails(id) {
  const o = db.get('operations', id); if (!o) return;
  if (o.type === 'transfer') {
    modal({ title: 'Перевод между кошельками', body: `<p>${money(o.amount)} · ${D.human(o.date)}${o.member ? ' · ' + esc(o.member) : ''}</p><p>${esc(o.from || '?')} → ${esc(o.to || '?')}</p><p class="small muted">Перевод между собственными кошельками перенесён из прежнего приложения. Он хранится для полноты истории, но не меняет общую казну и не участвует в аналитике.</p>`,
      actions: [{ label: 'Удалить', kind: 'btn-danger', icon: 'trash', onClick: async () => { await deleteOp(o.id); } }, { label: 'Закрыть', kind: 'btn-gold' }] });
    return;
  }
  openOpForm({ id });
}

// ---------- регулярные платежи ----------
function renderRules(body) {
  const rules = db.all('recurring').sort((a, b) => (b.active - a.active) || (a.title || '').localeCompare(b.title || '', 'ru'));
  const t = D.today(), horizon = D.add(t, 30);
  const upcoming = [];
  for (const r of rules) if (r.active) for (const d of occurrences(r, t, horizon)) upcoming.push({ r, d });
  upcoming.sort((a, b) => a.d.localeCompare(b.d));
  body.innerHTML = `<div class="ops-actions"><p class="small muted" style="margin:0;flex:1">Регулярные платежи казначей записывает сам — один раз на каждую дату, даже если приложение было закрыто. Отмена регулярности не удаляет уже сделанные записи.</p><button class="btn btn-ink" data-act="add-rule">${icon('plus')}Новый регулярный платёж</button></div>
    ${rules.length ? `<ul class="ledger">${rules.map(r => { const c = catById(r.categoryId); const nx = r.active ? nextOccurrence(r) : null; const cnt = db.all('operations').filter(o => o.recurringId === r.id).length;
      return `<li class="lrow" data-rule="${r.id}" data-ra="edit"><span class="cat-ic" style="--c:${c ? c.color : '#8a7058'}">${icon(c ? c.icon : 'repeat')}</span>
      <div class="main"><div class="t">${esc(r.title || (c ? c.name : 'Регулярный платёж'))}</div><div class="m">${ruleText(r)} · ${r.active ? (nx ? 'следующий ' + D.rel(nx) : 'завершён') : 'остановлен'} · записей: ${cnt}${r.end ? ' · до ' + D.dmy(r.end) : ''}</div></div>
      <div class="amt ${r.type === 'income' ? 'inc' : r.type === 'invest' ? 'inv' : 'exp'}">${r.type === 'income' ? '+' : r.type === 'invest' ? '⇢ ' : '−'}${money(r.amount)}</div>
      <button class="icon-btn sm" data-rule="${r.id}" data-ra="${r.active ? 'stop' : 'resume'}" title="${r.active ? 'Остановить' : 'Возобновить'}">${icon(r.active ? 'close' : 'repeat')}</button></li>`; }).join('')}</ul>`
      : empty('Регулярных платежей пока нет', 'Например, аренда раз в месяц или зарплата 10-го числа')}
    ${upcoming.length ? `${heading('Ближайшие 30 дней')}<ul class="ledger">${upcoming.slice(0, 30).map(({ r, d }) => `<li class="lrow" data-rule="${r.id}" data-ra="edit"><span class="cat-ic" style="--c:#8a7058">${icon('calendar')}</span><div class="main"><div class="t">${esc(r.title || catName(r.categoryId))}</div><div class="m">${D.rel(d)}, ${D.weekday(d)}</div></div><div class="amt ${r.type === 'income' ? 'inc' : 'exp'}">${r.type === 'income' ? '+' : '−'}${money(r.amount)}</div></li>`).join('')}</ul>` : ''}`;
}
async function ruleAction(id, act) {
  const r = db.get('recurring', id); if (!r) return;
  if (act === 'edit') {
    modal({ title: 'Регулярный платёж', body: `<p style="font-size:18px"><b>${esc(r.title || catName(r.categoryId))}</b> — ${r.type === 'income' ? '+' : '−'}${money(r.amount)}</p><p>${ruleText(r)}, с ${D.dmy(r.start)}${r.end ? ' по ' + D.dmy(r.end) : ''}. ${r.active ? 'Действует.' : 'Остановлен.'}</p><p class="small muted">Уже созданные записи останутся в книге при любом действии.</p>`,
      actions: [{ label: 'Удалить правило', kind: 'btn-danger', icon: 'trash', onClick: async () => {
        if (!await confirmDialog({ title: 'Удалить правило?', text: 'Новые записи перестанут создаваться. Уже сделанные записи останутся в книге.', ok: 'Удалить', danger: true })) return false;
        await db.commit([{ store: 'recurring', del: r.id }]); db.journal('recurring', `Удалено правило: ${r.title || catName(r.categoryId)}`);
        undoToast('Правило удалено', () => db.commit([{ store: 'recurring', put: r, keepStamp: true }]));
      } },
      { label: r.active ? 'Остановить' : 'Возобновить', kind: 'btn-ink', onClick: () => ruleAction(id, r.active ? 'stop' : 'resume') },
      { label: 'Изменить', kind: 'btn-gold', icon: 'edit', onClick: () => { setTimeout(() => openOpForm({ ruleId: id }), 50); } }] });
    return;
  }
  if (act === 'stop') { await db.commit([{ store: 'recurring', put: { ...r, active: false } }]); toast('Регулярность отменена. Прежние записи сохранены.'); db.journal('recurring', `Остановлено: ${r.title || catName(r.categoryId)}`); }
  if (act === 'resume') { await db.commit([{ store: 'recurring', put: { ...r, active: true, lastGenerated: D.today() } }]); toast('Правило снова действует. Платежи начнутся со следующей даты.'); }
}

// ---------- статьи (категории) ----------
let catKind = 'expense';
function renderCats(body) {
  const list = cats(catKind);
  const counts = {}; for (const o of db.all('operations')) if (o.categoryId) counts[o.categoryId] = (counts[o.categoryId] || 0) + 1;
  body.innerHTML = `<div class="ops-actions">${seg('catkind', [{ value: 'expense', label: 'Расходы' }, { value: 'income', label: 'Доходы' }], catKind)}<span class="grow"></span><button class="btn btn-ink" data-act="add-cat">${icon('plus')}Новая статья</button></div>
    <ul class="ledger cat-mgr">${list.map((c, i) => `<li class="lrow"><span class="cat-ic" style="--c:${c.color}">${icon(c.icon)}</span><div class="main"><div class="t">${esc(c.name)}</div><div class="m">${counts[c.id] || 0} ${plural(counts[c.id] || 0, ['запись', 'записи', 'записей'])}</div></div>
      <div class="order-btns"><button class="icon-btn sm" data-cat="${c.id}" data-cat-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Выше">${icon('up')}</button><button class="icon-btn sm" data-cat="${c.id}" data-cat-act="down" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Ниже">${icon('down')}</button></div>
      <button class="icon-btn sm" data-cat="${c.id}" data-cat-act="edit" aria-label="Изменить">${icon('edit')}</button><button class="icon-btn sm" data-cat="${c.id}" data-cat-act="del" aria-label="Удалить">${icon('trash')}</button></li>`).join('')}</ul>
    ${list.length ? '' : empty('Статей нет', 'Создайте свою')}`;
}
async function catAction(id, act) {
  const c = catById(id); if (!c) return;
  const list = cats(c.kind); const i = list.findIndex(x => x.id === id);
  if (act === 'up' || act === 'down') {
    const j = act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= list.length) return;
    const arr = [...list]; [arr[i], arr[j]] = [arr[j], arr[i]];
    await db.commit(arr.map((x, k) => ({ store: 'categories', put: { ...x, order: k } }))); return;
  }
  if (act === 'edit') return openCatForm(c);
  if (act === 'del') {
    const affected = db.all('operations').filter(o => o.categoryId === id);
    const rules = db.all('recurring').filter(r => r.categoryId === id);
    const others = list.filter(x => x.id !== id);
    const f = form([{ name: 'mode', type: 'segmented', options: [{ value: 'move', label: 'Перенести записи' }, { value: 'none', label: 'Оставить без статьи' }], value: others.length ? 'move' : 'none', show: () => affected.length + rules.length > 0 },
      { name: 'target', label: 'В статью', type: 'select', options: others.map(x => ({ value: x.id, label: x.name })), value: others[0] ? others[0].id : '', show: v => v.mode === 'move' && affected.length + rules.length > 0 }]);
    const info = document.createElement('p'); info.innerHTML = affected.length || rules.length ? `В статье «${esc(c.name)}» ${affected.length} ${plural(affected.length, ['запись', 'записи', 'записей'])}${rules.length ? ` и ${rules.length} регулярн.` : ''}. История не потеряется — выберите, что с ней сделать:` : `Статья «${esc(c.name)}» пуста.`;
    f.el.prepend(info);
    modal({ title: 'Удалить статью', body: f.el, actions: [{ label: 'Отмена', kind: 'btn-ghost' }, { label: 'Удалить статью', kind: 'btn-danger', icon: 'trash', onClick: async () => {
      const v = f.values(); const to = v.mode === 'move' ? v.target || null : null;
      const opsChange = affected.map(o => ({ store: 'operations', put: { ...o, categoryId: to }, keepStamp: true }));
      const rulesChange = rules.map(r => ({ store: 'recurring', put: { ...r, categoryId: to } }));
      await db.commit([...opsChange, ...rulesChange, { store: 'categories', del: c.id }]);
      db.journal('category', `Удалена статья «${c.name}»${to ? `, записи перенесены в «${catName(to)}»` : ', записи оставлены без статьи'}`);
      undoToast(`Статья «${c.name}» удалена`, () => db.commit([{ store: 'categories', put: c, keepStamp: true }, ...affected.map(o => ({ store: 'operations', put: o, keepStamp: true })), ...rules.map(r => ({ store: 'recurring', put: r, keepStamp: true }))]));
    } }] });
  }
}
export function openCatForm(init = {}) {
  return new Promise((resolve) => {
    const existing = init.id ? catById(init.id) : null;
    const f = form([
      { name: 'kind', type: 'segmented', options: [{ value: 'expense', label: 'Расход' }, { value: 'income', label: 'Доход' }], value: existing ? existing.kind : init.kind || 'expense', show: () => !existing },
      { name: 'name', label: 'Название', type: 'text', required: true, value: existing ? existing.name : '', check: (x, v) => { const n = (x || '').trim().toLowerCase(); return cats(v.kind).some(c => c.name.toLowerCase() === n && (!existing || c.id !== existing.id)) ? 'Такая статья уже есть' : ''; } },
      { name: 'icon', label: 'Значок', type: 'icon', icons: ICON_CHOICES_FIN, value: existing ? existing.icon : 'star' },
      { name: 'color', label: 'Цвет', type: 'color', value: existing ? existing.color : '#7a1f2b' }
    ]);
    let done = false;
    modal({ title: existing ? 'Изменить статью' : 'Новая статья', body: f.el, onClose: () => { if (!done) resolve(null); }, actions: [{ label: 'Отмена', kind: 'btn-ghost' }, { label: 'Сохранить', kind: 'btn-gold', icon: 'check', onClick: async () => {
      if (!f.validate()) return false;
      const v = f.values();
      const rec = existing ? { ...existing, name: v.name.trim(), icon: v.icon, color: v.color } : { id: db.uid('c'), kind: v.kind, name: v.name.trim(), icon: v.icon, color: v.color, order: cats(v.kind).length, createdAt: Date.now() };
      await db.commit([{ store: 'categories', put: rec }]);
      done = true; resolve(rec); toast(existing ? 'Статья изменена' : 'Статья добавлена', { kind: 'good' });
    } }] });
  });
}

// ---------------- ларец инвестиций ----------------
export function openInvest() { openOpForm({ type: 'expense', categoryId: INVEST_CAT }); }
export function openDivest() { openOpForm({ type: 'income', categoryId: DIVEST_CAT }); }
/** Указать текущую стоимость ларца (купоны, рост или падение цены бумаг) — без влияния на свободные деньги и траты. */
export function openRevalue(init = {}) {
  const existing = init.id ? db.get('operations', init.id) : null;
  const cur = investBalance() - (existing ? investDelta(existing) : 0);
  const f = form(existing ? [
    { name: 'dir', type: 'segmented', options: [{ value: 1, label: 'Стоимость выросла' }, { value: -1, label: 'Стоимость снизилась' }], value: existing.dir < 0 ? -1 : 1 },
    { name: 'amount', label: 'На сколько', type: 'money', required: true, min: 1, value: existing.amount },
    { name: 'date', label: 'Дата', type: 'date', required: true, value: existing.date, half: true },
    { name: 'note', label: 'Комментарий', type: 'text', value: existing.note || '', half: true }
  ] : [
    { name: 'value', label: 'Сколько стоят инвестиции сейчас', type: 'money', required: true, value: cur, hint: 'Например, по брокерскому приложению: облигации вместе с накопленными купонами' },
    { name: 'note', label: 'Комментарий', type: 'text', value: '', placeholder: 'Купоны за ноябрь, рост цены…' }
  ]);
  modal({ title: existing ? 'Переоценка ларца' : 'Текущая стоимость ларца', body: f.el, actions: [
    ...(existing ? [{ label: 'Удалить', kind: 'btn-danger', icon: 'trash', onClick: async () => { await deleteOp(existing.id); } }] : [{ label: 'Отмена', kind: 'btn-ghost' }]),
    { label: 'Сохранить', kind: 'btn-gold', icon: 'check', onClick: async () => {
      if (!f.validate()) return false; const v = f.values();
      if (existing) { await saveOp({ ...existing, amount: v.amount, dir: Number(v.dir), date: v.date, note: v.note }); return; }
      const delta = v.value - cur; if (!delta) { toast('Стоимость не изменилась'); return; }
      await saveOp({ type: 'revalue', amount: Math.abs(delta), dir: delta < 0 ? -1 : 1, categoryId: null, title: 'Переоценка ларца', note: v.note, date: D.today() });
      toast(`Стоимость ларца: ${money(v.value)} (${money(delta, { sign: true })})`, { kind: 'good' });
    } }] });
}
export function openCasket() {
  const list = db.all('operations').filter(o => investDelta(o) !== 0).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const sum = (t) => list.filter(o => o.type === t).reduce((s, o) => s + o.amount, 0);
  const reval = list.filter(o => o.type === 'revalue').reduce((s, o) => s + investDelta(o), 0);
  const m = modal({ title: 'Ларец инвестиций', wide: true, body: `<div class="sum-row">
      <div class="sum"><div class="l">В ларце</div><div class="v inv-c">${money(investBalance())}</div><span class="d">облигации и другие вложения</span></div>
      <div class="sum"><div class="l">В большом сундуке</div><div class="v">${money(balance())}</div><span class="d">свободные деньги</span></div>
      <div class="sum"><div class="l">Всё имущество</div><div class="v">${money(capital())}</div><span class="d">сундук + ларец</span></div></div>
    <p class="small muted" style="margin:0 0 8px">Начальный вклад ${money(Number(db.setting('openingInvest', 0)) || 0)} · переложено ${money(sum('invest'))} · возвращено ${money(sum('divest'))} · переоценка ${money(reval, { sign: true })}</p>
    ${list.length ? `<ul class="ledger">${list.slice(0, 60).map(o => opRow(o, { showDate: true })).join('')}</ul>` : '<p class="muted">В ларец ещё ничего не перекладывали. Начальную сумму инвестиций можно указать в «Настройки → Казна и семья».</p>'}`,
    actions: [{ label: 'Текущая стоимость', kind: 'btn-ghost', icon: 'chart', onClick: () => { setTimeout(() => openRevalue(), 120); } },
      { label: 'Вернуть в сундук', kind: 'btn-ink', icon: 'undo', onClick: () => { setTimeout(openDivest, 120); } },
      { label: 'Положить в ларец', kind: 'btn-gold', icon: 'plus', onClick: () => { setTimeout(openInvest, 120); } }] });
  m.el.addEventListener('click', (e) => { const r = e.target.closest('.lrow[data-op]'); if (r) { m.close(); setTimeout(() => openOpForm({ id: r.dataset.op }), 120); } });
}
/** Миграция данных к версии с ларцом: системные статьи и поиск старых «инвестиционных» статей. */
export async function migrateFinanceV2() {
  const ops = [];
  if (!db.get('categories', INVEST_CAT)) ops.push({ store: 'categories', put: { id: INVEST_CAT, kind: 'invest', name: 'Инвестиции', icon: 'chest', color: '#b8923a', system: true, order: 999, createdAt: Date.now() } });
  if (!db.get('categories', DIVEST_CAT)) ops.push({ store: 'categories', put: { id: DIVEST_CAT, kind: 'divest', name: 'Из инвестиций', icon: 'chest', color: '#2b6a9c', system: true, order: 999, createdAt: Date.now() } });
  if (db.setting('openingInvest') === undefined) ops.push({ store: 'settings', put: { key: 'openingInvest', value: 0 } });
  if (ops.length) await db.commit(ops);
  if (db.get('meta', 'investMigrationAsked')) return null;
  const legacy = db.all('categories').filter(c => c.kind === 'expense' && /инвест|облигац|брокер|акци|офз|вклад/i.test(c.name));
  const lops = db.all('operations').filter(o => o.type === 'expense' && legacy.some(c => c.id === o.categoryId));
  if (!lops.length) { await db.commit([{ store: 'meta', put: { key: 'investMigrationAsked', value: Date.now() } }]); return null; }
  return { cats: legacy, ops: lops, sum: lops.reduce((s, o) => s + o.amount, 0) };
}
export async function applyLegacyInvest(found, convert) {
  const ops = [{ store: 'meta', put: { key: 'investMigrationAsked', value: Date.now() } }];
  if (convert) for (const o of found.ops) ops.push({ store: 'operations', put: { ...o, type: 'invest', categoryId: INVEST_CAT, note: [o.note, `было в статье «${catName(o.categoryId)}»`].filter(Boolean).join(' · ') }, keepStamp: true });
  if (convert) await db.createSnapshot('Перед переносом инвестиций в ларец');
  await db.commit(ops);
}
