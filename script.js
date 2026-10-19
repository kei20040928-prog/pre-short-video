'use strict';
/* ショート動画 離脱UI プロトタイプ(11案を自由にON/OFFできる版)
 *
 * 【案を追加・変更するとき】 「3. 案の定義」の IDEAS を編集する。
 *   - 画面が変わる案 … frame(t, fx) の中で fx の値を変える(t は経過秒)
 *   - 問いかけの案   … times(秒)と run(ダイアログを出す関数)を書く
 *
 * URLパラメータ
 *   ?on=A07,A10   最初からONにする案(カンマ区切り)
 *   ?panel=0      設定ボタンを隠す(参加者用)
 *   ?debug=1      確認表示を出す
 *   ?max=30       画面が変わる案が最大になるまでの秒数(既定 30)
 */

/* ============ 1. 設定(ここを書き換える) ============ */
const params = new URLSearchParams(location.search);
const MAX_SEC = parseFloat(params.get('max')) || 30;   // 画面が変わる案は、この秒数で変化が最大になる
const FLIP_EVERY = 10;                 // A16: 画面を反転/元に戻す間隔(秒)
const PAST_TIMES = [10, 20, 30];       // A18: 「過去の自分からのメッセージ」を出す時刻(秒)
const WHY_TIMES = [5, 15, 25];         // A19: 「なぜ続けるか」を出す時刻(秒)
const DIST_M_PER_SWIPE = 14;           // A01: 1回のスワイプで進む距離(m)。実際は約14cm、デモ用に100倍
const SPEED_MIN = 0.5;                 // A10: 最大のときの再生速度
const HEAVY_MAX = 2;                   // A15: 最大のときの重さ(2 = 3倍の距離が必要)

/* ============ 2. 共通の道具 ============ */
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = (sec) => { const s = Math.floor(sec); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const fmtCount = (n) => n >= 10000 ? (n / 10000).toFixed(1) + '万' : n.toLocaleString('ja-JP');
const prog = (t) => clamp(t / MAX_SEC, 0, 1);   // 0 → 1(MAX_SEC秒で1)

/* ============ 3. 案の定義 ============ */
// fx = 今の画面の状態。毎フレーム初期値に戻してから、ONの案の frame() が書き換える。
const newFx = () => ({ sat: 1, speed: 1, heavy: 0, social: 1, flip: false, randP: 0, clock: false, dist: false });
const CATS = ['①現状把握', '②情報低減', '③UI複雑化', '④判断機会'];

const IDEAS = [
  { id: 'A01', cat: 0, name: 'スクロール距離の単位換算',     frame: (t, fx) => { fx.dist = true; } },
  { id: 'A02', cat: 0, name: '視聴時間の常時表示',           frame: (t, fx) => { fx.clock = true; } },
  { id: 'A07', cat: 1, name: '彩度低下',                     frame: (t, fx) => { fx.sat = 1 - prog(t); } },
  { id: 'A10', cat: 1, name: '再生速度低下',                 frame: (t, fx) => { fx.speed = 1 - (1 - SPEED_MIN) * prog(t); } },
  { id: 'A11', cat: 1, name: 'いいね・コメント・共有の非表示', frame: (t, fx) => { fx.social = 1 - prog(t); } },
  { id: 'A12', cat: 2, name: 'スワイプ方向のランダム化',     frame: (t, fx) => { fx.randP = prog(t); } },
  { id: 'A15', cat: 2, name: 'スワイプを重くする',           frame: (t, fx) => { fx.heavy = HEAVY_MAX * prog(t); } },
  { id: 'A16', cat: 2, name: '一定時間ごとの画面反転',       frame: (t, fx) => { fx.flip = Math.floor(t / FLIP_EVERY) % 2 === 1; } },
  { id: 'A18', cat: 3, name: '過去の自分からのメッセージ',   times: PAST_TIMES, run: () => askPast() },   // 開始前の入力は askMessage()
  { id: 'A19', cat: 3, name: 'なぜ続けるかを選択',           times: WHY_TIMES,  run: () => askWhy() },
  { id: 'A21', cat: 3, name: 'あと何本で満足するかを入力' },   // 開始直後に askPredict()
];

/* ============ 4. 状態 ============ */
const on = new Set((params.get('on') || '').split(',').filter((id) => IDEAS.some((i) => i.id === id)));
let fx = newFx();
let elapsed = 0, running = false, dlgOpen = false, panelOpen = false;
let idx = 0, watched = 1, swipes = 0, req = null;          // req: 今スワイプすべき方向(A12)。null なら通常
let message = '', predictTarget = null, reasons = [];
const fired = new Set(), queue = [];

/* ============ 5. 仮の動画(自動生成) ============ */
const PALETTES = [
  ['#10162b', '#ff4d6d', '#ffb703', '#3a86ff'], ['#0b1f1a', '#06d6a0', '#ffd166', '#118ab2'],
  ['#1b0f2e', '#c77dff', '#ff7b00', '#4cc9f0'], ['#1f1408', '#ff9f1c', '#e71d36', '#2ec4b6'],
  ['#0a1a2a', '#00b4d8', '#f72585', '#90e0ef'], ['#1a1f0a', '#9ef01a', '#ff006e', '#ffbe0b'],
];
const USERS = ['@mika_daily', '@ren_kitchen', '@sora.moves', '@tomo_and_cat', '@haru_note', '@yui_trip'];
const DESCS = ['朝のルーティン、最近ずっとこれ ☀️ #おすすめ', '30秒でできる簡単レシピ #料理 #レシピ', 'ひと駅ぶん歩いてみた結果… #散歩',
  'うちの猫がまた変なポーズ #猫のいる暮らし', '週末ひとり旅、ここが最高だった #旅行', '100均だけで棚をDIY #DIY'];
const MUSICS = ['オリジナル楽曲 - sample', '夜風のビート - demo', 'Morning Light - sample'];
function rand32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function makeVideo(i) {
  const r = rand32(i * 9973 + 17), pal = PALETTES[i % PALETTES.length];
  return {
    i, pal, user: USERS[i % USERS.length], desc: DESCS[(i * 5) % DESCS.length], music: MUSICS[i % MUSICS.length],
    blobs: [1, 2, 3].map((k) => ({ x: .2 + .6 * r(), y: .15 + .7 * r(), r: .7 + .5 * r(), fx: .15 + .25 * r(), fy: .12 + .2 * r(), ph: r() * 6.28, c: pal[k] })),
    likes: Math.floor(800 + r() * 90000), comments: Math.floor(20 + r() * 5000), saves: Math.floor(100 + r() * 40000),
  };
}
// 色を、同じ明るさの灰色に向かって薄める(sat=1: そのまま / 0: 白黒)
const rgbOf = (hex) => [1, 3, 5].map((p) => parseInt(hex.slice(p, p + 2), 16));
function desat(hex, sat, alpha) {
  const c = rgbOf(hex), lum = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const m = (x) => Math.round(clamp(lum + (x - lum) * sat, 0, 255));
  return `rgba(${m(c[0])},${m(c[1])},${m(c[2])},${alpha})`;
}
function drawVideo(card, t) {
  const { ctx, canvas, v } = card, w = canvas.width, h = canvas.height, s = fx.sat;
  const g = ctx.createLinearGradient(0, 0, w * .6, h);
  g.addColorStop(0, desat(v.pal[0], s, 1)); g.addColorStop(1, '#050505');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (const b of v.blobs) {
    const cx = (b.x + .12 * Math.sin(t * b.fx + b.ph)) * w, cy = (b.y + .09 * Math.cos(t * b.fy + b.ph)) * h;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r * h * .62);
    rg.addColorStop(0, desat(b.c, s, 1)); rg.addColorStop(.55, desat(b.c, s, .7)); rg.addColorStop(1, desat(b.c, s, 0));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  }
}

/* ============ 6. フィード(動画の表示とスワイプ) ============ */
const feed = $('#feed'), screen = $('#screen');
const ICON = {
  heart: '<svg width="27" height="27" viewBox="0 0 24 24"><path d="M12 21.4c-.3 0-.6-.1-.8-.3C7 17.8 2 13.6 2 8.9 2 5.6 4.5 3 7.7 3c1.7 0 3.3.8 4.3 2.1C13 3.8 14.6 3 16.3 3 19.5 3 22 5.6 22 8.9c0 4.7-5 8.9-9.2 12.2-.2.2-.5.3-.8.3z"/></svg>',
  comment: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 3h16a2 2 0 012 2v11a2 2 0 01-2 2H9.5L5 21.5V18H4a2 2 0 01-2-2V5a2 2 0 012-2z"/></svg>',
  save: '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M6 2.5h12a1 1 0 011 1V22l-7-4.2L5 22V3.5a1 1 0 011-1z"/></svg>',
  share: '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M21 12L13.5 4.5v4.1C7 9.4 3 13 2 19c2.8-3.6 6.3-5.3 11.5-5.3v4.3L21 12z"/></svg>',
};
function mountCard(i, x, y) {
  const v = makeVideo(i), el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = '<canvas></canvas><div class="shade"></div><div class="rail">' +
    '<div class="item"><div class="avatar"><span>+</span></div></div>' +
    `<div class="item social"><button class="ibtn heart">${ICON.heart}</button><div class="cnt" data-n="${v.likes}">${fmtCount(v.likes)}</div></div>` +
    `<div class="item social"><button class="ibtn">${ICON.comment}</button><div class="cnt">${fmtCount(v.comments)}</div></div>` +
    `<div class="item"><button class="ibtn save">${ICON.save}</button><div class="cnt">${fmtCount(v.saves)}</div></div>` +
    `<div class="item social"><button class="ibtn">${ICON.share}</button><div class="cnt">共有</div></div></div>` +
    `<div class="meta"><div class="user">${v.user}</div><div class="desc">${v.desc}</div><div class="music">♪ ${v.music}</div></div>`;
  feed.appendChild(el);
  const canvas = el.querySelector('canvas');
  const card = { i, v, el, canvas, ctx: canvas.getContext('2d') };
  sizeCanvas(card); place(card, x, y);
  return card;
}
const sizeCanvas = (c) => { c.canvas.width = Math.max(2, Math.round(feed.clientWidth / 2)); c.canvas.height = Math.max(2, Math.round(feed.clientHeight / 2)); };
const place = (c, x, y) => { c.el.style.transform = `translate3d(${x}px,${y}px,0)`; };

feed.addEventListener('click', (e) => {   // いいね・保存・フォロー(見た目だけ)
  const heart = e.target.closest('.heart'), save = e.target.closest('.save'), av = e.target.closest('.avatar');
  if (heart) { heart.classList.toggle('on'); const c = heart.parentElement.querySelector('.cnt'); c.textContent = fmtCount(+c.dataset.n + (heart.classList.contains('on') ? 1 : 0)); }
  if (save) save.classList.toggle('on');
  if (av) av.classList.toggle('followed');
});

/* --- スワイプ(指・マウス共通)。方向は d = [x, y] --- */
const UP = [0, -1], DOWN = [0, 1], LEFT = [-1, 0], RIGHT = [1, 0], DIRS = [UP, RIGHT, DOWN, LEFT];
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const DUR = 260;                                  // 切り替えアニメーション(ms)
let cur = null, nxt = null, drag = null, animating = false;

// その向きにスワイプしたとき、次に出す動画の番号(出せないとき null)
function targetFor(d) {
  if (req) return same(d, req) ? idx + 1 : null;           // A12: 矢印の向きだけ有効
  if (same(d, UP)) return idx + 1;
  if (same(d, DOWN)) return idx > 0 ? idx - 1 : null;     // 前の動画へ
  return null;
}
const sizeAlong = (d) => d[0] ? feed.clientWidth : feed.clientHeight;
function settle(d, commit, target) {
  const size = sizeAlong(d);
  animating = true;
  cur.el.style.transition = nxt.el.style.transition = `transform ${DUR}ms cubic-bezier(.22,.8,.3,1)`;
  if (commit) { place(cur, d[0] * size, d[1] * size); place(nxt, 0, 0); }
  else { place(cur, 0, 0); place(nxt, -d[0] * size, -d[1] * size); }
  setTimeout(() => {
    cur.el.style.transition = nxt.el.style.transition = '';
    if (commit) { cur.el.remove(); cur = nxt; arrive(target); if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) { /* 非対応 */ } }
    else nxt.el.remove();
    nxt = null; animating = false;
  }, DUR + 20);
}
function arrive(target) {                        // 新しい動画が表示されたとき
  idx = target; swipes++;
  if (idx + 1 > watched) { watched = idx + 1; checkPredict(); }
  req = Math.random() < fx.randP ? DIRS[Math.floor(Math.random() * 4)] : null;   // A12
}
function go(d) {                                 // キー操作・テスト用
  if (!running || animating || drag || dlgOpen || panelOpen) return;
  const target = targetFor(d);
  if (target === null) { if (req) wrongDir(); return; }
  nxt = mountCard(target, -d[0] * sizeAlong(d), -d[1] * sizeAlong(d));
  void nxt.el.offsetWidth;
  settle(d, true, target);
}
function wrongDir() {
  toast('矢印の方向にスワイプしてください');
  const c = $('#cue'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
}

feed.addEventListener('pointerdown', (e) => {
  if (!running || animating || dlgOpen || panelOpen || (e.pointerType === 'mouse' && e.button !== 0)) return;
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, d: null, proj: 0, samples: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
});
feed.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const f = fx.flip ? -1 : 1;                              // 画面が反転しているときは向きも反転
  const dx = f * (e.clientX - drag.x0), dy = f * (e.clientY - drag.y0);
  drag.samples.push({ t: performance.now(), x: e.clientX, y: e.clientY }); if (drag.samples.length > 6) drag.samples.shift();
  if (!drag.d) {
    if (Math.hypot(dx, dy) < 8) return;                    // 小さな動きはタップ
    const d = Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? UP : DOWN) : (dx < 0 ? LEFT : RIGHT);
    const target = targetFor(d);
    if (target === null) { if (req) wrongDir(); drag = null; return; }
    drag.d = d; drag.target = target;
    nxt = mountCard(target, -d[0] * sizeAlong(d), -d[1] * sizeAlong(d));
    try { feed.setPointerCapture(e.pointerId); } catch (_) { /* 非対応 */ }
  }
  const d = drag.d, size = sizeAlong(d);
  drag.proj = dx * d[0] + dy * d[1];
  const p = clamp(drag.proj / (1 + fx.heavy), 0, size);    // A15: 重いと、指の動きに対して画面が少ししか動かない
  place(cur, d[0] * p, d[1] * p); place(nxt, d[0] * (p - size), d[1] * (p - size));
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const dr = drag; drag = null;
  if (!dr.d) return;
  const size = sizeAlong(dr.d), p = clamp(dr.proj / (1 + fx.heavy), 0, size);
  const a = dr.samples[0], b = dr.samples[dr.samples.length - 1], f = fx.flip ? -1 : 1;
  const v = b.t > a.t ? f * ((b.x - a.x) * dr.d[0] + (b.y - a.y) * dr.d[1]) / (b.t - a.t) : 0;   // 進む向きの速さ(px/ms)
  settle(dr.d, p > size * 0.2 || (v > 0.5 && fx.heavy < 0.6), dr.target);
}
feed.addEventListener('pointerup', endDrag);
feed.addEventListener('pointercancel', endDrag);
window.addEventListener('keydown', (e) => { const k = { ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT }[e.key]; if (k) go(k); });

/* ============ 7. ダイアログ(A18 A19 A21)と終了 ============ */
const dlg = $('#dlg');
function showDialog(html, bind) {                // html を表示し、bind(q) でボタンの動作を設定
  dlg.innerHTML = `<div class="card-d">${html}</div>`;
  dlg.hidden = false; dlgOpen = true;
  const q = (s) => dlg.querySelector(s);
  bind(q);
  dlg.querySelectorAll('input,textarea').forEach((el) => {   // キーボードが出たら上に寄せる
    el.addEventListener('focus', () => dlg.classList.add('kb'));
    el.addEventListener('blur', () => dlg.classList.remove('kb'));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && el.tagName === 'TEXTAREA') { e.preventDefault(); el.blur(); } });
  });
}
function closeDialog() { dlg.hidden = true; dlg.classList.remove('kb'); dlg.innerHTML = ''; dlgOpen = false; }

function askMessage() {                          // A18: 見はじめる前に、キーボードで入力
  showDialog(`<div class="t">見はじめる前に</div><div class="s">あとで見る自分へのメッセージを、キーボードで入力してください</div>
    <textarea id="msg" maxlength="60" rows="2" placeholder="例:20分で終わらせて、レポートをやる" enterkeyhint="done" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
    <div class="hint">入力すると「見はじめる」が押せます</div><button class="dbtn primary" id="ok" disabled>見はじめる</button>`, (q) => {
    q('#msg').addEventListener('input', () => { q('#ok').disabled = !q('#msg').value.trim(); });
    q('#ok').addEventListener('click', () => { message = q('#msg').value.trim(); closeDialog(); begin(); });
  });
}
function askPast() {                             // A18: 途中で、過去の自分からのメッセージ
  showDialog(`<div class="t">過去の自分からのメッセージ</div><div class="s">(見はじめる前の自分より)</div>
    <div class="quote">「${esc(message || '(未入力)')}」</div>
    <button class="dbtn" id="keep">続けて見る</button><button class="dbtn primary" id="stop">ここでやめる</button>`, (q) => {
    q('#keep').addEventListener('click', closeDialog);
    q('#stop').addEventListener('click', () => { closeDialog(); finish('過去の自分からのメッセージを見て'); });
  });
}
function askWhy() {                              // A19: なぜ続けるか
  showDialog(`<div class="t">なぜ視聴を続けていますか?</div>
    ${['暇つぶし', '情報収集', '気分転換', 'なんとなく'].map((x) => `<button class="dbtn" data-r="${x}">${x}</button>`).join('')}
    <button class="dlink" id="quit">やめる</button>`, (q) => {
    dlg.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
      reasons.push(b.dataset.r); closeDialog();
      if (b.dataset.r === 'なんとなく') queue.unshift(askVague);
    }));
    q('#quit').addEventListener('click', () => { closeDialog(); finish('理由の選択をきっかけに'); });
  });
}
function askVague() {
  showDialog(`<div class="t">なんとなく、続けているようです</div><div class="s">ここで一度、やめてみますか?</div>
    <button class="dbtn primary" id="stop">やめる</button><button class="dbtn" id="keep">もう少し見る</button>`, (q) => {
    q('#stop').addEventListener('click', () => { closeDialog(); finish('「なんとなく」への問いかけをきっかけに'); });
    q('#keep').addEventListener('click', closeDialog);
  });
}
function askPredict(again) {                     // A21: あと何本で満足するか
  showDialog(`<div class="t">あと何本見たら<br>満足しそうですか?</div><div class="s">${again ? 'もう少し見る場合の、目安を入力してください' : 'いまの気持ちで、おおよそでOKです'}</div>
    <div class="chips">${[3, 5, 10, 20].map((n) => `<button class="chip" data-n="${n}">${n}本</button>`).join('')}</div>
    <input id="n" type="number" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" min="1" max="99" placeholder="例:3"> 本
    <button class="dbtn primary" id="ok" disabled>決定する</button>`, (q) => {
    const upd = () => { const v = parseInt(q('#n').value, 10); q('#ok').disabled = !(v >= 1 && v <= 99); dlg.querySelectorAll('.chip').forEach((c) => c.classList.toggle('sel', String(v) === c.dataset.n)); };
    dlg.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { q('#n').value = c.dataset.n; upd(); }));
    q('#n').addEventListener('input', upd);
    q('#ok').addEventListener('click', () => { predictTarget = watched + parseInt(q('#n').value, 10); closeDialog(); });
  });
}
function checkPredict() {
  if (!on.has('A21') || predictTarget === null || watched < predictTarget) return;
  predictTarget = null;
  queue.push(() => showDialog(`<div class="t">予想していた本数に<br>達しました</div><div class="s">満足できましたか?</div>
    <button class="dbtn primary" id="stop">満足した(やめる)</button><button class="dbtn" id="more">まだ見たい</button>`, (q) => {
    q('#stop').addEventListener('click', () => { closeDialog(); finish('予想した本数に達して'); });
    q('#more').addEventListener('click', () => { closeDialog(); askPredict(true); });
  }));
}
function finish(by) {                            // 終了画面
  running = false; req = null;
  const end = $('#end');
  end.innerHTML = `<div class="wrap"><div class="bye">お疲れ様でした</div><div class="box"><dl>
    <dt>視聴時間</dt><dd>${fmtTime(elapsed)}</dd><dt>視聴本数</dt><dd>${watched}本</dd>
    <dt>続けた理由</dt><dd>${esc(reasons.join('、') || '(なし)')}</dd><dt>やめたきっかけ</dt><dd>${esc(by)}</dd></dl>
    <button class="dbtn primary" id="again">もう一度試す</button></div></div>`;
  end.hidden = false;
  $('#again').addEventListener('click', restart);
}

/* ============ 8. 開始・リセット ============ */
function restart() {
  elapsed = 0; running = false; idx = 0; watched = 1; swipes = 0; req = null; predictTarget = null; reasons = []; message = '';
  fired.clear(); queue.length = 0; drag = null; animating = false;
  feed.innerHTML = ''; cur = mountCard(0, 0, 0); nxt = null;
  closeDialog(); $('#end').hidden = true;
  if (on.has('A18')) askMessage(); else begin();
}
function begin() {
  running = true;
  if (on.has('A21')) queue.push(() => askPredict(false));
  toast('上にスワイプで次の動画');
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1600); }

/* ============ 9. 設定パネル(案のON/OFF) ============ */
function buildPanel() {
  $('#list').innerHTML = CATS.map((name, c) => `<h3>${name}</h3>` + IDEAS.filter((i) => i.cat === c).map((i) =>
    `<label><input type="checkbox" data-id="${i.id}" ${on.has(i.id) ? 'checked' : ''}><span class="id">${i.id}</span>${i.name}</label>`).join('')).join('');
  $('#list').querySelectorAll('input').forEach((cb) => cb.addEventListener('change', () => { cb.checked ? on.add(cb.dataset.id) : on.delete(cb.dataset.id); changed(); }));
}
function changed() {                             // ONの組み合わせが変わったら、URLに残して最初から
  const p = new URLSearchParams(location.search);
  on.size ? p.set('on', [...on].join(',')) : p.delete('on');
  try { history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '')); } catch (_) { /* file:// など */ }
  restart();
}
const setPanel = (open) => { panelOpen = open; $('#panel').classList.toggle('open', open); };
$('#gear').addEventListener('click', () => setPanel(true));
$('#bClose').addEventListener('click', () => setPanel(false));
$('#bRestart').addEventListener('click', () => { setPanel(false); restart(); });
$('#bAll').addEventListener('click', () => { IDEAS.forEach((i) => on.add(i.id)); buildPanel(); changed(); });
$('#bNone').addEventListener('click', () => { on.clear(); buildPanel(); changed(); });
$('#bCopy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); toast('リンクをコピーしました'); } catch (_) { prompt('このリンクをコピーしてください', location.href); }
});
if (params.get('panel') === '0') document.body.classList.add('nogear');

/* ============ 10. メインループ ============ */
const app = $('#app'), hud = $('#hud'), clock = $('#clock'), distEl = $('#dist'), cue = $('#cue');
if (params.get('debug') === '1') hud.hidden = false;
const LADDER = [['人の身長', 1.7, '人分'], ['キリン', 5.5, '頭分'], ['10階建てのビル', 35, '棟分'], ['東京タワー', 333, '本分'], ['富士山', 3776, '個分']];
function distLabel(m) { let p = LADDER[0]; for (const L of LADDER) if (m >= L[1]) p = L; const v = m / p[1]; return `${p[0]} ${v < 10 ? v.toFixed(1) : Math.round(v)}${p[2]}`; }
const UI_COLORS = { '--av1': '#e8c9a0', '--av2': '#c99a6a', '--badge': '#fe2c55', '--heart': '#fe2c55', '--save': '#ffc928' };

function applyFx() {                              // fx を画面に反映する
  screen.classList.toggle('flip', fx.flip);
  screen.style.setProperty('--social', fx.social.toFixed(3));
  clock.hidden = !fx.clock; clock.textContent = '視聴時間 ' + fmtTime(elapsed);
  distEl.hidden = !fx.dist; distEl.textContent = 'スクロール距離 ' + (swipes ? distLabel(swipes * DIST_M_PER_SWIPE) : '-');
  for (const k in UI_COLORS) app.style.setProperty(k, desat(UI_COLORS[k], fx.sat, 1));   // アイコンやボタンの色も薄める
  cue.hidden = !(running && req);
  if (req) $('#cue svg').style.transform = `rotate(${DIRS.findIndex((d) => same(d, req)) * 90}deg)`;
}
let last = performance.now(), vclock = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (running && !dlgOpen && !panelOpen) elapsed += dt;
  vclock += dt * fx.speed;

  fx = newFx();                                                   // ① 初期値に戻す
  for (const i of IDEAS) if (on.has(i.id) && i.frame) i.frame(elapsed, fx);   // ② ONの案が書き換える
  for (const i of IDEAS) if (on.has(i.id) && i.times) {          // ③ 時刻になった問いかけを予約する
    for (const t of i.times) if (elapsed >= t && !fired.has(i.id + t)) { fired.add(i.id + t); queue.push(i.run); }
  }
  if (running && !dlgOpen && !drag && !animating && queue.length) queue.shift()();   // ④ 問いかけを1つずつ出す

  applyFx();
  for (const c of [cur, nxt]) if (c) drawVideo(c, vclock + c.i * 3.1);
  if (!hud.hidden) hud.textContent = `経過 ${fmtTime(elapsed)}  本数 ${watched}\n彩度 ${Math.round(fx.sat * 100)}%  速度 ${fx.speed.toFixed(2)}x\n重さ ×${(1 + fx.heavy).toFixed(1)}  方向ランダム ${Math.round(fx.randP * 100)}%\nON: ${[...on].join(',') || 'なし'}`;
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => { for (const c of [cur, nxt]) if (c) sizeCanvas(c); });
['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault()));   // ピンチ拡大を無効化
document.addEventListener('contextmenu', (e) => { if (!e.target.closest('textarea,input')) e.preventDefault(); });

let wake = null;                                                  // 画面を消さない(対応端末のみ)
async function keepAwake() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (_) { /* 非対応 */ } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

buildPanel(); restart(); keepAwake(); requestAnimationFrame(frame);

// 動作確認用(コンソールから状態を読む・時間を進める)
window.__proto = { state: () => ({ elapsed: +elapsed.toFixed(2), idx, watched, running, req: req && req.join(), fx }), setTime: (s) => { elapsed = s; }, go, on, restart, DIRS: { UP, DOWN, LEFT, RIGHT } };
