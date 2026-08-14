/**
 * combinatorics.ts — subset-space bookkeeping (Sec 2.2).
 *
 * The UI enforces MAX_K_FULL_DETAIL to keep every recompute inside a
 * single animation frame; see ARCHITECTURE.md "Performance envelope".
 */

export const MAX_N = 16;
export const MAX_K_FULL_DETAIL = 14; // 2^14 = 16,384 combinations — comfortably sub-frame in JS

export function nChooseK(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

export function combinatorialGrowth(maxK: number): { k: number; combinations: number }[] {
  const out = [];
  for (let k = 1; k <= maxK; k++) out.push({ k, combinations: 2 ** k });
  return out;
}
