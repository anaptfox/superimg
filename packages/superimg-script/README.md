# @foxworth/superimg-script

The SuperImg script format. One `*.script.md` file that a writer edits and a
film reads. The fence line is the edit (`id`, `hold`, `at`, `still`); the body
is the words. This package parses it, prints it, and hashes it. It has no
dependencies and runs in a browser, so an editor can use it without the
SuperImg renderer.

```ts
import {
  editHash,
  filmScript,
  parseScript,
  printScript,
  scriptBlocks,
  scriptHash,
} from "@foxworth/superimg-script";

const doc = parseScript(text);   // null means the text is ordinary Markdown
if (doc) {
  for (const finding of doc.findings) console.warn(finding.line, finding.message);
  const [first] = scriptBlocks(doc);
  first.fields.do = "hop";
  const next = printScript(doc);
  const words = scriptHash(doc); // words/speakers/fields only (ignores timing)
  const edit = editHash(doc);    // includes hold/still/at timing attributes
  const film = filmScript(doc);  // version 2, with defaulted speech ids & pace
}
```

- `parseScript` never throws. Problems come back in `doc.findings`.
- Blocks are `shot` (requires `id=`, optional `hold=` and `still=`), `speech`
  (optional `id=` and `at=`, `pace` defaults to `say` in `filmScript`), and
  `card` (optional `id=` and `at=`). `storyboard` attaches to the block above.
- `printScript` writes canonical text. Printing a canonical file returns the
  same bytes. A hand-written file may be normalized once.
- `scriptHash` covers the words and intent a film sees, excluding timing
  (`hold`, `still`, `at`), storyboards, and prose between fences. `editHash`
  covers the same content plus timing attributes.
- On the AST, an omitted, malformed, or duplicated `id` is `undefined` (`rawId`
  holds what was written). In `filmScript(doc)`, id-less speeches receive
  default ids (`<shotId>-<n>`, `<section-slug>-<n>`, or `speech-<n>`).

The file format, how a film imports a script, and the editor commands are
described in [docs/scripts.md](../../docs/scripts.md).

To retime one uniquely addressed shot while preserving the rest of the source
(including line endings and Markdown), use `setShotHold(text, { id, seconds })`.
It returns `{ text }` and throws if the shot is ambiguous, the duration is not
positive, or the resulting hold would precede its still offset. It also rejects
ambiguous timing attributes. This edits the fence in place; it does not run the
canonical printer.
