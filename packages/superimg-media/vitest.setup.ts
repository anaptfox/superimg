import { JSDOM } from "jsdom";
import { primeTrustedPurifierForTests } from "./src/sanitize-html.js";

// Keep the DOM emulator test-only; production sanitizer chunks bind to the browser Window.
primeTrustedPurifierForTests(new JSDOM("").window as never);
