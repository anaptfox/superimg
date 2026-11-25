/** Centimetres. These values feed both rendered geometry and conservative review bounds. */
export const SPOON_DESIGN = {
  metal: "#b08d57", bowl: { x: .9, y: .22, z: 1.5 },
  stem: { topRadius: .14, bottomRadius: .23, length: 7, centerZ: 4 },
};
export const SPOON_POSE = { position: [-12, .42, 14.2], tilt: .025, yaw: Math.PI / 2 };
/** Retained failed staging from the first film; this must continue to produce a finding. */
export const ORIGINAL_SPOON_POSE = { position: [-11.5, .42, 10], tilt: .025, yaw: 1.74 };
export const HANDLE_POINTS = [[4.05, 7.9], [5.4, 8.25], [6.55, 7.3], [6.7, 5.4], [5.9, 3.6], [4.15, 2.9]];
export const HANDLE_TUBE = { radius: .5, flatten: .78, depth: 1.35, taper: .18 };
