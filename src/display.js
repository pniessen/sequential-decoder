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
    const r = this.cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    this.W = Math.max(200, r.width); this.H = Math.max(200, r.height);
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
    if (this.drift) { v.x0 += this.drift[0] * 0.12 * (1 + f.speed); v.yc -= this.drift[1] * 4 * (1 + f.speed); this.follow = false; }
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

    if (f.fast && f.running) {               // display program not running
      c.fillStyle = T.text; c.textAlign = 'left'; c.fillText('RUN', 12, H - 14);
      c.textAlign = 'right'; c.fillText(String(d.N), W - 12, H - 14);
      if (mode !== 'replica') { c.textAlign = 'center'; c.fillStyle = T.faint; c.fillText(f.mode === 0 ? 'MODE0 — display off' : 'SPEED=7 — display off, tree remembered', W / 2, H / 2); }
      return;
    }

    // threshold lines, the running threshold brighter
    const it0 = d.IT0, half = (H - TOP - BOTTOM) / 2 * 32 / this.dx;
    c.lineWidth = 1;
    for (let t = Math.ceil((v.yc - half) / it0) * it0; t <= v.yc + half; t += it0) {
      if (t === d.IT) continue;
      c.strokeStyle = T.thr; this.line(0, this.Y(t), W, this.Y(t));
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
    if (at === d.N) {
      const g = d.coder.gen, gx = Math.max(96, c.measureText(head).width + 30);
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
        const x = W - 70 - i * 64, yy = H - 14;
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
    const cv = this.cv, pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
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
