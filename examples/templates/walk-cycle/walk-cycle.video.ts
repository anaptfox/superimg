// Walk Cycle — Stick Figure Walking Animation
// Demonstrates: SVG line drawing + biomechanics-driven character animation

import { defineScene } from "superimg";

const { sin, cos, max, PI } = Math;
const TAU = PI * 2;
const DEG = PI / 180;

function joint(px: number, py: number, angleDeg: number, length: number) {
  const rad = angleDeg * DEG;
  return { x: px + sin(rad) * length, y: py + cos(rad) * length };
}

function line(x1: number, y1: number, x2: number, y2: number, color: string, width: number) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
}

function dot(x: number, y: number, r: number, color: string) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
}

function foot(ankleX: number, ankleY: number, angleDeg: number, color: string, width: number) {
  const len = 20;
  const rad = angleDeg * DEG;
  return line(ankleX, ankleY, ankleX + cos(rad) * len, ankleY + sin(rad) * len, color, width);
}

// Asymmetric bob: sharper impact, softer push-off
function asymBob(ca: number, amp: number): number {
  const s = sin(ca * 2);
  return (s < 0 ? s * 1.4 : s * 0.7) * amp;
}

export default defineScene({
  data: {
    frontColor: "#e0e0ff",
    backColor: "#7878a0",
    accentColor: "#667eea",
  },

  config: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 4,
    inlineCss: [`
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0f0f23; overflow: hidden; }
    `],
  },

  render(ctx) {
    const { std, sceneProgress, width, height, data } = ctx;
    const { frontColor, backColor, accentColor } = data;

    // --- Walk cycle ---
    const CYCLES = 6;
    const cycle = (sceneProgress * CYCLES) % 1;
    const ca = cycle * TAU;

    // --- Stride geometry ---
    // Match ground scroll speed to leg stride so feet plant correctly
    const UPPER_LEG = 55;
    const LOWER_LEG = 55;
    const HIP_SWING = 30; // degrees
    // Approximate stride length: 2 * sin(swing) * upper_leg
    const strideLength = 2 * sin(HIP_SWING * DEG) * UPPER_LEG;
    // Ground scrolls one stride per cycle
    const groundScroll = sceneProgress * CYCLES * strideLength;

    // --- Figure stays near center, drifts slightly ---
    const figX = width / 2 + std.tween(-100, 100, sceneProgress);
    const GROUND_Y = 720;

    // --- Body dynamics ---
    const bodyBob = asymBob(ca, 5);
    const bodyLean = 3 + sin(ca) * 1.5;
    const lateralSway = sin(ca) * 2;
    const headCounterBob = asymBob(ca + PI, 2);

    const hipX = figX + sin(ca) * 1.5;
    const hipY = GROUND_Y - 105 + bodyBob;

    // --- Torso ---
    const shoulder = joint(hipX, hipY, 180 + bodyLean + lateralSway, 80);

    // --- Head ---
    const headY = shoulder.y - 28 + headCounterBob;
    const headX = shoulder.x + sin(ca - 0.3) * 1.5;

    // --- Legs ---
    const leftUpperLeg = sin(ca) * HIP_SWING;
    const rightUpperLeg = sin(ca + PI) * HIP_SWING;

    const leftStance = max(0, cos(ca)) * 8;
    const rightStance = max(0, cos(ca + PI)) * 8;
    const leftSwingBend = max(0, -sin(ca - 0.5)) * 50;
    const rightSwingBend = max(0, -sin(ca + PI - 0.5)) * 50;
    const leftKneeBend = leftSwingBend + leftStance;
    const rightKneeBend = rightSwingBend + rightStance;

    // --- Feet (heel-toe roll) ---
    const leftFootAngle = sin(ca + 0.8) * 25 - 5;
    const rightFootAngle = sin(ca + PI + 0.8) * 25 - 5;

    // --- Arms (contralateral, cascade delay) ---
    const lShoulderAngle = sin(ca + PI) * 25;
    const rShoulderAngle = sin(ca) * 25;
    const lElbowAngle = 12 + sin(ca + PI + 0.15) * 12;
    const rElbowAngle = 12 + sin(ca + 0.15) * 12;

    // --- Joint positions ---
    const lKnee = joint(hipX, hipY, leftUpperLeg, UPPER_LEG);
    const lAnkle = joint(lKnee.x, lKnee.y, leftUpperLeg + leftKneeBend, LOWER_LEG);
    const rKnee = joint(hipX, hipY, rightUpperLeg, UPPER_LEG);
    const rAnkle = joint(rKnee.x, rKnee.y, rightUpperLeg + rightKneeBend, LOWER_LEG);

    const lElbow = joint(shoulder.x, shoulder.y, lShoulderAngle, 45);
    const lHand = joint(lElbow.x, lElbow.y, lShoulderAngle + lElbowAngle, 40);
    const rElbow = joint(shoulder.x, shoulder.y, rShoulderAngle, 45);
    const rHand = joint(rElbow.x, rElbow.y, rShoulderAngle + rElbowAngle, 40);

    // --- Fade ---
    const opacity = std.interpolate(sceneProgress, [0, 0.08, 0.92, 1], [0, 1, 1, 0]);

    // --- Shadow ---
    const shadowWidth = 40 + asymBob(ca, 10);
    const shadowOpacity = 0.12 + asymBob(ca, 0.04);

    // --- Scrolling ground (moves left as figure "walks" right) ---
    const groundDashes: string[] = [];
    const dashSpacing = 80;
    const totalGround = width + dashSpacing * 2;
    for (let i = 0; i < Math.ceil(totalGround / dashSpacing) + 1; i++) {
      const baseX = i * dashSpacing;
      const gx = ((baseX - groundScroll) % totalGround + totalGround) % totalGround - dashSpacing;
      groundDashes.push(
        `<line x1="${gx}" y1="${GROUND_Y}" x2="${gx + 30}" y2="${GROUND_Y}" stroke="#3a3a5c" stroke-width="2" stroke-linecap="round"/>`
      );
    }

    // --- SVG layers ---
    const backLimbs = [
      line(hipX, hipY, lKnee.x, lKnee.y, backColor, 5),
      line(lKnee.x, lKnee.y, lAnkle.x, lAnkle.y, backColor, 5),
      foot(lAnkle.x, lAnkle.y, leftFootAngle, backColor, 4),
      line(shoulder.x, shoulder.y, lElbow.x, lElbow.y, backColor, 4),
      line(lElbow.x, lElbow.y, lHand.x, lHand.y, backColor, 4),
    ].join("\n");

    const body = [
      line(hipX, hipY, shoulder.x, shoulder.y, frontColor, 6),
      `<circle cx="${headX}" cy="${headY}" r="22" stroke="${frontColor}" stroke-width="5" fill="none"/>`,
    ].join("\n");

    const frontLimbs = [
      line(hipX, hipY, rKnee.x, rKnee.y, frontColor, 6),
      line(rKnee.x, rKnee.y, rAnkle.x, rAnkle.y, frontColor, 6),
      foot(rAnkle.x, rAnkle.y, rightFootAngle, frontColor, 5),
      line(shoulder.x, shoulder.y, rElbow.x, rElbow.y, frontColor, 5),
      line(rElbow.x, rElbow.y, rHand.x, rHand.y, frontColor, 5),
    ].join("\n");

    const joints = [
      dot(hipX, hipY, 4, accentColor),
      dot(shoulder.x, shoulder.y, 4, accentColor),
      dot(lKnee.x, lKnee.y, 3, accentColor),
      dot(rKnee.x, rKnee.y, 3, accentColor),
      dot(lAnkle.x, lAnkle.y, 3, accentColor),
      dot(rAnkle.x, rAnkle.y, 3, accentColor),
      dot(lElbow.x, lElbow.y, 3, accentColor),
      dot(rElbow.x, rElbow.y, 3, accentColor),
    ].join("\n");

    return `
      <div style="position:relative;width:${width}px;height:${height}px;opacity:${opacity}">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          ${groundDashes.join("\n")}
          <ellipse cx="${hipX}" cy="${GROUND_Y}" rx="${shadowWidth}" ry="6"
                   fill="${std.color.alpha(accentColor, shadowOpacity)}"/>
          ${backLimbs}
          ${body}
          ${frontLimbs}
          ${joints}
        </svg>
      </div>
    `;
  },
});
