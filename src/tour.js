// Guided tour: shades the page around one feature at a time, magnifies the small things
// inside the scope with a live lens, and drives the facility so each stop is a demonstration.

const TOUR_STEPS = api => [
  {
    title: 'A 1965 experiment, running again',
    body: 'In 1965 Charles W. Niessen built a system at MIT for studying <b>sequential decoding</b> — a way of pulling a message out of a noisy radio signal by <em>searching a tree of possibilities</em>, guessing forward while the evidence is good and backing up when it turns bad. This page is a working re-implementation of his decoder and of the display he built to watch it think. The tour takes about three minutes.',
    enter: () => { api.setMode('explainer'); api.cmd('STOP'); },
  },
  {
    region: 'all', title: 'The tree display',
    body: 'Every transmitted bit is a fork in a tree: 0 or 1. The decoder walks the tree from left to right, one bit per step. <b>Height is a running score</b> — how well the path so far explains the noisy signal that was received. A good guess climbs gently; a bad one drops steeply. It is running now.',
    enter: () => { api.setMode('explainer'); api.cmd('RESET'); api.cmd('SPEED=4'); api.cmd('RUN'); },
  },
  {
    region: 'dot', lens: true, title: 'The path being searched',
    body: 'The bright line is the decoder’s current best guess at the message; the dot is where it stands. His display drew this path brighter than everything else so the eye could follow it. Most of the time the decoder simply walks forward like this — about two branch evaluations per bit, however long the code.',
    enter: () => api.ensureRunning(4),
  },
  {
    region: 'threshold', lens: true, title: 'The threshold',
    body: 'The one idea that makes the Fano algorithm work. The score must stay <b>above this line</b>. As the decoder makes progress on new ground the line ratchets up behind it, in steps of IT0 = 50. When every path forward falls below it, the decoder backs up — and if that fails too, lowers the line one step and tries again. No list of alternatives is kept; this line is nearly all the memory it needs.',
    enter: () => api.ensureRunning(4),
  },
  {
    region: 'register', lens: true, title: 'The coder’s shift register',
    body: 'Top row: the bit guessed for each branch. Second row: the channel signal (0–7) the coder assigns to it — the bit plus two parity checks computed over the <b>last 60 bits</b>. Because each signal depends on 60 earlier guesses, one wrong bit poisons everything after it, and the score of a wrong path soon collapses. That is how the decoder finds its mistakes.',
    enter: () => api.ensureRunning(3),
  },
  {
    region: 'list', lens: true, title: 'What the receiver heard',
    body: 'For each bit the receiver measures 8 voltages, one per possible signal, and keeps only the <b>4 largest</b>, in order — his “ordered list”, a compromise between keeping everything and keeping only the winner. A branch scores +17 if its signal tops the list, −13, −29 or −41 if lower, −64 if absent. Beside it, GEN shows which signal the coder would send for bit 0 and for bit 1.',
    enter: () => { api.cmd('STOP'); api.stepToBranch(); },
  },
  {
    target: '#math', title: 'The arithmetic, step by step',
    body: 'Every decision the decoder makes is three lines of arithmetic, shown here in the program’s own variable names. The branch’s <b>metric λ</b> comes from where its signal sits on the receiver’s list; it is added to the running total <b>L</b> to give the trial total <b>LT</b>; and the branch is <b>accepted only if LT ≥ IT</b>, the threshold. The last line shows what follows — threshold raised, back up, or threshold lowered. Use <b>◀ Back</b> and <b>Step ▶</b> under the display (or the ← → keys once the tour is over) to go one decision at a time in either direction, or drag the speed slider down to 4 or 8 seconds a step.',
    enter: () => { api.cmd('STOP'); api.stepToBranch(); },
  },
  {
    region: 'all', title: 'A wrong turn',
    body: 'Now the interesting part. The decoder has just run ahead with the display off, found a place where noise sent it into trouble, rewound using saved restart data, and is replaying it slowly — exactly the procedure the thesis recommends. Watch the score sink to the threshold, the decoder back up and try second-best branches (the stubs that hang down), and finally recover. <b>Orange</b> marks branches off the true path — something only we can see. It is playing at one step a second; the <b>speed slider under the display</b> slows it to as little as one step every 8 seconds, and <b>Step</b> advances by hand.',
    enter: () => api.find(),
  },
  {
    target: '#caption', title: 'Narration, and the truth',
    body: 'Each step is described in plain language here. The last line is the truth about whether the decoder is on the right path — knowledge it does not have. Niessen’s own conclusion was that <em>watching</em> the algorithm gave “a far better feeling for” its behaviour than any printout could.',
    enter: () => api.ensureRunning(2),
  },
  {
    target: '.listing', title: 'The original program',
    body: 'This is his decoder as printed in Fig. A-4 of the thesis, in the extended Fortran he created so that communications students — not programmers — could write decoding algorithms. The statements executed in the last step light up. The code running this page is a statement-for-statement port with the same labels, 1 to 19.',
    enter: () => api.ensureRunning(2),
  },
  {
    target: '.controls', title: 'Running the machine',
    body: 'Run, single-step, change speed, or jump straight to the next search. Every button types the 1965 monitor command it stands for on the teletype below — <code>RUN</code>, <code>G</code>, <code>SPEED=5</code>, <code>REPEAT</code> — so you pick up his command language as you go.',
    enter: () => api.cmd('STOP'),
  },
  {
    target: '.params', title: 'The channel and the one tuning knob',
    body: 'Lower the signal-to-noise ratio and searches become frequent and deep; raise it and the decoder almost never backs up. IT0, the threshold spacing, is the algorithm’s one tuning knob: too small and every dip sets off a search, too large and the decoder wanders far down wrong paths. The thesis found 50 best.',
  },
  {
    target: '#readouts', title: 'The decoder’s vital signs',
    body: 'Depth, score, threshold, and the statistics the thesis set out to measure. Hover over any of them — or over anything else on the page — for an explanation.',
  },
  {
    target: '.charts', title: 'Figure 6, re-created',
    body: 'The display is now off and the decoder is running at full speed through 30,000 more bits. The upper chart is the thesis’ Fig. 6: how many searches had to back up at least N nodes. The nearly <b>straight tail on log–log axes is a power law</b> — deep searches are rare but never rare enough, which is why a real decoder’s buffer eventually overflows. Measuring that tail was the point of the whole facility.',
    enter: () => { api.setMode('explainer'); api.cmd('DDT ISDM=0'); api.cmd('MODE0'); api.cmd('GO TO N=' + (api.f.maxN + 30000)); },
    leave: () => { api.cmd('STOP'); api.cmd('MODE1'); api.cmd('DDT ISDM=25'); },
  },
  {
    target: '.tty', title: 'The teletype',
    body: 'The monitor’s printed record — here, the statistics just collected, printed by <code>EXIT</code>. You can type any command yourself: try <code>GO TO N=50000</code>, <code>OTHERS=1</code>, <code>RESTART AT N=30000</code>, or <code>HELP</code>.',
    enter: () => api.cmd('EXIT'),
  },
  {
    region: 'all', title: 'Workbench mode',
    body: 'The same facility with a modern instrument’s comforts: <b>drag</b> to pan around the tree, <b>scroll</b> to zoom, <b>double-click</b> to return to the decoder, and <b>hover over the end of any branch</b> to see its bit, its signal and its score.',
    enter: () => { api.setMode('workbench'); api.cmd('SPEED=4'); api.cmd('RUN'); },
  },
  {
    region: 'all', title: 'Replica mode',
    body: 'And this is roughly what he saw: a phosphor scope on the Project MAC PDP-6, sixteen nodes of tree, numbers in octal, a teletype, and no buttons at all. Both hypotheses at each node are being drawn (<code>OTHERS=1</code>), which gives pictures very like the photographs in Fig. 5 of the thesis.',
    enter: () => { api.setMode('replica'); api.cmd('OTHERS=1'); api.cmd('SPEED=4'); api.cmd('RUN'); },
  },
  {
    region: 'words', lens: true, title: 'The light pen',
    body: 'In 1965 you pointed at the screen with a light pen. Click <b>MOVE</b> for the eight-pointed star, and hold on one of its tips to drift the tree; click <b>DATA</b>, then one of the dots that appear along the top, to see what the receiver heard at that node. Hold the pointer on any node to brighten the path leading back from it.',
    enter: () => { api.setMode('replica'); api.ensureRunning(4); },
  },
  {
    target: 'header nav', title: 'That’s the tour',
    body: 'Switch modes here at any time, or take the tour again. A good next step: <b>Explainer → Find a search</b>, then press <b>Step</b> and read each caption. Any unfamiliar word is in the <b>Glossary</b>, and the thesis itself is linked at the top of the page.',
    enter: () => { api.cmd('STOP'); api.cmd('OTHERS=0'); api.setMode('explainer'); },
  },
];

export class Tour {
  constructor(api) {
    this.api = api; this.active = false; this.i = 0; this.cur = null; this.curCard = null;
    this.steps = TOUR_STEPS(api);
    const mk = (tag, id) => { const e = document.createElement(tag); e.id = id; e.hidden = true; document.body.appendChild(e); return e; };
    this.shade = mk('div', 'tourShade');
    this.lens = mk('canvas', 'tourLens');
    this.card = mk('div', 'tourCard');
    this.card.setAttribute('role', 'dialog'); this.card.setAttribute('aria-label', 'Guided tour');
    this.card.innerHTML = '<button class="x" aria-label="End tour">×</button><h3></h3><p></p>'
      + '<div class="nav"><span class="count"></span><button class="back">Back</button><button class="next primary">Next</button></div>';
    this.card.querySelector('.x').onclick = () => this.end();
    this.card.querySelector('.back').onclick = () => this.go(this.i - 1);
    this.card.querySelector('.next').onclick = () => this.go(this.i + 1);
    document.addEventListener('keydown', e => {
      if (!this.active || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (e.key === 'Escape') this.end();
      else if (e.key === 'ArrowRight') this.go(this.i + 1);
      else if (e.key === 'ArrowLeft') this.go(this.i - 1);
      else return;
      e.preventDefault(); e.stopPropagation();
    }, true);
  }

  start() {
    this.active = true; this.cur = this.curCard = null; this.i = -1;
    this.shade.hidden = this.card.hidden = false;
    document.body.classList.add('touring');
    this.go(0);
  }
  end() {
    if (!this.active) return;
    const s = this.steps[this.i];
    if (s && s.leave) s.leave();
    this.active = false;
    this.shade.hidden = this.card.hidden = this.lens.hidden = true;
    document.body.classList.remove('touring');
    this.api.onEnd();
  }
  go(n) {
    if (n < 0) return;
    const prev = this.steps[this.i];
    if (prev && prev.leave) prev.leave();
    if (n >= this.steps.length) { this.i = -1; this.end(); return; }
    this.i = n;
    const s = this.steps[n], c = this.card;
    if (s.enter) s.enter();
    c.querySelector('h3').textContent = s.title;
    c.querySelector('p').innerHTML = s.body;
    c.querySelector('.count').textContent = `${n + 1} of ${this.steps.length}`;
    c.querySelector('.back').disabled = n === 0;
    c.querySelector('.next').textContent = n === this.steps.length - 1 ? 'Finish' : 'Next';
    c.querySelector('.next').focus({ preventScroll: true });
    const el = s.region ? this.api.scope.cv : s.target && document.querySelector(s.target);
    if (el) el.scrollIntoView({ block: innerWidth < 760 ? 'start' : 'nearest', behavior: 'smooth' });
    this.lens.hidden = !s.lens;
  }

  // Rectangle (viewport px) of the thing this step is about, or null for a centred card
  targetRect(s) {
    const cv = this.api.scope.cv;
    if (s.region) {
      const r = cv.getBoundingClientRect(), ox = r.left + cv.clientLeft, oy = r.top + cv.clientTop;
      const g = this.api.scope.region(s.region, this.api.f);
      return { x: ox + g.x, y: oy + g.y, w: g.w, h: g.h, g, avoid: r };
    }
    const el = s.target && document.querySelector(s.target);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height, avoid: r } : null;
  }

  // Called every animation frame
  frame() {
    if (!this.active) return;
    const s = this.steps[this.i], t = this.targetRect(s), W = innerWidth, H = innerHeight, pad = 8;
    const want = t ? { x: t.x - pad, y: t.y - pad, w: t.w + 2 * pad, h: t.h + 2 * pad } : { x: W / 2, y: H / 2, w: 0, h: 0 };
    this.cur = ease(this.cur, want, 0.3);
    Object.assign(this.shade.style, { left: this.cur.x + 'px', top: this.cur.y + 'px', width: this.cur.w + 'px', height: this.cur.h + 'px' });
    this.shade.classList.toggle('none', !t);

    let avoid = t ? t.avoid : null;
    if (s.lens && t) {
      const cv = this.api.scope.cv, dpr = cv.width / cv.clientWidth, cr = t.avoid;
      const z = Math.min(2, (cr.width - 24) / t.w), lw = t.w * z, lh = t.h * z;
      const e = this.cur, ex = e.x + pad, ey = e.y + pad;      // hang the lens off the (eased) spotlight so they move together
      const lx = Math.max(cr.left + 12, Math.min(cr.right - lw - 12, ex + t.w / 2 - lw / 2));
      const above = t.y + t.h / 2 > cr.top + cr.height / 2;
      const ly = above ? Math.max(cr.top + 12, ey - lh - 24) : Math.min(cr.bottom - lh - 12, ey + t.h + 24);
      if (this.lens.width !== Math.round(lw * dpr) || this.lens.height !== Math.round(lh * dpr)) { this.lens.width = Math.round(lw * dpr); this.lens.height = Math.round(lh * dpr); }
      Object.assign(this.lens.style, { left: lx + 'px', top: ly + 'px', width: lw + 'px', height: lh + 'px' });
      const c = this.lens.getContext('2d');
      c.imageSmoothingEnabled = true;
      c.drawImage(cv, t.g.x * dpr, t.g.y * dpr, t.g.w * dpr, t.g.h * dpr, 0, 0, this.lens.width, this.lens.height);
    }

    const card = this.card, sheet = W < 760;
    card.classList.toggle('sheet', sheet);
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 18;
    let x, y;
    if (sheet) { x = 8; y = H - ch - 8; }
    else if (!avoid) { x = (W - cw) / 2; y = (H - ch) / 2; }
    else if (avoid.right + gap + cw <= W - 8) { x = avoid.right + gap; y = avoid.top; }
    else if (avoid.left - gap - cw >= 8) { x = avoid.left - gap - cw; y = avoid.top; }
    else if (avoid.bottom + gap + ch <= H - 8) { x = avoid.left; y = avoid.bottom + gap; }
    else if (avoid.top - gap - ch >= 8) { x = avoid.left; y = avoid.top - gap - ch; }
    else { x = t.x + t.w / 2 > W / 2 ? 16 : W - cw - 16; y = H - ch - 16; }   // no room beside it: the corner farthest from the feature
    x = Math.max(8, Math.min(W - cw - 8, x)); y = Math.max(8, Math.min(H - ch - 8, y));
    this.curCard = ease(this.curCard, { x, y, w: 0, h: 0 }, 0.25);
    card.style.left = this.curCard.x + 'px'; card.style.top = this.curCard.y + 'px';
  }
}

function ease(cur, want, k) {
  if (!cur) return { ...want };
  const o = {};
  for (const key of ['x', 'y', 'w', 'h']) { const d = want[key] - cur[key]; o[key] = Math.abs(d) < 0.5 ? want[key] : cur[key] + d * k; }
  return o;
}
