// Glossary of key terms. In definitions, {term} links to another entry and {term|shown text}
// links with different wording. `see` says where the thing appears on this page or in the thesis.

const GLOSSARY = [
  ['The problem', [
    ['Channel', 'Whatever carries the signal from transmitter to receiver — a radio link, a telephone line — and adds {noise} along the way. The 1965 facility replayed tape recordings made on real channels; this page simulates one.', 'Sliders: signal-to-noise'],
    ['Noise', 'Random disturbance added to the signal. Here it is “white Gaussian” noise — the hiss of thermal noise, equally strong at all frequencies — the standard model, and the one used for the test in the thesis (p. 28).'],
    ['Signal-to-noise ratio', 'How far the signal stands above the {noise}, written √(2E/N₀): E is the energy of one transmitted pulse, N₀ the noise power per unit bandwidth. The thesis used 2.5. At that level the receiver’s first choice is right about 84% of the time — far too unreliable on its own, which is what the code is for.', 'Slider: Signal-to-noise'],
    ['Coding theorem', 'Claude Shannon’s 1948 result: below a certain rate, the {channel capacity}, messages can be sent over a noisy channel with as few errors as you like. The proof shows good codes exist but gives no practical way to decode them — the gap sequential decoding was invented to close (p. 1).'],
    ['Channel capacity', 'The highest data {rate} at which reliable communication is possible at all on a given {channel}. Set by the noise, not by the equipment.'],
    ['Rate', 'Information bits delivered per use of the channel. Here R = 1 bit per {baud}: each transmitted signal carries one message bit, though it could have carried three — the other two are redundancy.'],
    ['R-comp', 'The computational cutoff rate: the practical speed limit of sequential decoding, somewhat below {channel capacity}. Below R-comp the average work per bit stays small no matter how long the code; above it, the average blows up. The test in the thesis runs at about 80% of R-comp (1 bit per baud against an R-comp of 1.2, p. 30).'],
    ['Baud', 'One use of the channel — one transmitted signal. In this example each {branch} of the tree is one baud.'],
  ]],
  ['The code', [
    ['Convolutional code', 'A code in which each transmitted signal depends on the current message bit <em>and</em> a stretch of earlier ones, produced by passing the message through a {shift register} with {parity net|parity nets}. Unlike a block code it has no beginning or end: encoding, and decoding, are continuous.', 'Thesis Fig. 2'],
    ['Shift register', 'A row of one-bit memory cells. Each new bit enters at the left and every older bit moves one place right; the oldest falls off the end. It holds the last 60 message bits, so each transmitted signal depends on 60 bits of history — which is why one wrong guess by the decoder spoils its predictions for the next 60 steps and gets found out.', 'Top row of digits on the scope'],
    ['Constraint length', 'The length of the {shift register}: 60 bits here (<code>CONSTRAINT IS 60</code>). The chance of an undetected decoding error falls exponentially as it grows, and — the attraction of sequential decoding — the decoding work does not grow with it.'],
    ['Parity net', 'A set of connections from chosen cells of the {shift register} to a modulo-2 adder, whose output is 1 if an odd number of those cells hold a 1. Two nets, P1 and P2, give two check bits per message bit. The octal constants in the program (<code>P1 = 7360 3601 …</code>) are their wiring lists.', 'Thesis Fig. A-1, p. 44'],
    ['Channel signal', 'One of 8 waveforms, numbered 0–7. The number is three bits: the message bit followed by the two {parity net} outputs (<code>SEQUENCE 1 (S, I, P1, P2)</code>).', 'Second row of digits on the scope'],
    ['Orthogonal signals', 'Waveforms chosen so that a filter matched to one gives no response to any other — for example, tones at different frequencies. With 8 of them the receiver gets 8 separate, independently noisy readings per {baud}.'],
    ['Matched filter', 'The best possible detector for a known waveform in noise. The receiver has one per signal; after each {baud} every filter puts out a voltage saying how strongly its signal seems to have been present (p. 12).'],
    ['Ordered list', 'What the decoder is told about each {baud}: the 4 largest of the 8 {matched filter} voltages, in order, and which signals they belong to. Niessen’s compromise between a “hard decision” (keep only the winner) and a “soft decision” (keep everything) — most of the benefit for a fraction of the storage (Sec. II-E).', 'Lower left of the scope'],
    ['GEN table', 'The two {channel signal|signals} the coder would produce from the current node: one if the next message bit is 0, one if it is 1. The decoder looks both up on the {ordered list}.', 'Lower left of the scope, beside the list'],
    ['Hypothesis', 'One candidate for what was sent on the next {branch}. A binary tree has two per node. <code>OTHERS=1</code> draws both.'],
  ]],
  ['The algorithm', [
    ['Tree', 'Every possible message, laid out as forks: at each {node} the next bit is 0 or 1. N bits make 2ᴺ paths, far too many to check one by one — hence a search.', 'Thesis Fig. 1'],
    ['Node', 'A point in the {tree} reached after some number of bits. Its depth, N, is that number.', 'Bottom-right number on the scope'],
    ['Branch', 'One step in the {tree} — one guessed message bit and the {channel signal} it implies. Drawn as a line segment whose slope is its {metric} increment.'],
    ['Path', 'A sequence of branches from the origin: one candidate message. The bright path on the display is the decoder’s current guess.'],
    ['Sequential decoding', 'Decoding by exploring the {tree} one {branch} at a time, steered by a running score, rather than comparing all possible messages. Invented by J. M. Wozencraft at MIT in 1957; Niessen was his student.'],
    ['Fano algorithm', 'R. M. Fano’s 1963 form of {sequential decoding}, and the one implemented here. It moves forward on the best-looking {branch} while the {metric} stays above a {threshold}, backs up to try alternatives when it does not, and lowers the threshold when nothing works. It remembers almost nothing, at the cost of sometimes re-tracing its steps.', 'Thesis Fig. 3; the program listing in Explainer mode'],
    ['Metric', 'The running score of a {path}: for each branch, the log-likelihood of what was received given the signal guessed, minus a bias equal to the {rate}. The bias is the clever part — it makes the score climb along the correct path (about +10 per node here) and sink along a wrong one (about −23, even taking the better of the two branches each time), so paths of different lengths can be compared. In the program: L (total), LMBD(N) (one branch), IDIST (the table 17, −13, −29, −41, −64, by position on the {ordered list}).', 'Height on the scope; thesis Eq. (3) and p. 29'],
    ['Threshold', 'The level the {metric} must stay at or above for a branch to be accepted (IT in the program). Raised as far as possible whenever the decoder reaches a node it has never visited; lowered one {threshold increment|step} when every available path falls below it.', 'The highlighted horizontal line'],
    ['Threshold increment', 'IT0: the spacing of the allowed {threshold} levels, and the algorithm’s one tuning knob. Too small and every dip triggers a shallow {search}; too large and the decoder goes far down wrong paths before noticing. The thesis tried 20, 50 and 100 and found 50 best (Fig. 6).', 'Slider: Threshold increment IT0'],
    ['FLAG', 'One bit of state that stops the algorithm from looping. Set when a branch fails; while set, the {threshold} may not be raised, because the decoder is on ground it has covered before. Cleared at the first genuinely new node (pp. 6, 54).', 'Readouts'],
    ['Search', 'What happens when the decoder cannot advance: it backs up and tries other branches. By the thesis’ definition a search begins at a failure to advance and ends when the decoder first gets beyond the node where it began (p. 48).', 'Button: Find a search'],
    ['Wrong turn', 'An advance along a branch that is not the true message, because noise made it look better. The decoder cannot tell at the time; the {shift register} ensures the {metric} collapses soon after, which sets off a {search} that undoes it.', 'Orange branches in Explainer mode'],
    ['Computation', 'One evaluation of a {branch} — one pass through statement 1 of the program. “Computations per node” is the cost of decoding one bit; it averages about 2 here.', 'Readouts'],
  ]],
  ['What the facility measured', [
    ['Search depth', 'How many nodes a {search} backs up from where it started. Its distribution is Fig. 6 of the thesis.', 'Upper chart'],
    ['Waiting line', 'Received {baud|bauds} queued while the decoder is busy searching. The thesis models a decoder 20 times faster than the channel (<code>COMPUTE WAITING LINE 20</code>): the line grows during long searches and drains afterwards.', 'Lower chart'],
    ['Buffer overflow', 'The failure that matters in practice. A real decoder stores the {waiting line} in a finite memory; if a {search} runs long enough to fill it, incoming data is lost and communication breaks down (p. 7). How often that happens depends on the tail of the search distribution — see {power law}.'],
    ['Power law', 'The number of searches deeper than N falls off as N to a negative power — a straight line on log–log axes — rather than exponentially. So very long searches are rare but never negligible. Predicted by J. E. Savage; Niessen’s measurements supported it (p. 34), and it was later proved to be inherent in sequential decoding.', 'The straight tail of the upper chart'],
    ['Bit error', 'A decoded bit that differs from the one sent. With a {constraint length} of 60 these essentially never occur; the practical limit is {buffer overflow}, not errors.', 'Readouts'],
  ]],
  ['The 1965 machine', [
    ['PDP-6', 'Digital Equipment Corporation’s 36-bit computer; the one at MIT’s {Project MAC}, installed October 1964, had 16,000 words of memory. Chosen because it was run hands-on by its programmer rather than in batches, had a good display, and came with a Fortran compiler that could be extended (pp. 11, 26).'],
    ['Project MAC', 'MIT’s pioneering computing laboratory, founded 1963 — the forerunner of today’s CSAIL. R. M. Fano was its first director, and made the PDP-6 available for this work.'],
    ['Scope', 'The PDP-6’s cathode-ray display, which drew points, characters and line segments under program control. Its picture had to be redrawn about 30 times a second to avoid flicker, which drove the design of the {tree store}.', 'Replica mode'],
    ['Light pen', 'A pen-shaped photocell held against the {scope}; the computer knew what it was pointing at by when it saw the beam. Used to move the picture, pick a node, and brighten a path — the mouse of its day.', 'Replica mode: the words MOVE and DATA'],
    ['Teletype', 'The printing keyboard terminal through which the operator typed {monitor} commands and the system printed its replies.', 'The strip at the bottom of the page'],
    ['Monitor', 'Niessen’s control program. It runs the user’s algorithm between display checkpoints, fetches data automatically, keeps {restart data}, collects statistics, and obeys commands such as <code>RUN</code>, <code>STEPS=</code>, <code>SPEED=</code>, <code>GO TO N=</code> (Table A-2, p. 61).'],
    ['Special language', 'Fortran II extended with some 48 statements for describing decoders — <code>GENERATE</code>, <code>SHIFT LEFT</code>, <code>ENTER BRANCH</code>, <code>BACKUP DEPTH IS 256 NODES</code> — so that communications students, not programmers, could write new algorithms. Added by extending the syntax table of DEC’s syntax-directed compiler (Sec. IV, Appendix D).', 'The program listing in Explainer mode'],
    ['Restart data', 'A saved copy of the decoder’s complete state, written every so many nodes, so that an interesting stretch can be run again and watched closely (<code>RESTART AT N=</code>, <code>REPEAT</code>). About ten restart points were kept (p. 49).', 'Button: Rewind'],
    ['Tree store', 'The “cross-threaded” list structure that remembers searched branches for the display: a loop of branches at each depth, each with a pointer back to its parent. It held 512 branches — about ten screen-widths — discarding the oldest first (Appendix C).', 'Readouts: Branches stored'],
    ['DEC-Tape', 'The PDP-6’s small magnetic tape, holding 73,800 words — enough for about 37,000 nodes of data with a list of 4. The facility’s main bottleneck (p. 16).'],
    ['Octal', 'Base-8 notation, natural for a 36-bit machine (12 octal digits per word). The original display showed signal numbers and voltages in octal; Replica mode does too.'],
    ['DDT', 'The PDP-6’s debugger, reachable from the {monitor}, used to examine and change values in a running program. Here <code>DDT IT0=20</code> and similar commands change parameters.'],
    ['MODE0 and SPEED=7', 'Two ways to run fast. <code>SPEED=7</code> stops drawing but goes on remembering the tree; <code>MODE0</code> switches the display program off entirely — fastest, for collecting statistics (p. 62).', 'Checkbox: Display on'],
  ]],
];

const slug = t => 'g-' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function initGlossary(button) {
  const dlg = document.createElement('dialog');
  dlg.id = 'glossary';
  const link = (m, term, text) => `<a href="#${slug(term)}">${text || term}</a>`;
  dlg.innerHTML = '<div class="ghead"><h2>Glossary</h2><input type="search" placeholder="Search terms…" aria-label="Search the glossary"><button class="x" aria-label="Close">×</button></div><div class="gbody">'
    + GLOSSARY.map(([group, terms]) => `<section><h3>${group}</h3><dl>` + terms.map(([term, def, see]) =>
      `<div class="gterm" id="${slug(term)}"><dt>${term}</dt><dd>${def.replace(/\{([^}|]+)(?:\|([^}]+))?\}/g, link)}${see ? `<span class="see">${see}</span>` : ''}</dd></div>`).join('') + '</dl></section>').join('')
    + '<p class="none" hidden>No matching terms.</p></div>';
  document.body.appendChild(dlg);

  const input = dlg.querySelector('input'), body = dlg.querySelector('.gbody');
  const filter = () => {
    const q = input.value.trim().toLowerCase();
    let any = false;
    dlg.querySelectorAll('section').forEach(sec => {
      let shown = 0;
      sec.querySelectorAll('.gterm').forEach(t => { const hit = !q || t.textContent.toLowerCase().includes(q); t.hidden = !hit; if (hit) shown++; });
      sec.hidden = !shown; any = any || shown > 0;
    });
    dlg.querySelector('.none').hidden = any;
  };
  const show = id => {
    if (!dlg.open) dlg.showModal();
    const el = id && dlg.querySelector('#' + CSS.escape(id));
    if (!el) return;
    input.value = ''; filter();
    el.scrollIntoView({ block: 'start' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  };
  input.addEventListener('input', filter);
  dlg.querySelector('.x').onclick = () => dlg.close();
  dlg.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#g-"]');
    if (a) { e.preventDefault(); show(a.getAttribute('href').slice(1)); }
    else if (e.target === dlg) dlg.close();                 // click on the backdrop
  });
  dlg.addEventListener('close', () => { body.scrollTop = 0; input.value = ''; filter(); button.focus(); });
  button.onclick = () => { show(); input.focus(); };
  if (/^#g-/.test(location.hash)) show(location.hash.slice(1));
  return { show };
}
