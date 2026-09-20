# Sequential Decoding Facility — modern re-implementation

Source: C. W. Niessen, *An Experimental Facility for Sequential Decoding*, MIT RLE TR 450 /
Lincoln Lab TR 396, 13 Sept 1965. Page references below are to the report's own page numbers.

## Goal

A single-page web app that re-implements the Fano sequential decoder of Fig. A-4 (pp. 55–57)
and the interactive tree display of Sec. III-B / Appendix C, with three switchable modes:

| Mode | Intent |
|---|---|
| **Replica** | PDP-6 scope look: phosphor vector display, typed teletype commands only, octal numbers, 16-node window, 512-branch store, on-screen MOVE / DATA "light pen" words. |
| **Workbench** | Same display and commands plus buttons, sliders (speed, S/N, IT0), live histograms, drag-pan, wheel-zoom, hover inspection. |
| **Explainer** | Workbench plus a plain-language caption per step, the 1965 program listing with the executing statements highlighted, truth colouring (wrong-path branches), and "find me a search" (run fast → restart before the search → replay slowly, the procedure recommended on p. 24). |

## Engine (DOM-free, `src/*.js`, tested with `node --test`)

- `rng` — integer hash + mulberry32 + Box–Muller. All randomness is a pure function of `(seed, n)`
  so restarts replay identically.
- `coder` — 60-bit shift register in two 30-bit words; parity nets P1/P2 from Fig. A-4
  (`7360 3601 4576 2426 3054`, `5431 2256 7722 3264 7642`, bit 1 = newest bit);
  `SEQUENCE 1 (S, I, P1, P2)` → 3-bit symbol → one of M = 8 signals.
- `channel` — the thesis' future-work item (p. 34): simulated channel. M orthogonal signals in white
  Gaussian noise; matched-filter output mean √(2E/N₀) (default 2.5) on the sent signal, unit variance;
  10-bit ADC code; ordered list of the ℓ = 4 largest (value, signal number). All-zero or random message.
  `DATA AT N=` overrides.
- `metric` — `IDIST = 17, −13, −29, −41, −64` by list position (5 = off list). For other S/N the table is
  recomputed from p. 29: `log2(M·qᵢ) − R` on-list, `log2(M·q_{ℓ+1}/(M−ℓ)) − R` off-list, qᵢ by Monte Carlo.
- `fano` — statement-for-statement port of Fig. A-4 as a `switch(pc)` state machine whose cases are the
  1965 statement labels 1–19. `step()` runs to the next checkpoint (A: ENTER BRANCH, B/D: WAIT,
  C: threshold lowered) and reports the statements visited. Rings of 256 (`BACKUP DEPTH IS 256 NODES`).
  `FIND`'s off-list tie-break is random-but-repeatable (p. 19).
- `stats` — `COMPUTE SEARCH DEPTH` (depth, grain 1; computations, grain 4; 128 bins) and
  `COMPUTE WAITING LINE 20` exactly as defined on pp. 20, 48–49.
- `treeStore` — searched branches by depth with parent back-pointers (App. C), re-search dedup,
  oldest-loop eviction (512 in Replica).
- `facility` — the monitor: `RUN STOP STEPS= G SPEED= GO TO N= MODE0 MODE1 OTHERS= DATA AT N=
  RESTART AT N= REPEAT STORE DDT EXIT N0= IO=`; restart snapshots (10 kept); halts
  `WAITING LINE IS n` / `SEARCH DEPTH IS n` (IWLM = 100, ISDM = 25) as in Fig. A-4.

## Display

x = depth, y = running metric, branch slope ∝ metric increment (`SCALE 32` → 45°). Current path bright,
searched branches dim, threshold lines every IT0 with the running threshold brighter, shift-register bits
and channel symbols across the top, ordered list + GEN table, depth ticks every 10, slow auto-drift.

## Build

`node build.mjs` inlines `src/style.css` and the JS modules into a single `index.html` that runs from disk.

## Verification

Noise-free channel → zero searches; S/N 2.5 → 35,000 nodes decoded without error; restart reproduces the
trajectory; Monte-Carlo metric table ∝ the 1965 IDIST table; browser check of a Fig. 5-style search.
