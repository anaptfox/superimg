import { video } from '@foxworth/superimg';
import { arrange, type ArrangeRequest, type IntervalMotionPhase } from '@foxworth/superimg/stdlib/arrange';
import { DURATION, makeRequest, SIZE } from './requests.ts';

export function phaseAt(progress: number): IntervalMotionPhase {
  return progress >= 0.65 ? 'reveal' : progress >= 0.3 ? 'predict' : 'hold';
}

/** The exact same checked request feeds Player and both runtime exporters. */
export function makeMedia(raw: unknown) {
  const request = arrange.parseRequest(raw);
  const failures = arrange.checkRequest(request);
  if (failures.length) throw new Error(failures.map(f => `${f.code}: ${f.message}`).join('\n'));
  return video({
    size: request.spec.size ?? SIZE,
    duration: '6s',
    fps: 30,
    render(ctx) {
      const onStage = { ...request, spec: { ...request.spec, size: { width: ctx.width, height: ctx.height } } } as ArrangeRequest;
      return arrange.renderRequest(onStage, phaseAt(ctx.timeline.progress));
    },
  });
}

export { DURATION };
export default makeMedia(makeRequest('timeline', 4));
