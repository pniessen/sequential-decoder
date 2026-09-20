// Convolutional coder of Fig. A-1: a shift register (up to 60 bits here, held as two
// 30-bit words) with modulo-2 parity nets. Bit 1 is the newest bit (information bits
// enter from the left); SHIFT RIGHT pushes the oldest bit off the far end (SREND).

const MASK30 = 0x3fffffff;

// "P1 = 7360 3601 4576 2426 3054 0000": a 1 means that register stage feeds the adder.
export function parseNet(octal) {
  const d = octal.replace(/\s/g, '').padEnd(20, '0').slice(0, 20);
  return [parseInt(d.slice(0, 10), 8), parseInt(d.slice(10, 20), 8)];
}

// Parity nets of the Fig. A-4 example program (p. 55)
export const P1 = parseNet('7360 3601 4576 2426 3054 0000');
export const P2 = parseNet('5431 2256 7722 3264 7642 0000');

function parity(x) {
  x ^= x >>> 16; x ^= x >>> 8; x ^= x >>> 4; x ^= x >>> 2; x ^= x >>> 1;
  return x & 1;
}

export class Coder {
  constructor(K = 60, nets = [P1, P2]) {
    this.K = K;            // CONSTRAINT IS K
    this.nets = nets;
    this.a = 0;            // stages 1..30, stage 1 at the MSB
    this.b = 0;            // stages 31..60
    this.gen = [0, 0];     // GEN(J): channel symbol for information bit J
  }
  clear() { this.a = 0; this.b = 0; }                     // SR <- 0
  bit(pos) {
    return pos <= 30 ? (this.a >>> (30 - pos)) & 1 : (this.b >>> (60 - pos)) & 1;
  }
  setBit(pos, v) {
    if (pos <= 30) { const m = 1 << (30 - pos); this.a = v ? this.a | m : this.a & ~m; }
    else { const m = 1 << (60 - pos); this.b = v ? this.b | m : this.b & ~m; }
  }
  // SHIFT RIGHT 1 with x entering on the left; returns the bit pushed off (SREND)
  shiftRight(x) {
    const end = this.bit(this.K);
    this.b = (this.b >>> 1) | ((this.a & 1) << 29);
    this.a = (this.a >>> 1) | (x << 29);
    if (this.K < 60) {     // nothing lives beyond stage K
      if (this.K <= 30) { this.a &= ~((1 << (30 - this.K)) - 1); this.b = 0; }
      else this.b &= ~((1 << (60 - this.K)) - 1);
    }
    return end;
  }
  // SHIFT LEFT 1 ; ENTER SR END (1, endBit)
  shiftLeft(endBit) {
    this.a = ((this.a << 1) & MASK30) | (this.b >>> 29);
    this.b = (this.b << 1) & MASK30;
    this.setBit(this.K, endBit);
  }
  enter(j) { this.setBit(1, j); }                         // ENTER SR (1, J)
  // SEQUENCE 1 (S, I, P1, P2): symbol = I P1 P2 as a 3-bit number, with stage 1 = j
  symbolFor(j) {
    const a = (this.a & ~(1 << 29)) | (j << 29);
    let s = j;
    for (const [na, nb] of this.nets) s = (s << 1) | (parity(a & na) ^ parity(this.b & nb));
    return s;
  }
  // GENERATE 1: shift right, then tabulate the symbol on every branch from this node
  generate() {
    const end = this.shiftRight(0);
    this.gen[0] = this.symbolFor(0);
    this.gen[1] = this.symbolFor(1);
    return end;
  }
}
