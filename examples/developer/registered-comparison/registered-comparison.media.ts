import { image, arrange, Frame, Stack, Text, Fill } from "@foxworth/superimg";

const PAPER = "#E7E1D4";
const INK = "#1C1E22";

function header(stateId: string, ctaPad: number) {
  return Frame(
    { width: "fill", height: "fill", fill: PAPER },
    Frame(
      { id: `${stateId}-header`, width: "fill", height: 200 },
      Fill({ color: INK, width: "fill", height: "fill" }),
      Stack(
        { direction: "row", align: "center", justify: "space-between", pad: 42, width: "fill", height: 200 },
        Text({ id: `${stateId}-logo`, variant: "title", size: 46, color: PAPER, weight: 700 }, "Acme"),
        Stack(
          { id: `${stateId}-nav`, direction: "row", gap: 32, align: "center" },
          Text({ variant: "label", size: 27, color: PAPER }, "Shop"),
          Text({ variant: "label", size: 27, color: PAPER }, "Help"),
          Frame(
            { id: `${stateId}-cta`, pad: { x: 24, y: ctaPad }, fill: PAPER, radius: 6 },
            Text({ variant: "label", size: 29, color: INK, weight: 700 }, "Sign in"),
          ),
        ),
      ),
    ),
    Frame(
      { x: 42, y: 254, width: 900, height: 94 },
      Stack(
        { width: "fill", gap: 14 },
        Text({ variant: "title", size: 34, color: INK, weight: 600 }, "Your order"),
        Text({ variant: "body", size: 24, color: "#615D55" }, "The checkout content stays in the same place."),
      ),
    ),
  );
}

export default image({
  size: { width: 1080, height: 1080 },
  render() {
    return arrange.registeredComparison({
      question: "What differs in the checkout header?",
      workRemoved: "Matching corresponding elements and remembering the reference",
      evidence: "interpretation",
      states: [
        { id: "before", label: "Before  ·  A", view: header("before", 10) },
        { id: "after", label: "After  ·  B", view: header("after", 30) },
      ],
      layout: "stacked",
      frame: {
        scale: "shared",
        viewport: { width: 984, height: 400 },
        crop: "header and checkout heading",
      },
      correspondence: ["logo", "nav", "cta"],
      source: "synthetic checkout · same viewport · only button padding changes",
    });
  },
});
