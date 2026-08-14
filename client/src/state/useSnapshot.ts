/**
 * useSnapshot.ts — recomputes the engine snapshot on every param change,
 * batched to one recompute per animation frame.
 *
 * The engine itself is fast enough (see ARCHITECTURE.md "Performance
 * envelope": <60ms through k=12, ~200ms at the k=14 ceiling) that this
 * batching is a smoothness nicety rather than a correctness requirement —
 * without it, a mouse dragging a range input can fire more `input` events
 * per second than there are animation frames, each triggering a full
 * recompute for a value the browser will immediately overwrite. rAF
 * coalescing means only the latest value in a burst actually gets computed.
 */
import { useEffect, useRef, useState } from "react";
import { computeAll, type Params, type Snapshot } from "../engine";

export function useSnapshot(params: Params): Snapshot {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => computeAll(params));
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      setSnapshot(computeAll(params));
      frameRef.current = null;
    });
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  return snapshot;
}
