export const DRIVERS = 4000;
export const FIXED_MINUTES = 45;
export const CONGESTION_DIVISOR = 100;

export function costs(upper: number, lower: number, shortcut: number) {
  if ([upper, lower, shortcut].some(n => !Number.isFinite(n) || n < 0) || upper + lower + shortcut !== DRIVERS) {
    throw new Error('Route flows must be finite, nonnegative, and sum to 4000.');
  }
  const first = (upper + shortcut) / CONGESTION_DIVISOR;
  const last = (lower + shortcut) / CONGESTION_DIVISOR;
  return { first, last, upper: first + FIXED_MINUTES, lower: FIXED_MINUTES + last, shortcut: first + last };
}

export const BEFORE = costs(2000, 2000, 0);
export const AFTER = costs(0, 0, 4000);
export const CHANGE = AFTER.shortcut - BEFORE.upper;

export const BEATS = [
  { id: 'hook', start: 0, end: 5, title: 'Would you build this road?',
    voice: 'Would you build a road that takes zero minutes? Watch what happens.' },
  { id: 'rules', start: 5, end: 15, title: '4,000 drivers. Two routes.',
    voice: 'Four thousand drivers. Two routes. The mint roads slow with traffic: drivers divided by a hundred, in minutes. The gray roads always take forty-five.' },
  { id: 'baseline', start: 15, end: 23, title: 'An even split.',
    voice: 'Traffic splits evenly. Two thousand drivers per route. Twenty minutes on the busy road, plus forty-five on the other. Sixty-five minutes each.' },
  { id: 'predict', start: 23, end: 34, title: 'What if everyone can use it?',
    voice: 'Add a free shortcut. With the original traffic, one driver could do the trip in about forty minutes. What happens when everyone can use it?' },
  { id: 'reveal', start: 34, end: 45, title: 'Everyone takes the shortcut.',
    voice: 'Even at full load, each busy road takes forty minutes, beating forty-five. Everyone chooses both busy roads. Forty plus zero plus forty: eighty.' },
  { id: 'escape', start: 45, end: 58, title: 'Can one driver do better?',
    voice: 'Why not switch back? With everyone else on the shortcut, either old route now takes eighty-five. No driver can improve alone.' },
  { id: 'resolve', start: 58, end: 70, title: 'Close the shortcut.',
    voice: 'Close the shortcut. Traffic splits again. Back to sixty-five. That is Braess\'s paradox: individual shortcuts can create a collective slowdown.' },
] as const;

export function beatAt(seconds: number) {
  return BEATS.find(beat => seconds >= beat.start && seconds < beat.end) ?? BEATS[BEATS.length - 1];
}
