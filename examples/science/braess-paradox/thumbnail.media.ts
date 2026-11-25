import { image, Frame, Fill, Vector, vector, googleFont } from '@foxworth/superimg';

const bg = '#071C26', ink = '#F4F0E6', mint = '#5BDDC7', amber = '#FFD166', coral = '#FF7768';
const ring = (x: number, y: number) => `M${x - 25},${y}a25,25 0 1,0 50,0a25,25 0 1,0 -50,0`;

export default image({
  size: { width: 1920, height: 1080 },
  fonts: [googleFont('Inter:wght@500;600;700;800')],
  render() {
    return Frame({ width: 1920, height: 1080 },
      Fill({ color: bg }),
      Vector({ width: 1920, height: 1080, viewBox: { x: 0, y: 0, width: 1920, height: 1080 } },
        vector.text({ x: 140, y: 310, size: 108, weight: 800, fill: ink, family: 'Inter' },
          vector.run({}, 'A'), vector.run({ dx: 30 }, 'FREE'), vector.run({ dx: 30 }, 'ROAD.')),
        vector.text({ x: 140, y: 465, size: 100, weight: 800, fill: coral, family: 'Inter' },
          vector.run({}, 'A'), vector.run({ dx: 28 }, 'SLOWER'), vector.run({ dx: 28 }, 'TRIP.')),
        vector.text({ x: 140, y: 792, size: 172, weight: 600, fill: ink, family: 'Inter' }, '65 → 80'),
        vector.text({ x: 150, y: 879, size: 30, weight: 500, fill: '#A5BBC1', family: 'Inter' }, 'MINUTES. FOR EVERYONE.'),
        vector.path({ d: 'M1080,585L1400,315L1750,585', fill: 'none', stroke: '#617C86', strokeWidth: 9, strokeLinecap: 'round' }),
        vector.path({ d: 'M1080,585L1400,855L1750,585', fill: 'none', stroke: '#617C86', strokeWidth: 9, strokeLinecap: 'round' }),
        vector.path({ d: 'M1080,585L1400,315M1400,855L1750,585', fill: 'none', stroke: mint, strokeWidth: 13, strokeLinecap: 'round' }),
        vector.path({ d: 'M1400,315V855', fill: 'none', stroke: amber, strokeWidth: 13, strokeLinecap: 'round' }),
        vector.path({ d: 'M1385,595L1400,618L1415,595', fill: 'none', stroke: amber, strokeWidth: 6, strokeLinecap: 'round', strokeLinejoin: 'round' }),
        ...([[1080, 585], [1400, 315], [1400, 855], [1750, 585]] as const).map(([x, y]) => vector.path({ d: ring(x, y), fill: bg, stroke: ink, strokeWidth: 4 })),
        vector.path({ d: 'M1430,500H1710V570H1430Z', fill: bg }),
        vector.text({ x: 1445, y: 555, family: 'Inter', size: 55, weight: 700, fill: amber }, '0 MIN'),
      ),
    );
  },
});
