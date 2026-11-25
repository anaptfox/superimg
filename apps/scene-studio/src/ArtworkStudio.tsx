import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ViewTransition,
} from "react";
import { InteractivePlayer, type InteractivePlayerRef } from "@foxworth/superimg/react/interactive";
import { type SceneSnapshot } from "@foxworth/superimg/interactive/define";
import type { Artwork } from "./kit/artwork";
import { MeaningDrawer } from "./components/MeaningDrawer";
import {
  CameraControls,
  EditionSwitcher,
  StyleSwitcher,
} from "./components/SceneControls";
import { StoryRail } from "./components/StoryRail";
import { indexScene, sceneMatches } from "./kit/scene-index";

function readParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    act: params.get("act"),
    surface: params.get("surface"),
    edition: params.get("edition"),
    debug: params.get("debug") === "1" || params.get("debug") === "true",
  };
}

function writeParams(next: {
  act: string;
  surface: string;
  edition: string;
  debug: boolean;
  artwork: string;
}) {
  // Preserve unrelated query keys (e.g. future flags); only own studio keys.
  const params = new URLSearchParams(window.location.search);
  params.set("artwork", next.artwork);
  params.set("act", next.act);
  params.set("surface", next.surface);
  params.set("edition", next.edition);
  if (next.debug) params.set("debug", "1");
  else params.delete("debug");
  const url = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, "", url);
}

export function ArtworkStudio({
  artwork,
  reducedMotion,
}: {
  artwork: Artwork;
  reducedMotion: boolean;
}) {
  const seed = useMemo(() => readParams(), []);
  const actIds = useMemo(() => new Set(artwork.acts.map((a) => a.id)), [artwork]);
  const surfaceIds = useMemo(
    () => new Set(artwork.surfaces.map((s) => s.id)),
    [artwork],
  );
  const editionIds = useMemo(
    () => new Set(artwork.editions.map((e) => e.id)),
    [artwork],
  );

  const initialAct =
    seed.act && actIds.has(seed.act) ? seed.act : artwork.acts[0]!.id;
  const initialSurface =
    seed.surface && surfaceIds.has(seed.surface)
      ? seed.surface
      : artwork.defaultSurface;
  const initialEdition =
    seed.edition && editionIds.has(seed.edition)
      ? seed.edition
      : artwork.defaultEdition;

  const [actIntent, setActIntent] = useState({ id: initialAct, revision: 0 });
  const requestedAct = actIntent.id;
  const [surface, setSurface] = useState(initialSurface);
  const [editionId, setEditionId] = useState(initialEdition);
  const [selectedId, setSelectedId] = useState<string | null>(
    artwork.acts.find((a) => a.id === initialAct)?.focus ?? null,
  );
  const [queryRole, setQueryRole] = useState<string | null>(null);
  const [runtimeScore, setRuntimeScore] = useState(
    `scene.replace({ state: "${initialAct}" })`,
  );
  const [guided, setGuided] = useState(false);
  const [debugOverlay, setDebugOverlay] = useState(seed.debug);
  const [snapshot, setSnapshot] = useState<SceneSnapshot | null>(null);
  const [isReady, setIsReady] = useState(false);
  const interactiveRef = useRef<InteractivePlayerRef<Record<string, unknown>>>(null);

  const edition =
    artwork.editions.find((e) => e.id === editionId) ?? artwork.editions[0]!;
  const dimensions = { width: edition.width, height: edition.height };

  const liveData = useMemo(
    () => ({ ...(artwork.template.sample ?? {}), debugOverlay }),
    [artwork.template, debugOverlay],
  );
  const scene = isReady
    ? interactiveRef.current?.controller?.scene ?? null
    : null;

  const mountedRef = useRef(true);
  const commandVersionRef = useRef(0);
  const pendingActRef = useRef<{ owner: NonNullable<typeof scene>; id: string } | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const runCommand = useCallback((owner: NonNullable<typeof scene>, command: () => Promise<void>) => {
    const version = ++commandVersionRef.current;
    const report = (error: unknown) => {
      if (!mountedRef.current || interactiveRef.current?.controller?.scene !== owner || version !== commandVersionRef.current) return;
      // Another user input can intentionally replace this requested presentation.
      if ((error as { code?: string } | null)?.code === "PLAYER_PRESENTATION_SUPERSEDED") return;
      setRuntimeScore(error instanceof Error ? error.message : String(error));
    };
    try { void command().catch(report); }
    catch (error) { report(error); }
  }, []);

  useEffect(() => {
    if (!scene) return;
    const request = { owner: scene, id: actIntent.id };
    pendingActRef.current = request;
    runCommand(scene, async () => {
      try { await scene.use(request.id); }
      finally { if (pendingActRef.current === request) pendingActRef.current = null; }
    });
  }, [scene, actIntent, runCommand]);

  const snapshotState = snapshot?.activeState ?? null;
  const activeAct =
    snapshotState && actIds.has(snapshotState) ? snapshotState : requestedAct;

  const index = useMemo(() => snapshot ? indexScene(snapshot) : null, [snapshot]);
  // Keep selection intent if a node disappears; its details stay empty until an
  // accepted snapshot contains it again, rather than selecting unrelated art.
  const selected = selectedId ? index?.byId.get(selectedId) ?? null : null;
  const queryMatches = useMemo(() => sceneMatches(index, queryRole), [index, queryRole]);

  useEffect(() => {
    writeParams({
      act: activeAct,
      surface,
      edition: editionId,
      debug: debugOverlay,
      artwork: artwork.id,
    });
  }, [activeAct, surface, editionId, debugOverlay, artwork.id]);

  const withManual = useCallback(
    <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        setGuided(false);
        return fn(...args);
      },
    [],
  );

  const updateNavigation = useCallback(
    (update: () => void) => {
      if (reducedMotion) {
        update();
      } else {
        startTransition(update);
      }
    },
    [reducedMotion],
  );

  const chooseAct = useCallback(
    (id: string, manual = true) => {
      if (manual) setGuided(false);
      const act = artwork.acts.find((candidate) => candidate.id === id);
      updateNavigation(() => {
        const pending = pendingActRef.current;
        const alreadyPending = pending?.owner === scene && pending.id === id;
        const alreadyAccepted = snapshot?.activeState === id && !pending;
        if (!alreadyPending && !alreadyAccepted) {
          setActIntent(previous => ({ id, revision: previous.revision + 1 }));
        }
        setSelectedId(act?.focus ?? null);
        setQueryRole(null);
      });
      setRuntimeScore(`scene.use(${JSON.stringify(id)})`);
    },
    [artwork.acts, scene, snapshot, updateNavigation],
  );

  useEffect(() => {
    if (!guided || reducedMotion) return;
    const index = artwork.acts.findIndex((act) => act.id === activeAct);
    const timer = window.setTimeout(() => {
      const next = artwork.acts[index + 1];
      if (!next) {
        setGuided(false);
        return;
      }
      chooseAct(next.id, false);
    }, 3_600);
    return () => window.clearTimeout(timer);
  }, [activeAct, artwork.acts, chooseAct, guided, reducedMotion]);

  const zoomBy = withManual((delta: number) => {
    if (!scene) return;
    const current = snapshot?.camera ?? { zoom: 1 };
    const zoom = Math.max(0.72, Math.min(1.55, (current.zoom ?? 1) + delta));
    setRuntimeScore(`scene.camera({ zoom: ${zoom.toFixed(2)} })`);
    runCommand(scene, () => scene.camera({ zoom }));
  });

  const rotateCamera = withManual(() => {
    if (!scene) return;
    const current = snapshot?.camera ?? artwork.resetCamera;
    const rotation = (current.rotation ?? 0) + 3;
    setRuntimeScore(`scene.camera({ rotation: ${rotation.toFixed(1)} })`);
    runCommand(scene, () => scene.camera({ rotation }));
  });

  const focusSelected = withManual(() => {
    // Selection intent can outlive a node; fit only current accepted geometry.
    if (!scene || !selected) return;
    const zoom = Math.max(snapshot?.camera.zoom ?? 1, 1.12);
    setRuntimeScore(`scene.camera({ fit: { target: "${selected.id}" } })`);
    runCommand(scene, () => scene.camera({
      zoom,
      rotation: snapshot?.camera.rotation ?? 0,
      fit: { target: selected.id, padding: 72 },
    }));
  });

  const resetCamera = withManual(() => {
    if (!scene) return;
    setRuntimeScore("scene.camera(resetCamera)");
    runCommand(scene, () => scene.camera(artwork.resetCamera));
  });

  const selectNode = withManual((id: string) => {
    updateNavigation(() => setSelectedId(id));
    if (!scene) return;
    setRuntimeScore(`scene.set("${id}", { animation: { type: "pulse" } })`);
    runCommand(scene, () => scene.set(id, {
      animation: {
        type: "pulse",
        progress: 0.25,
        durationMs: 720,
        intensity: 0.045,
      },
    }));
  });

  const runQuery = withManual((role: string | null) => {
    if (!role) {
      updateNavigation(() => {
        setQueryRole(null);
      });
      setRuntimeScore("scene.nodes");
      return;
    }
    const matches = sceneMatches(index, role);
    updateNavigation(() => {
      setQueryRole(role);
      if (matches[0]) setSelectedId(matches[0].id);
    });
    if (!scene) setRuntimeScore(`scene.query({ role: "${role}" })`);
  });

  const changeSurface = withManual((next: string) => {
    setSurface(next);
    setRuntimeScore(`renderer: "${next}" // same semantic graph`);
  });

  const changeEdition = withManual((next: string) => {
    setEditionId(next);
    setRuntimeScore(`output: "${next}" // same semantic scene`);
  });

  const toggleGuided = () => {
    if (reducedMotion) {
      setRuntimeScore("Guided motion is paused by your reduced-motion preference.");
      return;
    }
    if (guided) {
      setGuided(false);
      setRuntimeScore("guidedReading.pause()");
      return;
    }
    chooseAct(artwork.acts[0]!.id, false);
    setGuided(true);
    setRuntimeScore("guidedReading.play()");
  };

  const toggleDebug = withManual(() => {
    setDebugOverlay((v) => !v);
    setRuntimeScore(`data.debugOverlay = ${!debugOverlay}`);
  });

  // Keep a stable player ref for rapid handlers after ready flips.
  const playerReady = isReady;

  return (
    <div className="studio-shell">
      <header className="site-header">
        <a className="brand" href="#canvas" aria-label="SuperImg Scene Studio home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>SuperImg</strong><em>Scene Studio</em></span>
        </a>
        <div className="header-tools">
          <StyleSwitcher
            surfaces={artwork.surfaces}
            value={surface}
            onChange={changeSurface}
          />
          <button
            type="button"
            className="debug-toggle"
            aria-pressed={debugOverlay}
            data-testid="debug-overlay-toggle"
            onClick={toggleDebug}
            title="Toggle node id overlay"
          >
            Debug
          </button>
        </div>
      </header>

      <main id="canvas" className="studio-main">
        <section className="artwork-column" aria-labelledby="artwork-title">
          <header className="artwork-intro">
            <div>
              <span className="eyebrow">{artwork.meta.eyebrow}</span>
              <h1 id="artwork-title">{artwork.meta.title}</h1>
            </div>
            <p>{artwork.meta.synopsis}</p>
          </header>

          <div className="stage-toolbar">
            <EditionSwitcher
              editions={artwork.editions}
              value={editionId}
              onChange={changeEdition}
            />
            <div className="stage-status" aria-live="polite">
              <span className={`live-dot ${playerReady ? "is-ready" : ""}`} aria-hidden="true" />
              {playerReady ? "Scene live" : "Building scene"}
            </div>
            <CameraControls
              onZoomOut={() => zoomBy(-0.12)}
              onZoomIn={() => zoomBy(0.12)}
              onRotate={rotateCamera}
              onFocus={focusSelected}
              onReset={resetCamera}
            />
          </div>

          <div
            className={`artwork-stage edition-${editionId}`}
            data-testid="artwork-player"
            data-active-state={activeAct}
            data-active-renderer={surface}
            style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
            aria-describedby="artwork-description"
          >
            <InteractivePlayer
              ref={interactiveRef}
              className="artwork-player-surface"
              media={artwork.template}
              data={liveData}
              size={dimensions}
              sceneRenderer={artwork.renderer}
              sceneStyle={surface}
              autoplay={false}
              onLoad={(result) => {
                const ready = result.status === "success";
                setIsReady(ready);
                if (!ready) setRuntimeScore(result.message);
              }}
              onSceneUpdate={setSnapshot}
              onError={(error) => {
                // A failed update can leave the accepted scene fully usable.
                setRuntimeScore(error.message);
              }}
            />
            {!playerReady ? <div className="stage-loading">Composing meaning…</div> : null}
          </div>

          <p id="artwork-description" className="artwork-description">
            {artwork.meta.description}
          </p>

          <div className="story-heading">
            <div>
              <span className="eyebrow">Scene states</span>
              <strong>{artwork.acts.find((act) => act.id === activeAct)?.note}</strong>
            </div>
            <button
              className="guided-button"
              type="button"
              aria-pressed={guided}
              disabled={reducedMotion}
              onClick={toggleGuided}
            >
              <span aria-hidden="true">{guided ? "Ⅱ" : "▶"}</span>
              {guided ? "Pause reading" : "Guided reading"}
            </button>
          </div>
          <StoryRail acts={artwork.acts} active={activeAct} onSelect={chooseAct} />

          <div className="runtime-score" role="status" aria-live="polite" data-testid="runtime-score">
            <span>Runtime score</span>
            <code>{runtimeScore}</code>
            <span className="camera-readout" data-testid="camera-readout">
              z {(snapshot?.camera.zoom ?? 1).toFixed(2)} · r {(snapshot?.camera.rotation ?? 0).toFixed(1)}°
            </span>
          </div>
        </section>

        <ViewTransition
          name="scene-studio-selection"
          update={reducedMotion ? "none" : "auto"}
        >
          <MeaningDrawer
            index={index}
            selected={selected}
            selectedId={selectedId}
            queryRole={queryRole}
            queryMatches={queryMatches}
            roleFilters={artwork.roleFilters}
            onQuery={runQuery}
            onSelect={selectNode}
          />
        </ViewTransition>
      </main>

      <footer className="site-footer">
        <p>HTML → semantic scene → living artifact</p>
        <div aria-label="Available output media">
          <span>PNG</span><span>SVG</span><span>MP4</span><span>Canvas</span><span>Web</span>
        </div>
      </footer>
    </div>
  );
}
