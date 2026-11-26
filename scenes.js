// scenes.js — места действия: сокровищница, палата казначея, балаган шута,
// боярская дума, царская кухня и земли на карте пути.
import { P, G, Pt, L, E, C, SH, HL, MIR, strokes, star4, coin, rng, servant, treasurer, treasurerDesk, jester, cook, cookTable, cookPot } from './art.js';

const op = (s, o) => s.replace('/>', ` opacity="${o}"/>`);

function stoneWall(x0, y0, w, h, rowH, seed, base, line) {
  const r = rng(seed); let d = '', blocks = '';
  for (let y = y0, row = 0; y < y0 + h; y += rowH, row++) {
    d += `M${x0} ${y}H${x0 + w}`;
    const off = row % 2 ? rowH : 0;
    for (let x = x0 + off; x < x0 + w; x += rowH * 2) {
      d += `M${x} ${y}v${rowH}`;
      if (r() < .18) blocks += `<rect x="${x + 2}" y="${y + 2}" width="${rowH * 2 - 4}" height="${rowH - 4}" fill="${base}" opacity=".5"/>`;
    }
  }
  return blocks + `<path d="${d}" stroke="${line}" stroke-width="2" fill="none" opacity=".55"/>`;
}
function banner(x, y, len, col, emblem) {
  return G('banner', L(`M${x - 46} ${y}H${x + 46}`, 'k') + C(x - 48, y, 4, P.gold, 'k1') + C(x + 48, y, 4, P.gold, 'k1')
    + Pt(`M${x - 38} ${y}L${x + 38} ${y}L${x + 38} ${y + len}L${x} ${y + len - 26}L${x - 38} ${y + len}Z`, col)
    + Pt(`M${x - 31} ${y + 6}L${x + 31} ${y + 6}L${x + 31} ${y + len - 14}L${x} ${y + len - 36}L${x - 31} ${y + len - 14}Z`, 'none', 'k1').replace('k1', 'k1 goldline')
    + emblem + SH(`M${x + 14} ${y}L${x + 38} ${y}L${x + 38} ${y + len}L${x + 14} ${y + len - 18}Z`, .18), [x, y]);
}
function emblemKey(x, y) {
  return Pt(`M${x - 14} ${y - 10}L${x - 12} ${y - 24}L${x - 5} ${y - 16}L${x} ${y - 28}L${x + 5} ${y - 16}L${x + 12} ${y - 24}L${x + 14} ${y - 10}Z`, P.goldL, 'k1')
    + C(x, y + 6, 11, 'none', 'k').replace('class="k"', 'class="k goldstroke"') + Pt(`M${x - 2.5} ${y + 16}h5v28h-5Z`, P.goldL, 'k1') + Pt(`M${x + 2} ${y + 34}h8v4h-4v4h4v3h-8Z`, P.goldL, 'k1');
}
function sconce(x, y, id) {
  return `<g class="sconce">${`<circle cx="${x}" cy="${y - 34}" r="70" fill="url(#${id})" class="glowlight"/>`}${Pt(`M${x - 18} ${y + 18}Q${x} ${y + 30} ${x + 18} ${y + 18}L${x + 12} ${y + 8}L${x - 12} ${y + 8}Z`, P.iron)}${L(`M${x} ${y + 24}v22l-14 10`, 'k')}${Pt(`M${x - 6} ${y - 20}h12v28h-12Z`, P.cream)}${G('flame', Pt(`M${x} ${y - 46}C${x - 8} ${y - 36} ${x - 6} ${y - 26} ${x} ${y - 22}C${x + 6} ${y - 26} ${x + 8} ${y - 36} ${x} ${y - 46}Z`, P.goldL, 'k1') + Pt(`M${x} ${y - 38}C${x - 3} ${y - 32} ${x - 2} ${y - 27} ${x} ${y - 25}C${x + 2} ${y - 27} ${x + 3} ${y - 32} ${x} ${y - 38}Z`, '#fff3c4', ''), [x, y - 22])}</g>`;
}
const glowDef = (id, col = '#ffd98a') => `<radialGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity=".55"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`;
function motes(n, x0, y0, w, h, seed) {
  const r = rng(seed); let s = '';
  for (let i = 0; i < n; i++) s += `<circle class="mote" cx="${(x0 + r() * w).toFixed(0)}" cy="${(y0 + r() * h).toFixed(0)}" r="${(1 + r() * 1.6).toFixed(1)}" fill="#fff2c8" style="animation-delay:${(-r() * 9).toFixed(1)}s"/>`;
  return `<g class="motes">${s}</g>`;
}
function sack(x, y, s = 1, label = '', col = '#b08a55') {
  return `<g transform="translate(${x} ${y}) scale(${s})">${Pt('M-26 0C-32-24-22-46 0-50C22-46 32-24 26 0Z', col)}${Pt('M-10-48Q0-56 10-48L8-58Q0-62-8-58Z', col, 'k1')}${L('M-12-46q12 5 24 0', 'k')}${label ? `<text x="0" y="-18" text-anchor="middle" font-size="11" font-weight="700" fill="${P.brownD}" font-family="Lora, serif">${label}</text>` : ''}${SH('M10-44C22-36 28-18 26 0H12C16-16 16-32 10-44Z', .18)}</g>`;
}
function barrel(x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">${Pt('M-30 0C-38-26-38-58-30-84L30-84C38-58 38-26 30 0Z', P.woodL)}${L('M-34-18h68M-35-66h70', 'k')}${Pt('M-36-22h72v6h-72ZM-36-70h72v6h-72Z', P.iron, 'k1')}${L('M-14-84v84M10-84v84', 'k1')}${E(0, -84, 30, 7, P.wood)}${SH('M14-84C24-60 24-24 14 0H30C38-26 38-58 30-84Z', .2)}</g>`;
}
function jar(x, y, h, col, lid = P.wood) {
  return Pt(`M${x - 10} ${y}C${x - 14} ${y - h * .4} ${x - 12} ${y - h * .8} ${x - 7} ${y - h}L${x + 7} ${y - h}C${x + 12} ${y - h * .8} ${x + 14} ${y - h * .4} ${x + 10} ${y}Z`, col)
    + Pt(`M${x - 8} ${y - h - 6}h16v6h-16Z`, lid, 'k1') + HL(`M${x - 6} ${y - h * .7}v${h * .4}`);
}

// ============ СОКРОВИЩНИЦА (главная). viewBox 0 0 1000 560 ============
export function mainChest() {
  const pile = (lvl, d, extra) => `<g class="pile pile${lvl}">${Pt(d, P.gold)}${extra}</g>`;
  const coinsRow = (pts) => pts.map(([x, y, r]) => coin(x, y, r || 9)).join('');
  return `<g class="main-chest">
    ${op(E(150, 234, 160, 13, P.ink, ''), .3)}
    <g class="mlid"${' style="transform-origin:150px 100px"'}>${Pt('M24 100C24 44 64 14 150 14C236 14 276 44 276 100Z', 'url(#trWoodD)')}${Pt('M40 98C40 54 74 30 150 30C226 30 260 54 260 98Z', '#2c1a10', 'k1')}
      ${Pt('M60 22l10 76M240 22l-10 76', 'none').replace('fill="none"', 'fill="none" class="k1"')}${Pt('M140 14h20v12h-20Z', P.gold, 'k1')}${HL('M44 70q10-34 60-46')}</g>
    ${Pt('M26 98L274 98L270 116L30 116Z', '#22150d')}
    <g class="piles">
      <g class="pile pile0">${L('M36 104l40 10M36 104l18 12M264 104l-38 10M264 104l-16 12M44 108q10 4 18 0M248 108q-10 4-18 0', 'k1').replace('k1 nf', 'k1 nf web')}<g class="moth">${Pt('M150 70c-8-8-18-6-16 2c2 6 10 6 16-2Zm0 0c8-8 18-6 16 2c-2 6-10 6-16-2Z', '#c9bfa8', 'k1')}</g></g>
      ${pile(1, 'M40 116C80 102 120 100 150 102C180 100 220 102 260 116Z', coinsRow([[96, 108, 8], [150, 103, 8], [200, 108, 8]]))}
      ${pile(2, 'M36 116C64 92 104 78 150 76C196 78 236 92 264 116Z', coinsRow([[84, 100], [120, 86], [158, 80], [196, 88], [228, 102], [140, 98]]) + C(176, 98, 6, P.red, 'k1'))}
      ${pile(3, 'M32 116C52 76 96 52 150 48C204 52 248 76 268 116Z', coinsRow([[76, 96], [104, 74], [138, 58], [170, 56], [204, 70], [232, 94], [120, 94], [186, 92], [154, 80]]) + C(128, 76, 6, P.greenL, 'k1') + C(196, 82, 6, P.red, 'k1')
        + `<g transform="translate(206 34)">${Pt('M0 0h22l-4 16q-7 6-14 0Z', P.goldL)}${L('M11 16v12M4 30h14', 'k')}${C(11, 6, 3, P.red, 'k1')}</g>` + L('M60 104q30 14 60 6q30-8 52 4', 'k1').replace('k1 nf', 'k1 nf pearls'))}
      ${pile(4, 'M24 118C40 64 90 28 150 22C210 28 260 64 276 118Z', coinsRow([[60, 104], [86, 78], [112, 56], [142, 36], [172, 34], [200, 50], [228, 72], [252, 100], [100, 98], [130, 80], [160, 64], [190, 82], [220, 100], [150, 104]]) + C(118, 70, 6, P.greenL, 'k1') + C(206, 70, 6, P.red, 'k1') + C(160, 92, 6, P.blueL, 'k1')
        + `<g transform="translate(128 0)">${Pt('M0 22L2 6L10 14L22 0L34 14L42 6L44 22Z', P.goldL)}${Pt('M0 22h44v6H0Z', P.gold, 'k1')}${C(22, 12, 2.6, P.red, 'k1')}</g>` + coinsRow([[40, 140, 8], [262, 150, 8], [232, 172, 7]]))}
    </g>
    <g class="chest-mouth"><rect x="40" y="70" width="220" height="40" fill="none"/></g>
    ${Pt('M22 106L278 106L270 234L30 234Z', 'url(#trWood)')}
    ${L('M26 140H274M28 172H272M29 204H271', 'k1')}${SH('M214 106L278 106L270 234L222 234Z', .2)}
    ${Pt('M70 106h22v128H70ZM208 106h22v128h-22Z', P.iron, 'k1')}${[120, 150, 180, 210].map(y => C(81, y, 2.6, P.greyL, 'k1') + C(219, y, 2.6, P.greyL, 'k1')).join('')}
    ${Pt('M22 106h40v14l-26 10l-14-6ZM278 106h-40v14l26 10l14-6ZM30 234h34v-14l-24-8l-10 6ZM270 234h-34v-14l24-8l10 6Z', P.gold, 'k1')}
    ${Pt('M20 102h260v10H20Z', P.goldD, 'k1')}
    ${Pt('M126 124h48v52l-24 12l-24-12Z', P.gold)}${C(150, 146, 6, P.ink, '')}${Pt('M147 148h6l2 16h-10Z', P.ink, '')}${star4(150, 132, 5, P.goldL)}
    ${HL('M34 124q2 50 6 96')}
  </g>`;
}
/** Текстуры-материалы для сцен: тёмное дерево, белый камень, каменный пол. */
export const texDefs = (k = 't') => `<pattern id="${k}Wood" patternUnits="userSpaceOnUse" width="300" height="300"><image href="wood-dark.jpg" width="300" height="300" preserveAspectRatio="none"/></pattern>
  <pattern id="${k}WoodD" patternUnits="userSpaceOnUse" width="300" height="300"><image href="wood-dark.jpg" width="300" height="300" preserveAspectRatio="none"/><rect width="300" height="300" fill="#140a06" opacity=".45"/></pattern>
  <pattern id="${k}WoodH" patternUnits="userSpaceOnUse" width="300" height="300" patternTransform="rotate(90)"><image href="wood-dark.jpg" width="300" height="300" preserveAspectRatio="none"/></pattern>
  <pattern id="${k}Stone" patternUnits="userSpaceOnUse" width="640" height="320"><image href="stone-wall.jpg" width="640" height="320" preserveAspectRatio="none"/></pattern>
  <pattern id="${k}Floor" patternUnits="userSpaceOnUse" width="300" height="150"><image href="stone-floor.jpg" width="300" height="150" preserveAspectRatio="none"/></pattern>
  <radialGradient id="${k}Vig" cx=".5" cy=".42" r=".75"><stop offset=".55" stop-color="#0c0814" stop-opacity="0"/><stop offset="1" stop-color="#0c0814" stop-opacity=".78"/></radialGradient>`;

/** Ларец инвестиций: расписная лакированная шкатулка-теремок, на замке, внутри — бумаги и облигации. Начало координат — середина низа. */
export function casket() {
  const orn = (x, y) => `<g transform="translate(${x} ${y})">${L('M-12 0c4-8 12-8 12 0s8 8 12 0', 'k1 goldline')}${C(0, 0, 2.2, P.goldL, '')}</g>`;
  return `<g class="casket">
    ${op(E(0, 2, 92, 9, P.ink, ''), .35)}
    <circle class="casket-glow" cx="0" cy="-70" r="120" fill="url(#docGlow)"/>
    <g class="docs">
      ${Pt('M-58-96h40l4 56h-48Z', '#f4e6c4', 'k1')}${L('M-52-86h30M-52-78h28M-52-70h30M-52-62h22', 'k1 faint')}${C(-30, -50, 6, P.red, 'k1')}
      ${Pt('M-14-108h46l-2 66h-46Z', '#fbf1d8', 'k1')}<text x="9" y="-92" text-anchor="middle" font-size="8" font-weight="700" fill="${P.blueD}" font-family="Lora, serif">ОБЛИГАЦИЯ</text>${L('M-8-82h34M-8-74h30M-8-66h34', 'k1 faint')}${C(20, -52, 6, P.blue, 'k1')}
      <g transform="translate(46 -60) rotate(-12)">${Pt('M-10-30h20v36h-20Z', '#efdfb8', 'k1')}${E(0, -30, 10, 4, '#f6ead0', 'k1')}${Pt('M-11-6h22v4h-22Z', P.red, 'k1')}</g>
    </g>
    <g class="cbody">
      ${Pt('M-80-60H80V-6Q80 0 74 0H-74Q-80 0-80-6Z', P.blueD)}
      ${Pt('M-72-54H72V-8H-72Z', P.blue, 'k1')}
      ${orn(-40, -30)}${orn(40, -30)}${L('M-72-42h144M-72-20h144', 'k1 goldline')}
      ${Pt('M-80-60h10V0h-10ZM70-60h10V0H70Z', P.gold, 'k1')}${[-50, -30, -10].map(y => C(-75, y, 2, P.goldL, '') + C(75, y, 2, P.goldL, '')).join('')}
      ${SH('M40-60H80V-6Q80 0 74 0H40Z', .22)}${HL('M-72-50v38')}
      <g class="padlock">${Pt('M-11-42c0-14 22-14 22 0', 'none').replace('fill="none"', 'fill="none" class="k shackle" stroke-width="5"')}${Pt('M-15-44h30v28q-15 8-30 0Z', P.gold)}${C(0, -32, 3.6, P.ink, '')}${Pt('M-1.6-31h3.2l1 8h-5.2Z', P.ink, '')}<circle class="keyhole-glow" cx="0" cy="-30" r="5" fill="#ffe7a0"/></g>
    </g>
    <g class="clid">
      ${Pt('M-84-60L-84-74Q-80-100-40-108L0-124L40-108Q80-100 84-74L84-60Z', P.burg)}
      ${Pt('M-74-64L-74-74Q-70-94-36-100L0-114L36-100Q70-94 74-74L74-64Z', P.red, 'k1')}
      ${L('M-60-80q30-14 60-26q30 12 60 26', 'k1 goldline')}${Pt('M-6-124h12l-6-14Z', P.gold, 'k1')}${C(0, -140, 4, P.goldL, 'k1')}
      ${Pt('M-86-64h172v8h-172Z', P.gold, 'k1')}${SH('M40-108L84-74V-60H44Z', .2)}
    </g>
  </g>`;
}
export function treasuryScene() {
  const t = 'tr';
  return `<defs>${texDefs(t)}${glowDef('sg1')}${glowDef('chestglow', '#ffd36b')}${glowDef('docGlow', '#9fd0ff')}<linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffeec4" stop-opacity=".38"/><stop offset="1" stop-color="#ffeec4" stop-opacity="0"/></linearGradient>
    <linearGradient id="floorShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0814" stop-opacity=".55"/><stop offset=".35" stop-color="#0c0814" stop-opacity=".1"/><stop offset="1" stop-color="#0c0814" stop-opacity=".45"/></linearGradient></defs>
  <rect width="1000" height="440" fill="url(#${t}Stone)"/>
  <rect width="1000" height="440" fill="#2a1c14" opacity=".28"/>
  ${Pt('M230 440L230 220C230 128 302 74 400 74C498 74 570 128 570 220L570 440Z', '#120c10', '')}
  <path d="M218 440L218 218C218 118 296 60 400 60C504 60 582 118 582 218L582 440" fill="none" stroke="#b9a07e" stroke-width="22" opacity=".9"/>
  <path d="M218 440L218 218C218 118 296 60 400 60C504 60 582 118 582 218L582 440" fill="none" stroke="#4a3a2c" stroke-dasharray="2 26" stroke-width="24" opacity=".6"/>
  <path d="M207 440L207 218C207 112 290 49 400 49" fill="none" stroke="#0c0814" stroke-width="3" opacity=".5"/>
  ${Pt('M14 440V262C14 206 56 172 108 172C160 172 200 206 200 262V440Z', '#120c10', '')}${Pt('M770 440V262C770 206 812 172 864 172C916 172 956 206 956 262V440Z', '#120c10', '')}
  ${Pt('M26 336h166v10H26ZM782 336h166v10H782Z', `url(#${t}WoodH)`)}
  ${sack(56, 336, .9, '₽')}${sack(112, 336, .75)}${`<g transform="translate(160 302)">${Pt('M-22 34L22 34L20 6L-20 6Z', P.burgD)}${Pt('M-22 6C-22-8 22-8 22 6Z', P.burg)}${Pt('M-3 10h6v10h-6Z', P.gold, 'k1')}</g>`}
  ${sack(62, 440, 1.05)}${barrel(150, 440, .9)}
  ${jar(808, 336, 46, P.burgD, P.goldD)}${jar(846, 336, 34, P.greenD)}${`<g transform="translate(900 324)">${Pt('M-22 12h44v-24h-44Z', P.parch)}${E(-22, 0, 4, 12, P.cream)}${E(22, 0, 4, 12, P.cream)}</g>`}${`<g transform="translate(896 306)">${Pt('M-18 0h36v-10h-36Z', P.parch, 'k1')}${E(-18, -5, 3, 5, P.cream, 'k1')}</g>`}
  <g class="window">${Pt('M336 120C336 96 364 84 400 84C436 84 464 96 464 120V176H336Z', '#f4dfae')}${L('M336 140H464M336 158H464M368 90V176M400 84V176M432 90V176', 'k1')}${Pt('M330 176h140v10H330Z', `url(#${t}WoodD)`)}</g>
  <path class="ray" d="M340 180L460 180L600 440L200 440Z" fill="url(#ray)"/>
  ${motes(16, 260, 190, 280, 240, 3)}
  ${banner(200, 40, 190, P.burg, emblemKey(200, 108))}${banner(600, 40, 190, P.blueD, emblemKey(600, 108))}
  ${sconce(196, 278, 'sg1')}${sconce(712, 270, 'sg1')}
  <rect y="440" width="1000" height="120" fill="url(#${t}Floor)"/><rect y="440" width="1000" height="120" fill="url(#floorShade)"/>
  ${Pt('M290 440L510 440L600 560L200 560Z', P.burg)}${L('M302 448L498 448L584 556M302 448L216 556', 'k1').replace('k1 nf', 'k1 nf goldline')}
  ${coin(220, 520, 8)}${coin(238, 534, 7)}${coin(590, 528, 8)}
  <circle class="chestglow" cx="400" cy="380" r="210" fill="url(#chestglow)"/>
  <g class="chest-pos" transform="translate(250 230)">${mainChest()}</g>
  <g class="stand" transform="translate(690 470)">${Pt('M-96-30h192v12h-192Z', `url(#${t}WoodH)`)}${Pt('M-84-18h168l-8 18h-152Z', `url(#${t}WoodD)`)}${Pt('M-80 0h14v22h-14ZM66 0h14v22H66Z', `url(#${t}WoodD)`)}${SH('M-96-18h192v4h-192Z', .35)}</g>
  <g class="casket-pos" transform="translate(690 440)" role="button" aria-label="Ларец инвестиций">${casket()}</g>
  <g class="servant-pos" transform="translate(842 226) scale(.94)">${servant()}</g>
  <rect width="1000" height="560" fill="url(#${t}Vig)" pointer-events="none"/>`;
}

// ============ ПАЛАТА КАЗНАЧЕЯ. viewBox 0 0 1000 300 ============
export function deskRoomScene() {
  const books = [[778, 22, P.burg], [798, 18, P.greenD], [814, 24, P.blueD], [836, 20, P.goldD], [854, 16, P.burgD], [868, 22, P.green]]
    .map(([x, w, c], i) => Pt(`M${x} 96h${w * .8}v-${44 + (i % 3) * 6}h-${w * .8}Z`, c, 'k1') + L(`M${x + 3} ${80 - (i % 3) * 6}h${w * .8 - 6}`, 'k1')).join('');
  return `<defs>${glowDef('lampglow')}${texDefs('dk')}<pattern id="dkWall" patternUnits="userSpaceOnUse" width="300" height="300"><image href="wall-violet.jpg" width="300" height="300"/></pattern><radialGradient id="dkVig" cx=".62" cy=".3" r=".8"><stop offset=".3" stop-color="#0c0814" stop-opacity="0"/><stop offset="1" stop-color="#0c0814" stop-opacity=".6"/></radialGradient></defs>
  <rect width="1000" height="136" fill="url(#dkWall)"/>
  <rect y="132" width="1000" height="168" fill="url(#dkWood)"/><rect y="132" width="1000" height="168" fill="#140a06" opacity=".25"/>
  ${Pt('M0 120H1000V136H0Z', 'url(#dkWoodH)')}${L('M0 136H1000', 'k')}
  ${Array.from({ length: 25 }, (_, i) => Pt(`M${i * 40 + 8} 18l12 -10l12 10l-12 10Z`, P.burg, 'k1')).join('')}${L('M0 32H1000M0 4H1000', 'k1')}
  <g class="window">${Pt('M80 200V70C80 40 108 26 140 26C172 26 200 40 200 70V200Z', '#f2ddb0')}${Array.from({ length: 7 }, (_, i) => L(`M${80 + i * 20} 26L${200} ${146 - i * 20}M${80 + i * 20} 200L200 ${80 + i * 20}`, 'k1')).join('')}${Pt('M70 200h140v12H70Z', P.woodD)}</g>
  <path class="ray" d="M90 200L200 200L330 300L150 300Z" fill="#ffeec4" opacity=".14"/>
  ${Pt('M760 96h200v8H760ZM760 170h200v8H760Z', 'url(#dkWoodH)')}${books}
  <g transform="translate(900 96)">${Pt('M-14-40h28l-12 18l12 18h-28l12-18Z', '#f4dfae')}${Pt('M-16-44h32v4h-32ZM-16-4h32v4h-32Z', P.wood, 'k1')}<path class="sand" d="M-8-36h16l-8 12Z" fill="#c9a043"/></g>
  <g transform="translate(790 170)">${Pt('M0 0h50v-14H0Z', P.parch, 'k1')}${E(0, -7, 4, 7, P.cream)}${E(50, -7, 4, 7, P.cream)}</g>${`<g transform="translate(870 170)">${sack(10, 0, .5, '')}</g>`}
  <g class="lantern" style="transform-origin:620px 0px">${L('M620 0v60', 'k')}<circle cx="620" cy="84" r="60" fill="url(#lampglow)" class="glowlight"/>${Pt('M606 60h28l-4 40h-20Z', P.goldD)}${Pt('M610 66h20l-3 28h-14Z', '#ffe9a6', 'k1')}${Pt('M602 58h36l-6-8h-24Z', P.iron, 'k1')}</g>
  <g class="treasurer-pos" transform="translate(340 52)">${treasurer()}${treasurerDesk()}</g>
  ${Pt('M0 274H1000V300H0Z', 'url(#dkWoodD)')}${Pt('M0 268H1000V276H0Z', 'url(#dkWoodH)')}
  <rect width="1000" height="300" fill="url(#dkVig)" pointer-events="none"/>`;
}

// ============ БАЛАГАН ШУТА. viewBox 0 0 1000 640 ============
export function stageScene() {
  const t = 'st';
  const flags = Array.from({ length: 13 }, (_, i) => { const x = 40 + i * 72, y = 30 + Math.sin(i / 12 * Math.PI) * 30; return `<g class="flag" style="--d:${(-i * .23).toFixed(2)}s">${Pt(`M${x} ${y}L${x + 52} ${y + 2}L${x + 26} ${y + 42}Z`, [P.red, P.gold, P.green, P.blue][i % 4])}</g>`; }).join('');
  const drape = (x, flip) => { const d = `M0 0H150C140 120 150 260 130 420C120 500 140 560 150 640H0Z`; const folds = L('M30 0C40 200 30 400 40 640M70 0C80 200 70 420 84 640M110 0C116 160 108 330 112 640', 'k1'); return `<g transform="translate(${x} 0) scale(${flip} 1)"><g class="drape">${Pt(d, P.burg)}${folds}${SH('M0 0H40C40 200 30 400 40 640H0Z', .25)}${SH('M110 0H150C140 120 150 260 130 420C120 500 140 560 150 640H110Z', .2)}${Pt('M126 360q20-10 30 4q-14 14-30 6Z', P.gold, 'k1')}${Pt('M150 368l6 40l-10 0Z', P.gold, 'k1')}</g></g>`; };
  return `<defs>${texDefs(t)}<pattern id="stBack" patternUnits="userSpaceOnUse" width="420" height="420"><image href="wall-ochre.jpg" width="420" height="420"/></pattern>
    <radialGradient id="spotL" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9b0" stop-opacity=".32"/><stop offset="1" stop-color="#ffe9b0" stop-opacity="0"/></radialGradient></defs>
  <rect width="1000" height="560" fill="url(#stBack)"/><rect width="1000" height="560" fill="#2a1410" opacity=".35"/>
  <ellipse cx="400" cy="300" rx="330" ry="300" fill="url(#spotL)"/><ellipse cx="760" cy="420" rx="200" ry="200" fill="url(#spotL)"/>
  <g class="bunting">${L('M30 28Q500 90 970 28', 'k')}${flags}</g>
  <rect y="560" width="1000" height="80" fill="url(#${t}WoodH)"/>${L('M0 560H1000', 'k')}<rect y="560" width="1000" height="80" fill="url(#floorShadeSt)"/>
  <linearGradient id="floorShadeSt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity=".1"/></linearGradient>
  ${Pt('M320 560L388 300L412 300L340 560ZM480 560L412 300L388 300L460 560Z', `url(#${t}Wood)`)}${Pt('M340 470h120v10H340Z', `url(#${t}WoodD)`)}
  ${op(E(400, 566, 120, 10, P.ink, ''), .35)}${op(E(765, 572, 70, 8, P.ink, ''), .35)}
  <g transform="translate(880 560)">${Pt('M-40 0C-44-30-36-52 0-54C36-52 44-30 40 0Z', P.burg)}${E(0, -50, 38, 8, P.cream)}${L('M-36-30l72 18M-36-12l72-18', 'k1').replace('k1 nf', 'k1 nf goldline')}</g>
  ${C(120, 548, 12, P.red)}${C(150, 552, 9, P.gold)}${C(176, 550, 10, P.greenL)}
  ${drape(0, 1)}${drape(1000, -1)}
  <g class="wheel-holder" transform="translate(400 300)"></g>
  <g class="wheel-pointer" transform="translate(400 46)">${Pt('M-16 0h32l-16 30Z', P.goldL)}${C(0, -2, 8, P.gold)}</g>
  <g class="jester-pos" transform="translate(660 258) scale(1.06)">${jester()}</g>
  <g class="dagger-layer"></g>`;
}

// ============ БОЯРСКАЯ ДУМА. viewBox 0 0 1200 520 ============
export function dumaScene() {
  const frieze = Array.from({ length: 30 }, (_, i) => { const x = i * 40 + 20; return `M${x - 14} 120q14-22 28 0M${x} 120v-16M${x - 8} 108q8-10 16 0`; }).join('');
  const column = (x) => Pt(`M${x - 26} 470V170Q${x} 150 ${x + 26} 170V470Z`, '#b9833d') + Pt(`M${x - 34} 170h68v-16h-68Z`, P.burg, 'k1') + Pt(`M${x - 34} 470h68v-14h-68Z`, P.burg, 'k1')
    + L(`M${x - 26} 230h52M${x - 26} 300h52M${x - 26} 370h52`, 'k1') + Array.from({ length: 4 }, (_, i) => Pt(`M${x} ${194 + i * 70}l10 14l-10 14l-10-14Z`, P.burg, 'k1')).join('') + SH(`M${x + 8} 168Q${x + 18} 160 ${x + 26} 170V470H${x + 8}Z`, .22);
  const win = (x) => `<g>${Pt(`M${x - 50} 330V220C${x - 50} 196 ${x - 26} 180 ${x} 180C${x + 26} 180 ${x + 50} 196 ${x + 50} 220V330Z`, '#f3e0b2')}${Array.from({ length: 6 }, (_, i) => L(`M${x - 50 + i * 20} 180L${x + 50} ${280 - i * 20}M${x - 50} ${230 + i * 20}L${x - 50 + (100 - i * 20)} 330`, 'k1')).join('')}${Pt(`M${x - 58} 330h116v10h-116Z`, P.woodD)}</g>`;
  const tiles = Array.from({ length: 6 }, (_, r) => Array.from({ length: 4 }, (_, c) => `<rect x="${1086 + c * 22}" y="${220 + r * 40}" width="22" height="40" fill="#efe7d6" stroke="#2a1b12" stroke-width="1"/><path d="M${1097 + c * 22} ${228 + r * 40}l6 12l-6 12l-6-12Z" fill="${(r + c) % 2 ? '#3c6a7a' : '#7a3a2a'}"/>`).join('')).join('');
  return `<defs>${texDefs('du')}<pattern id="duWall" patternUnits="userSpaceOnUse" width="360" height="360"><image href="wall-azure.jpg" width="360" height="360"/></pattern><linearGradient id="duLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0814" stop-opacity=".35"/><stop offset=".5" stop-color="#0c0814" stop-opacity="0"/><stop offset="1" stop-color="#0c0814" stop-opacity=".3"/></linearGradient></defs>
  <rect width="1200" height="520" fill="url(#duWall)"/><rect width="1200" height="520" fill="url(#duLight)"/>
  ${Pt('M0 0H1200V130H0Z', P.burgD)}<path d="${frieze}" fill="none" stroke="#e8c86e" stroke-width="2"/>
  ${Array.from({ length: 12 }, (_, i) => Pt(`M${i * 100 + 50} 0C${i * 100 + 50} 50 ${i * 100 + 10} 70 ${i * 100 - 10} 90`, 'none').replace('fill="none"', 'fill="none" class="k1 goldline"')).join('')}
  ${Pt('M0 130H1200V146H0Z', P.gold)}
  
  ${win(280)}${win(920)}
  <path class="ray" d="M240 330L330 330L470 470L300 470Z" fill="#ffeec4" opacity=".12"/><path class="ray" d="M880 330L970 330L1000 470L870 470Z" fill="#ffeec4" opacity=".1"/>
  ${Pt('M40 400h1120v22H40Z', 'url(#duWoodH)')}${Pt('M40 386h1120v16H40Z', P.burg)}${L('M60 422v48M400 422v48M800 422v48M1140 422v48', 'k')}
  ${column(110)}${column(450)}${column(750)}${column(1050)}
  <g>${Pt('M1076 470V214l10-24h88l10 24V470Z', '#e4d8c2')}${tiles}${Pt('M1070 190h120v-24h-120Z', P.burgD)}${Pt('M1086 166h88v-30h-88Z', '#e4d8c2')}</g>
  <rect y="470" width="1200" height="50" fill="url(#duWoodH)"/>${L('M0 470H1200', 'k')}<rect y="470" width="1200" height="50" fill="#0c0814" opacity=".25"/>
  ${Pt('M520 470L680 470L760 520L440 520Z', P.burg)}${L('M532 476L668 476L740 518M532 476L460 518', 'k1').replace('k1 nf', 'k1 nf goldline')}
  <g class="boyars-holder"></g>`;
}

// ============ ЦАРСКАЯ КУХНЯ. viewBox 0 0 1200 460 ============
export function kitchenScene() {
  const hang = (x, kind) => {
    let g = '';
    if (kind === 'garlic') g = L(`M${x} 30v40`, 'k1') + [0, 1, 2, 3].map(i => C(x + (i % 2 ? 6 : -6), 76 + i * 16, 9, '#efe6d2')).join('');
    if (kind === 'onion') g = L(`M${x} 30v36`, 'k1') + [0, 1, 2].map(i => Pt(`M${x - 9 + (i % 2) * 6} ${86 + i * 18}c-12 0-12-16 0-20c2-4 2-6 2-8c0 2 0 4 2 8c12 4 12 20-4 20Z`, '#c98a3a')).join('');
    if (kind === 'sausage') g = L(`M${x - 20} 34h40`, 'k1') + [-14, 0, 14].map((dx, i) => Pt(`M${x + dx - 5} 34c-4 16-4 36 2 ${44 + i * 6}c6 2 8-2 8-8c-2-12-2-24 0-36Z`, '#9a3a2a')).join('');
    if (kind === 'herbs') g = L(`M${x} 30v30`, 'k1') + Pt(`M${x - 4} 60L${x + 4} 60L${x + 16} 120L${x - 16} 120Z`, P.greenL) + L(`M${x} 64v52M${x - 6} 80l-8 30M${x + 6} 80l8 30`, 'k1');
    if (kind === 'pan') g = L(`M${x} 30v20`, 'k1') + C(x, 72, 22, '#b86a3a') + C(x, 72, 15, 'none', 'k1') + Pt(`M${x - 3} 92h6v34h-6Z`, P.woodD);
    return `<g class="hang" style="transform-origin:${x}px 30px;animation-delay:${(x % 7) * -.4}s">${g}</g>`;
  };
  const fire = `<g class="fire">${Pt('M960 400C944 372 960 344 972 330C970 352 986 360 990 344C1004 362 1010 380 1000 400Z', '#e8873a', 'k1')}${Pt('M1000 400C992 380 1004 362 1014 352C1014 372 1030 376 1032 360C1044 378 1046 392 1038 400Z', '#e8873a', 'k1')}${Pt('M972 400C966 384 976 370 984 362C986 378 996 380 998 370C1006 384 1006 394 1002 400Z', '#f6c35a', '')}${Pt('M1008 400C1004 388 1012 378 1018 372C1020 384 1028 384 1028 378C1034 388 1034 396 1030 400Z', '#f6c35a', '')}</g>`;
  return `<defs>${glowDef('fireglow', '#ffb35a')}${glowDef('winglow', '#fff0c8')}${texDefs('kt')}<radialGradient id="ktVig" cx=".78" cy=".7" r=".9"><stop offset=".25" stop-color="#1a0c04" stop-opacity="0"/><stop offset="1" stop-color="#1a0c04" stop-opacity=".62"/></radialGradient></defs>
  <rect width="1200" height="460" fill="url(#ktStone)"/><rect width="1200" height="460" fill="#3a2414" opacity=".25"/>
  ${Pt('M0 0H1200V40H0Z', 'url(#ktWoodD)')}${Pt('M0 36H1200V48H0Z', 'url(#ktWoodH)')}
  ${[60, 320, 600, 880, 1140].map(x => Pt(`M${x - 14} 0h28v48h-28Z`, 'url(#ktWoodD)')).join('')}
  <g class="window">${Pt('M392 200V110C392 82 414 66 440 66C466 66 488 82 488 110V200Z', '#f4e2b4')}${L('M392 134H488M392 168H488M424 70V200M456 70V200', 'k1')}${Pt('M384 200h112v10H384Z', P.woodD)}<circle cx="440" cy="140" r="110" fill="url(#winglow)" opacity=".6"/></g>
  ${Pt('M30 170h300v10H30ZM30 270h300v10H30Z', P.woodD)}
  ${jar(60, 170, 40, '#8a6a4a')}${jar(96, 170, 54, P.greenD)}${jar(134, 170, 34, P.burgD)}${C(184, 154, 16, '#e0c36a')}${L('M170 150h28', 'k1')}${jar(226, 170, 46, '#6a7f8f')}${jar(266, 170, 30, '#b8894e')}${Pt('M290 170c0-20 30-20 30 0Z', '#d9a35b')}
  ${Pt('M50 270c0-26 50-26 50 0Z', '#d9a35b')}${L('M58 258l10-6M70 262l12-8', 'k1')}${jar(130, 270, 44, P.burg)}${Pt('M170 270h50v-26h-50Z', '#c9a36b')}${L('M170 256h50', 'k1')}${jar(254, 270, 36, '#8a6a4a')}${jar(296, 270, 50, P.greenD)}
  ${hang(560, 'garlic')}${hang(620, 'sausage')}${hang(700, 'onion')}${hang(760, 'herbs')}${hang(830, 'pan')}${hang(180, 'herbs')}${hang(250, 'onion')}
  ${barrel(70, 420, 1)}${barrel(150, 420, .82)}${sack(230, 420, 1.1, 'МУКА', '#d8c39a')}${sack(300, 420, .95, 'КРУПА')}
  <g>${Pt('M880 420V200C880 160 930 130 1000 130C1070 130 1120 160 1120 200V420Z', '#4a3a30')}${Pt('M910 420V230C910 200 950 180 1000 180C1050 180 1090 200 1090 230V420Z', '#1e1511')}
    <circle cx="1000" cy="380" r="120" fill="url(#fireglow)" class="fireglow"/>${L('M1000 180v80', 'k')}
    ${fire}${Pt('M940 404h120v16H940Z', '#3a2c23')}${L('M950 404l20-18M990 404l-14-18M1030 404l20-16', 'k')}
    <g transform="translate(970 262)">${cookPot()}</g>
    ${Pt('M866 130h268v24H866Z', P.woodD)}${jar(900, 130, 26, '#b86a3a')}${jar(1100, 130, 30, P.iron)}</g>
  ${Pt('M0 420H1200V460H0Z', '#4a3a30')}
  <g class="cook-pos" transform="translate(470 160)">${cook()}<g class="cook-table">${cookTable()}</g><g transform="translate(206 192)">${cookPot()}</g></g>`;
}

// ============ ЗЕМЛИ НА КАРТЕ ============
export const MAP = {
  fir: (x, y, s = 1, c = P.greenD) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="tree-sway">${Pt('M0-64L-18-28H-8L-24 0H24L8-28H18Z', c)}${Pt('M-3 0h6v8h-6Z', P.woodD, 'k1')}</g></g>`,
  tree: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="tree-sway">${Pt('M-4 0L-3-22H3L4 0Z', P.wood, 'k1')}${C(0, -34, 18, P.greenL)}${C(-12, -26, 10, P.greenL)}${C(12, -28, 11, P.greenL)}${op(C(6, -38, 8, '#fff', ''), .15)}</g></g>`,
  hill: (x, y, w, h, c) => Pt(`M${x - w / 2} ${y}C${x - w / 4} ${y - h} ${x + w / 4} ${y - h} ${x + w / 2} ${y}Z`, c, 'k1'),
  house: (x, y, s = 1, roof = P.burg) => `<g transform="translate(${x} ${y}) scale(${s})">${Pt('M8-36h6v-12h-6Z', '#7a6a5a', 'k1')}<g class="smoke"><circle cx="11" cy="-54" r="5" fill="#efe9dd"/><circle cx="15" cy="-64" r="7" fill="#efe9dd"/><circle cx="20" cy="-76" r="9" fill="#efe9dd"/></g>${Pt('M-16 0V-22H16V0Z', P.parch)}${Pt('M-20-22L0-40L20-22Z', roof)}${Pt('M-5 0v-10h10V0Z', P.woodD, 'k1')}${Pt('M6-17h6v6h-6Z', '#f2d58a', 'k1')}</g>`,
  church: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${Pt('M-14 0V-34H14V0Z', P.cream)}${Pt('M-10-34C-14-46-6-52 0-60C6-52 14-46 10-34Z', P.gold)}${L('M0-60v-10M-4-66h8', 'k1')}${Pt('M-4 0v-12h8V0Z', P.woodD, 'k1')}</g>`,
  tent: (x, y, s = 1, c = P.burg) => `<g transform="translate(${x} ${y}) scale(${s})">${Pt('M-24 0L0-40L24 0Z', c)}${Pt('M0-40L-8 0H8Z', P.cream, 'k1')}${L('M0-40v-12', 'k1')}${Pt('M0-52l12 4l-12 4Z', P.gold, 'k1')}</g>`,
  stall: (x, y, s = 1, c = P.red) => `<g transform="translate(${x} ${y}) scale(${s})">${Pt('M-22 0v-26h44V0Z', P.woodL)}${Pt('M-26-26L-20-38H20L26-26Z', c)}${L('M-14-38l-4 12M-4-38v12M6-38l2 12M16-38l4 12', 'k1')}${coin(-8, -6, 4)}${coin(6, -8, 4)}</g>`,
  mountain: (x, y, w, h, snow = true) => Pt(`M${x - w / 2} ${y}L${x - w * .08} ${y - h}L${x + w * .06} ${y - h * .9}L${x + w / 2} ${y}Z`, '#7d8a86') + (snow ? Pt(`M${x - w * .17} ${y - h * .7}L${x - w * .08} ${y - h}L${x + w * .06} ${y - h * .9}L${x + w * .14} ${y - h * .62}L${x + w * .02} ${y - h * .7}L${x - w * .06} ${y - h * .6}Z`, P.snow, 'k1') : '') + SH(`M${x + w * .06} ${y - h * .9}L${x + w / 2} ${y}L${x + w * .12} ${y}Z`, .2),
  reeds: (x, y) => L(`M${x} ${y}q-2-20 2-34M${x + 6} ${y}q2-16 0-28M${x - 6} ${y}q-4-14-8-22`, 'k1') + E(x + 2, y - 36, 2.5, 7, P.brown, 'k1'),
  rock: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${Pt('M-16 0C-18-10-10-18 0-18C12-18 18-8 16 0Z', '#8b8478')}${HL('M-8-12q6-4 12-2')}</g>`,
  castle: (x, y, s = 1, c = '#3a3540') => `<g transform="translate(${x} ${y}) scale(${s})">${Pt('M-40 0V-50H-28V-58H-20V-50H20V-58H28V-50H40V0Z', c)}${Pt('M-46-50V-86H-26V-50Z', c)}${Pt('M26-50V-96H46V-50Z', c)}${Pt('M-50-86L-36-104L-22-86Z', P.burgD)}${Pt('M22-96L36-116L50-96Z', P.burgD)}${Pt('M-8 0v-20q8-10 16 0V0Z', '#120e10', 'k1')}${C(-36, -66, 3, '#9cf07a', 'k1')}${C(36, -74, 3, '#9cf07a', 'k1')}</g>`,
  hut: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${L('M-10-26l-6 26M10-26l6 26M-16 0l-6 4M-16 0l4 4M16 0l6 4M16 0l-4 4', 'k')}${Pt('M-22-26V-52H22V-26Z', P.woodL)}${L('M-22-34h44M-22-42h44', 'k1')}${Pt('M-28-50L0-72L28-50Z', P.brown)}${Pt('M-6-36h12v-10h-12Z', '#f2d58a', 'k1')}</g>`,
  ship: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${Pt('M-30 0L30 0L22 12H-22Z', P.wood)}${L('M0 0v-40', 'k')}${Pt('M2-38L24-8H2Z', P.cream)}${Pt('M-2-34L-20-8H-2Z', P.cream)}</g>`,
  windmill: (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${Pt('M-12 0L-8-40H8L12 0Z', P.parch)}${Pt('M-10-40L0-52L10-40Z', P.burg)}<g class="mill-blades" style="transform-origin:0px -40px">${L('M0-40l-22-22M0-40l22-22M0-40l22 22M0-40l-22 22', 'k')}</g>${C(0, -40, 3, P.woodD, 'k1')}</g>`,
  bridge: (x, y, w) => Pt(`M${x} ${y}Q${x + w / 2} ${y - 24} ${x + w} ${y}L${x + w} ${y + 8}Q${x + w / 2} ${y - 14} ${x} ${y + 8}Z`, P.woodL) + L(`M${x + 8} ${y - 4}v-14M${x + w / 2} ${y - 16}v-14M${x + w - 8} ${y - 4}v-14M${x + 8} ${y - 18}Q${x + w / 2} ${y - 40} ${x + w - 8} ${y - 18}`, 'k1'),
  waves: (x0, x1, y, c = '#5d8aa0') => { let d = `M${x0} ${y}`; for (let x = x0; x < x1; x += 30) d += `q7.5-7 15 0t15 0`; return `<path class="k1" d="${d}L${x1} ${y + 30}L${x0} ${y + 30}Z" fill="${c}"/>`; },
  crow: (x, y) => `<g class="crow" transform="translate(${x} ${y})">${Pt('M-8 0q8-8 8 0q0-8 8 0q-8-3-8 2q0-5-8-2Z', P.ink, '')}</g>`
};
