import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Coder, P1, P2, parseNet } from '../src/coder.js';
import { Channel } from '../src/channel.js';
import { estimateQ, metricBits, IDIST_1965 } from '../src/metric.js';
import { Facility } from '../src/facility.js';

const runTo = (f, n, maxSteps = 5e6) => { let s = 0; while (f.dec.N < n && s++ < maxSteps) f.stepOnce(); return s; };

test('parity nets parse as in the manual: P = 431 -> stages 1,5,6,9', () => {
  const [a] = parseNet('431');
  const c = new Coder(60, [[a, 0]]);
  const taps = [];
  for (let p = 1; p <= 60; p++) { c.clear(); c.setBit(p, 1); if (c.symbolFor(c.bit(1)) & 1) taps.push(p); }
  assert.deepEqual(taps, [1, 5, 6, 9]);
  assert.equal(P1[0] >>> 29, 1); assert.equal(P2[0] >>> 29, 1);   // both nets tap the newest bit
});

test('coder: impulse response reads out the parity nets; shifts are reversible', () => {
  const c = new Coder(), bits1 = [], bits2 = [];
  c.generate(); c.enter(1);
  bits1.push((c.symbolFor(1) >> 1) & 1); bits2.push(c.symbolFor(1) & 1);
  for (let i = 1; i < 60; i++) { c.generate(); c.enter(0); bits1.push((c.gen[0] >> 1) & 1); bits2.push(c.gen[0] & 1); }
  const oct = b => b.join('').match(/.{3}/g).map(t => parseInt(t, 2)).join('');
  assert.equal(oct(bits1), '73603601457624263054');
  assert.equal(oct(bits2), '54312256772232647642');
  const a = c.a, b = c.b, end = c.shiftRight(1);
  c.shiftLeft(end);
  assert.deepEqual([c.a, c.b], [a, b]);
});

test('channel: ordered list is sorted, repeatable, and independent of access order', () => {
  const ch = new Channel({ seed: 3, message: 'random' }), ch2 = new Channel({ seed: 3, message: 'random' });
  const r = ch.received(500);
  assert.equal(r.num.length, 4);
  for (let i = 1; i < 4; i++) assert.ok(r.code[i - 1] >= r.code[i]);
  for (let n = 0; n <= 500; n++) ch2.received(n);
  assert.deepEqual(ch2.received(500), r);
});

test('noise-free channel: decoder never searches', () => {
  const f = new Facility({ snr: 40, message: 'random' });
  runTo(f, 2000);
  assert.equal(f.stats.searches, 0);
  assert.equal(f.dec.ICOUNT, 2000);
  assert.equal(f.errors, 0);
});

test('S/N 2.5, R = 0.8 Rcomp: 35,000 nodes decode without error, with searches', () => {
  for (const message of ['zero', 'random']) {
    const f = new Facility({ message, ISDM: 0, IWLM: 0 });
    runTo(f, 35000);
    assert.equal(f.dec.N, 35000);
    assert.equal(f.errors, 0);
    assert.equal(f.offPath, -1);
    assert.ok(f.stats.searches > 1000, 'searches ' + f.stats.searches);
    const perNode = f.dec.ICOUNT / f.maxN;
    assert.ok(perNode > 1.05 && perNode < 4, 'computations per node ' + perNode);
    console.log(`  ${message}: ${f.stats.searches} searches, ${perNode.toFixed(2)} computations/node, tail`,
      f.stats.depthTail().slice(1, 12).join(' '));
  }
});

test('restart reproduces the trajectory exactly', () => {
  const f = new Facility({ ISDM: 0, IWLM: 0 });
  runTo(f, 1000);
  const trace = () => { const t = []; for (let i = 0; i < 3000; i++) { const e = f.stepOnce(); t.push(e.kind, e.N, e.L, e.IT); } return t; };
  assert.equal(f.dec.N, 1000);
  const first = trace();
  assert.equal(f.restartAt(1000), 1000);
  assert.deepEqual(trace(), first);
});

test('B steps back; stepping forward again replays the same decisions', () => {
  const f = new Facility({ ISDM: 0, IWLM: 0 });
  runTo(f, 60);
  const sig = () => [f.dec.N, f.dec.L, f.dec.IT, f.dec.FLAG, f.dec.pc, f.dec.coder.a, f.dec.coder.b, f.stats.moves, f.offPath].join();
  const seen = [sig()];
  for (let i = 0; i < 40; i++) { f.stepOnce(); seen.push(sig()); }
  for (let i = 39; i >= 15; i--) { f.exec('B'); assert.equal(sig(), seen[i]); }
  for (let i = 16; i <= 40; i++) { f.exec('G'); assert.equal(sig(), seen[i]); }
});

test('monitor commands', () => {
  const f = new Facility(), out = [];
  f.onPrint = s => out.push(s);
  f.exec('SPEED=7'); f.exec('GO TO N = 150'); while (f.running) f.pump(0);
  assert.ok(f.dec.N >= 150); assert.ok(out.includes('READY'));
  f.exec('RESTART AT N=120'); assert.equal(f.dec.N, 100);
  f.exec('STEPS=5'); while (f.running) f.pump(0);
  f.exec('DATA AT N=400: 1000 7, * *, * *, * *');
  assert.equal(f.channel.received(400).num[0], 7);
  f.exec('SPEED=-2'); assert.equal(f.speed, -2); f.exec('SPEED=8'); assert.equal(out.at(-1), '?'); assert.equal(f.speed, -2);
  f.exec('BOGUS'); assert.equal(out.at(-1), '?');
  const r = f.findSearch(3);
  assert.ok(r && r.from <= r.n0 - 3 && f.dec.N === r.from);
});

test('Monte-Carlo metric (p. 29) is proportional to the 1965 IDIST table', () => {
  const bits = metricBits(estimateQ({ snr: 2.5 }));
  let sxy = 0, sxx = 0;
  bits.forEach((x, i) => { sxy += x * IDIST_1965[i]; sxx += x * x; });
  const scale = sxy / sxx;
  console.log('  bits', bits.map(x => x.toFixed(2)).join(' '), ' scale', scale.toFixed(2),
    ' fitted', bits.map(x => Math.round(x * scale)).join(' '));
  bits.forEach((x, i) => assert.ok(Math.abs(x * scale - IDIST_1965[i]) < 6, `pos ${i + 1}`));
});
