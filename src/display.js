// The output display (Sec. III-B): x is depth in the tree, y the total metric, and each branch
// a line segment whose slope is proportional to its metric increment (SCALE 32: an increment
// of 32 is drawn at 45 degrees). The path being searched is brighter than everything else.

export const THEMES = {
  replica: {
    bg: '#020805', fade: 'rgba(2,8,5,0.45)', bright: '#c9ffdc', dim: 'rgba(80,255,150,0.38)', pin: 'rgba(150,255,190,0.8)',
    thr: 'rgba(80,255,150,0.13)', thrHi: 'rgba(120,255,170,0.6)', text: 'rgba(140,255,180,0.85)', faint: 'rgba(80,255,150,0.4)',
    fail: '#c9ffdc', wrong: null, glow: 'rgba(80,255,150,0.9)', font: '13px "IBM Plex Mono", ui-monospace, Menlo, monospace',
  },
  workbench: {
    bg: '#0d1117', fade: null, bright: '#ffd166', dim: '#3e5878', pin: '#8fb8e8',
    thr: 'rgba(255,255,255,0.06)', thrHi: '#e85d75', text: '#c9d1d9', faint: '#5c6b7e',
    fail: '#e85d75', wrong: null, glow: null, font: '12px "IBM Plex Mono", ui-monospace, Menlo, monospace',
  },
  explainer: {
    bg: '#fdfcf8', fade: null, bright: '#1d4ed8', dim: '#a9b4c6', pin: '#5b7fd6',
    thr: '#ece8dc', thrHi: '#2b8a3e', text: '#33312c', faint: '#9a958a',
    fail: '#d9480f', wrong: '#e8590c', glow: null, font: '12px "IBM Plex Mono", ui-monospace, Menlo, monospace',
  },
};

const TOP = 46, BOTTOM = 30;
const STAR = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export class Scope {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.view = { x0: -1.5, yc: 40, w: 16 };
    this.follow = true;
    this.pin = null;          // branch whose path back is intensified (light pen on a node)
    this.inspect = null;      // depth whose ordered list is shown instead of the current one
    this.hover = null; this.mouse = null;
    this.dataMode = false; this.moveMode = false; this.drift = null;
    this.words = [];
  }
  resize() {
    const dpr = window.devicePixelRatio || 1;      // content box: the Replica bezel is a CSS border
    this.W = Math.max(200, this.cv.clientWidth); this.H = Math.max(200, this.cv.clientHeight);
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cleared = false;
  }
  get dx() { return this.W / this.view.w; }
  X(d) { return (d - this.view.x0) * this.dx; }
  Y(y) { return TOP + (this.H - TOP - BOTTOM) / 2 - (y - this.view.yc) * this.dx / 32; }
  resetView(f) { this.follow = true; this.view.x0 = f.dec.N - this.view.w * 0.5; this.view.yc = f.dec.L; }

  track(f, quick) {
    const v = this.view, d = f.dec;
    if (this.drift) { const k = Math.max(1, 1 + f.speed); v.x0 += this.drift[0] * 0.12 * k; v.yc -= this.drift[1] * 4 * k; this.follow = false; }
    if (!this.follow) return;
    const tip = f.tentative ? f.tentative.d + 1 : d.N, e = quick ? 0.35 : 0.1;
    let tx = v.x0;
    if (tip > v.x0 + v.w * 0.78) tx = tip - v.w * 0.78;
    if (d.N < v.x0 + v.w * 0.12) tx = d.N - v.w * 0.12;
    v.x0 += (tx - v.x0) * e;
    const span = (this.H - TOP - BOTTOM) * 32 / this.dx;     // metric units visible
    if (Math.abs(d.L - v.yc) > span * 0.22) v.yc += (d.L - v.yc - Math.sign(d.L - v.yc) * span * 0.22) * e;
  }

  line(x1, y1, x2, y2) { const c = this.ctx; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }

  draw(f, mode, o = {}) {
    const c = this.ctx, T = THEMES[mode], v = this.view, d = f.dec, W = this.W, H = this.H;
    const num = n => (mode === 'replica' ? n.toString(8) : String(n));
    c.shadowBlur = 0; c.shadowColor = 'transparent';
    if (T.fade && this.cleared) { c.fillStyle = T.fade; c.fillRect(0, 0, W, H); }
    else { c.fillStyle = T.bg; c.fillRect(0, 0, W, H); this.cleared = true; }
    c.font = T.font; c.textBaseline = 'middle'; c.lineCap = 'round';
    c.shadowColor = T.glow || 'transparent'; c.shadowBlur = T.glow ? 6 : 0;
    this.words = [];

    // vertical axis title - drawn first so it persists even while the display program is off
    c.save(); c.translate(11, TOP + (H - TOP - BOTTOM) / 2 - 20); c.rotate(-Math.PI / 2);
    c.textAlign = 'center'; c.fillStyle = mode === 'replica' ? T.text : T.faint;
    c.fillText(mode === 'replica' ? 'TOTAL METRIC  L  \u2192' : 'total metric L (running score) \u2192', 0, 0);
    c.restore();

    if (f.fast && f.running) {               // display program not running
      c.fillStyle = T.text; c.textAlign = 'left'; c.fillText('RUN', 12, H - 14);
      c.textAlign = 'right'; c.fillText(String(d.N), W - 12, H - 14);
      if (mode !== 'replica') { c.textAlign = 'center'; c.fillStyle = T.faint; c.fillText(f.mode === 0 ? 'MODE0 — display off' : 'SPEED=7 — display off, tree remembered', W / 2, H / 2); }
      return;
    }

    // threshold lines, the running threshold brighter
    const it0 = d.IT0, half = (H - TOP - BOTTOM) / 2 * 32 / this.dx;
    c.lineWidth = 1;
    const listTop = (this.layout ? this.layout.ty : H - 110) - 40;
    c.textAlign = 'left';
    for (let t = Math.ceil((v.yc - half) / it0) * it0; t <= v.yc + half; t += it0) {
      const yy = this.Y(t);
      if (yy > TOP + 14 && yy < listTop && it0 * this.dx / 32 >= 16) { c.fillStyle = t === d.IT ? T.thrHi : T.faint; c.fillText(String(t), 24, yy - 8); }   // axis values
      if (t === d.IT) continue;
      c.strokeStyle = T.thr; this.line(0, yy, W, yy);
    }
    c.strokeStyle = T.thrHi; c.lineWidth = 1.5; this.line(0, this.Y(d.IT), W, this.Y(d.IT));
    if (mode !== 'replica') { c.fillStyle = T.thrHi; c.textAlign = 'right'; c.fillText('threshold ' + d.IT, W - 8, this.Y(d.IT) - 9); }

    // depth marks every 10 nodes
    c.textAlign = 'center';
    for (let n = Math.max(0, Math.ceil(v.x0 / 10) * 10); n <= v.x0 + v.w; n += 10) {
      c.strokeStyle = T.faint; this.line(this.X(n), H - BOTTOM, this.X(n), H - BOTTOM + 6);
      if (this.X(n) > 64 && this.X(n) < W - (mode === 'replica' ? 190 : 70)) { c.fillStyle = T.faint; c.fillText(String(n), this.X(n), H - BOTTOM + 16); }
    }

    // every branch searched and still remembered
    c.lineWidth = 1.2;
    for (const b of f.store.visible(v.x0 - 1, v.x0 + v.w + 1)) {
      c.strokeStyle = T.wrong && !b.correct ? T.wrong : T.dim;
      c.globalAlpha = T.wrong && !b.correct ? 0.55 : 1;
      this.line(this.X(b.d), this.Y(b.y0), this.X(b.d + 1), this.Y(b.y0 + b.dy));
      if (b.other && this.dx > 20) { c.fillStyle = T.faint; c.textAlign = 'left'; c.fillText(num(b.sym), this.X(b.d + 1) + 4, this.Y(b.y0 + b.dy)); }
    }
    c.globalAlpha = 1;

    // light pen on a node: intensify the unique path leading back from it
    const pinned = this.pin || this.hover;
    if (pinned) {
      c.strokeStyle = T.pin; c.lineWidth = 2;
      for (let b = pinned; b && b.d >= v.x0 - 1; b = b.parent) this.line(this.X(b.d), this.Y(b.y0), this.X(b.d + 1), this.Y(b.y0 + b.dy));
    }

    // the current path, from the DISPLAY INCREMENTS table (LMBD)
    c.lineWidth = 2.2;
    let y = d.L;
    const lo = Math.max(0, d.N - 255, Math.floor(v.x0) - 1);
    for (let n = d.N - 1; n >= lo; n--) {
      const y0 = y - d.LMBD[n & 255];
      c.strokeStyle = T.wrong && f.offPath >= 0 && n >= f.offPath ? T.wrong : T.bright;
      this.line(this.X(n), this.Y(y0), this.X(n + 1), this.Y(y));
      y = y0;
    }
    const t = f.tentative;
    if (t) {
      c.strokeStyle = t.fail ? T.fail : (T.wrong && !t.correct ? T.wrong : T.bright);
      if (t.fail && mode !== 'replica') c.setLineDash([5, 4]);
      this.line(this.X(t.d), this.Y(t.y0), this.X(t.d + 1), this.Y(t.y0 + t.dy));
      c.setLineDash([]);
    }
    c.fillStyle = T.bright;                        // the small blob at the present value of N
    c.beginPath(); c.arc(this.X(d.N), this.Y(d.L), 4, 0, 7); c.fill();

    // shift register bits and channel signal numbers across the top, above their branches
    if (this.dx >= 15) {
      c.textAlign = 'center';
      const last = t ? t.d : d.N - 1;
      for (let n = Math.max(lo, Math.ceil(v.x0 - 0.5)); n <= last && n < v.x0 + v.w; n++) {
        const cur = t && n === t.d;
        c.fillStyle = cur ? T.bright : T.text;
        c.fillText(String(cur ? t.bit : d.BIT[n & 255]), this.X(n + 0.5), 14);
        c.fillStyle = cur ? T.bright : T.faint;
        c.fillText(num(cur ? t.sym : d.HYP[n & 255]), this.X(n + 0.5), 31);
      }
    }
    if (this.dataMode) {
      c.fillStyle = T.bright;
      for (let n = Math.max(0, Math.ceil(v.x0)); n < v.x0 + v.w; n++) { c.beginPath(); c.arc(this.X(n), 42, 2, 0, 7); c.fill(); }
    }

    // ordered list for this node, and the GEN table (coder assignments at the current node)
    const at = this.inspect != null ? this.inspect : (this.hover ? this.hover.d : d.N), r = f.channel.received(at);
    c.textAlign = 'left'; c.fillStyle = T.faint;
    let ty = H - BOTTOM - 22 - r.num.length * 15;
    const head = mode === 'replica' ? 'N ' + at : 'list at node ' + at;
    c.fillText(head, 12, ty - 16);
    r.num.forEach((s, i) => {
      const onBranch = t && at === t.d && s === t.sym;
      c.fillStyle = onBranch ? T.bright : T.text;
      c.fillText(num(r.code[i]).padStart(4) + '  ' + num(s), 12, ty + i * 15);
    });
    const gx = Math.max(96, c.measureText(head).width + 30);
    this.layout = { ty, gx, rows: r.num.length, at };
    if (at === d.N) {
      const g = d.coder.gen;
      c.fillStyle = T.faint; c.fillText('GEN', gx, ty - 16);
      c.fillStyle = T.text;
      if (t) { c.fillText('0  ' + num(g[0]), gx, ty); c.fillText('1  ' + num(g[1]), gx, ty + 15); }
    }

    // RUN / STOP, depth as a decimal number, light-pen words
    c.fillStyle = T.text; c.textAlign = 'left'; c.fillText(f.running ? 'RUN' : 'STOP', 12, H - 14);
    c.textAlign = 'right'; c.fillText(String(d.N), W - 12, H - 14);
    if (mode === 'replica') {
      const ws = this.moveMode ? ['RESET'] : this.dataMode ? ['ERASE'] : ['MOVE', 'DATA'];
      ws.forEach((w, i) => {
        const x = W - 52 - c.measureText(String(d.N)).width - i * 64, yy = H - 14;   // clear of the depth number
        c.textAlign = 'center'; c.fillStyle = T.text; c.fillText(w, x, yy);
        this.words.push({ w, x, y: yy });
      });
      if (this.moveMode) {                        // the eight-pointed star
        const cx = W - 70, cy = H - BOTTOM - 70;
        c.strokeStyle = T.bright; c.lineWidth = 1.5;
        STAR.forEach(([sx, sy]) => { const k = 34 / Math.hypot(sx, sy); this.line(cx, cy, cx + sx * k, cy + sy * k); });
      }
    } else if (this.hover && this.mouse) {
      const b = this.hover, p = f.channel.received(b.d).num.indexOf(b.sym) + 1;
      const tip = `node ${b.d}→${b.d + 1}   bit ${b.bit}   signal ${b.sym} (${p ? 'list position ' + p : 'not on list'})   metric ${b.dy > 0 ? '+' : ''}${b.dy} → ${b.y0 + b.dy}`;
      const tw = c.measureText(tip).width + 16, tx = Math.min(W - tw - 6, Math.max(6, this.mouse[0] + 12)), tyy = Math.max(TOP + 12, this.mouse[1] - 22);
      c.shadowBlur = 0; c.fillStyle = T.bg; c.globalAlpha = 0.92; c.fillRect(tx, tyy - 11, tw, 22); c.globalAlpha = 1;
      c.strokeStyle = T.faint; c.lineWidth = 1; c.strokeRect(tx, tyy - 11, tw, 22);
      c.fillStyle = T.text; c.textAlign = 'left'; c.fillText(tip, tx + 8, tyy);
    }
  }

  // Named parts of the picture, in canvas px, for the guided tour's spotlight and lens
  region(name, f) {
    const d = f.dec, W = this.W, H = this.H, L = this.layout || { ty: H - 120, gx: 110, rows: 4 };
    const box = (x, y, w, h) => { w = Math.min(w, W); h = Math.min(h, H); x = Math.max(0, Math.min(W - w, x)); y = Math.max(0, Math.min(H - h, y)); return { x, y, w, h }; };
    const tipX = this.X(f.tentative ? f.tentative.d + 1 : d.N);
    if (name === 'dot') return box(this.X(d.N) - 150, this.Y(d.L) - 60, 210, 120);
    if (name === 'threshold') return box(W - 270, this.Y(d.IT) - 34, 270, 56);
    if (name === 'register') return box(tipX - 230, 0, 270, TOP + 4);
    if (name === 'list') return box(2, L.ty - 30, L.gx + 66, L.rows * 15 + 40);
    if (name === 'words') return this.moveMode ? box(W - 240, H - BOTTOM - 112, 240, BOTTOM + 112) : box(W - 240, H - BOTTOM - 6, 240, BOTTOM + 6);
    return { x: 0, y: 0, w: W, h: H };
  }

  // What is under the pointer, in words - for the self-explanatory tooltips
  regionTip(f, mode, px, py) {
    const d = f.dec, W = this.W, H = this.H, L = this.layout, oct = mode === 'replica';
    if (f.fast && f.running) return 'The display program is switched off so the algorithm can run at full speed. The number at the lower right is the node depth reached. STOP, or a slower SPEED, brings the picture back.';
    if (oct && this.wordAt(px, py)) {
      return { MOVE: 'Light-pen word. Touch MOVE and an eight-pointed star appears; hold the pen on one of its tips and the whole tree drifts that way, so you can look back at branches that have slid off the screen (p. 22).',
        RESET: 'Put the display back where it was, following the decoder, and remove the star.',
        DATA: 'Light-pen word. Touch DATA and a row of dots appears across the top, one per node; touch a dot to see the ordered list the receiver produced for that node (p. 63).',
        ERASE: 'Remove the dots and go back to showing the ordered list for the current node.' }[this.wordAt(px, py)];
    }
    if (this.moveMode && this.starTip(px, py)) return 'Hold the pointer on a tip of the star: the tree drifts in that direction for as long as you hold. RESET returns to the decoder’s position.';
    if (px < 22 && py > TOP && py < H - BOTTOM - 130) return 'The vertical axis: the total metric L — the running score of the path, in the program’s integer units (10 units = 1 bit of log-likelihood). The small numbers are the values of the threshold levels, IT0 apart. Depth in the tree runs left to right.';
    if (py < 23) return 'The contents of the coder’s shift register: the information bit the decoder has guessed for each branch of the current path, written above that branch. The register really holds the last 60 of them — every new channel signal depends on all 60, which is what makes a wrong turn show up sooner or later.';
    if (py < TOP) return (this.dataMode ? 'Touch a dot to show the ordered list for that node. ' : '') + 'The channel signal number (0–7' + (oct ? ', octal' : '') + ') the coder assigns to each branch of the current path: the information bit followed by two parity checks on the shift register (SEQUENCE 1 (S, I, P1, P2)). One of 8 orthogonal waveforms is sent per bit.';
    if (L && px < L.gx - 8 && py > L.ty - 26 && py < L.ty + L.rows * 15) return `The receiver’s ordered list for node ${L.at}: the 4 of its 8 matched-filter outputs that were largest, most likely first. Left column is the voltage as a 10-bit converter reading${oct ? ' (octal)' : ''}, right column the signal number. The decoder never sees more than this about each received signal (Sec. II-E). A branch scores +17 if its signal is first on the list, −13, −29 or −41 if lower, and −64 if it is not on the list at all.`;
    if (L && px >= L.gx - 8 && px < L.gx + 70 && py > L.ty - 26 && py < L.ty + 34) return 'The GEN table: the channel signal the coder would send from this node for information bit 0 and for bit 1. The decoder looks both up on the ordered list and tries the better-placed one first.';
    if (py > H - BOTTOM) {
      if (px < 64) return 'RUN or STOP: whether the main program is running — shown in the corner of the scope, as in 1965.';
      if (px > W - 64) return 'The current node depth N, as a decimal number: how many branches from the start of the tree the decoder is standing.';
      return 'Depth in the tree, marked every 10 nodes. One node = one information bit = one use of the channel.';
    }
    if (Math.hypot(px - this.X(d.N), py - this.Y(d.L)) < 12) return `Where the decoder is now: node ${d.N}, total metric ${d.L}. The metric is a running score of how well this path explains everything received so far — a log-likelihood, less a bias for the data rate, so that it climbs on the right path and sinks on a wrong one.`;
    if (Math.abs(py - this.Y(d.IT)) < 7) return `The running threshold, now ${d.IT}. A branch is accepted only if the total stays at or above this line. It is raised as far as it will go whenever the decoder reaches a node it has never seen, and lowered by IT0 = ${d.IT0} when every path from here falls below it.`;
    const k = Math.round((this.view.yc + (TOP + (H - TOP - BOTTOM) / 2 - py) * 32 / this.dx) / d.IT0) * d.IT0;
    if (Math.abs(py - this.Y(k)) < 5) return `One of the levels the threshold may take — multiples of IT0 = ${d.IT0}. The threshold only ever sits on one of these lines.`;
    return mode === 'replica'
      ? 'The tree display. Left to right is depth in the tree; height is the total metric; each branch is a line whose slope is its metric increment. The path being searched is brightest. Hold the pointer on a node to intensify the path leading back from it, as the light pen did.'
      : 'The tree display. Left to right is depth in the tree; height is the total metric; each branch is a line whose slope is its metric increment, so good guesses climb and bad ones drop steeply. Drag to pan, scroll to zoom, double-click to return to the decoder, hover over the end of a branch to inspect it.';
  }

  nodeAt(f, px, py) {
    let best = null, bd = 14;
    for (const b of f.store.visible(this.view.x0 - 1, this.view.x0 + this.view.w + 1)) {
      const dist = Math.hypot(this.X(b.d + 1) - px, this.Y(b.y0 + b.dy) - py);
      if (dist < bd) { bd = dist; best = b; }
    }
    return best;
  }
  wordAt(px, py) { const w = this.words.find(k => Math.abs(k.x - px) < 28 && Math.abs(k.y - py) < 12); return w ? w.w : null; }
  starTip(px, py) {
    const cx = this.W - 70, cy = this.H - BOTTOM - 70, dx = px - cx, dy = py - cy;
    if (Math.hypot(dx, dy) > 50 || Math.hypot(dx, dy) < 8) return null;
    return STAR[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
  }

  // Light pen (Replica) or mouse (Workbench / Explainer)
  attach(getF, getMode) {
    const cv = this.cv, pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left - cv.clientLeft, e.clientY - r.top - cv.clientTop]; };
    let drag = null;
    cv.addEventListener('pointerdown', e => {
      const [x, y] = pos(e), f = getF(), replica = getMode() === 'replica';
      cv.setPointerCapture(e.pointerId);
      if (replica) {
        const w = this.wordAt(x, y);
        if (w === 'MOVE') { this.moveMode = true; return; }
        if (w === 'RESET') { this.moveMode = false; this.drift = null; this.resetView(f); return; }
        if (w === 'DATA') { this.dataMode = true; return; }
        if (w === 'ERASE') { this.dataMode = false; this.inspect = null; return; }
        if (this.moveMode) { this.drift = this.starTip(x, y); if (this.drift) return; }
        if (this.dataMode && y < TOP + 8) { this.inspect = Math.max(0, Math.round(x / this.dx + this.view.x0)); return; }
      }
      this.pin = this.nodeAt(f, x, y);
      if (!this.pin && !replica) drag = { x, y, x0: this.view.x0, yc: this.view.yc };
    });
    cv.addEventListener('pointermove', e => {
      const [x, y] = pos(e), f = getF();
      this.mouse = [x, y];
      if (drag) {
        this.follow = false;
        this.view.x0 = drag.x0 - (x - drag.x) / this.dx;
        this.view.yc = drag.yc + (y - drag.y) * 32 / this.dx;
      } else if (getMode() !== 'replica') this.hover = this.nodeAt(f, x, y);
      else if (this.drift) this.drift = this.starTip(x, y);
    });
    const up = () => { drag = null; this.pin = null; this.drift = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { this.hover = null; this.mouse = null; });
    cv.addEventListener('dblclick', () => this.resetView(getF()));
    cv.addEventListener('wheel', e => {
      if (getMode() === 'replica') return;
      e.preventDefault();
      const [x] = pos(e), at = this.view.x0 + x / this.dx;
      this.view.w = Math.max(8, Math.min(120, this.view.w * (e.deltaY > 0 ? 1.12 : 0.89)));
      this.view.x0 = at - x / this.dx;
    }, { passive: false });
  }
}
