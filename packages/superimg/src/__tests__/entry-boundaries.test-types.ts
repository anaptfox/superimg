//! Compile-time proof of public entry ownership.

import { video } from "../index.js";
import { defineInteractive } from "../index.interactive-define.js";

void video;
void defineInteractive;

// @ts-expect-error core is rasterize/IR, not authoring helpers
import { video as coreVideo } from "@superimg/core";
void coreVideo;

// @ts-expect-error interactive helper is not on the authoring root
import { defineInteractive as rootInteractive } from "../index.js";
void rootInteractive;

// @ts-expect-error authoring never exports a browser runtime
import { createInteractivePlayer as authoringPlayer } from "../index.interactive-define.js";
void authoringPlayer;
// @ts-expect-error framework-neutral runtime never exports React
import { InteractivePlayer as runtimeReact } from "../index.interactive-player.js";
void runtimeReact;
// @ts-expect-error passive DOM entry never exports driven Player
import { Player as drivenPlayer } from "../index.player-dom.js";
void drivenPlayer;
