# Sequential Decoding Facility

A working re-implementation of the system in Charles W. Niessen's 1965 MIT Sc.D. thesis,
*An Experimental Facility for Sequential Decoding* (RLE TR 450 / Lincoln Lab TR 396): the Fano
sequential decoder of Fig. A-4 and the interactive tree display of Sec. III-B, as a single web page.

**Live:** https://pniessen.github.io/sequential-decoder/ — or open `index.html` in any browser. No install, no server.

**The thesis:** [PDF](https://ntrs.nasa.gov/api/citations/19660019223/downloads/19660019223.pdf) (79 pages, 4.5 MB) ·
[NASA Technical Reports Server record 19660019223](https://ntrs.nasa.gov/citations/19660019223).
Page numbers cited in this README and in the source comments are the report's own.

## Three modes

- **Replica** — the PDP-6 scope and teletype: phosphor display, typed monitor commands only, octal,
  16-node window, 512-branch store. Click the words `MOVE` / `DATA` on the scope as you would touch
  them with the light pen; hold the pointer on a node to intensify the path leading back from it.
- **Workbench** — same display and commands, plus buttons, sliders (speed, S/N, IT0), live
  histograms, drag to pan, wheel to zoom, hover to inspect a branch. Space = run/stop, G = step.
- **Explainer** — adds a plain-language caption for every step, the 1965 Fortran listing with the
  statements just executed lit up, colouring of branches that are off the true path, and
  **Find a search**: run fast with the display off until a search occurs, restart just before it
  from saved restart data, and replay it slowly (the procedure recommended on p. 24).

**Guided tour** (button at the top right, any mode): an 18-stop, three-minute walk-through that shades the page
around one feature at a time, magnifies the small details on the scope with a live ×2 lens, and drives the decoder
so each stop is a demonstration — including finding and replaying a wrong turn and re-creating Fig. 6. ← → to move, Esc to end.

Hover over (or keyboard-focus) any control, readout, chart, legend entry, or region of the scope —
threshold lines, register bits, ordered list, GEN table — for an explanation of what it is and why it matters.

## Monitor commands (Table A-2)

`RUN` `STOP` `G` `STEPS=n` `SPEED=0..7` `GO TO N=n` `MODE0` `MODE1` `OTHERS=1|0`
`RESTART AT N=n` `REPEAT` `STORE` `DATA AT N=n: value signal, ...` `DDT [IT0= SN= SEED= MSG= ISDM= IWLM= K=]`
`EXIT` `RESET` `HELP`

To reproduce Fig. 6: `DDT ISDM=0`, `MODE0`, `GO TO N=35000`, `EXIT`. Repeat with `DDT IT0=20` and `DDT IT0=100`.

## What is faithful, what is not

Faithful: the algorithm (statement labels 1–19 are the `switch` cases in `src/fano.js`), constraint
length 60, the P1/P2 parity nets, `SEQUENCE 1 (S, I, P1, P2)`, 8 orthogonal signals, ordered list of 4,
the `IDIST` metric table, IT0 = 50, `SCALE 32`, 256-node backup rings, the statistics definitions,
the monitor commands, the restart mechanism, the display layout.

Not in the original: the data. The 1965 facility played back tapes of real demodulator outputs;
here the channel is simulated (white Gaussian noise, √(2E/N₀) = 2.5), which the thesis lists as
future work. As a check, recomputing the metric from the formula on p. 29 with this simulated
channel gives 17, −13, −28, −41, −64 against the thesis' 17, −13, −29, −41, −64.

## Development

    node --test        # engine tests
    node build.mjs     # src/ -> index.html

Engine modules in `src/` are DOM-free: `rng` `coder` `channel` `metric` `fano` `stats` `treeStore`
`facility`; `display` and `app` are the browser side. Design notes: `docs/design.md`.
