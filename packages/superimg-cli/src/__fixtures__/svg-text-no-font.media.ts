import { svg, Vector, vector } from "@foxworth/superimg";

export default svg({
  size: { width: 200, height: 80 },
  render: () => Vector(
    { width: 200, height: 80, viewBox: { x: 0, y: 0, width: 200, height: 80 } },
    vector.text({ x: 10, y: 50 }, "hello"),
  ),
});
