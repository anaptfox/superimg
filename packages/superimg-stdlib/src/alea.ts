/**
 * Alea PRNG - Seeded random number generator
 * 
 * From http://baagoe.com/en/RandomMusings/javascript/
 * Johannes Baagøe <baagoe@baagoe.com>, 2010
 * 
 * Provides deterministic random number generation with seed support
 */

export interface AleaPRNG {
  (): number;
  next: () => number;
  uint32: () => number;
  fract53: () => number;
  version: string;
  args: (string | number)[];
  exportState: () => [number, number, number, number];
  importState: (state: [number, number, number, number]) => void;
}

/**
 * Mash hash function for seeding
 */
function Mash() {
  let n = 0xefc8249d;

  const mash = function (data: string | number): number {
    data = data.toString();
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      let h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000; // 2^32
    }
    return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
  };

  mash.version = 'Mash 0.9';
  return mash;
}

/**
 * Create a new Alea PRNG instance
 * @param args - Seed arguments (strings or numbers)
 * @returns PRNG function
 */
function Alea(...args: (string | number)[]): AleaPRNG {
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let c = 1;

  if (args.length === 0) {
    args = [+new Date()];
  }

  const mash = Mash();
  s0 = mash(' ');
  s1 = mash(' ');
  s2 = mash(' ');

  for (let i = 0; i < args.length; i++) {
    s0 -= mash(args[i]);
    if (s0 < 0) {
      s0 += 1;
    }
    s1 -= mash(args[i]);
    if (s1 < 0) {
      s1 += 1;
    }
    s2 -= mash(args[i]);
    if (s2 < 0) {
      s2 += 1;
    }
  }

  const random = function (): number {
    const t = 2091639 * s0 + c * 2.3283064365386963e-10; // 2^-32
    s0 = s1;
    s1 = s2;
    return (s2 = t - (c = t | 0));
  } as AleaPRNG;

  random.next = random;
  random.uint32 = function (): number {
    return random() * 0x100000000; // 2^32
  };
  random.fract53 = function (): number {
    return random() + (random() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
  };
  random.version = 'Alea 0.9';
  random.args = args;

  random.exportState = function (): [number, number, number, number] {
    return [s0, s1, s2, c];
  };

  random.importState = function (state: [number, number, number, number]): void {
    s0 = +state[0] || 0;
    s1 = +state[1] || 0;
    s2 = +state[2] || 0;
    c = +state[3] || 0;
  };

  return random;
}

// Attach static method
const AleaFunction = Alea as typeof Alea & {
  importState: (state: [number, number, number, number]) => AleaPRNG;
};

AleaFunction.importState = function (state: [number, number, number, number]): AleaPRNG {
  const random = Alea();
  random.importState(state);
  return random;
};

export default AleaFunction;
