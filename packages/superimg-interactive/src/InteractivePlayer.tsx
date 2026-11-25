//! React entry for one interactive definition driven by live host data.
"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type Ref,
} from "react";
import type {
  CanvasSize,
} from "@superimg/types";
import type {
  GuideCheckpoint,
  InteractiveDefinition,
  SceneActionEvent,
  SceneSnapshot,
  SceneStyleRenderer,
} from "./contracts.js";
import type { LoadOptions, LoadResult } from "@superimg/player";
import {
  createInteractivePlayer,
  type InteractivePlayerController,
} from "./controller.js";

export interface InteractivePlayerProps<TData> {
  ref?: Ref<InteractivePlayerRef<TData>>;
  media: InteractiveDefinition<TData>;
  data: TData;
  size?: CanvasSize;
  autoplay?: boolean;
  playbackMode?: "once" | "loop";
  playerMode?: "render-only" | "dev";
  /** Host resources for this mounted session. Changing identity reloads it. */
  assets?: LoadOptions["assets"];
  assetResolver?: LoadOptions["assetResolver"];
  fonts?: LoadOptions["fonts"];
  sceneRenderer?: SceneStyleRenderer;
  sceneStyle?: string;
  className?: string;
  style?: CSSProperties;
  onLoad?: (result: LoadResult) => void;
  onError?: (error: Error) => void;
  onAction?: (event: SceneActionEvent) => void;
  onStepChange?: (step: GuideCheckpoint | null, index: number) => void;
  onSceneUpdate?: (scene: SceneSnapshot) => void;
}

export interface InteractivePlayerRef<TData> {
  readonly controller: InteractivePlayerController<TData> | null;
  /** Resolves when this record is accepted; rejects if its session is replaced. */
  setData(data: TData): Promise<void>;
  goToStep(stepId: string): Promise<void>;
  nextStep(): Promise<void>;
  previousStep(): Promise<void>;
  play(): void;
  pause(): void;
}

/** @internal Isolates one async Player session from React effect restarts. */
export function createInteractiveMount(host: HTMLElement): HTMLDivElement {
  const mount = document.createElement("div");
  mount.dataset.superimgInteractiveMount = "1";
  mount.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
  host.appendChild(mount);
  return mount;
}

export function InteractivePlayer<TData>({
  ref,
  media,
  data,
  size,
  autoplay = false,
  playbackMode = "once",
  playerMode = "render-only",
  assets,
  assetResolver,
  fonts,
  sceneRenderer,
  sceneStyle,
  className,
  style,
  onLoad,
  onError,
  onAction,
  onStepChange,
  onSceneUpdate,
}: InteractivePlayerProps<TData>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<InteractivePlayerController<TData> | null>(null);
  const dataSessionRef = useRef<{
    replaceData(data: TData): void;
    setData(data: TData): Promise<void>;
  } | null>(null);
  const callbacksRef = useRef({
    onLoad,
    onError,
    onAction,
    onStepChange,
    onSceneUpdate,
  });
  callbacksRef.current = {
    onLoad,
    onError,
    onAction,
    onStepChange,
    onSceneUpdate,
  };
  const hasExplicitSize = size !== undefined;
  const livePropsRef = useRef({ data, size, sceneStyle });
  livePropsRef.current = { data, size, sceneStyle };

  useImperativeHandle(ref, () => ({
    get controller() {
      return controllerRef.current;
    },
    setData: async (next) => {
      const session = dataSessionRef.current;
      if (!session) throw new Error("InteractivePlayer is not mounted");
      await session.setData(next);
    },
    goToStep: async (stepId) => {
      await controllerRef.current?.guide.goToStep(stepId);
    },
    nextStep: async () => {
      await controllerRef.current?.guide.next();
    },
    previousStep: async () => {
      await controllerRef.current?.guide.previous();
    },
    play: () => controllerRef.current?.play(),
    pause: () => controllerRef.current?.pause(),
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Each effect owns a private mount node. React StrictMode may start, clean
    // up, and restart an async load before its first session commits; keeping
    // the session inside a detachable node prevents that stale load from
    // appending an iframe into the next effect's host.
    const mount = createInteractiveMount(host);
    let active = true;
    const controller = createInteractivePlayer<TData>({
      container: mount,
      ...(size !== undefined ? { size } : {}),
      autoplay,
      playbackMode,
      playerMode,
      ...(sceneRenderer !== undefined ? { sceneRenderer } : {}),
      ...(sceneStyle !== undefined ? { sceneStyle } : {}),
    });
    controllerRef.current = controller;
    type DataRequest =
      | { kind: "prop"; value: { data: TData; size: CanvasSize | undefined; sceneStyle: string | undefined } }
      | { kind: "imperative"; data: TData; resolve(): void; reject(error: unknown): void }
      | { kind: "initialization"; resolve(): void; reject(error: unknown): void };
    const requests: DataRequest[] = [];
    const initialProps = livePropsRef.current;
    const initialData = initialProps.data;
    let acceptedProps = initialProps;
    let ready = false;
    let loadFailure: Error | null = null;
    let inFlight: DataRequest | null = null;
    let draining: Promise<void> | null = null;
    let updateErrors: Set<unknown> | null = null;
    const reportError = (error: unknown) => {
      if (!active) return;
      updateErrors?.add(error);
      callbacksRef.current.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    };
    const rejectRequests = (error: Error) => {
      if (inFlight && inFlight.kind !== "prop") inFlight.reject(error);
      for (const request of requests.splice(0)) {
        if (request.kind !== "prop") request.reject(error);
      }
    };
    // One update owns the Player at a time. Only unstarted prop replacements
    // coalesce; each imperative request keeps its own acceptance promise.
    const drainData = (): Promise<void> => {
      if (!active || !ready) return Promise.resolve();
      if (draining) return draining;
      const operation = (async () => {
        while (active && requests.length > 0) {
          const request = requests.shift()!;
          inFlight = request;
          try {
            if (request.kind === "initialization") {
              request.resolve();
              continue;
            }
            updateErrors = new Set();
            if (request.kind === "imperative") {
              await controller.setData(request.data);
              if (!active) break;
              acceptedProps = { ...acceptedProps, data: request.data };
              request.resolve();
            } else {
              const next = request.value;
              const changesData = !Object.is(acceptedProps.data, next.data);
              const changesSize = !Object.is(acceptedProps.size?.width, next.size?.width) || !Object.is(acceptedProps.size?.height, next.size?.height);
              const changesStyle = acceptedProps.sceneStyle !== next.sceneStyle;
              if (changesSize || changesStyle) {
                await controller.update({ ...(changesData ? { data: next.data } : {}), ...(next.size ? { size: next.size } : {}), sceneStyle: next.sceneStyle });
              } else if (changesData) await controller.setData(next.data);
              if (!active) break;
              acceptedProps = next;
            }
          } catch (error: unknown) {
            if (request.kind !== "prop") request.reject(error);
            else if (!updateErrors?.has(error)) reportError(error);
          } finally {
            updateErrors = null;
            inFlight = null;
          }
        }
      })();
      draining = operation;
      void operation.then(() => {
        if (draining === operation) draining = null;
        // An enqueue can happen after the loop exits but before this microtask.
        if (active && requests.length > 0) void drainData();
      });
      return operation;
    };
    const dataSession = {
      replaceData(next: TData) {
        if (!active || loadFailure) return;
        const last = requests.at(-1);
        const value = { ...livePropsRef.current, data: next };
        if (last?.kind === "prop") last.value = value;
        else requests.push({ kind: "prop", value });
        void drainData();
      },
      setData(next: TData) {
        if (!active) return Promise.reject(new Error("InteractivePlayer session was disposed"));
        if (loadFailure) return Promise.reject(loadFailure);
        return new Promise<void>((resolve, reject) => {
          requests.push({ kind: "imperative", data: next, resolve, reject });
          void drainData();
        });
      },
    };
    dataSessionRef.current = dataSession;
    const disposers = [
      controller.on("error", reportError),
      controller.on("action", (event) => {
        if (active) callbacksRef.current.onAction?.(event);
      }),
      controller.on("stepchange", (step, index) => {
        if (active) callbacksRef.current.onStepChange?.(step, index);
      }),
      controller.on("sceneupdate", (scene) => {
        if (active) callbacksRef.current.onSceneUpdate?.(scene);
      }),
    ];
    void controller
      .load(media, {
        data: initialData,
        autoplay,
        ...(assets !== undefined ? { assets } : {}),
        ...(assetResolver !== undefined ? { assetResolver } : {}),
        ...(fonts !== undefined ? { fonts } : {}),
        ...(sceneRenderer !== undefined ? { sceneRenderer } : {}),
        ...(sceneStyle !== undefined ? { sceneStyle } : {}),
      })
      .then(async (result) => {
        if (!active) {
          controller.dispose();
          return;
        }
        if (result.status === "success") {
          // Freeze a finite initialization boundary. Later live replacements
          // drain after it and cannot keep onLoad waiting for a quiet stream.
          const initialized = new Promise<void>((resolve, reject) => {
            requests.push({ kind: "initialization", resolve, reject });
          });
          ready = true;
          void drainData();
          await initialized;
        } else {
          loadFailure = new Error(`InteractivePlayer load failed: ${result.message}`);
          rejectRequests(loadFailure);
        }
        if (active) callbacksRef.current.onLoad?.(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        loadFailure = error instanceof Error ? error : new Error(String(error));
        rejectRequests(loadFailure);
        reportError(error);
      });
    return () => {
      active = false;
      rejectRequests(new Error("InteractivePlayer data update was superseded by a disposed session"));
      for (const dispose of disposers) dispose();
      controller.dispose();
      mount.remove();
      if (controllerRef.current === controller) controllerRef.current = null;
      if (dataSessionRef.current === dataSession) dataSessionRef.current = null;
    };
  }, [media, hasExplicitSize, autoplay, playbackMode, playerMode, assets, assetResolver, fonts, sceneRenderer]);

  useEffect(() => {
    dataSessionRef.current?.replaceData(data);
  }, [data, size?.width, size?.height, sceneStyle]);

  return (
    <div
      ref={hostRef}
      className={className}
      data-superimg-interactive="1"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "100%",
        aspectRatio: size ? `${size.width} / ${size.height}` : "16 / 9",
        ...style,
      }}
    />
  );
}
