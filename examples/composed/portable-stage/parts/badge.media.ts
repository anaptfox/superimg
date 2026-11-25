import { svg, Vector, vector } from "@foxworth/superimg";

export default svg({
  size: { width: 600, height: 180 },
  render() {
    return Vector({ id: "badge", width: 600, height: 180, viewBox: { x: 0, y: 0, width: 600, height: 180 } },
      vector.path({ id: "plate", d: "M28 0H572Q600 0 600 28V152Q600 180 572 180H28Q0 180 0 152V28Q0 0 28 0Z", fill: "#e6f7f6" }),
      vector.path({ id: "bar", d: "M28 0H74V180H28Q0 180 0 152V28Q0 0 28 0Z", fill: "#77d6db" }),
      vector.text({ id: "label", x: 110, y: 80, size: 42, weight: 700, family: "system-ui", fill: "#172540", dominantBaseline: "middle" }, "VECTOR"),
      vector.text({ id: "note", x: 112, y: 130, size: 25, weight: 500, family: "system-ui", fill: "#53707a", dominantBaseline: "middle" }, "a still inside a film"),
    );
  },
});
