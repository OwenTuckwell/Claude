import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { advance, applyCommand } from "../sim/sim";
import { computeModifiers } from "../sim/effects";
import type { Command, GameState } from "../sim/types";
import { TICKS_PER_REAL_SECOND, loadOrNew, save } from "../host/persistence";

export function useGame() {
  const [state, setState] = useState<GameState>(() => loadOrNew());
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Wall-clock → ticks. The host owns time; the sim is advanced deterministically.
  useEffect(() => {
    const acc = { rem: 0, last: Date.now() };
    const id = window.setInterval(() => {
      const now = Date.now();
      const elapsed = (now - acc.last) / 1000;
      acc.last = now;
      acc.rem += elapsed * TICKS_PER_REAL_SECOND;
      const ticks = Math.floor(acc.rem);
      if (ticks > 0) {
        acc.rem -= ticks;
        setState((prev) => advance(prev, ticks));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Autosave.
  useEffect(() => {
    const id = window.setInterval(() => save(stateRef.current), 3000);
    return () => { window.clearInterval(id); save(stateRef.current); };
  }, []);

  const dispatch = useCallback((cmd: Command) => {
    const { state: next, result } = applyCommand(stateRef.current, cmd);
    if (result.ok) { setState(next); setError(null); }
    else setError(result.error ?? "Action failed.");
  }, []);

  const mods = useMemo(() => computeModifiers(state), [state]);

  return { state, setState, mods, dispatch, error, setError };
}
