//! Checkpoint resolver for navigation and markers

import type { Checkpoint, Marker, MarkerPosition } from "@superimg/types";

export interface CheckpointResolverOptions {
  /** Include markers as checkpoints (default: true) */
  includeMarkers?: boolean;
}

/**
 * Resolves and manages checkpoints for a video.
 * Combines explicit markers with runtime additions.
 */
export class CheckpointResolver {
  private markers: Marker[];
  private totalFrames: number;
  private fps: number;
  private checkpoints: Checkpoint[] = [];
  private checkpointById: Map<string, Checkpoint> = new Map();
  private runtimeCheckpoints: Checkpoint[] = [];

  constructor(
    markers: Marker[] = [],
    totalFrames: number,
    fps: number,
    options: CheckpointResolverOptions = {}
  ) {
    this.markers = markers;
    this.totalFrames = totalFrames;
    this.fps = fps;
    this.buildCheckpoints(options);
  }

  private buildCheckpoints(options: CheckpointResolverOptions): void {
    const { includeMarkers = true } = options;

    if (includeMarkers) {
      this.buildMarkerCheckpoints();
    }

    // Sort by frame
    this.checkpoints.sort((a, b) => a.frame - b.frame);

    // Build lookup index
    for (const cp of this.checkpoints) {
      this.checkpointById.set(cp.id, cp);
    }
  }

  private buildMarkerCheckpoints(): void {
    for (const marker of this.markers) {
      const frame = this.resolveMarkerPosition(marker.at);
      if (frame >= 0 && frame < this.totalFrames) {
        this.checkpoints.push({
          id: `marker:${marker.id}`,
          frame,
          time: frame / this.fps,
          label: marker.label,
          metadata: marker.metadata,
          source: { type: "marker", markerId: marker.id },
        });
      }
    }
  }

  private resolveMarkerPosition(position: MarkerPosition): number {
    switch (position.type) {
      case "frame":
        return position.value;
      case "time":
        return Math.round(position.value * this.fps);
    }
  }

  // --- Public API ---

  /** Get all checkpoints sorted by frame */
  getAll(): Checkpoint[] {
    return [...this.checkpoints, ...this.runtimeCheckpoints].sort(
      (a, b) => a.frame - b.frame
    );
  }

  /** Get checkpoint by ID */
  get(id: string): Checkpoint | undefined {
    return (
      this.checkpointById.get(id) ??
      this.runtimeCheckpoints.find((c) => c.id === id)
    );
  }

  /** Get checkpoint at or nearest before frame */
  getAt(frame: number): Checkpoint | undefined {
    const all = this.getAll();
    let best: Checkpoint | undefined;
    for (const cp of all) {
      if (cp.frame <= frame) {
        best = cp;
      } else {
        break;
      }
    }
    return best;
  }

  /** Get next checkpoint after frame */
  getNext(frame: number): Checkpoint | undefined {
    const all = this.getAll();
    for (const cp of all) {
      if (cp.frame > frame) {
        return cp;
      }
    }
    return undefined;
  }

  /** Get previous checkpoint before frame */
  getPrevious(frame: number): Checkpoint | undefined {
    const all = this.getAll();
    let prev: Checkpoint | undefined;
    for (const cp of all) {
      if (cp.frame >= frame) {
        return prev;
      }
      prev = cp;
    }
    return prev;
  }

  /** Add checkpoint at runtime */
  add(
    id: string,
    frame: number,
    options?: { label?: string; metadata?: Record<string, unknown> }
  ): Checkpoint {
    const checkpoint: Checkpoint = {
      id,
      frame,
      time: frame / this.fps,
      label: options?.label,
      metadata: options?.metadata,
      source: { type: "runtime" },
    };
    this.runtimeCheckpoints.push(checkpoint);
    return checkpoint;
  }

  /** Remove runtime checkpoint */
  remove(id: string): boolean {
    const idx = this.runtimeCheckpoints.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this.runtimeCheckpoints.splice(idx, 1);
      return true;
    }
    return false;
  }

  /** Get marker checkpoints only */
  getMarkerCheckpoints(): Checkpoint[] {
    return this.checkpoints.filter((c) => c.source.type === "marker");
  }

  /** Get runtime checkpoints only */
  getRuntimeCheckpoints(): Checkpoint[] {
    return [...this.runtimeCheckpoints];
  }
}
