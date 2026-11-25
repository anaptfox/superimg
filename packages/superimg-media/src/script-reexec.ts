//! Re-execute <script> nodes after morphdom (innerHTML-inert scripts).
//! Used only by the dev player policy.

/**
 * Find script elements under `root` and re-create them so the browser runs them.
 * External scripts get a new element with the same src; inline scripts copy text.
 */
export function reexecuteScriptsUnder(root: Element, doc: Document): number {
  const scripts = [...root.querySelectorAll("script")];
  let count = 0;
  for (const old of scripts) {
    const parent = old.parentNode;
    if (!parent) continue;
    const next = doc.createElement("script");
    for (const attr of old.attributes) {
      next.setAttribute(attr.name, attr.value);
    }
    if (old.textContent) next.textContent = old.textContent;
    parent.replaceChild(next, old);
    count += 1;
  }
  return count;
}
