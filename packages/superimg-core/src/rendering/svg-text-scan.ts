const SVG_TEXT_ELEMENTS = new Set(["text", "tspan", "textPath"]);

function isXmlSpace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function isNameStart(char: string): boolean {
  return (char >= "A" && char <= "Z") || (char >= "a" && char <= "z") || char === "_";
}

function isNameChar(char: string): boolean {
  return isNameStart(char) || (char >= "0" && char <= "9") || char === "." || char === "-" || char === "_";
}

/** End index of an NCName starting at `index`, or `index` when none starts there. */
function readNcName(svg: string, index: number): number {
  if (index >= svg.length || !isNameStart(svg[index]!)) return index;
  let end = index + 1;
  while (end < svg.length && isNameChar(svg[end]!)) end++;
  return end;
}

/**
 * Count `<text>`, `<tspan>`, and `<textPath>` start tags.
 * A namespace prefix counts only as `prefix:local` with no whitespace in the QName.
 * The same spellings inside XML comments are not counted.
 */
export function countSvgTextElements(svg: string): number {
  let count = 0;
  for (let i = 0; i < svg.length; i++) {
    if (svg.startsWith("<!--", i)) {
      const end = svg.indexOf("-->", i + 4);
      if (end === -1) break;
      i = end + 2;
      continue;
    }
    if (svg[i] !== "<") continue;

    let cursor = i + 1;
    while (cursor < svg.length && isXmlSpace(svg[cursor]!)) cursor++;
    const mark = svg[cursor];
    if (mark === undefined || mark === "/" || mark === "!" || mark === "?") continue;

    const nameEnd = readNcName(svg, cursor);
    if (nameEnd === cursor) continue;
    let localStart = cursor;
    let localEnd = nameEnd;
    cursor = nameEnd;
    if (svg[cursor] === ":") {
      cursor++;
      const prefixedEnd = readNcName(svg, cursor);
      if (prefixedEnd === cursor) continue;
      localStart = cursor;
      localEnd = prefixedEnd;
      cursor = prefixedEnd;
    }

    const local = svg.slice(localStart, localEnd);
    const boundary = svg[cursor];
    if (
      SVG_TEXT_ELEMENTS.has(local) &&
      (boundary === undefined || isXmlSpace(boundary) || boundary === ">" || boundary === "/")
    ) {
      count++;
    }
  }
  return count;
}
