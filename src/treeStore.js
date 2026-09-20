// Storage for the display of the tree (Appendix C). Branches are kept in a "loop" per depth;
// each carries a back pointer to the branch that ends where it begins, which is what lets the
// light pen intensify a unique path back toward the origin. A branch the algorithm searches
// again is recognised rather than stored twice. When storage is depleted the oldest loops
// are removed a whole loop at a time (the 1965 display had room for 512 branches).

export class TreeStore {
  constructor(capacity = 512) {
    this.capacity = capacity;
    this.clear();
  }
  clear() { this.loops = new Map(); this.count = 0; this.minDepth = Infinity; }

  add(d, y0, dy, bit, sym, parent, correct, other = false) {
    let loop = this.loops.get(d);
    if (!loop) { loop = []; this.loops.set(d, loop); if (d < this.minDepth) this.minDepth = d; }
    for (const b of loop) {
      if (b.y0 === y0 && b.bit === bit && b.parent === parent) {
        this.last = { b, isNew: false, wasOther: b.other };      // what this call changed, so a step can be undone
        if (!other) b.other = false;
        return b;
      }
    }
    const b = { d, y0, dy, bit, sym, parent, correct, other };
    loop.push(b); this.count++;
    this.last = { b, isNew: true, wasOther: other };
    while (this.count > this.capacity && this.minDepth < d) this.dropLoop(this.minDepth);
    return b;
  }
  remove(b) {
    const loop = this.loops.get(b.d), i = loop ? loop.indexOf(b) : -1;
    if (i < 0) return;
    loop.splice(i, 1); this.count--;
    if (!loop.length) this.dropLoop(b.d);
  }
  dropLoop(d) {
    const loop = this.loops.get(d);
    if (loop) { this.count -= loop.length; this.loops.delete(d); }
    if (d === this.minDepth) {
      this.minDepth = Infinity;
      for (const k of this.loops.keys()) if (k < this.minDepth) this.minDepth = k;
    }
  }
  // "every time an advance is made to a depth not reached before, the loop for N - 250 is removed"
  trim(n) { for (let d = this.minDepth; d <= n - 250; d++) this.dropLoop(d); }

  *visible(d0, d1) {
    for (let d = Math.max(0, Math.floor(d0)); d <= d1; d++) {
      const loop = this.loops.get(d);
      if (loop) yield* loop;
    }
  }
}
