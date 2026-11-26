// assets.js — система растровых художественных слоёв.
//
// Векторные персонажи и сцены в приложении — это РАЗМЕТКА: скелет с шарнирами, позы, анимации и
// временная отрисовка. Настоящие иллюстрации подключаются файлами WebP/PNG, которые кладутся в корень
// сайта рядом с index.html и перечисляются в art-manifest.json. Если файла нет — остаётся вектор.
//
//  • Фон сцены:  art-<сцена>.webp — во весь кадр сцены (размеры в SCENES), без персонажей.
//  • Персонаж:   ch-<персонаж>-<часть>.webp — каждая часть нарисована на ПОЛНОМ холсте персонажа
//                в положении покоя (как слой PSD, экспортированный без обрезки), фон прозрачный.
//                Шарниры (pivot) заданы в коде и описаны в ART-BRIEF.md / art-kit.
//
// Подмена делается во время работы: в группу-часть вставляется <image>, а векторные фигуры этой части
// скрываются. Дочерние части остаются отдельными слоями и двигаются своими шарнирами.

export const SCENES = {
  treasury: { file: 'art-treasury.webp', w: 1000, h: 560, sel: '.treasury-box svg.scene', title: 'Сокровищница (подвал казны)' },
  office: { file: 'art-office.webp', w: 1000, h: 300, sel: '.desk-box svg.scene', title: 'Палата казначея' },
  stage: { file: 'art-stage.webp', w: 1000, h: 640, sel: '.stage-box svg.scene', title: 'Балаган шута (сцена колеса)' },
  duma: { file: 'art-duma.webp', w: 1200, h: 520, sel: '.duma-box svg.scene', title: 'Боярская дума' },
  kitchen: { file: 'art-kitchen.webp', w: 1200, h: 460, sel: '.kitchen-box svg.scene', title: 'Царская кухня' },
  map: { file: 'art-map.webp', w: 0, h: 0, sel: 'svg.map-svg', title: 'Карта пути (панорама)' }
};
export const CHARS = {
  servant: { sel: '.ch.servant', w: 200, h: 330, title: 'Ключник Прошка' },
  treasurer: { sel: '.ch.treasurer', w: 320, h: 250, title: 'Казначей Фома Счётович' },
  jester: { sel: '.ch.jester', w: 200, h: 330, title: 'Шут Гороховый' },
  cook: { sel: '.ch.cook', w: 260, h: 300, title: 'Повар Кузьма' }
};
for (const id of ['schetov', 'puzatov', 'trevogin', 'radostin', 'podpiskin', 'dikovinov', 'chekushkin', 'letopiscev']) CHARS['boyar-' + id] = { sel: `.ch.boyar[data-id="${id}"]`, w: 170, h: 360, title: 'Боярин ' + id };
for (const id of ['kupets', 'zmey', 'mytar', 'kot', 'ulita', 'koschey', 'yaga', 'chudo']) CHARS['boss-' + id] = { sel: `.boss.boss-${id}`, w: 260, h: 250, x: -10, y: -12, title: 'Босс ' + id };

let avail = new Set(), loaded = false;
export const has = (file) => avail.has(file);
export const count = () => avail.size;
export const list = () => [...avail];

/** Прочитать art-manifest.json (если есть). Ничего не ломается, если файла нет. */
export async function detect() {
  try {
    const r = await fetch('art-manifest.json', { cache: 'no-cache' });
    if (r.ok) { const j = await r.json(); avail = new Set((j.files || []).filter(f => /^[\w.-]+\.(webp|png|jpg)$/i.test(f))); }
  } catch (e) { /* офлайн или файла нет — работаем на векторе */ }
  loaded = true;
  return avail.size;
}

/** Части персонажа: группы с классом и шарниром (transform-origin). Ключ — самый частный класс, при повторе — с префиксом родителя. */
const GENERIC = new Set(['ch', 'arm', 'horn', 'e', 'm', 'b', 'leg', 'boot', 'held', 'prop']);
const PREFIX = new Set(['fore', 'hand', 'foot', 'lower', 'upper']);
export function parts(root) {
  const out = [], seen = new Map();
  // часть = группа с классом и шарниром, либо вариант лица (e-*, m-*, b-*), либо предмет в руке (held/prop)
  const isPart = (g) => { if (g === root || g.tagName.toLowerCase() !== 'g') return false; const c = g.getAttribute('class'); if (!c) return false;
    return /transform-origin/.test(g.getAttribute('style') || '') || /(^|\s)[emb]-\w+/.test(c) || /(^|\s)(held|prop)(\s|$)/.test(c); };
  const walk = (node, parentKey) => {
    for (const c of node.children) {
      if (c.tagName.toLowerCase() !== 'g') continue;
      if (isPart(c)) {
        const cls = c.getAttribute('class').split(/\s+/).filter(Boolean);
        let k = (cls.filter(x => !GENERIC.has(x)).pop() || cls[cls.length - 1]);
        if (PREFIX.has(k) && parentKey) k = parentKey + '-' + k;              // предплечья: arm-l-fore, arm-r-fore
        else if (!/^[emb]-/.test(k) && seen.has(k) && parentKey) k = parentKey + '-' + k; // варианты лица (e-open…) у двух глаз — один слой
        seen.set(k, (seen.get(k) || 0) + 1);
        const m = (c.getAttribute('style') || '').match(/transform-origin:\s*([-\d.]+)px\s+([-\d.]+)px/);
        out.push({ key: k, el: c, pivot: m ? [+m[1], +m[2]] : null, parent: parentKey || 'base' });
        walk(c, k);
      } else walk(c, parentKey);
    }
  };
  walk(root, '');
  return out;
}
/** Матрица только из атрибутов transform (без CSS-поз) от root до node. */
function attrMatrix(node, root, svg) {
  let m = svg.createSVGMatrix(); const chain = [];
  for (let n = node; n && n !== root; n = n.parentNode) chain.unshift(n);
  for (const n of chain) { const t = n.transform && n.transform.baseVal.consolidate(); if (t) m = m.multiply(t.matrix); }
  return m;
}
const containsPart = (el, set) => { for (const p of set) if (el !== p && el.contains(p)) return true; return false; };
function hideOwnShapes(group, partSet) {
  for (const c of [...group.children]) {
    if (c.classList && c.classList.contains('art-layer')) continue;
    if (partSet.has(c)) continue;
    if (c.tagName.toLowerCase() === 'g' && containsPart(c, partSet)) { hideOwnShapes(c, partSet); continue; }
    if (c.tagName.toLowerCase() === 'defs' || c.tagName.toLowerCase() === 'clippath') continue;
    c.setAttribute('data-vec', '1'); c.style.display = 'none';
  }
}
function insertLayer(group, file, box, inv) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const im = document.createElementNS(svgNS, 'image');
  im.setAttribute('class', 'art-layer'); im.setAttribute('href', file); im.setAttribute('preserveAspectRatio', 'none');
  im.setAttribute('x', box.x || 0); im.setAttribute('y', box.y || 0); im.setAttribute('width', box.w); im.setAttribute('height', box.h);
  if (inv) im.setAttribute('transform', `matrix(${inv.a} ${inv.b} ${inv.c} ${inv.d} ${inv.e} ${inv.f})`);
  group.insertBefore(im, group.firstChild);
}
/** Подменить части персонажа растровыми слоями, если они есть. */
export function applyChar(root, charId) {
  const c = CHARS[charId]; if (!c || !avail.size || root.dataset.art === '1') return 0;
  const svg = root.ownerSVGElement; if (!svg) return 0;
  const ps = parts(root); const set = new Set(ps.map(p => p.el)); let n = 0;
  const box = { x: c.x || 0, y: c.y || 0, w: c.w, h: c.h };
  const base = `ch-${charId}-base.webp`;
  if (has(base)) { hideOwnShapes(root, set); insertLayer(root, base, box, null); n++; }
  const used = new Set();
  for (const p of ps) {
    const f = `ch-${charId}-${p.key}.webp`; if (!has(f)) continue;
    hideOwnShapes(p.el, set);
    if (used.has(p.key)) continue; used.add(p.key);   // общий слой для двух глаз/бровей рисуется один раз
    insertLayer(p.el, f, box, attrMatrix(p.el, root, svg).inverse()); n++;
  }
  if (n) root.dataset.art = '1';
  return n;
}
/** Подложить растровый фон сцены (векторный фон скрывается, персонажи и интерфейс остаются). */
export function applyScene(svg, sceneId, keepSel = []) {
  const s = SCENES[sceneId]; if (!s || !has(s.file) || !svg || svg.dataset.art === '1') return false;
  const vb = svg.viewBox.baseVal; const w = s.w || vb.width, h = s.h || vb.height;
  const keep = (el) => keepSel.some(q => el.matches(q) || el.querySelector(q));
  for (const c of [...svg.children]) { const t = c.tagName.toLowerCase(); if (t === 'defs' || keep(c)) continue; c.setAttribute('data-vec', '1'); c.style.display = 'none'; }
  const im = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  im.setAttribute('class', 'art-layer art-bg'); im.setAttribute('href', s.file); im.setAttribute('x', vb.x); im.setAttribute('y', vb.y); im.setAttribute('width', w); im.setAttribute('height', h); im.setAttribute('preserveAspectRatio', 'none');
  svg.insertBefore(im, svg.querySelector('defs') ? svg.querySelector('defs').nextSibling : svg.firstChild);
  svg.dataset.art = '1';
  return true;
}
/** Пройтись по экрану и подключить всё, что есть. Вызывается после монтирования экранов. */
export function applyAll(scope = document) {
  if (!avail.size) return 0;
  let n = 0;
  const KEEP = {
    treasury: ['.chest-pos', '.casket-pos', '.stand', '.servant-pos'],
    office: ['.treasurer-pos', '.lantern'],
    stage: ['.wheel-holder', '.wheel-pointer', '.jester-pos', '.dagger-layer'],
    duma: ['.boyars-holder'],
    kitchen: ['.cook-pos', '.cook', '.pot', '.table'],
    map: ['.road-seg', '.map-node', '.map-flag', '.map-boss', '.map-chest', '.hero-pos', '.roads', '.signpost']
  };
  for (const [id, s] of Object.entries(SCENES)) scope.querySelectorAll(s.sel).forEach(svg => { if (applyScene(svg, id, KEEP[id] || [])) n++; });
  for (const [id, c] of Object.entries(CHARS)) scope.querySelectorAll(c.sel).forEach(el => { n += applyChar(el, id); });
  return n;
}
export function status() {
  const scenes = Object.values(SCENES).map(s => ({ title: s.title, file: s.file, ok: has(s.file) }));
  const chars = Object.entries(CHARS).map(([id, c]) => ({ id, title: c.title, ok: [...avail].some(f => f.startsWith(`ch-${id}-`)) }));
  return { loaded, total: avail.size, scenes, chars };
}
