//! Internal proof for exact HTML produced by the escaped typed-tree lowerer.
//! Not exported on a package surface. A boolean cannot grant raw-markup trust.
const proofs = new WeakMap<object, string>();

export function escapedTreeHtml(html: string): object {
  const proof = Object.freeze({});
  proofs.set(proof, html);
  return proof;
}

export function isEscapedTreeHtml(proof: object | undefined, html: string): boolean {
  return proof !== undefined && proofs.get(proof) === html;
}
