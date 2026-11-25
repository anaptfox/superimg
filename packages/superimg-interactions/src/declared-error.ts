const NON_EMPTY = { type: "string", minLength: 1 } as const;

export function declaredErrorDetailsSchema<Kind extends string>(kind: Kind) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "kind", "path", "message"],
    properties: {
      schemaVersion: { const: 1 },
      kind: { const: kind },
      path: NON_EMPTY,
      message: NON_EMPTY,
    },
  } as const;
}

export type DeclaredErrorDetails<Kind extends string> = Readonly<{
  schemaVersion: 1;
  kind: Kind;
  path: string;
  message: string;
}>;

export function declaredErrorDetails<Kind extends string>(
  kind: Kind,
  path: string,
  message: string,
): DeclaredErrorDetails<Kind> {
  return Object.freeze({
    schemaVersion: 1,
    kind,
    path,
    message,
  });
}
