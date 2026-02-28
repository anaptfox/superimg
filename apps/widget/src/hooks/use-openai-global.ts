import { useSyncExternalStore } from "react";
import {
  SET_GLOBALS_EVENT_TYPE,
  type SetGlobalsEvent,
  type OpenAIGlobals,
} from "./types";

export function useOpenAIGlobal<K extends keyof OpenAIGlobals>(
  key: K
): OpenAIGlobals[K] | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return () => {};

      const handleSetGlobal = (event: Event) => {
        const detail = (event as SetGlobalsEvent).detail;
        if (detail.globals[key] === undefined) return;
        onChange();
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, {
        passive: true,
      });
      return () =>
        window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
    },
    () =>
      typeof window !== "undefined"
        ? (window.openai?.[key] as OpenAIGlobals[K]) ?? null
        : null,
    () => null
  );
}
