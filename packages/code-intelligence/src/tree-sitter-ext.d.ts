// Full ambient typing for tree-sitter 0.20.6 matching its runtime API.
// The bundled tree-sitter.d.ts omits several runtime members; skipLibCheck
// absorbs the overlap between the two declarations.
declare module 'tree-sitter' {
  class Parser {
    parse(input: string): Parser.Tree;
    setLanguage(language: unknown): void;
    getLanguage(): unknown;
  }

  namespace Parser {
    class Language {}

    type Point = { row: number; column: number };

    interface SyntaxNode {
      type: string;
      childCount: number;
      startByte: number;
      endByte: number;
      startPosition: Point;
      endPosition: Point;
      child(index: number): SyntaxNode | null;
      childForFieldName(fieldName: string): SyntaxNode | null;
    }

    interface Tree {
      rootNode: SyntaxNode;
    }
  }

  export = Parser;
}
