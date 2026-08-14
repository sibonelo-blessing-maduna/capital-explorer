# Mathematics

Every formula, its derivation, and the exact place it lives in code — both the reference Python
implementation (`capital_framework/`) and this app's client-side TypeScript port
(`client/src/engine/*`). This mirrors the paper's own section numbers (2 through 4.4) so you can
read this alongside `Maduna_Capital_Partitioning_Framework.pdf` (served at `/paper.pdf`).

For *why* the engine is written the way it is (performance, why it's duplicated client-side
instead of calling a server), see `ARCHITECTURE.md` §5. This document is about the mathematics
itself, not the software engineering around it.

## Notation

- **n** — the number of events in the universe (`params.universe.length`, capped at `MAX_N`).
- **k** — the size of the subset of events actually modeled (`params.k`, capped at
  `MAX_K_FULL_DETAIL`). Choosing k events out of n creates one specific subset; the paper's outer
  question (which k-event subset out of the C(n,k) possible ones) is out of scope for the
  interactive explorer, which fixes the subset to "the first k events in your universe list," but
  is implemented in the Python reference (`objectives.py`'s `mean_variance_best_subset` /
  `mean_variance_search`, brute-forcing over `choose_subsets`).
- **O(e, outcome)** — the decimal odds for one outcome of one event: a winning unit stake returns
  `O` total. Implied probability of that outcome is `1/O`.
- **C** — one combination: a specific outcome assignment (1 or 2) for every event in the subset.
  There are exactly 2^k combinations for a size-k subset — every one of them mutually exclusive
  (exactly one can ever be the realized outcome).
- **O(C)** — the combination's combined odds, `prod(O(e_i, outcome_i))` over the k events in it.
- **p(C)** — the combination's combined *true* probability, `prod(trueProb(e_i, outcome_i))`,
  using each event's own `trueProbA` if supplied, else falling back to that event's own
  market-implied probability (i.e., assuming the market is efficient for that one event).
- **P** — total capital to allocate (`params.capital`).
- **B(C)** — the stake allocated to combination C. Every strategy in Sec 4 is a different rule for
  computing B(C) across the 2^k combinations.

## Section 2 — Event space and the combinatorial space

Each event is binary: exactly two outcomes, each with its own decimal odds. The implied
probability of an outcome is `1/O`. A real market prices both outcomes so their implied
probabilities sum to slightly more than 1 (`Sec(e,1) + Sec(e,2) > 1`) — that excess is the
bookmaker's margin, the "vig." (`client/src/engine/events.ts`'s `impliedProb`, `oddsFor`.)

Choosing a k-event subset and predicting an outcome for every event in it produces exactly `2^k`
distinct combinations — a Boolean hypercube, since each event contributes one independent binary
choice. This is `generateCombinations()` in `events.ts` (Python: `generate_combinations` in
`events.py`), which iterates a k-bit counter (`mask` from `0` to `2^k - 1`) rather than recursing:
bit `i` of `mask` selects outcome 1 or 2 for event `i`.

Because each event's outcome is chosen independently of the others when building one combination,
`p(C)` factors as a plain product — this is the actual computational benefit of event-level
independence (Sec 4.1's covariance module docstring flags that the *combinations'* covariance
matrix does **not** inherit this sparsity — see §4.1 below).

The growth of `2^k` is the reason `k` is capped at `MAX_K_FULL_DETAIL = 14` in this app (see
`ARCHITECTURE.md` §5) and why the app also tracks `C(n,k)` (`nChooseK` in `combinatorics.ts`) as a
reminder that the paper's *outer* search — which k-sized subset to use — grows even faster, since
there are `C(n,k)` candidate subsets, each requiring its own `2^k`-sized inner computation.

## Section 3 — The weighting function

```
W(C) = (1 / O(C)) ^ alpha
B(C) = P * W(C) / sum_{C'} W(C')
```

`W(C)` weights each combination by its market-implied probability, raised to a tuning exponent
alpha ∈ [0, ∞). Normalizing across all 2^k combinations turns `W` into `B`, the actual capital
allocated. Three regimes:

- **alpha = 1**: proportional to implied probability — see the special case below.
- **alpha > 1**: concentrates stake on favorites (higher implied probability); as alpha → ∞, all
  stake collapses onto the single most probable combination.
- **alpha < 1**: flattens toward a uniform split; alpha = 0 is exactly uniform (`W(C) = 1` for
  every C, since `x^0 = 1` regardless of `x`).

Code: `weight()` and `allocate()` in `weighting.ts` (Python: `weighting.py`, identical formula).

### The alpha = 1 guaranteed hedge

Define the **book load** `S = sum_C (1/O(C))`, the sum of implied probabilities across all 2^k
combinations. At exactly alpha = 1:

```
B(C) = P * (1/O(C)) / S
```

so the payout *if C wins* is

```
B(C) * O(C) = P * (1/O(C)) / S * O(C) = P / S
```

— independent of which C actually wins. Every combination pays back exactly `P/S` if it occurs,
so the portfolio's payout is deterministic: variance is exactly zero, for *any* subset, *any* n,
*any* k. This is a mathematically guaranteed hedge, not an approximation.

Whether that guaranteed outcome is good news depends on `S`:

- Real markets have a vig, so every event's implied probabilities sum to slightly over 1, which
  (since `p(C)` for combinations multiplies across independent events) pushes `S` — a sum over
  2^k terms each shrunk by that same per-event margin compounded k times — to be greater than 1.
  `S > 1` means `P/S < P`: a guaranteed *loss* of `P - P/S`, exactly the "cost of certainty" the
  vig imposes.
- A mispriced market with `S < 1` would make this a guaranteed *arbitrage profit* — `P/S > P` with
  zero risk. The explorer's "why alpha=1 is special" callout on the Weighting panel computes `S`
  live from whatever odds you enter, specifically so you can see this cross over if you enter odds
  that don't carry a vig.

Code: `computeAlphaOneHedge()` in `engine/index.ts`; verified in `scripts/verify-engine.ts`
("alpha=1 hedge book load," "alpha=1 hedge deterministic return," and "alpha=1 payouts identical
across combos" — the last of which checks `max(B(C)*O(C)) - min(B(C)*O(C))` is at floating-point
zero across every combination, not just approximately equal).

## Section 4.1 — Mean-variance optimization

Treat each combination C as a random variable `X_C`: it pays `O(C)` if C is the realized outcome,
0 otherwise. Then:

```
mu_C  = E[X_C]        = O(C) * p(C)
Sigma_CC' = Cov(X_C, X_C')
```

Since the 2^k combinations are mutually exclusive outcomes of one partition (exactly one is ever
realized), every pair has a strictly negative covariance — not just pairs that happen to share an
underlying event:

```
Sigma_CC  = O(C)^2 * p(C) * (1 - p(C))              (variance, i.e. C with itself)
Sigma_CC' = -O(C) * O(C') * p(C) * p(C')   for C != C'
```

**This is dense, not sparse.** It's tempting to assume that because the underlying *events* are
independent, the covariance matrix of the *combinations* must inherit that independence and be
sparse. It doesn't: event-level independence is what makes each `p(C)` cheap to compute (a plain
product, §2 above) — it says nothing about the relationship between different combinations, which
is governed entirely by mutual exclusivity, not by which events they happen to share. The Python
reference's `objectives.py` module docstring flags this explicitly as a place where the paper's
prose ("Sigma is mathematically sparse") doesn't match the actual mathematics, and both
implementations compute the dense form.

The optimization is standard mean-variance:

```
max_{w in simplex}  mu^T w - lambda * w^T Sigma w
```

over portfolio weights `w` (one per combination, `sum(w) = 1`, `w >= 0`), for a risk-aversion
coefficient `lambda >= 0`. As `lambda -> infinity`, the optimal `w` converges to exactly the same
zero-variance allocation that alpha=1 produces exactly (§3) — mean-variance and the guaranteed
hedge are the same fixed point in the risk-infinite limit, verified in `verify-engine.ts`
("mean-variance lambda=100 expected return matches hedge" / "...variance -> 0").

### Solving it: Python vs. TypeScript

The Python reference (`objectives.py`'s `mean_variance_weights`) solves this as a small QP via
`scipy.optimize.minimize` (SLSQP) — fine for offline use, but calling into a numerical solver on
every slider tick is not an option for a client-side, zero-latency UI.

The TypeScript engine (`meanVariance.ts`) instead uses **Frank-Wolfe** (conditional gradient),
which only needs the gradient of the objective, `mu - 2*lambda*(Sigma w)`, at each iterate, and a
linear-minimization step over the simplex (which for a linear objective is just "put all mass on
the single best coordinate," an O(n) argmax). The one expensive-looking piece is `Sigma w`, an
O(n²) matrix-vector product if you materialize the dense Sigma — but Sigma's specific structure
here (rank-2-plus-diagonal, from the `-O_iO_jp_ip_j` outer-product form) collapses to an O(n)
closed form:

```
(Sigma w)_i = mu_i * (O_i * w_i - S),   where S = mu . w
```

**Derivation.** Write `Sigma_ij = -O_i O_j p_i p_j` for `i != j` and `Sigma_ii = O_i^2 p_i - O_i^2
p_i^2 = O_i^2 p_i - O_i p_i * O_i p_i`. Note `mu_i = O_i p_i`, so `Sigma_ii = O_i * mu_i - mu_i^2`.
Then for any i:

```
(Sigma w)_i = Sigma_ii * w_i + sum_{j != i} Sigma_ij * w_j
            = (O_i*mu_i - mu_i^2) * w_i - sum_{j != i} O_i * mu_i * p_j * O_j... 
```

more directly: since `Sigma_ij = -O_i p_i * O_j p_j = -mu_i * (O_j p_j)` for `i != j`, and folding
the `i=j` term in by writing `Sigma_ii = mu_i*(O_i - mu_i)`:

```
(Sigma w)_i = mu_i * (O_i - mu_i) * w_i - mu_i * sum_{j != i} mu_j w_j
            = mu_i * O_i * w_i - mu_i * mu_i * w_i - mu_i * (S - mu_i w_i)     [S = sum_j mu_j w_j]
            = mu_i * O_i * w_i - mu_i * S
            = mu_i * (O_i * w_i - S)
```

which is exactly the identity used in code. This turns every Frank-Wolfe iteration from O(n²) into
O(n): compute `S = mu . w` once (O(n)), then every entry of the gradient is an O(1) formula. This
is what makes 400 Frank-Wolfe iterations at k=14 (16,384 combinations) run in ~15-25ms instead of
the ~300ms an array-allocating O(n²) port measured at during development.

**Correctness check, not just speed.** Before trusting this identity as the hot path, it was
verified against the naive O(n²) direct computation (`quadraticForm()` / `sigmaDotW()` in
`meanVariance.ts` — the same function is used both for the fast path *and* to compute the final
reported variance, and `verify-engine.ts` cross-checks the Frank-Wolfe result's implied return and
variance against the known alpha=1 hedge numbers at high lambda) to machine precision — this is
the sort of "clever O(n) trick" that's exactly the kind of thing that's easy to get subtly wrong,
so it's checked, not just asserted.

The dense `Sigma` matrix is still materialized (`denseSigma()`) purely for the heatmap display,
and only up to k=6 (64×64) — past that it would be a lot of numbers to render usefully, though the
O(n) identity above never needs it at any k.

## Section 4.2 — Principal protection

Guarantee the bankroll back if the single most probable combination (by market-implied
probability — `C_favorite`, the one with the smallest `O(C)`) occurs:

```
B(C_favorite) = P / O(C_favorite)
```

since `B(C_favorite) * O(C_favorite) = P` by construction — betting exactly this amount returns
exactly `P` if the favorite hits, regardless of anything else. The remaining capital,
`P - B(C_favorite)`, is spread across every other combination using the Sec 3 weighting function
at a chosen alpha.

**Tuning alpha for the remainder.** The paper specifies the remainder should be allocated
"maximizing alpha" but doesn't pin down a stopping rule — pushed to infinity, alpha simply
collapses all remaining stake onto the single next-most-probable combination, which usually isn't
actually the best expected-value outcome once you account for how thin that concentration makes
every *other* combination's stake. Both implementations give this a concrete, optimizable meaning:
search alpha for the value that maximizes the remainder's expected profit under each combination's
*true*-probability model:

```
EV(alpha) = sum_{C != C_favorite} p(C) * B(C; alpha) * O(C)  -  remaining_capital
```

If the market's odds and your own true-probability model agree exactly (`trueProbA` unset, so
`p(C)` equals the market-implied probability for every event), this EV is maximized at whatever
alpha reproduces the market's own weighting most closely — pushing alpha away from that point
makes EV *worse*, not better, which is the substance of the "tuning alpha only helps if you and
the market agree" explanation on the Principal Protection panel.

The Python reference (`optimize_alpha_for_principal_protection`) solves this with
`scipy.optimize.minimize_scalar` (bounded Brent's method). The TypeScript port
(`optimizeAlphaForPrincipalProtection` in `principalProtection.ts`) uses **golden-section search**
instead — no external numerical library, and the search only needs to assume the objective is
unimodal on `[0, alphaMax]` (true here: EV is a smooth function of one weighting exponent with a
single interior or boundary maximum), which golden-section search exploits to find the optimum in
~60 function evaluations regardless of the desired precision's order of magnitude, each evaluation
itself an O(n) pass (`makeEvEvaluator`'s reused-buffer evaluator) rather than a full re-allocation
of the remainder's weighting from scratch. A further constant-factor win: `Math.pow(x, alpha)`
recomputes `ln(x)` internally on every call even when `x` doesn't change across the search, so the
evaluator precomputes `ln(1/O(C))` once outside the search loop and uses `exp(alpha * lnX)`
instead.

## Section 4.3 — The barbell strategy

Split capital `P` into two pools modeled at two different subset sizes: a small `k1` "safe" pool
and a larger `k2` "risk" pool (the two pools' underlying events are assumed not to overlap — the
`k1 << k2` framing from the paper). Each pool is internally allocated by the Sec 3 weighting
function at its own alpha (`alphaSafe`, `alphaRisk`), giving each pool a per-unit expected return
and variance (`poolStats()` in `barbell.ts` / `_pool_stats` in Python — literally "run the Sec 3
allocation on a notional 1 unit of capital and read off its mean/variance").

Let `A`, `Vs` be the safe pool's per-unit expected return and variance, and `B`, `Vr` the risk
pool's. For a safe-capital ratio `r ∈ [0,1]` (so `r*P` goes to the safe pool, `(1-r)*P` to risk):

```
max_{r}  r*A + (1-r)*B - lambda*(r^2*Vs + (1-r)^2*Vr)
```

This is the same mean-variance criterion as Sec 4.1, now over the single scalar `r` instead of a
full weight vector. The Python reference treats this as a generic 1-D bounded optimization
(`minimize_scalar`). The TypeScript port instead recognizes the objective is exactly quadratic and
concave in `r` (for `lambda > 0`) and solves it in closed form by setting the derivative to zero:

```
d/dr [ r*A + (1-r)*B - lambda*(r^2*Vs + (1-r)^2*Vr) ] = 0
  A - B - lambda*(2*r*Vs - 2*(1-r)*Vr) = 0
  r* = (A - B + 2*lambda*Vr) / (2*lambda*(Vs + Vr))
```

clamped to `[0, 1]` (the unconstrained optimum can fall outside the feasible range, in which case
the true constrained optimum is at the nearer boundary, since the objective is concave). The
`lambda <= 0` case is handled separately as a pure-EV boundary solution (`r=1` if `A >= B` else
`r=0`, since with no variance penalty the best pool wins outright). This closed form was verified
against `scipy.optimize.minimize_scalar`'s numerical answer (`verify-engine.ts`'s "barbell ratio at
lambda=1" check) before being trusted.

The pool with genuinely lower variance wins as risk-aversion (`lambda`) rises — and that is *not*
always the pool with the smaller `k1`, since variance here depends on the actual odds/probabilities
in each pool's specific events, not on subset size directly.

## Section 4.4 — Maximum entropy distribution

Find the highest-entropy (most spread-out) allocation that still hits a minimum required return
`tau`:

```
max_{B(C)}  -sum_C B(C) ln B(C)
s.t.        sum_C B(C) = P
            sum_C B(C) * O(C) * p(C) = P * (1 + tau)
```

With one normalization constraint and one linear expectation constraint, the entropy-maximizing
distribution is a standard result from the exponential (Gibbs/Boltzmann) family — the same shape
that arises from maximum-entropy arguments in statistical mechanics:

```
B(C) = P * exp(beta * g(C)) / sum_{C'} exp(beta * g(C')),   g(C) = O(C) * p(C)
```

for the unique Lagrange multiplier `beta` that satisfies the return constraint.
`beta = 0` recovers the exactly-uniform distribution (every `B(C) = P / 2^k`), which happens
precisely when `tau` equals the return the uniform allocation itself would achieve; `beta > 0`
tilts weight toward higher-`g(C)` (higher-return) combinations to hit a `tau` above that baseline,
and `beta < 0` tilts away from them to hit a `tau` below it. Entropy is maximal at `tau =
uniform's own return` and falls off symmetrically as `tau` is pushed toward either the maximum or
minimum achievable return (at which point entropy collapses to zero — all stake on the single
extreme combination).

**Feasibility.** The achievable-return ratio `sum(B(C)g(C))/P` is bounded by `[min_C g(C), max_C
g(C)]` — no beta can push the weighted average outside the range of the underlying values.
`feasibleTauRange()` computes this bound directly (`[min(g) - 1, max(g) - 1]`) and both the server
side default `tau` value and the client's slider (`ParameterPanel.tsx`) clamp to it, and
`computeAll()` catches an infeasible `tau` and returns `null` for the max-entropy result rather
than throwing, so a slider drag through an infeasible region degrades to "this panel has nothing
to show right now" instead of a crash.

**Solving for beta.** Both implementations solve the same scalar root-finding problem — the
achieved-return ratio is monotonically increasing in beta, so it's a textbook bisection target.
The Python reference uses `scipy.optimize.brentq`; the TypeScript port (`maxEntropyAllocate` in
`maxEntropy.ts`) uses plain bisection (50 iterations — far more precision than the display needs,
chosen deliberately low to keep this stage cheap; it was originally 100 iterations with `.map()`/
`.reduce()` allocation on every step, reduced as part of the same performance pass described in
`ARCHITECTURE.md` §5) over a single reused `Float64Array` scratch buffer rather than reallocating
arrays on every bisection step.

## Cross-checks

`client/scripts/verify-engine.ts` is the living cross-check between this document's formulas, the
Python reference implementation, and the TypeScript engine actually shipped to the browser. It
runs 9 checks (allocation sums to capital; the alpha=1 hedge's book load, deterministic return, and
exactly-equal payouts; mean-variance's high-lambda convergence to that same hedge; principal
protection's breakeven; the barbell closed-form ratio against `scipy`'s numerical answer; max
entropy's beta=0 uniform baseline) and is run after every change to the engine — see
`ARCHITECTURE.md` §5 for how it was used to validate each performance rewrite didn't silently
change an answer.
