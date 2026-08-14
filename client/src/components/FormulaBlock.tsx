import katex from "katex";
import { useMemo } from "react";

/**
 * FormulaBlock — renders a LaTeX string with KaTeX, entirely client-side
 * (no server round-trip, no image rendering — see ARCHITECTURE.md "Why
 * KaTeX"). `display` controls block vs inline rendering.
 */
export function FormulaBlock({ tex, display = true }: { tex: string; display?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: false, displayMode: display }),
    [tex, display]
  );
  return <span className={display ? "katex-block" : undefined} dangerouslySetInnerHTML={{ __html: html }} />;
}
