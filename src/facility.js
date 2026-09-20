import { Channel } from './channel.js';
import { metricTable, estimateQ } from './metric.js';
import { FanoDecoder } from './fano.js';
import { Stats } from './stats.js';
import { TreeStore } from './treeStore.js';

// The monitor system (Sec. III-C, Appendix A-V-B): runs the algorithm between display
// checkpoints, feeds the tree display, keeps restart data, and obeys teletype commands.

const HISTORY = 300;       // single steps that can be taken back (an addition: the 1965 monitor could only RESTART)
const DECODE_LAG = 200;    // a bit this far behind the deepest node is taken as decoded
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const HELP = [
  'RUN  STOP  G  STEPS=n        run / stop / one step / n steps          B  take the last step back (up to 300)',
  'SPEED=0..6                   2^(1-n) sec per step (also -1, -2: 4 s, 8 s);  SPEED=7 fast, display off, tree remembered',
  'MODE0  MODE1                 display program off (fastest) / on',
  'GO TO N=n                    run until node depth n, then READY',
  'OTHERS=1|0                   show every hypothesis at the current node',
  'RESTART AT N=n  REPEAT  STORE   restart from saved restart data',
  'DATA AT N=n: v s, v s, ...   replace the ordered list at node n (* keeps a value)',
  'DDT [IT0= SN= SEED= MSG=ZERO|RANDOM ISDM= IWLM= K=]   examine / change parameters',
  'EXIT                         print statistics and stop        RESET  start over',
];

export class Facility {
  constructor(cfg = {}) {
    this.cfg = {
      seed: 1965, snr: 2.5, it0: 50, message: 'zero', ratio: 20, capacity: 512,
      restartEvery: 100, IWLM: 100, ISDM: 25, radix: 10, ...cfg,
    };
    this.onPrint = null;
    this.speed = 3; this.mode = 1; this.others = 0;
    this.reset();
  }

  print(s) { if (this.onPrint) this.onPrint(s); }

  reset() {
    const c = this.cfg;
    this.channel = new Channel({ seed: c.seed, snr: c.snr, message: c.message });
    this.idist = metricTable(c.snr);
    this.q = estimateQ({ snr: c.snr, trials: 60000 });   // Pr(sent signal is i-th on the list): shown in the worksheet
    this.dec = new FanoDecoder({ channel: this.channel, idist: this.idist, it0: c.it0 });
    this.stats = new Stats(c.ratio);
    this.store = new TreeStore(c.capacity);
    this.pathBranch = new Array(256).fill(null);
    this.running = false; this.stepsLeft = null; this.gotoN = null; this.acc = 0;
    this.maxN = 0; this.errors = 0; this.offPath = -1; this.lastOffPath = -1;
    this.tentative = null; this.lastEvent = null; this.lastEnter = null;
    this.history = [];
    this.snapshots = []; this.storePending = false;
    this.haltedSearch = false; this.haltedWait = false;
    this.saveSnapshot();
  }

  run() { this.running = true; this.acc = 0; }
  stop() { this.running = false; this.stepsLeft = null; }

  saveSnapshot() {
    this.snapshots.push({
      N: this.dec.N, dec: this.dec.snapshot(), stats: this.stats.clone(),
      maxN: this.maxN, errors: this.errors, offPath: this.offPath,
    });
    if (this.snapshots.length > 10) this.snapshots.shift();   // "usually about ten"
    this.storePending = false;
  }

  restartAt(n) {
    let best = null;
    for (const s of this.snapshots) if (s.N <= n && (!best || s.N > best.N)) best = s;
    if (!best) { this.print('NO RESTART DATA AT OR BELOW N = ' + n); return -1; }
    this.dec.restore(best.dec);
    this.stats = best.stats.clone();
    this.maxN = best.maxN; this.errors = best.errors; this.offPath = best.offPath;
    this.snapshots = this.snapshots.filter(s => s.N <= best.N);   // restart destroys later restart data
    this.store.clear(); this.pathBranch.fill(null);
    this.tentative = null; this.lastEvent = null; this.lastEnter = null; this.history = [];
    this.haltedSearch = this.haltedWait = false;
    return best.N;
  }

  // Take back the last step: restore the complete state saved just before it
  stepBack() {
    const h = this.history.pop();
    this.stop();
    if (!h) { this.print('NO EARLIER STEP SAVED'); return false; }
    this.dec.restore(h.dec);
    this.stats = h.stats;
    Object.assign(this, h.misc);
    for (const u of h.undo) {                        // clear from the display what the undone step drew
      if (u.isNew) this.store.remove(u.b); else u.b.other = u.wasOther;
    }
    if (h.path) this.pathBranch[h.path.k] = h.path.prev;
    return true;
  }

  stepOnce() {
    let hist = null;
    if (this.mode === 1 && !(this.speed === 7 && this.running)) {     // watching, not racing: remember how to get back
      this.history.push(hist = {
        undo: [], path: null,
        dec: this.dec.snapshot(), stats: this.stats.clone(),
        misc: { maxN: this.maxN, errors: this.errors, offPath: this.offPath, lastOffPath: this.lastOffPath, tentative: this.tentative,
          lastEvent: this.lastEvent, lastEnter: this.lastEnter, haltedSearch: this.haltedSearch, haltedWait: this.haltedWait },
      });
      if (this.history.length > HISTORY) this.history.shift();
    } else if (this.history.length) this.history = [];
    const d = this.dec, ch = this.channel, ev = d.step();
    this.stats.onEvent(ev);
    this.lastEvent = ev;
    if (ev.kind === 'enter') {
      const k = ev.N & 255, bit = ev.J, sym = d.HYP[k];
      const correct = this.offPath < 0 && bit === ch.msgBit(ev.N);
      this.tentative = { d: ev.N, y0: ev.L, dy: ev.LT - ev.L, bit, sym, pos: ev.POS, li: d.LI[k], fail: ev.LT < ev.IT, correct };
      this.lastEnter = { ev, t: this.tentative, gen: [d.coder.gen[0], d.coder.gen[1]] };
      if (this.mode === 1) {
        let parent = ev.N > 0 ? this.pathBranch[(ev.N - 1) & 255] : null;
        if (parent && (parent.d !== ev.N - 1 || parent.y0 + parent.dy !== ev.L)) parent = null;
        if (hist) hist.path = { k, prev: this.pathBranch[k] };
        this.pathBranch[k] = this.store.add(ev.N, ev.L, ev.LT - ev.L, bit, sym, parent, correct);
        if (hist) hist.undo.push(this.store.last);
        if (this.others) {                      // OTHERT(j) <- IDIST[XPFINDF(GEN(j), N)] ; CALL CHANGE
          const jo = 1 - bit, so = d.coder.gen[jo];
          this.store.add(ev.N, ev.L, this.idist[d.xpfindf(so, ev.N) - 1], jo, so, parent,
            this.offPath < 0 && jo === ch.msgBit(ev.N), true);
          if (hist) hist.undo.push(this.store.last);
        }
      }
    } else {
      this.tentative = null;
      if (ev.kind === 'advance') {
        const at = ev.N - 1;
        if (this.offPath < 0 && d.BIT[at & 255] !== ch.msgBit(at)) this.offPath = this.lastOffPath = at;
        if (ev.N > this.maxN) {
          this.maxN = ev.N;
          this.store.trim(ev.N);
          const f = at - DECODE_LAG;
          if (f >= 0 && d.BIT[f & 255] !== ch.msgBit(f)) this.errors++;
          if (ev.N % this.cfg.restartEvery === 0) this.saveSnapshot();
        }
      } else if (ev.kind === 'retreat' && this.offPath >= ev.N) this.offPath = -1;
    }
    if (this.storePending && d.pc === 1) this.saveSnapshot();

    // Fig. A-4, statement 1: TYPEOUT ... ; GO TO MONITOR
    const st = this.stats, c = this.cfg;
    if (c.ISDM && st.searchDepth >= c.ISDM && !this.haltedSearch) {
      this.haltedSearch = true; this.print('SEARCH DEPTH IS ' + st.searchDepth); this.print('READY'); this.stop();
    }
    if (!st.inSearch) this.haltedSearch = false;
    if (c.IWLM && st.waitingLine >= c.IWLM && !this.haltedWait) {
      this.haltedWait = true; this.print('WAITING LINE IS ' + st.waitingLine); this.print('READY'); this.stop();
    }
    if (st.waitingLine < c.IWLM / 2) this.haltedWait = false;

    if (this.gotoN != null && ev.kind === 'advance' && d.N >= this.gotoN) {
      this.gotoN = null; this.print('READY'); this.stop();
    }
    if (this.stepsLeft != null && --this.stepsLeft <= 0) this.stop();
    return ev;
  }

  get fast() { return this.mode === 0 || this.speed === 7; }

  // Advance the clock by dt ms; returns the number of steps taken
  pump(dt, budget = 12) {
    if (!this.running) return 0;
    let n = 0;
    if (this.fast) {
      const t0 = now();
      do { for (let i = 0; i < 400 && this.running; i++, n++) this.stepOnce(); }
      while (this.running && now() - t0 < budget);
    } else {
      const iv = 2000 / Math.pow(2, this.speed);
      this.acc += dt;
      while (this.acc >= iv && this.running && n < 4) { this.stepOnce(); this.acc -= iv; n++; }
      if (this.acc > iv) this.acc = iv;
    }
    return n;
  }

  // Run silently until a search at least minDepth deep is under way, then restart just before it
  findSearch(minDepth = 3, maxSteps = 3e6) {
    const c = this.cfg, save = { mode: this.mode, K: c.restartEvery, ISDM: c.ISDM, IWLM: c.IWLM };
    this.stop();
    this.mode = 0; c.restartEvery = 8; c.ISDM = 0; c.IWLM = 0;
    let steps = 0;
    this.lastOffPath = -1;
    while (this.dec.pc !== 1) this.stepOnce();
    this.saveSnapshot();
    while (this.stats.searchDepth < minDepth && steps++ < maxSteps) this.stepOnce();
    const found = this.stats.searchDepth >= minDepth, n0 = this.stats.n0;
    const wrongTurn = this.lastOffPath >= n0 - 30 && this.lastOffPath <= n0 ? this.lastOffPath : -1;
    Object.assign(c, { restartEvery: save.K, ISDM: save.ISDM, IWLM: save.IWLM });
    this.mode = 1;
    if (!found) return null;
    const from = this.restartAt(Math.max(0, n0 - minDepth - 6));
    return { n0, from, wrongTurn };
  }

  report() {
    const st = this.stats, tail = st.depthTail(), out = [];
    out.push(`NODES DECODED ${this.maxN}   COMPUTATIONS ${this.dec.ICOUNT}   PER NODE ${(this.dec.ICOUNT / Math.max(1, this.maxN)).toFixed(3)}`);
    out.push(`SEARCHES ${st.searches}   BIT ERRORS ${this.errors}   WAITING LINE ${st.waitingLine}`);
    out.push('SEARCHES OF DEPTH >= N');
    for (let i = 1; i < 128 && tail[i] > 0; i++) out.push(`  ${String(i).padStart(3)}  ${tail[i]}`);
    return out;
  }

  exec(line) {
    const raw = line.trim(), s = raw.toUpperCase().replace(/\s+/g, '');
    let mt;
    if (!s) return;
    if (s === 'RUN') this.run();
    else if (s === 'STOP') this.stop();
    else if (s === 'G') { this.stop(); this.stepOnce(); }
    else if (s === 'B') this.stepBack();
    else if ((mt = s.match(/^STEPS=(\d+)$/))) { this.stepsLeft = +mt[1]; this.run(); }
    else if ((mt = s.match(/^SPEED=(-[12]|[0-7])$/))) this.speed = +mt[1];   // -1, -2: slower than 1965 allowed (4 s, 8 s)
    else if ((mt = s.match(/^GOTON=(\d+)$/))) { this.gotoN = +mt[1]; this.run(); }
    else if (s === 'MODE0') { this.mode = 0; this.others = 0; this.store.clear(); this.pathBranch.fill(null); }
    else if (s === 'MODE1') this.mode = 1;
    else if ((mt = s.match(/^OTHERS=([01])$/))) this.others = +mt[1];
    else if ((mt = s.match(/^RESTARTATN=(\d+)$/))) { this.stop(); const n = this.restartAt(+mt[1]); if (n >= 0) this.print('RESTARTED AT N = ' + n); }
    else if (s === 'REPEAT') { this.stop(); const n = this.restartAt(Infinity); this.print('RESTARTED AT N = ' + n); }
    else if (s === 'STORE') this.storePending = true;
    else if (s === 'EXIT') { this.stop(); this.report().forEach(l => this.print(l)); }
    else if (s === 'RESET') { this.reset(); this.print('READY'); }
    else if (s === 'HELP' || s === '?') HELP.forEach(l => this.print(l));
    else if (/^N0=/.test(s) || /^IO=/.test(s)) this.print('OK');
    else if (s.startsWith('DDT')) this.ddt(s.slice(3));
    else if ((mt = raw.match(/^DATA\s*AT\s*N\s*=\s*(\d+)\s*:?(.*)$/i))) this.dataAt(+mt[1], mt[2]);
    else this.print('?');
  }

  ddt(arg) {
    const c = this.cfg;
    let mt;
    if (!arg) {
      this.print(`IT0/ ${c.it0}   SN/ ${c.snr}   SEED/ ${c.seed}   MSG/ ${c.message.toUpperCase()}   ISDM/ ${c.ISDM}   IWLM/ ${c.IWLM}   K/ ${c.restartEvery}`);
      this.print(`IDIST/ ${this.idist.join(' ')}`);
    } else if ((mt = arg.match(/^IT0=(\d+)$/)) && +mt[1] > 0) { c.it0 = +mt[1]; this.dec.IT0 = c.it0; }
    else if ((mt = arg.match(/^ISDM=(\d+)$/))) c.ISDM = +mt[1];
    else if ((mt = arg.match(/^IWLM=(\d+)$/))) c.IWLM = +mt[1];
    else if ((mt = arg.match(/^K=(\d+)$/)) && +mt[1] > 0) c.restartEvery = +mt[1];
    else if ((mt = arg.match(/^SN=(\d*\.?\d+)$/))) { c.snr = +mt[1]; this.reset(); this.print('NEW CHANNEL. IDIST/ ' + this.idist.join(' ')); }
    else if ((mt = arg.match(/^SEED=(\d+)$/))) { c.seed = +mt[1]; this.reset(); this.print('NEW DATA TAPE'); }
    else if ((mt = arg.match(/^MSG=(ZERO|RANDOM)$/))) { c.message = mt[1].toLowerCase(); this.reset(); this.print('NEW DATA TAPE'); }
    else this.print('?');
  }

  // DATA AT N=n: <signal value> <signal number>, ...   (* leaves a quantity unchanged)
  dataAt(n, text) {
    const cur = this.channel.received(n), num = cur.num.slice(), code = cur.code.slice(), rx = this.cfg.radix;
    const rows = text.split(',').map(r => r.trim()).filter(Boolean);
    for (let i = 0; i < rows.length && i < num.length; i++) {
      const [v, sgn] = rows[i].split(/\s+/);
      if (v && v !== '*') code[i] = parseInt(v, rx) & 1023;
      if (sgn && sgn !== '*') num[i] = parseInt(sgn, rx) & 7;
    }
    if (rows.length) this.channel.override(n, { num, code });
    const l = this.channel.received(n);
    this.print(`N = ${n}: ` + l.num.map((s, i) => `${l.code[i].toString(rx)} ${s.toString(rx)}`).join(', '));
  }
}
