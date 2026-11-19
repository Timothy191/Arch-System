import type Parser from 'tree-sitter';

const ANONYMOUS_SYMBOL_NAME = '<anonymous>';
const DEFAULT_EXPORT_NAME = 'default';
const BASE_CYCLOMATIC_COMPLEXITY = 1;
const ASYNC_KEYWORD_LENGTH = 5;
const ROOT_FILE_NODE_TYPES: ReadonlySet<string> = new Set(['typescript:file', 'javascript:file']);
const COMPLEXITY_KEYWORDS: readonly string[] = [
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

export interface SyntaxParserLike {
  parse(input: string): Parser.Tree;
  setLanguage?(language: unknown): void;
}

interface WalkContext {
  readonly filepath: string;
  readonly content: string;
  readonly symbols: SymbolMetadata[];
  readonly rawSymbolRanges: Map<string, [number, number]>;
}

interface BaseSymbolOptions {
  readonly kind: SymbolKind;
  readonly name: string;
  readonly node: Parser.SyntaxNode;
}

interface SyntheticNodeOptions {
  readonly type: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly row?: number;
  readonly startColumn?: number;
  readonly endColumn?: number;
  readonly children?: readonly Parser.SyntaxNode[];
  readonly fields?: Readonly<Record<string, Parser.SyntaxNode | null>>;
}

interface LineParseContext {
  readonly line: string;
  readonly lineStartByte: number;
  readonly row: number;
}

type NodeVisitor = (node: Parser.SyntaxNode, context: WalkContext) => void;

function createBaseSymbolMetadata(options: BaseSymbolOptions): SymbolMetadata {
  const { kind, name, node } = options;
  return {
    kind,
    name,
    qualifiedName: name,
    startByte: node.startByte,
    endByte: node.endByte,
    startRow: node.startPosition.row,
    startColumn: node.startPosition.column,
    endRow: node.endPosition.row,
    endColumn: node.endPosition.column,
  };
}

function hasFieldChildMarker(node: Parser.SyntaxNode, fieldName: string): boolean {
  const markerNode = node.childForFieldName(fieldName);
  return (markerNode?.childCount ?? 0) > 0;
}

function createSyntheticSyntaxNode(options: SyntheticNodeOptions): Parser.SyntaxNode {
  const row = options.row ?? 0;
  const startColumn = options.startColumn ?? options.startByte;
  const endColumn = options.endColumn ?? options.endByte;
  const children = options.children ?? [];
  const fields = options.fields ?? {};

  return {
    type: options.type,
    childCount: children.length,
    startByte: options.startByte,
    endByte: options.endByte,
    startPosition: { row, column: startColumn },
    endPosition: { row, column: endColumn },
    child(index: number): Parser.SyntaxNode | null {
      return children[index] ?? null;
    },
    childForFieldName(fieldName: string): Parser.SyntaxNode | null {
      return fields[fieldName] ?? null;
    },
  };
}

function createMarkerNode(startByte: number, endByte: number): Parser.SyntaxNode {
  const leafToken = createSyntheticSyntaxNode({
    type: 'keyword_token',
    startByte,
    endByte,
  });
  return createSyntheticSyntaxNode({
    type: 'modifier_marker',
    startByte,
    endByte,
    children: [leafToken],
  });
}

function parseLineToSyntaxNode(lineContext: LineParseContext): Parser.SyntaxNode | null {
  const { line, lineStartByte, row } = lineContext;
  const trimmed = line.trim();
  if (!trimmed) return null;

  const lineEndByte = lineStartByte + line.length;

  const importMatch = /^import\s+.+?\s+from\s+(['"][^'"]+['"])/.exec(trimmed);
  if (importMatch?.[1]) {
    const sourceText = importMatch[1];
    const sourceOffset = line.indexOf(sourceText);
    const sourceNode = createSyntheticSyntaxNode({
      type: 'string',
      startByte: lineStartByte + sourceOffset,
      endByte: lineStartByte + sourceOffset + sourceText.length,
      row,
    });
    return createSyntheticSyntaxNode({
      type: 'import_statement',
      startByte: lineStartByte,
      endByte: lineEndByte,
      row,
      fields: { source: sourceNode },
    });
  }

  const classMatch =
    /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$]*))?(?:\s+implements\s+([A-Za-z_$][\w$]*))?/.exec(
      trimmed
    );
  if (classMatch?.[1]) {
    return buildFallbackClassNode(lineContext, classMatch);
  }

  const fnMatch =
    /^(?:export\s+)?(async\s+)?function(\*)?\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/.exec(
      trimmed
    );
  if (fnMatch?.[3]) {
    return buildFallbackFunctionNode(lineContext, fnMatch);
  }

  const varMatch = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(trimmed);
  if (varMatch?.[1]) {
    return buildFallbackVariableNode(lineContext, varMatch[1]);
  }

  if (trimmed.startsWith('export default')) {
    return createSyntheticSyntaxNode({
      type: 'export_statement',
      startByte: lineStartByte,
      endByte: lineEndByte,
      row,
    });
  }

  return null;
}

function buildFallbackClassNode(
  lineContext: LineParseContext,
  classMatch: RegExpExecArray
): Parser.SyntaxNode {
  const { line, lineStartByte, row } = lineContext;
  const className = classMatch[1] ?? ANONYMOUS_SYMBOL_NAME;
  const superName = classMatch[2];
  const implementsName = classMatch[3];
  const nameOffset = line.indexOf(className);
  const nameNode = createSyntheticSyntaxNode({
    type: 'type_identifier',
    startByte: lineStartByte + nameOffset,
    endByte: lineStartByte + nameOffset + className.length,
    row,
  });
  const superNode = superName
    ? createSyntheticSyntaxNode({
        type: 'identifier',
        startByte: lineStartByte + line.indexOf(superName),
        endByte: lineStartByte + line.indexOf(superName) + superName.length,
        row,
      })
    : null;
  const implementsNode = implementsName
    ? createSyntheticSyntaxNode({
        type: 'type_identifier',
        startByte: lineStartByte + line.indexOf(implementsName),
        endByte: lineStartByte + line.indexOf(implementsName) + implementsName.length,
        row,
      })
    : null;

  return createSyntheticSyntaxNode({
    type: 'class_declaration',
    startByte: lineStartByte,
    endByte: lineStartByte + line.length,
    row,
    fields: {
      name: nameNode,
      super_class: superNode,
      implements: implementsNode,
    },
  });
}

function buildFallbackFunctionNode(
  lineContext: LineParseContext,
  fnMatch: RegExpExecArray
): Parser.SyntaxNode {
  const { line, lineStartByte, row } = lineContext;
  const isAsync = Boolean(fnMatch[1]);
  const isGenerator = Boolean(fnMatch[2]);
  const fnName = fnMatch[3] ?? ANONYMOUS_SYMBOL_NAME;
  const rawParams = (fnMatch[4] ?? '').trim();
  const rawReturnType = (fnMatch[5] ?? '').trim();

  const nameOffset = line.indexOf(fnName);
  const nameNode = createSyntheticSyntaxNode({
    type: 'identifier',
    startByte: lineStartByte + nameOffset,
    endByte: lineStartByte + nameOffset + fnName.length,
    row,
  });

  const paramChildren = rawParams
    ? rawParams.split(',').map((paramSegment) => {
        const trimmedParam = paramSegment.trim();
        const paramOffset = line.indexOf(trimmedParam);
        return createSyntheticSyntaxNode({
          type: 'required_parameter',
          startByte: lineStartByte + paramOffset,
          endByte: lineStartByte + paramOffset + trimmedParam.length,
          row,
        });
      })
    : [];

  const parametersNode = createSyntheticSyntaxNode({
    type: 'formal_parameters',
    startByte: lineStartByte,
    endByte: lineStartByte + line.length,
    row,
    children: paramChildren,
  });

  const returnTypeNode = rawReturnType
    ? createSyntheticSyntaxNode({
        type: 'type_annotation',
        startByte: lineStartByte + line.lastIndexOf(rawReturnType),
        endByte: lineStartByte + line.lastIndexOf(rawReturnType) + rawReturnType.length,
        row,
      })
    : null;

  return createSyntheticSyntaxNode({
    type: 'function_declaration',
    startByte: lineStartByte,
    endByte: lineStartByte + line.length,
    row,
    fields: {
      name: nameNode,
      parameters: parametersNode,
      return_type: returnTypeNode,
      async: isAsync ? createMarkerNode(lineStartByte, lineStartByte + ASYNC_KEYWORD_LENGTH) : null,
      generator: isGenerator ? createMarkerNode(lineStartByte, lineStartByte + 1) : null,
    },
  });
}

function buildFallbackVariableNode(
  lineContext: LineParseContext,
  variableName: string
): Parser.SyntaxNode {
  const { line, lineStartByte, row } = lineContext;
  const nameOffset = line.indexOf(variableName);
  const nameNode = createSyntheticSyntaxNode({
    type: 'identifier',
    startByte: lineStartByte + nameOffset,
    endByte: lineStartByte + nameOffset + variableName.length,
    row,
  });
  const declaratorNode = createSyntheticSyntaxNode({
    type: 'variable_declarator',
    startByte: lineStartByte + nameOffset,
    endByte: lineStartByte + line.length,
    row,
    fields: { name: nameNode },
  });
  return createSyntheticSyntaxNode({
    type: 'variable_declaration',
    startByte: lineStartByte,
    endByte: lineStartByte + line.length,
    row,
    children: [declaratorNode],
  });
}

function createFallbackSyntaxParser(): SyntaxParserLike {
  return {
    parse(content: string): Parser.Tree {
      const lines = content.split('\n');
      const childNodes: Parser.SyntaxNode[] = [];
      let byteCursor = 0;

      for (let rowIndex = 0; rowIndex < lines.length; rowIndex++) {
        const currentLine = lines[rowIndex] ?? '';
        const parsedNode = parseLineToSyntaxNode({
          line: currentLine,
          lineStartByte: byteCursor,
          row: rowIndex,
        });
        if (parsedNode) {
          childNodes.push(parsedNode);
        }
        byteCursor += currentLine.length + 1;
      }

      const rootNode = createSyntheticSyntaxNode({
        type: 'typescript:file',
        startByte: 0,
        endByte: content.length,
        row: 0,
        children: childNodes,
      });

      return { rootNode };
    },
  };
}

export class TreeSitterParser {
  private readonly parser: SyntaxParserLike;
  private readonly nodeVisitors: Readonly<Record<string, NodeVisitor>>;

  constructor(customParser?: SyntaxParserLike) {
    this.parser = customParser ?? createFallbackSyntaxParser();
    this.nodeVisitors = {
      class_declaration: (node, context) => this.visitClassNode(node, context),
      class_expression: (node, context) => this.visitClassNode(node, context),
      function_declaration: (node, context) => this.visitFunctionNode(node, context),
      function_expression: (node, context) => this.visitFunctionNode(node, context),
      arrow_function: (node, context) => this.visitFunctionNode(node, context),
      method_signature: (node, context) => this.visitMethodNode(node, context),
      method_definition: (node, context) => this.visitMethodNode(node, context),
      property_signature: (node, context) => this.visitPropertyNode(node, context),
      property_declaration: (node, context) => this.visitPropertyNode(node, context),
      variable_declaration: (node, context) => this.visitVariableNode(node, context),
      import_statement: (node, context) => this.visitImportNode(node, context),
      export_statement: (node, context) => this.visitExportNode(node, context),
      export_declaration: (node, context) => this.visitExportNode(node, context),
    };
  }

  async parseFile(filepath: string, content: string): Promise<ParsedFile> {
    const tree = this.parser.parse(content);
    const symbols: SymbolMetadata[] = [];
    const rawSymbolRanges = new Map<string, [number, number]>();

    if (!tree.rootNode) {
      return { filepath, content, language: 'typescript', symbols, rawSymbolRanges };
    }

    const walkContext: WalkContext = {
      filepath,
      content,
      symbols,
      rawSymbolRanges,
    };

    this.walkNode(tree.rootNode, walkContext);

    return {
      filepath,
      content,
      language: 'typescript',
      symbols,
      rawSymbolRanges,
    };
  }

  private walkNode(node: Parser.SyntaxNode, context: WalkContext): void {
    if (ROOT_FILE_NODE_TYPES.has(node.type)) {
      this.walkChildren(node, context);
      return;
    }

    const visitor = this.nodeVisitors[node.type];
    if (visitor) {
      visitor(node, context);
    }

    this.walkChildren(node, context);
  }

  private walkChildren(node: Parser.SyntaxNode, context: WalkContext): void {
    for (let childIndex = 0; childIndex < node.childCount; childIndex++) {
      const childNode = node.child(childIndex);
      if (childNode) {
        this.walkNode(childNode, context);
      }
    }
  }

  private visitClassNode(node: Parser.SyntaxNode, context: WalkContext): void {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(context.content, nameNode) : ANONYMOUS_SYMBOL_NAME;
    context.symbols.push({
      ...createBaseSymbolMetadata({ kind: 'class', name, node }),
      signature: this.extractClassSignature(node, context.content),
    });
    context.rawSymbolRanges.set(name, [node.startByte, node.endByte]);
  }

  private visitFunctionNode(node: Parser.SyntaxNode, context: WalkContext): void {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(context.content, nameNode) : ANONYMOUS_SYMBOL_NAME;
    const isAsync = hasFieldChildMarker(node, 'async');
    const isGenerator = hasFieldChildMarker(node, 'generator');

    context.symbols.push({
      ...createBaseSymbolMetadata({ kind: 'function', name, node }),
      signature: this.extractFunctionSignature(node, context.content),
      isAsync,
      isGenerator,
      complexity: this.calculateComplexity(node, context.content),
    });
    if (name !== ANONYMOUS_SYMBOL_NAME) {
      context.rawSymbolRanges.set(name, [node.startByte, node.endByte]);
    }
  }

  private visitMethodNode(node: Parser.SyntaxNode, context: WalkContext): void {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(context.content, nameNode) : ANONYMOUS_SYMBOL_NAME;

    context.symbols.push({
      ...createBaseSymbolMetadata({ kind: 'method', name, node }),
      signature: this.extractMethodSignature(node, context.content),
      isAsync: hasFieldChildMarker(node, 'async'),
    });
    if (name !== ANONYMOUS_SYMBOL_NAME) {
      context.rawSymbolRanges.set(name, [node.startByte, node.endByte]);
    }
  }

  private visitPropertyNode(node: Parser.SyntaxNode, context: WalkContext): void {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(context.content, nameNode) : undefined;
    if (!name) return;

    context.symbols.push({
      ...createBaseSymbolMetadata({ kind: 'property', name, node }),
      isAsync: hasFieldChildMarker(node, 'async'),
    });
    context.rawSymbolRanges.set(name, [node.startByte, node.endByte]);
  }

  private visitVariableNode(node: Parser.SyntaxNode, context: WalkContext): void {
    for (let childIndex = 0; childIndex < node.childCount; childIndex++) {
      const childNode = node.child(childIndex);
      if (childNode?.type !== 'variable_declarator') continue;

      const nameNode = childNode.childForFieldName('name');
      const name = nameNode ? this.getNodeText(context.content, nameNode) : undefined;
      if (!name) continue;

      context.symbols.push(createBaseSymbolMetadata({ kind: 'variable', name, node: childNode }));
      context.rawSymbolRanges.set(name, [childNode.startByte, childNode.endByte]);
    }
  }

  private visitImportNode(node: Parser.SyntaxNode, context: WalkContext): void {
    const sourceNode = node.childForFieldName('source');
    const source = sourceNode ? this.getNodeText(context.content, sourceNode) : '';
    context.symbols.push(createBaseSymbolMetadata({ kind: 'import', name: source, node }));
  }

  private visitExportNode(node: Parser.SyntaxNode, context: WalkContext): void {
    const declarationNode = node.childForFieldName('declaration');
    const rawDeclaration = declarationNode
      ? (this.getNodeText(context.content, declarationNode).split('.')[0] ?? '')
      : '';
    const exportName = rawDeclaration || DEFAULT_EXPORT_NAME;
    context.symbols.push(createBaseSymbolMetadata({ kind: 'export', name: exportName, node }));
  }

  private getNodeText(content: string, node: Parser.SyntaxNode): string {
    return content.slice(node.startByte, node.endByte);
  }

  private extractParameterList(node: Parser.SyntaxNode, content: string): string[] {
    const parameters: string[] = [];
    const argsNode = node.childForFieldName('parameters');
    if (!argsNode) return parameters;

    for (let paramIndex = 0; paramIndex < argsNode.childCount; paramIndex++) {
      const argNode = argsNode.child(paramIndex);
      if (!argNode) continue;
      const argText = this.getNodeText(content, argNode).trim();
      if (argText) {
        parameters.push(argText);
      }
    }
    return parameters;
  }

  private extractFunctionSignature(node: Parser.SyntaxNode, content: string): string {
    const params = this.extractParameterList(node, content);
    const returnTypeNode = node.childForFieldName('return_type');
    const returnType = returnTypeNode ? this.getNodeText(content, returnTypeNode) : '';
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(content, nameNode) : '';
    const prefix = hasFieldChildMarker(node, 'async') ? 'async ' : '';
    const returnSuffix = returnType ? `: ${returnType}` : '';

    return `${prefix}${name}(${params.join(',')})${returnSuffix}`;
  }

  private extractClassSignature(node: Parser.SyntaxNode, content: string): string {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(content, nameNode) : ANONYMOUS_SYMBOL_NAME;
    const extendsNode = node.childForFieldName('super_class');
    const extendsText = extendsNode ? this.getNodeText(content, extendsNode) : '';
    const implementsNode = node.childForFieldName('implements');
    const implementsText = implementsNode ? this.getNodeText(content, implementsNode) : '';

    let signature = `class ${name}`;
    if (extendsText) {
      signature += ` extends ${extendsText}`;
    }
    if (implementsText) {
      signature += ` implements ${implementsText}`;
    }
    return signature;
  }

  private extractMethodSignature(node: Parser.SyntaxNode, content: string): string {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(content, nameNode) : ANONYMOUS_SYMBOL_NAME;
    const params = this.extractParameterList(node, content);
    const prefix = hasFieldChildMarker(node, 'async') ? 'async ' : '';

    return `${prefix}${name}(${params.join(',')})`;
  }

  private calculateComplexity(node: Parser.SyntaxNode, content: string): number {
    const sourceSlice = this.getNodeText(content, node);
    let complexityCount = BASE_CYCLOMATIC_COMPLEXITY;

    for (const keyword of COMPLEXITY_KEYWORDS) {
      const keywordPattern = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = sourceSlice.match(keywordPattern);
      if (matches) {
        complexityCount += matches.length;
      }
    }

    return complexityCount;
  }
}
