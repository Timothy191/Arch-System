// Ambient typing for tree-sitter 0.20.6 and Node built-in test runner modules.
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
      rootNode: SyntaxNode | null;
    }
  }

  export = Parser;
}

declare module 'node:test' {
  export function describe(name: string, fn: () => void | Promise<void>): Promise<void>;
  export function it(name: string, fn: () => void | Promise<void>): Promise<void>;
}

declare module 'node:assert/strict' {
  function assert(condition: unknown, message?: string): asserts condition;
  namespace assert {
    function equal<T>(actual: T, expected: T, message?: string): void;
    function deepEqual<T>(actual: T, expected: T, message?: string): void;
    function ok(condition: unknown, message?: string): asserts condition;
  }
  export default assert;
}
