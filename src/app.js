import { Facility } from './facility.js';
import { Scope, THEMES } from './display.js';
import { Tour } from './tour.js';
import { initGlossary } from './glossary.js';

const $ = id => document.getElementById(id);
const MODE_CFG = {
  replica: { capacity: 512, radix: 8, w: 16 },      // 512 branches, octal, 16 nodes deep (p. 21)
  workbench: { capacity: 6000, radix: 10, w: 26 },
  explainer: { capacity: 6000, radix: 10, w: 20 },
};

// Fig. A-4, with the statement labels the decoder reports as it runs
const LISTING = [
  [[1], ' 1:', 'GENERATE 1 ; CALL FIND (POS, J, LI(N), 2, N, 0)', 'code the next branch; pick the LI-th most likely hypothesis'],
  [[1], '', 'LT ← L + [LMBD(N) ← IDIST(POS)]', 'trial total = total so far + this branch’s metric'],
  [[2], ' 2:', 'ENTER BRANCH ; IF [LT .L. IT] 11', 'below the threshold? then search'],
  [[3], ' 3:', 'N ← N + 1', 'move forward one node'],
  [[4], ' 4:', 'IF [FLAG .NE. 0] 8', 'retracing old ground?'],
  [[5], ' 5:', 'IF [IT + IT0 .G. LT] 7', 'threshold already as tight as it can be?'],
  [[6], ' 6:', 'IT ← IT + IT0 ; GO TO 5', 'tighten the threshold'],
  [[7], ' 7:', 'L ← LT ; LI(N) ← 1 ; WAIT ; GO TO 1', 'accept the branch'],
  [[8], ' 8:', 'IF [IT + IT0 .G. L] 10', 'did this move start less than IT0 above threshold…'],
  [[9], ' 9:', 'IF [IT + IT0 .LE. LT] 7', '…or end there? then this node is new'],
  [[10], '10:', 'CLEAR FLAG ; GO TO 5', 'new ground: tightening is allowed again'],
  [[11], '11:', 'BEGIN SEARCH ; SET FLAG ; SHIFT LEFT 1', 'branch failed: undo it'],
  [[12], '12:', 'IF [N .E. 0] 18', 'at the origin?'],
  [[13], '13:', 'LB ← L − LMBD(N−1)', 'look back one node'],
  [[14], '14:', 'IF [LB .L. IT] 18', 'is the node behind below the threshold too?'],
  [[15], '15:', 'N ← N − 1 ; SHIFT LEFT 1 ; L ← LB ; WAIT', 'back up one node'],
  [[16], '16:', 'IF [LI(N) .E. 2] 12', 'was that the worst branch here? keep backing up'],
  [[17], '17:', 'LI(N) ← LI(N) + 1 ; GO TO 1', 'try the next most likely branch'],
  [[18], '18:', 'IT ← IT − IT0', 'lower the threshold'],
  [[19], '19:', 'LI(N) ← 1 ; GO TO 1', 'and search forward again, best branch first'],
];

let mode = 'explainer';
try { mode = localStorage.getItem('scd-mode') || mode; } catch (e) { /* private window */ }
if (!MODE_CFG[mode]) mode = 'explainer';

const f = new Facility(MODE_CFG[mode]);
const scope = new Scope($('scope'));
const log = $('log'), cmd = $('cmd');
let note = null;          // a caption that outranks the per-step one (e.g. after "Find a search")

function tty(line) {
  log.textContent += (log.textContent ? '\n' : '') + line;
  const lines = log.textContent.split('\n');
  if (lines.length > 300) log.textContent = lines.slice(-300).join('\n');
  log.scrollTop = log.scrollHeight;
}
f.onPrint = tty;

function submit(text) {
  tty('*' + text.toUpperCase());
  const wasN = f.dec.N;
  f.exec(text);
  note = null;
  if (Math.abs(f.dec.N - wasN) > scope.view.w || /^RES|^REP|^DDT/i.test(text.trim())) scope.resetView(f);
  if (/^RUN|^G$|^STEPS|^GO/i.test(text.trim())) scope.follow = true;
  sync();
}

function setMode(m) {
  mode = m;
  document.body.dataset.mode = m;
  try { localStorage.setItem('scd-mode', m); } catch (e) { /* ignore */ }
  document.querySelectorAll('[data-set-mode]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.setMode === m)));
  const c = MODE_CFG[m];
  f.cfg.capacity = f.store.capacity = c.capacity;
  f.cfg.radix = c.radix;
  scope.view.w = c.w;
  if (m === 'explainer') $('caption').appendChild($('math')); else $('scope').after($('math'));   // Explainer: words and arithmetic in one card
  scope.moveMode = scope.dataMode = false; scope.inspect = null; scope.hover = null;
  cmd.placeholder = m === 'replica' ? '' : 'monitor command — try HELP';
  requestAnimationFrame(() => { scope.resize(); scope.resetView(f); drawCharts(); });
  if (m === 'replica') cmd.focus();
}

// ---- side panel -----------------------------------------------------------------------------
const SPEED_LABEL = ['2 s / step', '1 s', '½ s', '¼ s', '⅛ s', '1⁄16 s', '1⁄32 s', 'fast, display off'];
function sync() {
  $('btnRun').textContent = f.running ? 'Stop' : 'Run';
  $('rngSpeed').value = f.speed; $('outSpeed').textContent = SPEED_LABEL[f.speed];
  $('chkDisplay').checked = f.mode === 1; $('chkOthers').checked = !!f.others;
  $('rngSnr').value = f.cfg.snr; $('outSnr').textContent = f.cfg.snr.toFixed(1);
  $('rngIt0').value = f.cfg.it0; $('outIt0').textContent = f.cfg.it0;
  $('selMsg').value = f.cfg.message.toUpperCase(); $('numSeed').value = f.cfg.seed;
}
$('btnRun').onclick = () => submit(f.running ? 'STOP' : 'RUN');
$('btnStep').onclick = () => submit('G');
$('btnRepeat').onclick = () => submit('REPEAT');
$('btnReset').onclick = () => submit('RESET');
$('btnExit').onclick = () => submit('EXIT');
$('rngSpeed').oninput = e => submit('SPEED=' + e.target.value);
$('chkDisplay').onchange = e => submit(e.target.checked ? 'MODE1' : 'MODE0');
$('chkOthers').onchange = e => submit('OTHERS=' + (e.target.checked ? 1 : 0));
$('rngSnr').oninput = e => { $('outSnr').textContent = (+e.target.value).toFixed(1); };
$('rngSnr').onchange = e => submit('DDT SN=' + (+e.target.value).toFixed(1));
$('rngIt0').oninput = e => { $('outIt0').textContent = e.target.value; };
$('rngIt0').onchange = e => submit('DDT IT0=' + e.target.value);
$('selMsg').onchange = e => submit('DDT MSG=' + e.target.value);
$('numSeed').onchange = e => submit('DDT SEED=' + Math.max(1, Math.floor(+e.target.value || 1)));
$('btnFind').onclick = () => {
  tty('*(FIND A SEARCH: MODE0, RUN, RESTART BEFORE IT, SPEED=2)');
  const r = f.findSearch(3);
  if (!r) { note = 'No search three nodes deep turned up in the next stretch of data — the channel is too quiet. Try a lower signal-to-noise ratio.'; sync(); return; }
  f.speed = 2;
  note = `Found a search that begins at node ${r.n0}. ` + (r.wrongTurn >= 0
    ? `Noise made a wrong branch look better at node ${r.wrongTurn}, and the decoder took it. `
    : 'The decoder never left the right path — a burst of noise simply dragged the correct path under the threshold. ')
    + `Rewound to node ${r.from} using saved restart data; now replaying it slowly. Watch the total sink toward the threshold line.`;
  tty('RESTARTED AT N = ' + r.from);
  scope.resetView(f); f.run(); sync();
};
const runFind = $('btnFind').onclick;
const tour = new Tour({
  f, scope, setMode, cmd: submit, find: runFind,
  ensureRunning(speed) { if (f.speed !== speed || f.fast) submit('SPEED=' + speed); if (f.mode === 0) submit('MODE1'); if (!f.running) submit('RUN'); },
  stepToBranch() { for (let i = 0; i < 6 && !f.tentative; i++) f.stepOnce(); scope.follow = true; },
  onEnd() { try { localStorage.setItem('scd-toured', '1'); } catch (e) { /* ignore */ } $('btnTour').classList.remove('nudge'); $('btnTour').focus(); },
});
$('btnTour').onclick = () => { hideTip(); tour.start(); };
initGlossary($('btnGlossary'));
try { if (!localStorage.getItem('scd-toured')) $('btnTour').classList.add('nudge'); } catch (e) { $('btnTour').classList.add('nudge'); }
document.querySelectorAll('[data-set-mode]').forEach(b => { b.onclick = () => setMode(b.dataset.setMode); });

cmd.addEventListener('keydown', e => {
  if (e.key === 'Enter' && cmd.value.trim()) { submit(cmd.value); cmd.value = ''; }
});
document.addEventListener('keydown', e => {
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
  if (mode === 'replica') { if (!typing && e.key.length === 1) cmd.focus(); return; }
  if (typing || tour.active || document.querySelector('dialog[open]')) return;
  if (e.key === ' ') { e.preventDefault(); submit(f.running ? 'STOP' : 'RUN'); }
  if (e.key === 'g' || e.key === 'G') submit('G');
});

const listing = $('listing');
LISTING.forEach(([pcs, label, code, gloss]) => {
  const div = document.createElement('div');
  div.dataset.pc = pcs.join(',');
  div.innerHTML = `<i>${label}</i><span>${code}</span><small>${gloss}</small>`;
  listing.appendChild(div);
});

// ---- Explainer captions ---------------------------------------------------------------------
const signed = n => (n > 0 ? '+' : '') + n;
function captionFor(ev) {
  const t = f.tentative, b = ev.boxes, ord = ['', 'most likely', 'second most likely'];
  let s = '';
  if (ev.kind === 'enter') {
    const where = t.pos <= 4 ? `number ${t.pos} on the receiver’s list of likely signals` : 'not on the receiver’s list at all';
    s = `At node ${ev.N}, try the ${ord[t.li]} branch: information bit ${t.bit}, which the coder turns into signal ${t.sym}. `
      + `That signal is ${where}, so the branch scores ${signed(t.dy)}. `
      + (t.fail ? `The total would fall to ${ev.LT}, under the threshold of ${ev.IT} — rejected.` : `The total, ${ev.LT}, stays above the threshold of ${ev.IT} — accepted.`);
  } else if (ev.kind === 'advance') {
    s = `Moved forward to node ${ev.N}. ` + (b.includes(6)
      ? `This is new ground, so the threshold is tightened to ${ev.IT}, just under the running total of ${ev.L}.`
      : ev.FLAG ? `The threshold stays at ${ev.IT}: the decoder has been through here before, and may not tighten again until it reaches a node it has never seen.`
        : `The threshold stays at ${ev.IT}.`);
  } else if (ev.kind === 'retreat') {
    s = (b[0] === 16 && b[1] === 12 ? `Both branches from node ${ev.N + 1} have now failed. ` : '')
      + `Backed up to node ${ev.N}. It sits above the threshold, so a branch not yet tried from here might still succeed.`;
  } else {
    s = `Every way forward dips under the threshold, and ${b.includes(14) ? 'the node behind is under it too' : 'there is nowhere to back up to'}. `
      + `So relax: lower the threshold by ${f.dec.IT0} to ${ev.IT}, and search forward again from node ${ev.N}, best branch first.`;
  }
  let truth = 'Truth: still on the correct path.', off = false;
  if (f.offPath >= 0) { truth = `Truth, hidden from the decoder: it left the correct path at node ${f.offPath}.`; off = true; }
  else if (t && !t.correct) { truth = 'Truth, hidden from the decoder: this branch is a wrong turn' + (t.fail ? '.' : ' — and it looks perfectly good.'); off = true; }
  return `${s}<span class="truth${off ? ' off' : ''}">${truth}</span>`;
}

let shownEvent;          // undefined, so the introduction is shown before the first step
function narrate() {
  const ev = f.lastEvent, cap = $('captionText');
  if (f.fast && f.running) { cap.innerHTML = `Running at full speed with the display off — ${f.maxN.toLocaleString()} nodes decoded. The histograms are filling in.`; shownEvent = null; return; }
  if (ev === shownEvent && !note) return;
  shownEvent = ev;
  if (note && (!ev || ev.kind !== 'lower' && !f.stats.inSearch)) { cap.innerHTML = note; }
  else if (ev) { cap.innerHTML = captionFor(ev); note = null; }
  else cap.innerHTML = 'Each line segment is one guess at one transmitted bit. A guess that fits the noisy received signal climbs; a poor fit drops steeply. '
    + 'The decoder pushes forward along the best-looking branch while the total stays above a threshold, and backs up to try the alternatives when it does not. Press <b>Run</b>, or <b>Find a search</b> to jump to the interesting part.';
  const on = new Set(ev ? ev.boxes : []), last = ev ? ev.boxes[ev.boxes.length - 1] : -1;
  for (const div of listing.children) {
    const pcs = div.dataset.pc.split(',').map(Number);
    div.classList.toggle('on', pcs.some(p => on.has(p)));
    div.classList.toggle('now', pcs.includes(last));
  }
}

// ---- the worksheet: how accept / fail is being calculated, step by step ----------------------
const ORD = ['', '1st', '2nd'], sgn = n => (n >= 0 ? '+ ' : '\u2212 ') + Math.abs(n), neg = n => String(n).replace('-', '\u2212');
let mathBranch = null, mathEvent;
function worksheet() {
  const ev = f.lastEvent, el = $('math'), d = f.dec;
  if (f.fast && f.running) { if (mathEvent !== 'fast') { mathEvent = 'fast'; el.innerHTML = '<div><b>DISPLAY OFF</b><span>running at full speed — STOP or a slower SPEED shows the arithmetic again</span></div>'; } return; }
  if (ev === mathEvent) return;
  mathEvent = ev;
  if (!ev) { mathBranch = null; el.innerHTML = '<div><b>WORKSHEET</b><span>the arithmetic behind each accept / fail decision appears here as the decoder runs</span></div>'; return; }
  const row = (k, v, cls) => `<div${cls ? ` class="${cls}"` : ''}><b>${k}</b><span>${v}</span></div>`;
  if (ev.kind === 'enter') {
    const t = f.tentative, g = d.coder.gen, l = f.channel.listLen, q = f.q[t.pos - 1];
    const formula = t.pos <= l ? `10 × [log₂(8 × ${q.toFixed(3)}) − 1]` : `10 × [log₂(8 × ${q.toFixed(3)} ÷ ${8 - l}) − 1]`;
    mathBranch = row('BRANCH', `node N = ${ev.N}: try the ${ORD[t.li]} choice, bit J = ${t.bit} → signal GEN(${t.bit}) = ${t.sym} <i>(GEN: 0 → ${g[0]}, 1 → ${g[1]})</i>`)
      + row('METRIC', `signal ${t.sym} is ${t.pos <= l ? `no. ${t.pos} on` : 'not on'} the receiver’s list → λ = IDIST(${t.pos}) = <em>${neg(t.dy)}</em> <i>≈ ${formula}, where ${q.toFixed(3)} = chance the true signal lands there</i>`)
      + row('TOTAL', `LT = L + λ = ${neg(ev.L)} ${sgn(t.dy)} = <em>${neg(ev.LT)}</em>`)
      + row('TEST', `LT ≥ IT ?  ${neg(ev.LT)} ${t.fail ? '&lt;' : '≥'} ${neg(ev.IT)} → <em>${t.fail ? 'FAIL' : 'ACCEPT'}</em>`, t.fail ? 'bad' : 'good');
    el.innerHTML = mathBranch + row('THEN', '…');
    return;
  }
  let then;
  if (ev.kind === 'advance') {
    const raised = ev.boxes.filter(b => b === 6).length * d.IT0;
    then = `N ← ${ev.N}, L ← ${neg(ev.L)}.  Threshold: ` + (raised
      ? `raise while IT + IT0 ≤ LT:  ${neg(ev.IT - raised)} → <em>${neg(ev.IT)}</em> <i>(${neg(ev.IT)} + ${d.IT0} &gt; ${neg(ev.L)}, so it stops there)</i>`
      : ev.FLAG ? `held at ${neg(ev.IT)} <i>— FLAG = 1: re-tracing old ground, no raising until a new node is reached</i>`
        : `stays ${neg(ev.IT)} <i>(${neg(ev.IT)} + ${d.IT0} &gt; ${neg(ev.L)}: no room to raise it)</i>`);
  } else if (ev.kind === 'retreat') {
    const lam = d.LMBD[ev.N & 255];
    then = `look back: LB = L − λ(N−1) = ${neg(ev.L + lam)} ${sgn(-lam)} = ${neg(ev.L)};  LB ≥ IT ?  ${neg(ev.L)} ≥ ${neg(ev.IT)} → <em>back up to node ${ev.N}</em>`
      + (d.LI[ev.N & 255] === 2 ? ' <i>— both branches here already tried: keep looking back</i>' : ' <i>— try its 2nd choice next</i>');
  } else {
    const old = ev.IT + d.IT0;
    then = (ev.boxes.includes(14) ? `look back: LB = ${neg(ev.L)} ${sgn(-d.LMBD[(ev.N - 1) & 255])} = ${neg(ev.L - d.LMBD[(ev.N - 1) & 255])} &lt; IT = ${neg(old)}, so no retreat is possible` : 'at the origin: nowhere to back up to')
      + ` → lower threshold: IT ← IT − IT0 = ${neg(old)} − ${d.IT0} = <em>${neg(ev.IT)}</em>`;
  }
  el.innerHTML = (mathBranch || '') + row('THEN', then);
}

// ---- readouts and histograms ----------------------------------------------------------------
const READOUTS = [
  ['Node depth N', () => f.dec.N, 'How far into the tree the decoder is standing: the number of information bits on its current path.'],
  ['Total metric L', () => f.dec.L, 'The running score of the current path — the sum of its branch metrics. About +10 per node on average along the right path at this noise level; sharply negative along a wrong one.'],
  ['Threshold IT', () => f.dec.IT, 'The running threshold. Always a multiple of IT0, and never more than IT0 below the score at the last new node reached.'],
  ['FLAG', () => f.dec.FLAG, 'The one bit of memory that keeps the Fano algorithm from looping. Set to 1 when a branch fails; while it is set the threshold may not be raised, because the decoder is re-tracing ground it has already covered. Cleared at the first genuinely new node.'],
  ['Computations / node', () => (f.dec.ICOUNT / Math.max(1, f.maxN)).toFixed(2), 'Branches examined per bit decoded (his ICOUNT). The attraction of sequential decoding: this average stays small and does not grow with the constraint length, as long as the rate is below R-comp. The catch is that it is only an average.'],
  ['Searches', () => f.stats.searches, 'How many times the decoder has failed to advance and had to search, counted as the thesis defines it: a search ends when the decoder first gets beyond the node where it began (p. 48).'],
  ['Search depth now', () => f.stats.searchDepth, 'How many nodes the search in progress has backed up so far. The 1965 program stopped and typed SEARCH DEPTH IS n at 25; so does this one (DDT ISDM=0 turns that off).'],
  ['Waiting line', () => f.stats.waitingLine, 'Received bauds waiting to be decoded, if the decoder runs 20 times faster than data arrives. It grows during long searches and drains afterwards.'],
  ['Bit errors', () => f.errors, 'Decoded bits that differ from the message sent, judged 200 nodes behind the front. With a constraint length of 60 this should stay at zero: the decoder eventually detects and repairs every wrong turn.'],
  ['Branches stored', () => f.store.count, 'Branches remembered for the display. The 1965 display had room for 512 (about ten screen widths), discarding the oldest first; Replica mode keeps that limit.'],
];
const readoutCells = READOUTS.map(([label, , tip]) => {
  const div = document.createElement('div'), b = document.createElement('b');
  div.dataset.tip = tip; div.append(label, b);
  $('readouts').appendChild(div);
  return b;
});
function readouts() {
  READOUTS.forEach(([, get], i) => { const v = get(); readoutCells[i].textContent = typeof v === 'number' ? v.toLocaleString() : v; });
}

function plot(cv, pts, { logx, xmax, xlabel }) {
  const dpr = window.devicePixelRatio || 1, W = 300, H = +(cv.dataset.h || (cv.dataset.h = cv.getAttribute('height')));
  if (+cv.dataset.dpr !== dpr) { cv.dataset.dpr = dpr; cv.width = W * dpr; cv.height = H * dpr; }
  const c = cv.getContext('2d'), T = THEMES[mode === 'replica' ? 'workbench' : mode];
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  const L = 34, B = 18, R = 6, Tp = 6, ymax = Math.max(10, ...pts.map(p => p[1]));
  const decades = Math.ceil(Math.log10(ymax));
  const X = x => L + (logx ? Math.log(x) / Math.log(xmax) : x / xmax) * (W - L - R);
  const Y = y => H - B - Math.log10(Math.max(1, y)) / decades * (H - B - Tp);
  c.font = '10px "IBM Plex Mono", monospace'; c.fillStyle = T.faint; c.strokeStyle = T.thr === '#ece8dc' ? '#e6e1d3' : 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
  c.textAlign = 'right'; c.textBaseline = 'middle';
  for (let k = 0; k <= decades; k++) { const y = Y(10 ** k); c.beginPath(); c.moveTo(L, y); c.lineTo(W - R, y); c.stroke(); c.fillText(k < 4 ? String(10 ** k) : '1e' + k, L - 4, y); }
  c.textAlign = 'center'; c.textBaseline = 'top';
  (logx ? [1, 2, 5, 10, 20] : [0, xmax / 4, xmax / 2, 3 * xmax / 4, xmax]).forEach(x => c.fillText(String(x), X(Math.max(x, logx ? 1 : 0)), H - B + 4));
  c.textAlign = 'right'; c.fillText(xlabel, W - R, H - B + 4);
  if (!pts.length) return;
  c.strokeStyle = T.bright; c.lineWidth = 1.6; c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))));
  c.stroke();
}
function drawCharts() {
  const tail = f.stats.depthTail(), a = [], w = [];
  for (let n = 1; n <= 30 && tail[n] > 0; n++) a.push([n, tail[n]]);
  plot($('chTail'), a, { logx: true, xmax: 30, xlabel: 'N' });
  let hi = 8; f.stats.waitHist.forEach((v, i) => { if (v && i > hi) hi = i; });
  const xmax = Math.ceil(hi / 8) * 8;
  for (let i = 0; i <= xmax; i++) if (f.stats.waitHist[i]) w.push([i, f.stats.waitHist[i]]);
  plot($('chWait'), w, { logx: false, xmax, xlabel: 'bauds waiting' });
}

// ---- tooltips: every control, readout and region of the scope explains itself --------------
const tip = document.createElement('div');
tip.id = 'tip'; tip.setAttribute('role', 'tooltip');
document.body.appendChild(tip);
let tipTimer = 0, tipKey = null;
function hideTip() { clearTimeout(tipTimer); tipKey = null; tip.classList.remove('on'); }
function showTip(key, text, x, y, below) {
  if (tour.active) return;
  if (key === tipKey) return;
  hideTip(); tipKey = key;
  tipTimer = setTimeout(() => {
    tip.textContent = text;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let ty = below ? y + 10 : y - h - 14;
    if (ty + h > innerHeight - 8) ty = y - h - 14;
    if (ty < 8) ty = Math.min(innerHeight - h - 8, y + 18);
    tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px';
    tip.style.top = Math.max(8, ty) + 'px';
    tip.classList.add('on');
  }, 380);
}
function tipFor(el) {
  const r = el.getBoundingClientRect();
  showTip(el, el.dataset.tip, r.left, r.bottom, true);
}
document.addEventListener('pointerover', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (el) tipFor(el); else if (e.target !== scope.cv) hideTip();
});
document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el && e.target.matches(':focus-visible')) tipFor(el); });
document.addEventListener('focusout', hideTip);
document.addEventListener('pointerdown', hideTip);
document.addEventListener('scroll', hideTip, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });
scope.cv.addEventListener('pointermove', e => {
  if (e.buttons || scope.hover) { hideTip(); return; }       // dragging, or the branch inspector is showing
  const r = scope.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const text = scope.regionTip(f, mode, x, y);
  showTip('scope:' + text, text, e.clientX + 14, e.clientY, false);
});
scope.cv.addEventListener('pointerleave', hideTip);

// ---- clock ----------------------------------------------------------------------------------
let last = performance.now(), lastSlow = 0, wasRunning = false;
function frame(ts) {
  const dt = Math.min(100, ts - last); last = ts;
  f.pump(dt);
  if (f.running !== wasRunning) { wasRunning = f.running; sync(); }
  scope.track(f, f.speed >= 5);
  scope.draw(f, mode);
  worksheet();
  if (mode === 'explainer') narrate();
  tour.frame();
  if (ts - lastSlow > 200 && mode !== 'replica') { lastSlow = ts; readouts(); drawCharts(); }
  requestAnimationFrame(frame);
}

scope.attach(() => f, () => mode);
window.addEventListener('resize', () => scope.resize());
setMode(mode);
sync();
tty('SEQ. DECODING SYSTEM   PDP-6 / PROJECT MAC   (RE-IMPLEMENTED)');
tty('CONSTRAINT IS 60   LIST LENGTH IS 4   BITS PER BRANCH = 1   8 ORTHOGONAL SIGNALS, WHITE GAUSSIAN NOISE');
tty('READY');
requestAnimationFrame(frame);
