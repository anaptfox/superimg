import { image, arrange, Frame, Fill, Text } from "@foxworth/superimg";

const PAPER = "#E7E1D4";
const INK = "#1C1E22";
const CONTEXT = { width: 984, height: 562 };
const PAY = { x: 580, y: 280, width: 140, height: 36 };

function board() {
  return Frame(
    { width: "fill", height: "fill", fill: PAPER },
    Fill({ x: 40, y: 36, width: 200, height: 18, color: "rgba(28,30,34,0.2)" }),
    Fill({ x: 40, y: 80, width: 520, height: 200, color: "rgba(28,30,34,0.08)" }),
    Frame(
      { id: "pay-button", ...PAY, fill: INK, radius: 4, pad: { x: 16, y: 8 } },
      Text({ variant: "label", size: 14, color: PAPER, weight: 700 }, "Pay"),
    ),
  );
}

function pay() {
  return Frame(
    { width: "fill", height: "fill", fill: PAPER },
    Fill({ width: "fill", height: "fill", color: INK, radius: 6 }),
    Frame(
      { pad: 24 },
      Text({ variant: "label", size: 22, color: PAPER, weight: 700 }, "Pay  ·  spacing differs from spec"),
    ),
  );
}

export default image({
  size: { width: 1080, height: 1080 },
  render() {
    return arrange.pointWithContext({
      question: "Where is the broken Pay button?",
      workRemoved: "Finding the exact object being discussed in the larger checkout",
      evidence: "interpretation",
      context: { id: "checkout", label: "Checkout", view: board() },
      focus: {
        id: "pay",
        label: "Pay",
        view: pay(),
        region: { x: PAY.x / CONTEXT.width, y: PAY.y / CONTEXT.height, width: PAY.width / CONTEXT.width, height: PAY.height / CONTEXT.height },
      },
      correspondence: "inset",
      source: "synthetic checkout · marker B",
    });
  },
});
