import { video, Frame, Fill, Text, Vector, vector, type MediaElement, googleFont } from '@foxworth/superimg';
import { AFTER, BEFORE, BEATS, CHANGE, beatAt } from './model.ts';
import audio from './assets/audio.generated.json';

export const PALETTE = {
  bg: '#071C26', ink: '#F4F0E6', muted: '#A5BBC1', mint: '#5BDDC7',
  chalk: '#9BB0B8', amber: '#FFD166', coral: '#FF7768', hair: '#25424C',
};
const P = PALETTE;
type Point = readonly [number, number];
const S: Point = [270, 565], A: Point = [765, 340], B: Point = [765, 795], T: Point = [1250, 565];
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => 1 - Math.pow(1 - clamp(n), 3);
const line = (points: readonly Point[]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
const circle = (x: number, y: number, r: number) => `M${x - r},${y}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;

function atPath(points: readonly Point[], progress: number): Point {
  const lengths = points.slice(1).map((point, i) => Math.hypot(point[0] - points[i][0], point[1] - points[i][1]));
  let remaining = clamp(progress) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const p = remaining / lengths[i];
      return [points[i][0] + (points[i + 1][0] - points[i][0]) * p, points[i][1] + (points[i + 1][1] - points[i][1]) * p];
    }
    remaining -= lengths[i];
  }
  return points[points.length - 1];
}

function arrow(id: string, from: Point, to: Point, color: string, opacity = 1, at = 0.57): MediaElement {
  const [x, y] = atPath([from, to], at);
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const backX = x - Math.cos(angle) * 16, backY = y - Math.sin(angle) * 16;
  return vector.path({ id, d: `M${backX - Math.sin(angle) * 8},${backY + Math.cos(angle) * 8}L${x},${y}L${backX + Math.sin(angle) * 8},${backY - Math.cos(angle) * 8}`, fill: 'none', stroke: color, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', opacity });
}

function textBox(id: string, text: string, x: number, y: number, width: number, size: number, color = P.ink, align: 'left' | 'center' | 'right' = 'left', weight = 600) {
  const lines = text.split('\n');
  return Frame({ id: `${id}-box`, x, y, width, height: size * 2.5, overflow: 'visible' },
    ...lines.map((line, index) => Frame({ id: `${id}-line-${index}`, x: 0, y: index * size * 1.2, width, height: size * 1.2 },
      Text({ id: index === 0 ? id : `${id}-${index}`, size, color, fontFamily: 'Inter', weight, align, lineHeight: 1.12 }, line))));
}

function roadLabel(id: string, value: string, flow: string, x: number, y: number, color: string) {
  return Frame({ id: `${id}-labels`, x, y, width: 290, height: 100, overflow: 'visible' },
    Text({ id: `${id}-cost`, size: 36, color, weight: 650, fontFamily: 'Inter', align: 'center' }, value),
    Frame({ x: 0, y: 52, width: 290, height: 32 }, Text({ id: `${id}-flow`, size: 21, color: P.muted, align: 'center', fontFamily: 'Inter' }, flow)),
  );
}

export default video({
  size: { width: 1920, height: 1080 },
  duration: '70s', fps: 30, poster: '41s',
  fonts: [googleFont('Inter:wght@400;500;600;700;800')],
  audio: {
    clips: [
      { id: 'narration', label: 'Narration', src: audio.narration, role: 'voice', volume: 1 },
      { id: 'score', label: 'Original synthetic score', src: audio.score, role: 'music', volume: 0.65 },
    ],
    mix: { master: 1, ducking: false },
  },
  render(ctx) {
    const seconds = ctx.timeline.seconds;
    const beat = beatAt(seconds);
    const d = ctx.director({ hook: '5s', rules: '10s', baseline: '8s', predict: '11s', reveal: '11s', escape: '13s', resolve: '12s' });
    const equilibrium = seconds >= 34.55 && seconds < 60.2;
    const after = equilibrium ? AFTER : BEFORE;
    const showRule = seconds >= 5 && seconds < 15;
    const showCosts = seconds >= 5;
    const showFlow = seconds >= 15;
    const shortcutOpacity = seconds < 5 ? ease((seconds - 0.3) / 0.5) : seconds < 23 ? 0 : seconds < 58.4 ? ease((seconds - 23) / 0.5) : 1 - ease((seconds - 58.4) / 0.55);
    const shortcutGhost = seconds < 5;
    const revealAnswer = seconds >= 39 && seconds < 45;
    const escapeUpper = seconds >= 46 && seconds < 50.5;
    const escapeLower = seconds >= 50.5 && seconds < 54.5;
    const escaped = escapeUpper || escapeLower;
    const returned = seconds >= 61.8;
    const roadmap = seconds < 5 ? 0.5 : 1;
    const quietFixed = equilibrium ? 0.25 : 0.72;

    const roads: MediaElement[] = [
      vector.path({ id: 'road-SA', d: line([S, A]), fill: 'none', stroke: P.mint, strokeWidth: equilibrium ? 13 : 8, strokeLinecap: 'round', opacity: roadmap }),
      vector.path({ id: 'road-AT', d: line([A, T]), fill: 'none', stroke: P.chalk, strokeWidth: 8, strokeLinecap: 'round', opacity: escapeUpper ? 1 : quietFixed * roadmap }),
      vector.path({ id: 'road-SB', d: line([S, B]), fill: 'none', stroke: P.chalk, strokeWidth: 8, strokeLinecap: 'round', opacity: escapeLower ? 1 : quietFixed * roadmap }),
      vector.path({ id: 'road-BT', d: line([B, T]), fill: 'none', stroke: P.mint, strokeWidth: equilibrium ? 13 : 8, strokeLinecap: 'round', opacity: roadmap }),
      vector.path({ id: 'road-shortcut', d: line([A, B]), fill: 'none', stroke: P.amber, strokeWidth: 8, strokeDasharray: shortcutGhost ? '13 13' : undefined, strokeLinecap: 'round', opacity: shortcutOpacity }),
      arrow('dir-SA', S, A, P.ink, roadmap), arrow('dir-AT', A, T, P.ink, quietFixed * roadmap),
      arrow('dir-SB', S, B, P.ink, quietFixed * roadmap), arrow('dir-BT', B, T, P.ink, roadmap),
      arrow('dir-AB', A, B, P.amber, shortcutOpacity, 0.58),
    ];

    // Short route traces represent choices, not a microscopic traffic simulation.
    const traces: { id: string; points: Point[]; at: number; duration: number; color: string }[] = [
      { id: 'upper-choice', points: [S, A, T], at: 15.5, duration: 1.2, color: P.mint },
      { id: 'lower-choice', points: [S, B, T], at: 18.5, duration: 1.2, color: P.mint },
      { id: 'one-shortcut', points: [S, A, B, T], at: 24.2, duration: 1.7, color: P.amber },
      { id: 'all-shortcut', points: [S, A, B, T], at: 35, duration: 1.5, color: P.amber },
      { id: 'escape-upper', points: [S, A, T], at: 46.2, duration: 1.3, color: P.coral },
      { id: 'escape-lower', points: [S, B, T], at: 50.7, duration: 1.3, color: P.coral },
      { id: 'restore-upper', points: [S, A, T], at: 60.4, duration: 1.2, color: P.mint },
      { id: 'restore-lower', points: [S, B, T], at: 61.1, duration: 1.2, color: P.mint },
    ];
    const tokens = traces.flatMap(trace => {
      const p = (seconds - trace.at) / trace.duration;
      const opacity = p >= 0 && p <= 1 ? Math.min(1, p * 10, (1 - p) * 10) : 0;
      const [x, y] = atPath(trace.points, ease(p));
      return [
        vector.path({ id: `${trace.id}-halo`, d: circle(x, y, 27), fill: trace.color, opacity: opacity * 0.13 }),
        vector.path({ id: `${trace.id}-dot`, d: circle(x, y, 11), fill: trace.color, stroke: P.bg, strokeWidth: 3, opacity }),
      ];
    });

    const nodes = ([['S', S], ['A', A], ['B', B], ['T', T]] as const).flatMap(([id, [x, y]]) => [
      vector.path({ id: `node-${id}`, d: circle(x, y, id === 'S' || id === 'T' ? 36 : 29), fill: P.bg, stroke: P.ink, strokeWidth: 2.5 }),
      vector.text({ id: `node-${id}-label`, x, y: y + 1, size: 26, weight: 600, family: 'Inter', fill: P.ink, anchor: 'middle', dominantBaseline: 'central' }, id),
    ]);

    let title: string = beat.title;
    let sub: string = 'Same 4,000 drivers. One new choice.';
    let metric = '?';
    let equation = '';
    let metricLabel = 'MINUTES PER DRIVER';
    let metricColor = P.ink;
    let extra = '';
    if (beat.id === 'hook') { equation = 'NEW ROAD'; metric = '0'; metricLabel = 'MINUTES TO CROSS'; metricColor = P.amber; sub = 'A shortcut should help. Right?'; }
    if (beat.id === 'rules') { metric = '4,000'; metricLabel = 'DRIVERS'; equation = 'S → T'; sub = 'x = drivers using that road · edge labels are minutes'; }
    if (beat.id === 'baseline') { equation = '20 + 45'; metric = String(BEFORE.upper); metricColor = P.mint; extra = 'Both routes tie.'; sub = '2,000 drivers above. 2,000 below.'; }
    if (beat.id === 'predict') {
      title = seconds < 29.5 ? 'One driver finds a shortcut.' : 'What if everyone can use it?';
      equation = seconds < 29.5 ? '20 + 0 + 20' : 'FASTER / SAME / SLOWER?';
      metric = seconds < 29.5 ? '≈40' : '?'; metricColor = P.amber;
      sub = seconds < 29.5 ? 'One tiny driver, with the original traffic.' : 'Make your prediction.';
      extra = seconds >= 31 && seconds < 34 ? `${Math.ceil(34 - seconds)}` : '';
    }
    if (beat.id === 'reveal') {
      equation = seconds < 38.5 ? '40 < 45' : '40 + 0 + 40';
      metric = revealAnswer ? String(AFTER.shortcut) : '?';
      metricColor = P.coral; extra = revealAnswer ? `+${CHANGE} minutes.\nEvery driver.` : 'Both busy roads beat 45.';
      sub = 'New equilibrium · all 4,000 use the zigzag.';
    }
    if (beat.id === 'escape') {
      title = seconds >= 54.5 ? 'No one can improve alone.' : 'Can one driver do better?';
      equation = escapeUpper ? '40 + 45' : escapeLower ? '45 + 40' : '40 + 0 + 40';
      metric = String(escaped ? AFTER.upper : AFTER.shortcut); metricColor = escaped ? P.chalk : P.coral;
      extra = escaped ? 'Switching is even slower.' : 'An equilibrium. Not a win.';
      sub = 'Hold everyone else’s route fixed.';
    }
    if (beat.id === 'resolve') {
      title = seconds >= 65 ? 'Braess’s paradox.' : 'Close the shortcut.';
      equation = returned ? '20 + 45' : '40 + 0 + 40';
      metric = String(returned ? BEFORE.upper : AFTER.shortcut); metricColor = returned ? P.mint : P.coral;
      extra = returned ? '15 minutes saved.' : '';
      sub = seconds >= 65 ? 'More choice can make everyone worse off.' : 'Remove one edge. Restore the even split.';
    }

    const labels: MediaElement[] = [];
    if (showCosts) {
      const variable = showRule ? 'x / 100 min' : `${after.first} min`;
      const flow = showFlow ? `${equilibrium ? '4,000' : '2,000'} drivers` : 'depends on traffic';
      labels.push(roadLabel('SA', variable, flow, 346, 330, P.mint), roadLabel('BT', variable, flow, 892, 745, P.mint));
      labels.push(roadLabel('AT', '45 min', 'fixed travel time', 899, 330, P.chalk), roadLabel('SB', '45 min', 'fixed travel time', 346, 745, P.chalk));
    }
    const sectionIndex = BEATS.findIndex(b => b.id === beat.id);
    return Frame({ id: 'film', width: ctx.width, height: ctx.height },
      Fill({ color: P.bg }),
      Frame({ id: 'design-plane', width: 1920, height: 1080 },
        textBox('brand', 'THE MATHEMATICS OF BAD IDEAS', 192, 73, 1200, 19, P.muted, 'left', 500),
        Frame({ id: 'heading', x: 192, y: 126, width: 1580, height: 110, motion: d.motion({ id: `heading-${beat.id}`, target: 'heading', during: beat.id, y: 17, for: '0.4s' }) },
          Text({ id: 'headline', size: 68, weight: 700, color: P.ink, fontFamily: 'Inter', lineHeight: 1.12 }, title)),
        Vector({ id: 'network', width: 1920, height: 1080, viewBox: { x: 0, y: 0, width: 1920, height: 1080 } },
          vector.path({ id: 'metric-divider', d: 'M1375,308V834', fill: 'none', stroke: P.hair, strokeWidth: 1 }),
          ...roads, ...tokens, ...nodes,
          vector.group({ id: 'shortcut-label', opacity: shortcutOpacity },
            vector.path({ d: 'M802,525H970V606H802Z', fill: P.bg }),
            vector.text({ x: 818, y: 565, size: 38, fill: P.amber, family: 'Inter', weight: 650 }, '0 min'),
            vector.text({ x: 818, y: 597, size: 18, fill: P.muted, family: 'Inter' }, 'one-way'),
          ),
          vector.group({ id: 'closure-mark', opacity: seconds >= 58.4 ? ease((seconds - 58.4) / 0.5) : 0 },
            vector.path({ d: 'M744,548L786,590M786,548L744,590', stroke: P.coral, strokeWidth: 5, strokeLinecap: 'round' }),
          ),
        ),
        ...labels,
        textBox('source-name', 'START', 205, 617, 130, 17, P.muted, 'center', 500),
        textBox('target-name', 'FINISH', 1185, 617, 130, 17, P.muted, 'center', 500),
        textBox('equation', equation, 1420, 365, 335, equation.length > 17 ? 23 : 35, P.muted),
        textBox('metric', metric, 1408, 430, 370, metric === '4,000' ? 108 : 162, metricColor, 'left', 600),
        textBox('metric-label', metricLabel, 1420, 640, 350, 19, P.muted, 'left', 500),
        textBox('extra', extra, 1420, 704, 345, extra.length > 18 ? 25 : 32, metricColor, 'left', 500),
        textBox('takeaway', sub, 192, 925, 1540, 29, P.ink, 'left', 500),
        textBox('model-note', 'Schematic route-choice model · motion shows routes, not traffic dynamics', 192, 989, 1280, 17, P.muted, 'left', 400),
        textBox('chapter', `${String(sectionIndex + 1).padStart(2, '0')} / 07`, 1580, 991, 148, 17, P.muted, 'right', 500),
        Frame({ id: 'progress-base', x: 192, y: 1040, width: 1536, height: 2 }, Fill({ color: P.hair })),
        Frame({ id: 'progress', x: 192, y: 1040, width: Math.max(1, 1536 * ctx.timeline.progress), height: 2 }, Fill({ color: P.mint })),
      ),
    );
  },
});
