globalThis.superimgSample = (seconds, viewport, state) => {
  if (state.x < 0) throw new Error("invalid position");
  return {
    width: 100,
    height: 100,
    draw: [
      { id: "ground", kind: "rect", x: 0, y: 0, width: 100, height: 100, color: "#194020" },
      {
        id: "nell", kind: "sprite", x: state.x + seconds, y: 38, width: 16, height: 12,
        asset: state.asset,
      },
    ],
    anchors: [
      { entity: "nell", name: "talk", x: state.x + seconds + 8, y: viewport.reduceMotion ? 30 : 32 },
    ],
  };
};
