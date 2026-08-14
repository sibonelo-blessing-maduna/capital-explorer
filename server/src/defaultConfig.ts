/**
 * defaultConfig.ts — first-boot defaults for site_config.
 *
 * Only fills in keys that don't already exist, so an admin's edits made
 * through the safe config editor (routes/admin.ts) always win over these
 * defaults on every subsequent restart. This is what makes the "Explain"
 * panels and default parameter values editable without touching code.
 */
import { SiteConfig } from "./db";

const DEFAULT_UNIVERSE = [
  { name: "Team A vs B", oddsA: 1.85, oddsB: 2.05, trueProbA: 0.53 },
  { name: "Team C vs D", oddsA: 1.55, oddsB: 2.55, trueProbA: 0.6 },
  { name: "Team E vs F", oddsA: 2.2, oddsB: 1.75, trueProbA: 0.44 },
  { name: "Team G vs H", oddsA: 1.4, oddsB: 3.1, trueProbA: 0.68 },
  { name: "Team I vs J", oddsA: 2.6, oddsB: 1.55, trueProbA: 0.37 },
  { name: "Team K vs L", oddsA: 1.95, oddsB: 1.95, trueProbA: 0.5 },
];

const DEFAULT_PARAMS = { k: 3, alpha: 1.0, lambda: 2.0, tau: -0.05, capital: 10000 };

const DEFAULTS: Record<string, string> = {
  "defaults.universe": JSON.stringify(DEFAULT_UNIVERSE),
  "defaults.params": JSON.stringify(DEFAULT_PARAMS),
  "limits.maxN": "12",
  "limits.maxKFullDetail": "10",

  "explain.eventSpace":
    "Each event has exactly two outcomes, each with a decimal payout multiplier (its 'odds'). " +
    "The implied probability of an outcome is 1 / odds. Real markets price both outcomes so their " +
    "implied probabilities sum to slightly more than 1 — that excess is the bookmaker's margin (the 'vig').",

  "explain.combinatorialSpace":
    "Selecting k events out of your n-event universe creates a subset. Because each event is binary, " +
    "predicting an outcome for every event in that subset produces exactly 2^k distinct combinations — " +
    "a Boolean hypercube. Increasing k grows this hypercube exponentially, and it also grows the cost of " +
    "outer search over which k-event subset to use, since there are C(n,k) of them.",

  "explain.weightingFunction":
    "W(C) = (1/O(C))^alpha weights each combination by its market-implied probability, raised to a tuning " +
    "power alpha. Normalizing across all 2^k combinations gives B(C), the capital allocated to each. " +
    "alpha=1 is proportional to implied probability; alpha>1 concentrates on favorites; alpha<1 approaches " +
    "a uniform split.",

  "explain.alphaOneHedge":
    "At exactly alpha=1, the payout if any combination wins is identical no matter which one occurs: " +
    "B(C)*O(C) = P/S, where S is the sum of implied probabilities across all combinations. This makes the " +
    "portfolio's variance exactly zero — a mathematically guaranteed hedge. Since real markets have a vig " +
    "(S>1), this guaranteed outcome is a guaranteed small loss, not a profit; a mispriced market with S<1 " +
    "would make it a guaranteed arbitrage profit instead.",

  "explain.meanVariance":
    "Classic mean-variance portfolio theory applied to the 2^k combinations: maximize expected return minus " +
    "a risk-aversion coefficient (lambda) times variance. Because the combinations are mutually exclusive " +
    "outcomes of one partition (only one can ever occur), their covariance matrix is fully dense — betting " +
    "more on one combination always comes at the expense of every other. As lambda grows, the optimal " +
    "allocation converges to the same zero-variance hedge that alpha=1 produces exactly.",

  "explain.principalProtection":
    "Guarantees the bankroll back if the single most probable combination occurs, by staking exactly " +
    "P / O(C_favorite) on it. The remaining capital is spread across every other combination. Tuning how " +
    "concentrated that remainder is (via alpha) only increases expected value if the market's odds and your " +
    "own probability model agree — when they disagree, pushing alpha higher can make expected value worse, " +
    "not better.",

  "explain.barbell":
    "Splits capital into two pools modeled at two different subset sizes — a small k1 'safe' pool and a " +
    "larger k2 'risk' pool — then optimizes what fraction of capital sits in each, the same way lambda " +
    "controls the mean-variance trade-off. The pool with genuinely lower variance wins as risk-aversion " +
    "rises — which is not always the pool with the smaller k.",

  "explain.maxEntropy":
    "Finds the most spread-out (highest-entropy) allocation that still hits a minimum required return tau. " +
    "The exact solution is an exponential (Gibbs/Boltzmann) distribution — no generic numerical entropy " +
    "solver needed. Entropy is maximized when tau equals the uniform allocation's own return, and falls " +
    "symmetrically as tau is pushed toward either extreme.",

  "explain.sigmaDense":
    "It's tempting to assume that because the underlying events are independent, the covariance matrix of " +
    "the 2^k combinations must be sparse. It isn't: independence only makes each combination's joint " +
    "probability cheap to compute. The combinations themselves are mutually exclusive outcomes of a single " +
    "partition, which produces a fully dense, strictly negative-off-diagonal covariance matrix.",
};

export function ensureDefaultConfig() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (SiteConfig.get(key) === undefined) {
      SiteConfig.set(key, value, null);
    }
  }
}
