/** Page-owned observations for opt-in reuse, after animation sampling and readiness.
 * Null means capture normally. This is deliberately not a DOM-mutation cache.
 */
export function staticCaptureSignature(input: { html: string; encoding: string }): string | null {
  const root = document.getElementById("frame");
  if (!root || document.fonts.status !== "loaded" || document.getAnimations().length || window.getSelection()?.rangeCount) return null;
  const authored = document.createElement("template");
  authored.innerHTML = input.html;
  const unsupported = "script,canvas,video,audio,iframe,object,embed,img,image,input,textarea,select,animate,animateTransform,animateMotion,set,foreignObject,link,base,meta";
  // Inspect original markup too: a script can remove itself after installing timers.
  if (authored.content.querySelector(unsupported) || document.body.querySelector(unsupported)) return null;
  const all = [...authored.content.querySelectorAll("*"), root, ...document.body.querySelectorAll("*")];
  if (all.length > 2000 || all.some(node => node.shadowRoot || node.localName.includes("-") || [...node.attributes].some(attr => /^on/i.test(attr.name) || ["href", "src", "xlink:href"].includes(attr.name)))) return null;
  // Refuse external styles and animations, even if currently paused or finished.
  const owner = window as unknown as {
    __superimgCaptureFonts?: { faces: WeakMap<FontFace, number>; next: number };
    __superimgCaptureRules?: { rules: WeakMap<CSSRule, { text: string; id: number }>; next: number };
    __superimgCaptureSignature?: { value: string; revision: number };
  };
  const identities = owner.__superimgCaptureRules ??= { rules: new WeakMap<CSSRule, { text: string; id: number }>(), next: 0 };
  const sheets: (number | string | boolean)[] = [];
  const media: [string, boolean][] = [];
  const externalPaint = (value: string) => /counter\(/i.test(value) || [...value.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)].some(match => !match[2]!.startsWith("#"));
  const rules = (list: CSSRuleList): boolean => {
    for (const rule of list) {
      const text = rule.cssText;
      let known = identities.rules.get(rule);
      if (known?.text !== text) { known = { text, id: identities.next++ }; identities.rules.set(rule, known); }
      sheets.push(known!.id);
      // Font bytes are represented by loaded FontFace object identities below.
      if (rule.type === CSSRule.FONT_FACE_RULE) continue;
      if (/@(?:keyframes|import)/i.test(rule.cssText)) return false;
      if (rule instanceof CSSMediaRule) media.push([rule.conditionText, matchMedia(rule.conditionText).matches]);
      if ("cssRules" in rule && !rules((rule as CSSGroupingRule).cssRules)) return false;
    }
    return true;
  };
  try { for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
    sheets.push(sheet.disabled, sheet.media.mediaText);
    media.push([sheet.media.mediaText, !sheet.media.mediaText || matchMedia(sheet.media.mediaText).matches]);
    if (!rules(sheet.cssRules)) return null;
  } }
  catch { return null; }
  if (externalPaint(input.html)) return null;
  const nodes = [document.documentElement, document.body, root, ...document.body.querySelectorAll("*")];
  const observations: unknown[] = [];
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    if (style.animationName !== "none" || style.transitionDuration.split(",").some(value => Number.parseFloat(value) > 0)) return null;
    if (["background-image", "mask-image", "border-image-source", "list-style-image", "filter", "clip-path", "fill", "stroke", "shape-outside"].some(name => externalPaint(style.getPropertyValue(name)))) return null;
    // Generated content can depend on counters/UA state without a DOM change.
    for (const pseudo of ["::before", "::after"]) {
      const content = getComputedStyle(node, pseudo).content;
      if (content !== "none" && content !== "normal" && content !== "") return null;
    }
    observations.push([rect.x, rect.y, rect.width, rect.height, node.scrollLeft, node.scrollTop, node.matches(":hover"), node.matches(":focus"), node.matches(":active")]);
  }
  const fonts = owner.__superimgCaptureFonts ??= { faces: new WeakMap<FontFace, number>(), next: 0 };
  const fontIdentity = (font: FontFace) => { let id = fonts.faces.get(font); if (id === undefined) { id = fonts.next++; fonts.faces.set(font, id); } return id; };
  // Embedded font CSS can be megabytes. Keep exact rule-text comparisons in
  // this page, not in the browser protocol or each serialized frame signature.
  const attributes = (element: Element) => [...element.attributes].map(attr => [attr.name, attr.value]);
  const head = [...document.head.childNodes].map(node => node instanceof HTMLStyleElement ? [node.tagName, attributes(node)] : node instanceof Element ? node.outerHTML : node.textContent);
  const value = JSON.stringify([input.encoding, attributes(document.documentElement), head, document.body.outerHTML, sheets, media, window.innerWidth, window.innerHeight, window.devicePixelRatio, [...document.fonts].map(font => [fontIdentity(font), font.family, font.style, font.weight, font.stretch, font.unicodeRange, font.status]), location.hash, window.scrollX, window.scrollY, observations]);
  const prior = owner.__superimgCaptureSignature;
  if (prior?.value === value) return String(prior.revision);
  const revision = (prior?.revision ?? 0) + 1;
  if (!Number.isSafeInteger(revision) || !Number.isSafeInteger(identities.next)) return null;
  owner.__superimgCaptureSignature = { value, revision };
  return String(revision);
}
