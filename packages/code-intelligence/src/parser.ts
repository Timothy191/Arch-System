import Parser from 'tree-sitter';
import ts from 'tree-sitter-typescript';

export type SymbolKind =
  | 'file'
  | 'module'
  | 'program'
  | 'class'
  | 'function'
  | 'method'
  | 'getter'
  | 'setter'
  | 'property'
  | 'variable'
  | 'parameter'
  | 'import'
  | 'export'
  | 'interface'
  | 'type'
  | 'enum'
  | 'enumMember';

export interface SymbolMetadata {
  kind: SymbolKind;
  name: string;
  qualifiedName: string;
  startByte: number;
  endByte: number;
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
  signature?: string;
  summary?: string;
  deprecated?: boolean;
  exports?: boolean;
  imports?: boolean;
  isAsync?: boolean;
  isGenerator?: boolean;
  complexity?: number;
}

export interface ParsedFile {
  filepath: string;
  content: string;
  language: 'typescript' | 'javascript';
  symbols: SymbolMetadata[];
  rawSymbolRanges: Map<string, [number, number]>;
}

export class TreeSitterParser {
  private parser: Parser;
  private typescriptLanguage: unknown;

  constructor() {
    this.typescriptLanguage = new ts.language();
    this.parser = new Parser();
    this.parser.setLanguage(this.typescriptLanguage);
  }

  async parseFile(filepath: string, content: string): Promise<ParsedFile> {
    const tree = this.parser.parse(content);
    const symbols: SymbolMetadata[] = [];
    const rawSymbolRanges = new Map<string, [number, number]>();

    if (!tree.rootNode) {
      return { filepath, content, language: 'typescript', symbols, rawSymbolRanges };
    }

    this.walkNode(tree.rootNode, content, symbols, rawSymbolRanges, filepath);

    return {
      filepath,
      content,
      language: 'typescript',
      symbols,
      rawSymbolRanges,
    };
  }

  private walkNode(
    node: Parser.SyntaxNode,
    content: string,
    symbols: SymbolMetadata[],
    rawSymbolRanges: Map<string, [number, number]>,
    filepath: string
  ): void {
    if (node.type === 'typescript:file' || node.type === 'javascript:file') {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          this.walkNode(child, content, symbols, rawSymbolRanges, filepath);
        }
      }
      return;
    }

    if (node.type === 'class_declaration' || node.type === 'class_expression') {
      const nameNode = node.childForFieldName('name');
      const name = nameNode ? this.getNodeText(content, nameNode) : '<anonymous>';
      symbols.push({
        kind: 'class',
        name,
        qualifiedName: name,
        startByte: node.startByte,
        endByte: node.endByte,
        startRow: node.startPosition.row,
        startColumn: node.startPosition.column,
        endRow: node.endPosition.row,
        endColumn: node.endPosition.column,
        signature: this.extractClassSignature(node, content),
      });
      rawSymbolRanges.set(name, [node.startByte, node.endByte]);
    }

    if (
      node.type === 'function_declaration' ||
      node.type === 'function_expression' ||
      node.type === 'arrow_function'
    ) {
      const nameNode = node.childForFieldName('name');
      const name = nameNode ? this.getNodeText(content, nameNode) : '<anonymous>';
      const asyncMarker = (node.childForFieldName('async')?.childCount ?? 0) > 0;
      const generatorMarker = (node.childForFieldName('generator')?.childCount ?? 0) > 0;

      symbols.push({
        kind: 'function',
        name,
        qualifiedName: name,
        startByte: node.startByte,
        endByte: node.endByte,
        startRow: node.startPosition.row,
        startColumn: node.startPosition.column,
        endRow: node.endPosition.row,
        endColumn: node.endPosition.column,
        signature: this.extractFunctionSignature(node, content),
        isAsync: asyncMarker,
        isGenerator: generatorMarker,
        complexity: this.calculateComplexity(node, content),
      });
      if (name !== '<anonymous>') {
        rawSymbolRanges.set(name, [node.startByte, node.endByte]);
      }
    }

    if (node.type === 'method_signature' || node.type === 'method_definition') {
      const nameNode = node.childForFieldName('name');
      const name = nameNode ? this.getNodeText(content, nameNode) : '<anonymous>';
      const asyncChild = node.childForFieldName('async');

      symbols.push({
        kind: 'method',
        name,
        qualifiedName: name,
        startByte: node.startByte,
        endByte: node.endByte,
        startRow: node.startPosition.row,
        startColumn: node.startPosition.column,
        endRow: node.endPosition.row,
        endColumn: node.endPosition.column,
        signature: this.extractMethodSignature(node, content),
        isAsync: (asyncChild?.childCount ?? 0) > 0,
      });
      if (name !== '<anonymous>') {
        rawSymbolRanges.set(name, [node.startByte, node.endByte]);
      }
    }

    if (node.type === 'property_signature' || node.type === 'property_declaration') {
      const nameNode = node.childForFieldName('name');
      const name = nameNode ? this.getNodeText(content, nameNode) : undefined;

      if (name) {
        symbols.push({
          kind: 'property',
          name,
          qualifiedName: name,
          startByte: node.startByte,
          endByte: node.endByte,
          startRow: node.startPosition.row,
          startColumn: node.startPosition.column,
          endRow: node.endPosition.row,
          endColumn: node.endPosition.column,
          isAsync: (node.childForFieldName('async')?.childCount ?? 0) > 0,
        });
        rawSymbolRanges.set(name, [node.startByte, node.endByte]);
      }
    }

    if (node.type === 'variable_declaration') {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child?.type === 'variable_declarator') {
          const nameNode = child.childForFieldName('name');
          const name = nameNode ? this.getNodeText(content, nameNode) : undefined;

          if (name) {
            symbols.push({
              kind: 'variable',
              name,
              qualifiedName: name,
              startByte: child.startByte,
              endByte: child.endByte,
              startRow: child.startPosition.row,
              startColumn: child.startPosition.column,
              endRow: child.endPosition.row,
              endColumn: child.endPosition.column,
            });
            rawSymbolRanges.set(name, [child.startByte, child.endByte]);
          }
        }
      }
    }

    if (node.type === 'import_statement') {
      const sourceNode = node.childForFieldName('source');
      const source = sourceNode ? this.getNodeText(content, sourceNode) : '';

      symbols.push({
        kind: 'import',
        name: source,
        qualifiedName: source,
        startByte: node.startByte,
        endByte: node.endByte,
        startRow: node.startPosition.row,
        startColumn: node.startPosition.column,
        endRow: node.endPosition.row,
        endColumn: node.endPosition.column,
      });
    }

    if (node.type === 'export_statement' || node.type === 'export_declaration') {
      const declaration = node.childForFieldName('declaration');
      const name = declaration ? this.getNodeText(content, declaration).split('.')[0] : '';

      symbols.push({
        kind: 'export',
        name: name || 'default',
        qualifiedName: name || 'default',
        startByte: node.startByte,
        endByte: node.endByte,
        startRow: node.startPosition.row,
        startColumn: node.startPosition.column,
        endRow: node.endPosition.row,
        endColumn: node.endPosition.column,
      });
    }

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.walkNode(child, content, symbols, rawSymbolRanges, filepath);
      }
    }
  }

  private getNodeText(content: string, node: Parser.SyntaxNode): string {
    return content.slice(node.startByte, node.endByte);
  }

  private extractFunctionSignature(node: Parser.SyntaxNode, content: string): string {
    const params: string[] = [];
    const argsNode = node.childForFieldName('parameters');
    if (argsNode) {
      for (let i = 0; i < argsNode.childCount; i++) {
        const argNode = argsNode.child(i);
        if (!argNode) continue;
        const argText = this.getNodeText(content, argNode).trim();
        if (argText) {
          params.push(argText);
        }
      }
    }

    const returnTypeNode = node.childForFieldName('return_type');
    const returnType = returnTypeNode ? this.getNodeText(content, returnTypeNode) : '';

    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(content, nameNode) : '';

    const isAsync = (node.childForFieldName('async')?.childCount ?? 0) > 0;
    const prefix = isAsync ? 'async ' : '';

    return prefix + name + '(' + params.join(',') + ')' + (returnType ? ': ' + returnType : '');
  }

  private extractClassSignature(node: Parser.SyntaxNode, content: string): string {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(content, nameNode) : '<anonymous>';

    const extendsNode = node.childForFieldName('super_class');
    const extendsText = extendsNode ? this.getNodeText(content, extendsNode) : '';

    const implementsNode = node.childForFieldName('implements');
    const implementsText = implementsNode ? this.getNodeText(content, implementsNode) : '';

    let cl = 'class ' + name;
    if (extendsText) {
      cl += ' extends ' + extendsText;
    }
    if (implementsText) {
      cl += ' implements ' + implementsText;
    }
    return cl;
  }

  private extractMethodSignature(node: Parser.SyntaxNode, content: string): string {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(content, nameNode) : '<anonymous>';

    const params: string[] = [];
    const argsNode = node.childForFieldName('parameters');
    if (argsNode) {
      for (let i = 0; i < argsNode.childCount; i++) {
        const argNode = argsNode.child(i);
        if (!argNode) continue;
        const argText = this.getNodeText(content, argNode).trim();
        if (argText) {
          params.push(argText);
        }
      }
    }

    const asyncChild = node.childForFieldName('async');
    const isAsync = (asyncChild?.childCount ?? 0) > 0;
    const prefix = isAsync ? 'async ' : '';

    return prefix + name + '(' + params.join(',') + ')';
  }

  private calculateComplexity(node: Parser.SyntaxNode, content: string): number {
    const text = this.getNodeText(content, node);
    const keywords = [
      'if',
      'else',
      'for',
      'while',
      'switch',
      'case',
      'try',
      'catch',
      'finally',
      'return',
      'throw',
    ];
    let count = 1;

    for (const kw of keywords) {
      const regex = new RegExp('\b' + kw + '\b', 'g');
      const matches = text.match(regex);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }
}
