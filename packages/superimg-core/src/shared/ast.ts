//! Minimal AST shapes used by template-metadata static analysis (oxc-parser output).

export interface AstNode {
  type: string;
}

export interface AstIdentifier extends AstNode {
  type: "Identifier";
  name: string;
}

export interface AstLiteral extends AstNode {
  type: "Literal";
  value?: string | number | boolean | null;
}

export interface AstProperty extends AstNode {
  type: "Property" | "ObjectProperty";
  computed?: boolean;
  key: AstNode;
  value: AstNode;
  method?: boolean;
}

export interface AstObjectExpression extends AstNode {
  type: "ObjectExpression";
  properties: AstProperty[];
}

export interface AstMemberExpression extends AstNode {
  type: "MemberExpression";
  property: AstNode;
}

export interface AstCallExpression extends AstNode {
  type: "CallExpression";
  callee: AstNode;
  arguments: AstExpr[];
}

export type AstExpr =
  | AstIdentifier
  | AstLiteral
  | AstObjectExpression
  | AstCallExpression
  | AstMemberExpression
  | AstNode;

export function isObjectExpression(node: AstNode): node is AstObjectExpression {
  return node.type === "ObjectExpression";
}

export function isProperty(node: AstNode): node is AstProperty {
  return node.type === "Property" || node.type === "ObjectProperty";
}

export function isIdentifier(node: AstNode): node is AstIdentifier {
  return node.type === "Identifier";
}

export function isLiteral(node: AstNode): node is AstLiteral {
  return node.type === "Literal";
}

export function isCallExpression(node: AstNode): node is AstCallExpression {
  return node.type === "CallExpression";
}