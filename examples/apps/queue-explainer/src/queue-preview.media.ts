/** Offline projection of the authored scenario, not a recording of a live session. */
import { lowerInteractiveDefinition } from '@foxworth/superimg/interactive/define';
import queue from './queue.media.ts';

export default lowerInteractiveDefinition(queue);
