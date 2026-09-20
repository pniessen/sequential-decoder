import { hash32 } from './rng.js';
import { Coder } from './coder.js';

// The Fano sequential decoder of Fig. A-4 (pp. 55-57), ported statement for statement.
// The cases of switch(pc) are the statement labels of the 1965 program; variable names
// are his: N node depth, L total metric, LT trial metric, IT threshold, IT0 threshold
// increment, FLAG, LI(N) which-most-likely branch is being tried at N, LMBD(N) metric
// increment, ISR(N) bit pushed off the register, HYP(N) channel symbol on the path.
//
// step() runs to the next display checkpoint (p. 58):
//   'enter'   A  ENTER BRANCH - a new branch has been computed
//   'advance' B  WAIT - branch accepted, threshold raised
//   'lower'   C  threshold lowered
//   'retreat' D  WAIT - backed up one node

const RING = 256;          // BACKUP DEPTH IS 256 NODES
const RM = RING - 1;

export class FanoDecoder {
  constructor({ channel, idist, it0 = 50, K = 60 }) {
    this.channel = channel;
    this.IDIST = idist;
    this.IT0 = it0;
    this.coder = new Coder(K);
    this.LI = new Int32Array(RING);     // SAVE LI(256), HYP(256), LMBD(256), ISR(256)
    this.HYP = new Int32Array(RING);
    this.LMBD = new Int32Array(RING);
    this.ISR = new Int32Array(RING);
    this.BIT = new Int32Array(RING);    // information bit J on the path (the register, unrolled)
    this.reset();
  }

  reset() {                             // statement 20
    this.N = 0; this.IT = 0; this.L = 0; this.LT = 0; this.LB = 0;
    this.coder.clear();
    this.FLAG = 0;
    this.LI.fill(0); this.LI[0] = 1;
    this.POS = 0; this.J = 0;
    this.ICOUNT = 0;
    this.pc = 1;
  }

  // CALL FIND (POS, J, LI(N), 2, N, 0): the LI-th most likely of the two hypotheses.
  // Hypotheses off the list are equiprobable; choose among them in a "random (yet
  // repeatable) way" so the all-zero test message is not accidentally favoured (p. 19).
  find(li, n) {
    const { num } = this.channel.received(n), off = num.length + 1;
    const g = this.coder.gen;
    const p0 = num.indexOf(g[0]) + 1 || off, p1 = num.indexOf(g[1]) + 1 || off;
    const first = p0 < p1 ? 0 : p1 < p0 ? 1 : hash32(this.channel.seed ^ 0xf17d, n) & 1;
    this.J = li === 1 ? first : 1 - first;
    this.POS = this.J === 0 ? p0 : p1;
  }
  // XPFINDF(hypothesis, N): list position of a symbol
  xpfindf(sym, n) {
    const { num } = this.channel.received(n);
    return num.indexOf(sym) + 1 || num.length + 1;
  }

  step() {
    const boxes = [];
    let beginSearch = false;
    const ev = kind => ({
      kind, boxes, beginSearch, N: this.N, L: this.L, LT: this.LT, IT: this.IT, FLAG: this.FLAG,
      J: this.J, POS: this.POS,
    });
    for (;;) {
      boxes.push(this.pc);
      switch (this.pc) {
        case 1: {                                   // 32: GENERATE 1 ... LT <- L + [LMBD(N) <- IDIST(POS)]
          const k = this.N & RM;
          this.ICOUNT++;
          this.ISR[k] = this.coder.generate();      // ISR(N) <- SREND
          this.find(this.LI[k], this.N);
          this.coder.enter(this.J);                 // ENTER SR (1, J)
          this.HYP[k] = this.coder.gen[this.J];     // HYP(N) <- GEN(J)
          this.BIT[k] = this.J;
          this.LMBD[k] = this.IDIST[this.POS - 1];
          this.LT = this.L + this.LMBD[k];
          this.pc = 2;
          return ev('enter');                       // 2: ENTER BRANCH
        }
        case 2: this.pc = this.LT < this.IT ? 11 : 3; break;          // IF [LT .L. IT] 11
        case 3: this.N++; this.pc = 4; break;                         // N <- N + 1
        case 4: this.pc = this.FLAG !== 0 ? 8 : 5; break;             // IF [FLAG .NE. 0] 8
        case 5: this.pc = this.IT + this.IT0 > this.LT ? 7 : 6; break; // IF [IT + IT0 .G. LT] 7
        case 6: this.IT += this.IT0; this.pc = 5; break;              // IT <- IT + IT0 ; GO TO 5
        case 7:                                                       // L <- LT ; LI(N) <- 1 ; WAIT
          this.L = this.LT; this.LI[this.N & RM] = 1; this.pc = 1;
          return ev('advance');
        case 8: this.pc = this.IT + this.IT0 > this.L ? 10 : 9; break;   // IF [IT + IT0 .G. L] 10
        case 9: this.pc = this.IT + this.IT0 <= this.LT ? 7 : 10; break; // IF [IT + IT0 .LE. LT] 7
        case 10: this.FLAG = 0; this.pc = 5; break;                   // CLEAR FLAG ; GO TO 5
        case 11:                                                      // BEGIN SEARCH ; SET FLAG
          beginSearch = true;
          this.FLAG = 1;
          this.coder.shiftLeft(this.ISR[this.N & RM]);                 // SHIFT LEFT 1 ; ENTER SR END (1, SREND)
          this.pc = 12; break;
        case 12: this.pc = this.N === 0 ? 18 : 13; break;             // IF [N .E. 0] 18
        case 13: this.LB = this.L - this.LMBD[(this.N - 1) & RM]; this.pc = 14; break;
        case 14: this.pc = this.LB < this.IT ? 18 : 15; break;        // IF [LB .L. IT] 18
        case 15:                                                      // N <- N-1 ; restore register ; WAIT
          this.N--;
          this.coder.shiftLeft(this.ISR[this.N & RM]);
          this.L = this.LB;
          this.pc = 16;
          return ev('retreat');
        case 16: this.pc = this.LI[this.N & RM] === 2 ? 12 : 17; break; // IF [LI(N) .E. 2] 12
        case 17: this.LI[this.N & RM]++; this.pc = 1; break;
        case 18: this.IT -= this.IT0; this.pc = 19; return ev('lower');
        case 19: this.LI[this.N & RM] = 1; this.pc = 1; break;
      }
    }
  }

  // RESTART DATA ... IS (L, IT, FLAG, TABLES, LI, 256, LMBD, 256, ISR, 256, HYP, 256)
  snapshot() {
    return {
      N: this.N, L: this.L, LT: this.LT, LB: this.LB, IT: this.IT, FLAG: this.FLAG, ICOUNT: this.ICOUNT, pc: this.pc, J: this.J, POS: this.POS,
      g0: this.coder.gen[0], g1: this.coder.gen[1], a: this.coder.a, b: this.coder.b,
      LI: this.LI.slice(), HYP: this.HYP.slice(), LMBD: this.LMBD.slice(), ISR: this.ISR.slice(), BIT: this.BIT.slice(),
    };
  }
  restore(s) {
    Object.assign(this, { N: s.N, L: s.L, LT: s.LT, LB: s.LB, IT: s.IT, FLAG: s.FLAG, ICOUNT: s.ICOUNT, pc: s.pc, J: s.J, POS: s.POS });
    this.coder.a = s.a; this.coder.b = s.b; this.coder.gen[0] = s.g0; this.coder.gen[1] = s.g1;
    this.LI.set(s.LI); this.HYP.set(s.HYP); this.LMBD.set(s.LMBD); this.ISR.set(s.ISR); this.BIT.set(s.BIT);
  }
}
