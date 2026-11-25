import type { MediaDefinition } from '@foxworth/superimg';
import type { InteractiveDefinition } from '@foxworth/superimg/interactive/define';

export type Fidelity = 'full' | 'reduced';
export type StudyId = 'sandglass' | 'cleft' | 'returning-shore' | 'borrowed-shapes' | 'aster-basin';
export type StudyData = Record<string, unknown> & { fidelity: Fidelity; inputVersion: number; teaching: boolean; live: boolean; logicalSeconds: number | null };
export interface StudyModule {
  live: MediaDefinition<Record<string, unknown>> | InteractiveDefinition<Record<string, unknown>>;
  initial: StudyData;
  observe(data: StudyData, seconds: number, frame: number): Record<string, unknown>;
}
export interface Study {
  id: StudyId;
  title: string;
  subtitle: string;
  description: string;
  number: string;
  color: string;
  kind: 'interactive' | 'timeline' | 'pointer';
  seconds: number;
  settled: number;
  logicalCount: number;
  thumbnail: string;
  load(): Promise<StudyModule>;
}

function moduleValue(module: unknown, initialKey: string, observe: StudyModule['observe']): StudyModule {
  const source = module as Record<string, unknown>;
  if (!source.live || !source[initialKey]) throw new Error(`Study must export live and ${initialKey}.`);
  return { live: (source.galleryLive ?? source.live) as StudyModule['live'], initial: { ...(source[initialKey] as StudyData), teaching: false, live: true, inputVersion: 0 }, observe };
}

const sources = import.meta.glob([
  '../../../showcase/sandglass/sandglass.media.ts',
  '../../../showcase/cleft/cleft.media.ts',
  '../../../showcase/returning-shore/returning-shore.media.ts',
  '../../../showcase/borrowed-shapes/borrowed-shapes.media.ts',
  '../../../showcase/aster-basin/aster-basin.media.ts',
]);
const models = import.meta.glob([
  '../../../showcase/sandglass/model.ts', '../../../showcase/cleft/model.ts',
  '../../../showcase/returning-shore/model.ts', '../../../showcase/borrowed-shapes/model.ts',
  '../../../showcase/aster-basin/model.ts',
]);
declare const __MATERIAL_SOURCE_ROOT__: string;
const available = new Set<StudyId>();
for (const path of Object.keys(sources)) available.add(path.split('/').at(-2) as StudyId);
export function isAvailable(id: StudyId): boolean { return available.has(id); }
export async function refreshAvailability(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const response = await fetch('/api/material-studies', { cache: 'no-store' });
  if (!response.ok) return;
  const value = await response.json() as { available?: StudyId[] };
  for (const id of value.available ?? []) available.add(id);
}
async function loadStudy(id: StudyId, initialKey: string): Promise<StudyModule> {
  await refreshAvailability();
  if (!available.has(id)) throw new Error('This study is being built. Available studies are ready to explore.');
  const load = sources[`../../../showcase/${id}/${id}.media.ts`] ?? (import.meta.env.DEV ? () => import(/* @vite-ignore */ `/@fs/${__MATERIAL_SOURCE_ROOT__}/examples/showcase/${id}/${id}.media.ts`) : undefined);
  if (!load) throw new Error('This study is being built. Available studies are ready to explore.');
  const modelLoad = models[`../../../showcase/${id}/model.ts`] ?? (import.meta.env.DEV ? () => import(/* @vite-ignore */ `/@fs/${__MATERIAL_SOURCE_ROOT__}/examples/showcase/${id}/model.ts`) : undefined);
  if (!modelLoad) throw new Error('The study model is being prepared.');
  const [module, model] = await Promise.all([load(), modelLoad()]);
  const values = model as Record<string, unknown>;
  const suffix = { sandglass: 'Sandglass', cleft: 'Cleft', 'returning-shore': 'Shore', 'borrowed-shapes': 'Forms', 'aster-basin': 'Atlas' }[id];
  const sample = values[`sample${suffix}`] as (data: unknown, clock?: unknown) => unknown;
  const observe = values[`observe${suffix}`] as (snapshot: unknown) => Record<string, unknown>;
  return moduleValue(module, initialKey, (data, seconds, frame) => observe(sample(data,
    id === 'cleft' ? { kind: 'live', seconds, frame } : id === 'sandglass' ? { logicalSeconds: Number(data.logicalSeconds ?? seconds) } : { seconds, frame })));
}

export const STUDIES: readonly Study[] = [
  {
    id: 'sandglass', number: '01', title: 'Sandglass Queue', subtitle: 'Matter as an explanation', color: '#d9ef70',
    description: 'Two vessels, one stream of requests. Change the workers and watch waiting become visible.',
    kind: 'interactive', seconds: 98, settled: 12, logicalCount: 1152,
    thumbnail: '<path d="M29 15H65L58 36L65 59H29L36 36Z"/><path d="M91 15H127L120 36L127 59H91L98 36Z"/><path class="detail" d="M34 24H60M33 53H61M96 24H122M95 53H123"/>',
    load: () => loadStudy('sandglass', 'INITIAL_SANDGLASS'),
  },
  {
    id: 'cleft', number: '02', title: 'Cleft', subtitle: 'One contour, many materials', color: '#e7e9e4',
    description: 'An interlocking mineral mark. Reveal its stepped cut, then move between ink, mineral, and graphite.',
    kind: 'pointer', seconds: 8, settled: 7.2, logicalCount: 8192,
    thumbnail: '<g transform="translate(52 8) scale(.5)"><path d="M8 8H92V38H62V62H38V82H8Z"/><path d="M92 48H72V72H48V92H8V112H92Z"/></g>',
    load: () => loadStudy('cleft', 'INITIAL_CLEFT'),
  },
  {
    id: 'returning-shore', number: '03', title: 'The Returning Shore', subtitle: 'A painting that repairs itself', color: '#b68d48',
    description: 'Sweep pigment aside to uncover an older shoreline. Four seconds later, the painting finds its way home.',
    kind: 'interactive', seconds: 120, settled: 6, logicalCount: 18000,
    thumbnail: '<path d="M19 54C27 40 46 44 57 33S70 20 83 27S96 48 111 31S127 24 138 18"/><path class="detail" d="M20 62C44 42 58 48 73 38S94 51 117 36S136 39 141 28"/>',
    load: () => loadStudy('returning-shore', 'INITIAL_SHORE'),
  },
  {
    id: 'borrowed-shapes', number: '04', title: 'Borrowed Shapes', subtitle: 'The same grains, another life', color: '#b2a0d1',
    description: 'A seed grows into a tree and becomes a citadel. Follow the grains that keep their identities along the way.',
    kind: 'interactive', seconds: 30, settled: 4.5, logicalCount: 19600,
    thumbnail: '<path d="M76 61V27M76 42L51 28M76 35L98 19M76 29L70 14M76 48L110 35M76 51L43 45"/><path class="detail" d="M58 64H96"/>',
    load: () => loadStudy('borrowed-shapes', 'INITIAL_FORMS'),
  },
  {
    id: 'aster-basin', number: '05', title: 'Aster Basin', subtitle: 'A city, a route, two futures', color: '#78d8d2',
    description: 'Navigate a tidal city, compare two imagined shorelines, and watch the present return to grains.',
    kind: 'interactive', seconds: 50, settled: 13, logicalCount: 24000,
    thumbnail: '<path d="M20 56V32H38V56M48 56V18H67V56M88 56V25H105V56M119 56V38H136V56"/><path class="detail" d="M16 65H73V45H115V13"/>',
    load: () => loadStudy('aster-basin', 'INITIAL_ATLAS'),
  },
];

export function findStudy(id: string): Study {
  const study = STUDIES.find((value) => value.id === id);
  if (!study) throw new Error(`Unknown material study: ${id}`);
  return study;
}
