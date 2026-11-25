import { captionStates, centeredCamera, defineInteractive, focusOn, type SceneGuide } from "@foxworth/superimg/interactive/define";
import { Html } from "@foxworth/superimg";
import {
  environmentMotion,
  environmentShellArt,
  pavementArt,
  rainArt,
  streetlightArt,
} from "./art/environment";
import {
  addressCardArt,
  banknoteArt,
  doorwayArt,
  familyPhotoArt,
  keepTrailArt,
  ownerArt,
  returnTrailArt,
  walletShellArt,
} from "./art/objects";
import { livingCanvasCss } from "./art/styles";

const captions = {
  encounter: ["A wallet waits", "in the rain."],
  inventory: ["Money. An address.", "A photograph."],
  temptation: ["Value is easy", "to count."],
  recognition: ["A life", "is harder."],
  return: ["The map tilts", "toward someone else."],
  afterimage: ["Meaning changed", "the picture."],
} as const;

const guide: SceneGuide = {
  id: "living-canvas",
  steps: [
    ["encounter", "Encounter", "A wallet waits in the rain.", "wallet"],
    ["inventory", "Inventory", "Money. An address. A photograph.", "wallet.contents"],
    ["temptation", "Temptation", "Value is easy to count.", "money"],
    ["recognition", "Recognition", "A life is harder.", "family-photo"],
    ["return", "Return", "The map tilts toward someone else.", "address"],
    ["afterimage", "Afterimage", "Meaning changed the picture.", "decision"],
  ].map(([id, label, note, focusNodeId]) => ({
    id: id!,
    label: label!,
    note,
    duration: "3s",
    scene: { state: id! },
    focusNodeId,
  })),
};

export default defineInteractive({
  guide,
  sample: {
    edition: "Study No. 01",
    debugOverlay: false,
  },

  render(ctx) {
    const { scene, std, timeline, width, height, data } = ctx;
    const portrait = ctx.isPortrait;
    const center = (
      zoom: number,
      rotation: number,
      target: string,
      padding: number,
    ) =>
      centeredCamera(width, height, {
        zoom,
        rotation,
        fit: { target, padding },
      });

    const spread = portrait
      ? {
          money: { x: -130, y: -290, rotate: -8 },
          photo: { x: 125, y: -230, rotate: 7 },
          address: { x: 0, y: 220, rotate: -2 },
        }
      : {
          money: { x: -320, y: -140, rotate: -9 },
          photo: { x: 10, y: -250, rotate: 6 },
          address: { x: 320, y: -110, rotate: 5 },
        };

    const allCaptions = Object.keys(captions) as Array<keyof typeof captions>;
    const captionState = (active: keyof typeof captions) =>
      captionStates(allCaptions, active);

    // Quiet-unless-spotlighted nodes share a base; money/photo/address stay explicit.
    const quietBase = {
      "wallet.shell": { opacity: 0.2 },
      owner: { opacity: 0 },
      "owner.home": { opacity: 0 },
      "keep-path": { opacity: 0 },
      "return-path": { opacity: 0 },
    };

    scene.states({
      encounter: {
        nodes: {
          ...focusOn(quietBase, {
            "wallet.shell": { opacity: 1, transform: { scale: 1 } },
          }),
          "wallet.contents": { opacity: 0, transform: { scale: 0.72 } },
          money: { opacity: 0, transform: { y: 90, scale: 0.72 } },
          "family-photo": { opacity: 0, transform: { y: 90, scale: 0.72 } },
          address: { opacity: 0, transform: { y: 90, scale: 0.72 } },
          ...captionState("encounter"),
        },
        camera: center(1, 0, "wallet", 120),
      },
      inventory: {
        nodes: {
          ...focusOn(quietBase, {
            "wallet.shell": { opacity: 0.72, transform: { scale: 1.02 } },
            owner: { opacity: 0.08 },
          }),
          "wallet.contents": { opacity: 1, transform: { scale: 1 } },
          money: { opacity: 1, transform: spread.money },
          "family-photo": { opacity: 1, transform: spread.photo },
          address: { opacity: 1, transform: spread.address },
          ...captionState("inventory"),
        },
        camera: center(portrait ? 1.04 : 1.08, 0, "wallet.contents", 84),
      },
      temptation: {
        nodes: {
          ...focusOn(quietBase, {
            "wallet.shell": { opacity: 0.34 },
            "keep-path": {
              opacity: 0.88,
              transform: { scale: 1 },
              animation: { type: "draw" },
            },
            "return-path": { opacity: 0.08 },
          }),
          "wallet.contents": { opacity: 1 },
          money: {
            opacity: 1,
            transform: { ...spread.money, x: (spread.money.x ?? 0) - 34, scale: 1.28, rotate: -3 },
            animation: { type: "pulse", progress: 0.25, intensity: 0.06 },
          },
          "family-photo": { opacity: 0.18, transform: spread.photo },
          address: { opacity: 0.14, transform: spread.address },
          ...captionState("temptation"),
        },
        camera: center(portrait ? 1.08 : 1.14, -1.5, "money", 70),
      },
      recognition: {
        nodes: {
          ...focusOn(quietBase, {
            "wallet.shell": { opacity: 0.26 },
            owner: { opacity: 0.72, transform: { x: portrait ? -18 : -34 } },
            "owner.home": { opacity: 0.18 },
            "keep-path": { opacity: 0.05 },
            "return-path": { opacity: 0.2 },
          }),
          "wallet.contents": { opacity: 1 },
          money: { opacity: 0.16, transform: spread.money },
          "family-photo": {
            opacity: 1,
            transform: { ...spread.photo, x: (spread.photo.x ?? 0) + 38, scale: 1.34, rotate: 2 },
            animation: { type: "pulse", progress: 0.25, intensity: 0.035 },
          },
          address: { opacity: 0.38, transform: spread.address },
          ...captionState("recognition"),
        },
        camera: center(portrait ? 1.06 : 1.12, 1.2, "family-photo", 64),
      },
      return: {
        nodes: {
          ...focusOn(quietBase, {
            "wallet.shell": { opacity: 0.2 },
            owner: { opacity: 0.82, transform: { x: portrait ? -28 : -54 } },
            "owner.home": { opacity: 0.82 },
            "keep-path": { opacity: 0.04 },
            "return-path": {
              opacity: 1,
              transform: { scale: 1.04 },
              animation: { type: "draw" },
            },
          }),
          "wallet.contents": { opacity: 1 },
          money: { opacity: 0.14, transform: spread.money },
          "family-photo": { opacity: 0.56, transform: spread.photo },
          address: {
            opacity: 1,
            transform: { ...spread.address, x: (spread.address.x ?? 0) - 24, scale: 1.22, rotate: 0 },
          },
          ...captionState("return"),
        },
        camera: center(portrait ? 1.03 : 1.08, -1, "address", 70),
      },
      afterimage: {
        nodes: {
          ...focusOn(quietBase, {
            "wallet.shell": { opacity: 0.64, transform: { scale: 0.92 } },
            owner: { opacity: 0.5 },
            "owner.home": { opacity: 0.42 },
            "keep-path": { opacity: 0.32 },
            "return-path": { opacity: 0.78 },
          }),
          "wallet.contents": { opacity: 1, transform: { scale: 0.9 } },
          money: { opacity: 0.62, transform: { ...spread.money, scale: 0.88 } },
          "family-photo": { opacity: 0.84, transform: { ...spread.photo, scale: 0.94 } },
          address: { opacity: 0.76, transform: { ...spread.address, scale: 0.9 } },
          ...captionState("afterimage"),
        },
        camera: center(portrait ? 0.94 : 0.96, 0, "decision", 120),
      },
    });

    const motion = environmentMotion(timeline.seconds);

    const rain = scene.node("rain", rainArt(motion), {
      kind: "weather",
      role: "atmosphere",
      parent: "environment",
      tags: ["rain", "time"],
    });
    const pavement = scene.node("pavement", pavementArt(motion), {
      kind: "ground",
      role: "setting",
      parent: "environment",
      tags: ["street", "found"],
    });
    const streetlight = scene.node("streetlight", streetlightArt(motion), {
      kind: "light",
      role: "lighting",
      parent: "environment",
      tags: ["attention", "warmth"],
    });
    const environment = environmentShellArt(motion, `${rain}${pavement}${streetlight}`);

    const money = scene.node("money", banknoteArt, {
      kind: "money",
      role: "evidence",
      parent: "wallet.contents",
      label: "Cash",
      tags: ["material", "temptation", "value"],
      metadata: { amount: 40, currency: "USD" },
    });
    const photo = scene.node("family-photo", familyPhotoArt, {
      kind: "photograph",
      role: "evidence",
      parent: "wallet.contents",
      label: "Family photograph",
      tags: ["memory", "empathy", "person"],
    });
    const address = scene.node("address", addressCardArt, {
      kind: "address",
      role: "evidence",
      parent: "wallet.contents",
      label: "Owner address",
      tags: ["clue", "return", "person"],
    });
    const contents = scene.node(
      "wallet.contents",
      `<div class="art-contents">${money}${photo}${address}</div>`,
      {
        kind: "collection",
        role: "evidence-set",
        parent: "wallet",
        label: "Wallet contents",
        tags: ["inventory"],
      },
    );
    const shell = scene.node("wallet.shell", walletShellArt, {
      kind: "object",
      role: "container",
      parent: "wallet",
      label: "Leather wallet",
      tags: ["found", "ordinary"],
    });
    const wallet = scene.node(
      "wallet",
      `<div class="art-wallet-world">${shell}${contents}</div>`,
      {
        kind: "wallet",
        role: "subject",
        parent: "story",
        label: "Found wallet",
        tags: ["decision", "found"],
      },
    );

    const home = scene.node("owner.home", doorwayArt, {
      kind: "place",
      role: "destination",
      parent: "owner",
      label: "Warm doorway",
      tags: ["return", "home"],
    });
    const owner = scene.node(
      "owner",
      `<div class="art-owner">${home}${ownerArt}</div>`,
      {
        kind: "character",
        role: "person",
        parent: "story",
        label: "The owner",
        tags: ["person", "empathy", "return"],
      },
    );

    const keepPath = scene.node("keep-path", keepTrailArt, {
      kind: "path",
      role: "option",
      parent: "decision",
      label: "Keep the money",
      tags: ["choice", "self"],
    });
    const returnPath = scene.node("return-path", returnTrailArt, {
      kind: "path",
      role: "option",
      parent: "decision",
      label: "Return the wallet",
      tags: ["choice", "other", "return"],
    });
    const decision = scene.node(
      "decision",
      `<div class="art-decision">${keepPath}${returnPath}</div>`,
      {
        kind: "decision",
        role: "choice",
        parent: "story",
        label: "The decision",
        tags: ["argument", "branch"],
      },
    );

    const story = `<div class="art-story">${wallet}${owner}${decision}</div>`;

    const captionHtml = allCaptions
      .map((id) => {
        const [lead, emphasis] = captions[id];
        return scene.node(
          `caption.${id}`,
          `<div class="art-caption">${lead}<br/><em>${emphasis}</em></div>`,
          {
            kind: "caption",
            role: "narration",
            parent: "caption",
            label: `${lead} ${emphasis}`,
            tags: ["story", id],
            space: "screen",
          },
        );
      })
      .join("");

    const debugClass = data.debugOverlay ? " is-debug" : "";
    const environmentLayer = scene.layer("environment", environment, {
      role: "setting",
      space: "world",
    });
    const storyLayer = scene.layer("story", story, {
      role: "narrative",
      space: "world",
    });
    const captionLayer = scene.layer(
      "caption",
      `<div class="art-caption-stack">${captionHtml}</div>`,
      { role: "narration", space: "screen" },
    );
    const editionLayer = scene.layer(
      "edition-label",
      `<div class="art-edition">The weight of a choice / ${data.edition}</div>`,
      { role: "narration", space: "screen" },
    );
    const runtimeLayer = scene.layer(
      "runtime-mark",
      `<div class="art-coordinate"><span class="art-coordinate-mark"></span> semantic scene / live</div>`,
      { role: "status", space: "screen" },
    );
    return Html({ width: "fill", height: "fill", html: `<style>${livingCanvasCss}</style><div class="scene-root ${portrait ? "is-portrait" : "is-landscape"}${debugClass}" style="${std.css({ width, height })}">
      ${environmentLayer}
      ${storyLayer}
      ${captionLayer}
      ${editionLayer}
      ${runtimeLayer}
    </div>` });
  },
});
