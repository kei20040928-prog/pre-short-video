'use strict';
/* ショート動画 離脱UI プロトタイプ(色彩低減)
 *
 * 開いてから30秒かけて、画面全体の彩度を100%から0%(完全なモノクロ)まで、一定の速さで下げる。
 * URLパラメータ(研究者用):
 *   ?duration=30  彩度が最小になるまでの時間(秒)。既定 30
 *   ?delay=0      彩度の低下を始めるまでの時間(秒)。既定 0
 *   ?to=0         最小の彩度(1 = 通常、0 = 白黒)。既定 0
 *   ?debug=1      経過時間・彩度の表示と、+10秒/最初からのボタンを出す
 */

/* ---------------- 設定 ---------------- */
const params = new URLSearchParams(location.search);
const num = (k, d) => { const v = parseFloat(params.get(k)); return Number.isFinite(v) ? v : d; };
const CFG = {
  delay:    num('delay', 0),       // 秒
  duration: num('duration', 30),   // 秒
  to:       num('to', 0),
};

const VERSION = 'v4';
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ramp = (m, a, b, from, to) => m <= a ? from : m >= b ? to : from + (to - from) * (m - a) / (b - a);
const fmtTime = (sec) => {
  const s = Math.floor(sec);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
const fmtCount = (n) => n >= 10000 ? (n / 10000).toFixed(1) + '万' : n.toLocaleString('ja-JP');
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------------- 仮の動画(自動生成) ---------------- */
// 彩度の変化が見えやすいよう、鮮やかな配色にしている
const PALETTES = [
  ['#10162b', '#ff4d6d', '#ffb703', '#3a86ff'],
  ['#0b1f1a', '#06d6a0', '#ffd166', '#118ab2'],
  ['#1b0f2e', '#c77dff', '#ff7b00', '#4cc9f0'],
  ['#1f1408', '#ff9f1c', '#e71d36', '#2ec4b6'],
  ['#0a1a2a', '#00b4d8', '#f72585', '#90e0ef'],
  ['#1a1f0a', '#9ef01a', '#ff006e', '#ffbe0b'],
];
const USERS = ['@mika_daily', '@ren_kitchen', '@sora.moves', '@tomo_and_cat', '@haru_note', '@yui_trip'];
const DESCS = [
  '朝のルーティン、最近ずっとこれ ☀️ #おすすめ',
  '30秒でできる簡単レシピ #料理 #レシピ',
  'ひと駅ぶん歩いてみた結果… #散歩',
  'うちの猫がまた変なポーズ #猫のいる暮らし',
  '週末ひとり旅、ここが最高だった #旅行',
  '100均だけで棚をDIY #DIY',
];
const MUSICS = ['オリジナル楽曲 - sample', '夜風のビート - demo', 'Morning Light - sample'];

function makeVideo(i) {
  const r = mulberry32(i * 9973 + 17);
  const pal = PALETTES[i % PALETTES.length];
  const blobs = [1, 2, 3].map((k) => ({
    x: .2 + .6 * r(), y: .15 + .7 * r(), r: .7 + .5 * r(),
    fx: .15 + .25 * r(), fy: .12 + .2 * r(), ph: r() * 6.28, c: pal[k],
  }));
  return {
    i, pal, blobs,
    user: USERS[i % USERS.length], desc: DESCS[(i * 5) % DESCS.length], music: MUSICS[i % MUSICS.length],
    likes: Math.floor(800 + r() * 90000), comments: Math.floor(20 + r() * 5000), saves: Math.floor(100 + r() * 40000),
  };
}
const rgbCache = {};
// 色を、同じ明るさの灰色に向かって薄める(sat=1: そのまま / sat=0: 白黒)
function rgbOf(hex) {
  let c = rgbCache[hex];
  if (!c) c = rgbCache[hex] = [1, 3, 5].map((p) => parseInt(hex.slice(p, p + 2), 16));
  return c;
}
function rgba(hex, a, sat) {
  let c = rgbCache[hex];
  if (!c) c = rgbCache[hex] = [1, 3, 5].map((p) => parseInt(hex.slice(p, p + 2), 16));
  const lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const m = (x) => Math.round(clamp(lum + (x - lum) * sat, 0, 255));
  return `rgba(${m(c[0])},${m(c[1])},${m(c[2])},${a})`;
}
function drawVideo(card, t, sat) {
  const { ctx, canvas, v } = card, w = canvas.width, h = canvas.height;
  const g = ctx.createLinearGradient(0, 0, w * .6, h);
  g.addColorStop(0, rgba(v.pal[0], 1, sat)); g.addColorStop(1, '#050505');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (const b of v.blobs) {
    const cx = (b.x + .12 * Math.sin(t * b.fx + b.ph)) * w;
    const cy = (b.y + .09 * Math.cos(t * b.fy + b.ph)) * h;
    const rad = b.r * h * .62;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, rgba(b.c, 1, sat)); rg.addColorStop(.55, rgba(b.c, .7, sat)); rg.addColorStop(1, rgba(b.c, 0, sat));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  }
}

/* ---------------- カード(1本の動画) ---------------- */
const ICON = {
  heart: '<svg width="27" height="27" viewBox="0 0 24 24"><path d="M12 21.4c-.3 0-.6-.1-.8-.3C7 17.8 2 13.6 2 8.9 2 5.6 4.5 3 7.7 3c1.7 0 3.3.8 4.3 2.1C13 3.8 14.6 3 16.3 3 19.5 3 22 5.6 22 8.9c0 4.7-5 8.9-9.2 12.2-.2.2-.5.3-.8.3z"/></svg>',
  comment: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 3h16a2 2 0 012 2v11a2 2 0 01-2 2H9.5L5 21.5V18H4a2 2 0 01-2-2V5a2 2 0 012-2z"/></svg>',
  save: '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M6 2.5h12a1 1 0 011 1V22l-7-4.2L5 22V3.5a1 1 0 011-1z"/></svg>',
  share: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M21 12L13.5 4.5v4.1C7 9.4 3 13 2 19c2.8-3.6 6.3-5.3 11.5-5.3v4.3L21 12z"/></svg>',
};
const feed = $('#feed');

function mountCard(i, y) {
  const v = makeVideo(i);
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML =
    '<canvas></canvas><div class="shade"></div>' +
    '<div class="rail">' +
      '<div class="item"><div class="avatar"><span>+</span></div></div>' +
      `<div class="item"><button class="ibtn heart" aria-label="いいね">${ICON.heart}</button><div class="cnt" data-n="${v.likes}">${fmtCount(v.likes)}</div></div>` +
      `<div class="item"><button class="ibtn" data-msg="1" aria-label="コメント">${ICON.comment}</button><div class="cnt">${fmtCount(v.comments)}</div></div>` +
      `<div class="item"><button class="ibtn save" aria-label="保存">${ICON.save}</button><div class="cnt">${fmtCount(v.saves)}</div></div>` +
      `<div class="item"><button class="ibtn" data-msg="1" aria-label="共有">${ICON.share}</button><div class="cnt">共有</div></div>` +
    '</div>' +
    `<div class="meta"><div class="user">${v.user}</div><div class="desc">${v.desc}</div><div class="music">♪ ${v.music}</div></div>`;
  feed.appendChild(el);
  const canvas = el.querySelector('canvas');
  const card = { i, v, el, canvas, ctx: canvas.getContext('2d') };
  sizeCanvas(card);
  setY(card, y);
  return card;
}
function sizeCanvas(card) {
  card.canvas.width = Math.max(2, Math.round(feed.clientWidth / 2));
  card.canvas.height = Math.max(2, Math.round(feed.clientHeight / 2));
}
function setY(card, y) { card.el.style.transform = `translate3d(0,${y}px,0)`; }

// いいね・保存・フォロー(見た目だけ)
feed.addEventListener('click', (e) => {
  const heart = e.target.closest('.heart');
  if (heart) {
    heart.classList.toggle('on');
    const c = heart.parentElement.querySelector('.cnt');
    c.textContent = fmtCount(parseInt(c.dataset.n, 10) + (heart.classList.contains('on') ? 1 : 0));
    return;
  }
  const save = e.target.closest('.save');
  if (save) { save.classList.toggle('on'); return; }
  const av = e.target.closest('.avatar');
  if (av) av.classList.toggle('followed');
});

/* ---------------- スワイプ(指・マウス共通) ---------------- */
const DUR = 260;   // 切り替えアニメーション(ms)
let cur = mountCard(0, 0), nxt = null;
let idx = 0, watched = 1, animating = false, drag = null;

function height() { return feed.clientHeight; }

// dir=+1: 次の動画(上へスワイプ) / dir=-1: 前の動画(下へスワイプ)
function prepareNeighbor(dir) {
  const target = idx + dir;
  if (target < 0) return false;
  nxt = mountCard(target, dir * height());
  return true;
}
function settle(dir, commit) {
  const H = height();
  animating = true;
  const ease = `transform ${DUR}ms cubic-bezier(.22,.8,.3,1)`;
  cur.el.style.transition = nxt.el.style.transition = ease;
  if (commit) { setY(cur, -dir * H); setY(nxt, 0); }
  else        { setY(cur, 0);        setY(nxt, dir * H); }
  setTimeout(() => {
    cur.el.style.transition = nxt.el.style.transition = '';
    if (commit) {
      cur.el.remove(); cur = nxt; idx += dir;
      if (idx + 1 > watched) watched = idx + 1;
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) { /* 非対応 */ } }
    } else {
      nxt.el.remove();
    }
    nxt = null; animating = false;
  }, DUR + 20);
}
function go(dir) {          // ボタン・キー・ホイール用
  if (animating || drag) return;
  if (!prepareNeighbor(dir)) return;
  void nxt.el.offsetWidth;  // 初期位置を確定させてからアニメーション
  settle(dir, true);
}

feed.addEventListener('pointerdown', (e) => {
  if (animating || (e.pointerType === 'mouse' && e.button !== 0)) return;
  drag = { id: e.pointerId, y0: e.clientY, dy: 0, dir: 0, started: false, samples: [{ t: performance.now(), y: e.clientY }] };
});
feed.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.dy = e.clientY - drag.y0;
  const now = performance.now();
  drag.samples.push({ t: now, y: e.clientY });
  if (drag.samples.length > 6) drag.samples.shift();

  if (!drag.started) {
    if (Math.abs(drag.dy) < 8) return;                 // 小さな動きはタップとして扱う
    drag.dir = drag.dy < 0 ? 1 : -1;
    if (!prepareNeighbor(drag.dir)) { drag = null; return; }   // 先頭で下スワイプは無効
    drag.started = true;
    try { feed.setPointerCapture(e.pointerId); } catch (_) { /* 非対応 */ }
  }
  const H = height();
  // 進んだ量(0〜H)。指を戻した場合は0で止める
  const p = clamp((drag.dir === 1 ? -drag.dy : drag.dy), 0, H);
  setY(cur, -drag.dir * p);
  setY(nxt, drag.dir * (H - p));
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (!d.started) return;
  const H = height();
  const p = clamp((d.dir === 1 ? -d.dy : d.dy), 0, H);
  const s0 = d.samples[0], s1 = d.samples[d.samples.length - 1];
  const v = (s1.t > s0.t) ? ((s1.y - s0.y) / (s1.t - s0.t)) * -d.dir : 0;   // 進む向きの速さ(px/ms)
  settle(d.dir, p > H * 0.2 || v > 0.5);
}
feed.addEventListener('pointerup', endDrag);
feed.addEventListener('pointercancel', endDrag);

// PCでの確認用:矢印キー・ホイール
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') go(1);
  if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') go(-1);
});
let wheelLock = 0;
feed.addEventListener('wheel', (e) => {
  e.preventDefault();
  const now = performance.now();
  if (now < wheelLock || Math.abs(e.deltaY) < 20) return;
  wheelLock = now + 500;
  go(e.deltaY > 0 ? 1 : -1);
}, { passive: false });

/* ---------------- 色彩低減 ---------------- */
let elapsed = 0;                      // 開いてからの経過時間(秒)
const saturationAt = (sec) => ramp(sec, CFG.delay, CFG.delay + CFG.duration, 1, CFG.to);

/* ---------------- 画面全体(アイコン・ボタンを含む)の彩度 ---------------- */
// 動画だけでなく、アイコンやボタンの色も同じ割合で薄める
const app = $('#app');
const UI_COLORS = { '--av1': '#e8c9a0', '--av2': '#c99a6a', '--badge': '#fe2c55', '--heart': '#fe2c55', '--save': '#ffc928' };
function desatHex(hex, sat) {
  const c = rgbOf(hex), lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const m = (x) => Math.round(clamp(lum + (x - lum) * sat, 0, 255));
  return `rgb(${m(c[0])},${m(c[1])},${m(c[2])})`;
}
let lastUiSat = -1;
function applyUiSaturation(sat) {
  if (Math.abs(sat - lastUiSat) < 0.004) return;
  lastUiSat = sat;
  for (const k in UI_COLORS) app.style.setProperty(k, desatHex(UI_COLORS[k], sat));
}

/* ---------------- 研究者用の表示 ---------------- */
const hud = $('#hud');
if (params.get('debug') === '1') hud.hidden = false;
$('#bSkip').addEventListener('click', () => { elapsed += 10; });
$('#bReset').addEventListener('click', () => { elapsed = 0; watched = 1; });

/* ---------------- メインループ ---------------- */
let last = performance.now(), vclock = 0, hudT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  elapsed += dt;
  vclock += dt;

  const sat = saturationAt(elapsed);
  for (const c of [cur, nxt]) if (c) drawVideo(c, vclock + c.i * 3.1, sat);

  applyUiSaturation(sat);

  hudT += dt;
  if (!hud.hidden && hudT > 0.25) {
    hudT = 0;
    $('#hTime').textContent = fmtTime(elapsed);
    $('#hSat').textContent = Math.round(sat * 100) + '%';
    $('#hVids').textContent = watched + '本';
    $('#hVer').textContent = VERSION;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => { for (const c of [cur, nxt]) if (c) sizeCanvas(c); });

/* 画面を消さない(対応端末のみ) */
let wake = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } }
  catch (_) { /* 非対応・拒否 */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
keepAwake();

// 拡大(ピンチ)・長押しメニューを無効化
['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault()));
document.addEventListener('contextmenu', (e) => e.preventDefault());

// 動作確認用(コンソールから状態を読む・時間を進める)
window.__proto = {
  state: () => ({ idx, watched, elapsed: +elapsed.toFixed(2), cards: feed.querySelectorAll('.card').length }),
  setTime: (sec) => { elapsed = sec; },
};
