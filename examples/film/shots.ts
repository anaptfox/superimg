import { vector } from "@foxworth/superimg";
import { closeOn, ellipse, line, poly, r, span, type Shot } from "@foxworth/superimg/film";
import { mira, pip } from "./series";

function coast(light: number) {
  return [
    r(0, 0, 360, 640, "#23485a"),
    ellipse(264, 186, 49, 49, "#bae4dd", 0.6),
    ...[270, 295, 325].map((y, i) => ellipse(180, y, 180, 16 + i * 4, "#a9cbc1", 0.12)),
    r(0, 350, 360, 290, "#153749"),
    ...[372, 399, 425, 472, 504].map((y, i) => line(24 + i * 26, y, 133 + i * 45, y, "#3d6571", 2)),
    poly([[0, 550], [38, 512], [140, 527], [214, 480], [308, 500], [360, 464], [360, 640], [0, 640]], "#102b3a"),
    poly([[246, 301], [282, 301], [297, 498], [232, 498]], "#9db5a8"),
    r(243, 266, 42, 40, "#253d48"),
    poly([[237, 266], [265, 239], [291, 266]], "#884e55"),
    vector.group({ opacity: light * 0.62 },
      poly([[250, 281], [0, 241], [0, 338], [250, 292]], "#f8dc92")),
  ];
}

export const lookout: Shot = ({ t }) => [
  ...coast(1 - span(t, 0, 0.28)),
  mira(t, { x: 105, y: 550 }),
  pip(t, { x: 177, y: 530 }, { size: 8 }),
];

export const lantern: Shot = ({ t }) => [
  closeOn({ x: 166, y: 443 }, { zoom: 1.18, y: 393 }, [
    ...coast(0),
    mira(t, { x: 105, y: 550 }),
    pip(t, { x: 177, y: 530 }, { size: 8 }),
    ellipse(177, 476, 28, 23, "#ffc969", span(t, 0.2, 0.65) * 0.32),
  ]),
];

export const harbor: Shot = ({ t }) => [
  ...coast(span(t, 0, 0.4)),
  mira(t, { x: 105, y: 550 }),
  pip(t, { x: 177, y: 530 }, { size: 8 }),
];
