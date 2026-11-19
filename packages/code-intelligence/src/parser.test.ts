import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type Parser from 'tree-sitter';
import {
  type ParsedFile,
  type SymbolKind,
  type SymbolMetadata,
  type SyntaxParserLike,
  TreeSitterParser,
} from './index.ts';
import { TreeSitterParser as DirectTreeSitterParser } from './parser.ts';

const EXPECTED_COMPLEXITY_WITH_FIVE_BRANCHES = 6;
const SAMPLE_ROW_TWO = 2;
const SAMPLE_COL_FOUR = 4;

interface MockSyntaxNodeConfig {
  readonly type: string;
  readonly text?: string;
  readonly startByte?: number;
  readonly endByte?: number;
  readonly startRow?: number;
  readonly startColumn?: number;
  readonly endRow?: number;
  readonly endColumn?: number;
  readonly children?: readonly Parser.SyntaxNode[];
  readonly fields?: Readonly<Record<string, Parser.SyntaxNode | null>>;
}

function createMockNode(config: MockSyntaxNodeConfig, sourceContent: string): Parser.SyntaxNode {
  const matchedOffset = config.text ? sourceContent.indexOf(config.text) : 0;
  const startByte = config.startByte ?? (matchedOffset >= 0 ? matchedOffset : 0);
  const endByte =
    config.endByte ?? (config.text ? startByte + config.text.length : sourceContent.length);
  const children = config.children ?? [];
  const fields = config.fields ?? {};

  return {
    type: config.type,
    childCount: children.length,
    startByte,
    endByte,
    startPosition: {
      row: config.startRow ?? 0,
      column: config.startColumn ?? startByte,
    },
    endPosition: {
      row: config.endRow ?? 0,
      column: config.endColumn ?? endByte,
    },
    child(index: number): Parser.SyntaxNode | null {
      return children[index] ?? null;
    },
    childForFieldName(fieldName: string): Parser.SyntaxNode | null {
      return fields[fieldName] ?? null;
    },
  };
}

function createModifierMarker(sourceContent: string): Parser.SyntaxNode {
  const leafNode = createMockNode({ type: 'token', startByte: 0, endByte: 1 }, sourceContent);
  return createMockNode(
    { type: 'modifier', startByte: 0, endByte: 1, children: [leafNode] },
    sourceContent
  );
}

describe('@repo/code-intelligence barrel and TreeSitterParser', () => {
  it('re-exports TreeSitterParser from src/index.ts matching src/parser.ts', () => {
    assert.equal(TreeSitterParser, DirectTreeSitterParser);
  });

  it('returns empty symbols and ranges when tree.rootNode is null', async () => {
    const nullRootParser: SyntaxParserLike = {
      parse(): Parser.Tree {
        return { rootNode: null };
      },
    };
    const parser = new TreeSitterParser(nullRootParser);
    const result: ParsedFile = await parser.parseFile('empty.ts', '');

    assert.equal(result.filepath, 'empty.ts');
    assert.equal(result.language, 'typescript');
    assert.equal(result.symbols.length, 0);
    assert.equal(result.rawSymbolRanges.size, 0);
  });

  it('parses TypeScript source using the default built-in parser when no custom parser is passed', async () => {
    const sourceCode = [
      "import { z } from 'zod';",
      'export class TelemetryEngine extends BaseEngine implements Runnable {',
      '}',
      'export async function* streamReadings(limit: number, prefix: string): AsyncGenerator<number> {',
      '  if (limit > 0) {',
      '    return;',
      '  }',
      '}',
      'const DEFAULT_LIMIT = 100;',
      'export default TelemetryEngine;',
    ].join('\n');

    const parser = new TreeSitterParser();
    const parsed = await parser.parseFile('src/telemetry.ts', sourceCode);

    const kinds: SymbolKind[] = parsed.symbols.map((symbol: SymbolMetadata) => symbol.kind);
    assert.deepEqual(kinds, ['import', 'class', 'function', 'variable', 'export']);

    const importSym = parsed.symbols.find((symbol) => symbol.kind === 'import');
    assert.equal(importSym?.name, "'zod'");

    const classSym = parsed.symbols.find((symbol) => symbol.kind === 'class');
    assert.equal(classSym?.name, 'TelemetryEngine');
    assert.equal(
      classSym?.signature,
      'class TelemetryEngine extends BaseEngine implements Runnable'
    );
    assert.equal(parsed.rawSymbolRanges.has('TelemetryEngine'), true);

    const fnSym = parsed.symbols.find((symbol) => symbol.kind === 'function');
    assert.equal(fnSym?.name, 'streamReadings');
    assert.equal(fnSym?.isAsync, true);
    assert.equal(fnSym?.isGenerator, true);
    assert.equal(
      fnSym?.signature,
      'async streamReadings(limit: number,prefix: string): AsyncGenerator<number>'
    );

    const varSym = parsed.symbols.find((symbol) => symbol.kind === 'variable');
    assert.equal(varSym?.name, 'DEFAULT_LIMIT');
    assert.equal(parsed.rawSymbolRanges.has('DEFAULT_LIMIT'), true);

    const exportSym = parsed.symbols.find((symbol) => symbol.kind === 'export');
    assert.equal(exportSym?.name, 'default');
  });

  it('extracts classes, anonymous class expressions, methods, and properties from AST nodes', async () => {
    const content =
      'class ShaftMonitor extends SensorBase implements Auditable { async poll(intervalMs: number) {} status: string; }';
    const classNameNode = createMockNode({ type: 'identifier', text: 'ShaftMonitor' }, content);
    const superNode = createMockNode({ type: 'identifier', text: 'SensorBase' }, content);
    const implementsNode = createMockNode({ type: 'identifier', text: 'Auditable' }, content);

    const methodNameNode = createMockNode({ type: 'identifier', text: 'poll' }, content);
    const methodParamNode = createMockNode(
      { type: 'required_parameter', text: 'intervalMs: number' },
      content
    );
    const methodParamsNode = createMockNode(
      { type: 'formal_parameters', children: [methodParamNode] },
      content
    );
    const methodNode = createMockNode(
      {
        type: 'method_definition',
        text: 'async poll(intervalMs: number) {}',
        startRow: SAMPLE_ROW_TWO,
        startColumn: SAMPLE_COL_FOUR,
        fields: {
          name: methodNameNode,
          parameters: methodParamsNode,
          async: createModifierMarker(content),
        },
      },
      content
    );

    const anonymousMethodNode = createMockNode(
      {
        type: 'method_signature',
        text: 'poll(intervalMs: number)',
        fields: {},
      },
      content
    );

    const propNameNode = createMockNode({ type: 'identifier', text: 'status' }, content);
    const propertyNode = createMockNode(
      {
        type: 'property_declaration',
        text: 'status: string;',
        fields: { name: propNameNode },
      },
      content
    );

    const unnamedPropertyNode = createMockNode(
      {
        type: 'property_signature',
        text: 'status: string;',
        fields: {},
      },
      content
    );

    const classNode = createMockNode(
      {
        type: 'class_declaration',
        text: content,
        children: [methodNode, anonymousMethodNode, propertyNode, unnamedPropertyNode],
        fields: {
          name: classNameNode,
          super_class: superNode,
          implements: implementsNode,
        },
      },
      content
    );

    const anonymousClassNode = createMockNode(
      {
        type: 'class_expression',
        text: 'class {}',
        fields: {},
      },
      content
    );

    const rootNode = createMockNode(
      {
        type: 'javascript:file',
        children: [classNode, anonymousClassNode],
      },
      content
    );

    const parser = new TreeSitterParser({
      parse: () => ({ rootNode }),
    });
    const parsed = await parser.parseFile('monitor.js', content);

    assert.equal(parsed.symbols.length, 5);
    const namedClass = parsed.symbols[0];
    assert.equal(namedClass?.kind, 'class');
    assert.equal(namedClass?.name, 'ShaftMonitor');
    assert.equal(
      namedClass?.signature,
      'class ShaftMonitor extends SensorBase implements Auditable'
    );

    const pollMethod = parsed.symbols[1];
    assert.equal(pollMethod?.kind, 'method');
    assert.equal(pollMethod?.name, 'poll');
    assert.equal(pollMethod?.isAsync, true);
    assert.equal(pollMethod?.signature, 'async poll(intervalMs: number)');
    assert.equal(pollMethod?.startRow, SAMPLE_ROW_TWO);
    assert.equal(pollMethod?.startColumn, SAMPLE_COL_FOUR);
    assert.equal(parsed.rawSymbolRanges.has('poll'), true);

    const anonMethod = parsed.symbols[2];
    assert.equal(anonMethod?.kind, 'method');
    assert.equal(anonMethod?.name, '<anonymous>');
    assert.equal(anonMethod?.signature, '<anonymous>()');
    assert.equal(parsed.rawSymbolRanges.has('<anonymous>'), true);

    const statusProp = parsed.symbols[3];
    assert.equal(statusProp?.kind, 'property');
    assert.equal(statusProp?.name, 'status');
    assert.equal(parsed.rawSymbolRanges.has('status'), true);

    const anonClass = parsed.symbols[4];
    assert.equal(anonClass?.kind, 'class');
    assert.equal(anonClass?.name, '<anonymous>');
    assert.equal(anonClass?.signature, 'class <anonymous>');
  });

  it('computes cyclomatic complexity and handles anonymous arrow/function expressions, imports, exports, and variables', async () => {
    const content = [
      'function evaluateAlarm(level: number): boolean {',
      '  if (level > 10) { return true; } else if (level < 0) { throw new Error("bad"); }',
      '  return false;',
      '}',
      '() => {}',
      'const alpha = 1, beta = 2;',
      'export { evaluateAlarm.run };',
    ].join('\n');

    const fnText = content.slice(0, content.indexOf('() => {}') - 1);
    const fnNameNode = createMockNode({ type: 'identifier', text: 'evaluateAlarm' }, content);
    const fnParamNode = createMockNode(
      { type: 'required_parameter', text: 'level: number' },
      content
    );
    const fnReturnNode = createMockNode({ type: 'type_annotation', text: 'boolean' }, content);
    const fnNode = createMockNode(
      {
        type: 'function_declaration',
        text: fnText,
        fields: {
          name: fnNameNode,
          parameters: createMockNode(
            { type: 'formal_parameters', children: [fnParamNode] },
            content
          ),
          return_type: fnReturnNode,
        },
      },
      content
    );

    const arrowNode = createMockNode(
      {
        type: 'arrow_function',
        text: '() => {}',
        fields: {},
      },
      content
    );

    const alphaDeclarator = createMockNode(
      {
        type: 'variable_declarator',
        text: 'alpha = 1',
        fields: {
          name: createMockNode({ type: 'identifier', text: 'alpha' }, content),
        },
      },
      content
    );
    const unnamedDeclarator = createMockNode(
      {
        type: 'variable_declarator',
        text: 'beta = 2',
        fields: {},
      },
      content
    );
    const nonDeclaratorToken = createMockNode({ type: 'const', text: 'const' }, content);
    const varDeclNode = createMockNode(
      {
        type: 'variable_declaration',
        text: 'const alpha = 1, beta = 2;',
        children: [nonDeclaratorToken, alphaDeclarator, unnamedDeclarator],
      },
      content
    );

    const sourcelessImportNode = createMockNode(
      {
        type: 'import_statement',
        text: 'import "side-effect";',
        fields: {},
      },
      content
    );

    const namedExportNode = createMockNode(
      {
        type: 'export_declaration',
        text: 'export { evaluateAlarm };',
        fields: {
          declaration: createMockNode({ type: 'identifier', text: 'evaluateAlarm.run' }, content),
        },
      },
      content
    );

    const rootNode = createMockNode(
      {
        type: 'typescript:file',
        children: [fnNode, arrowNode, varDeclNode, sourcelessImportNode, namedExportNode],
      },
      content
    );

    const parser = new TreeSitterParser({
      parse: () => ({ rootNode }),
    });
    const parsed = await parser.parseFile('alarm.ts', content);

    const evaluateFn = parsed.symbols.find((symbol) => symbol.name === 'evaluateAlarm');
    assert.ok(evaluateFn);
    assert.equal(evaluateFn.kind, 'function');
    assert.equal(evaluateFn.signature, 'evaluateAlarm(level: number): boolean');
    // 1 base + 2 'if' + 1 'else' + 1 'throw' + 2 'return' = 7, minus 1 if slice has 2 ifs:
    // Slice contains: if, return, else, if, throw, return => 1 + 6 = 7
    assert.equal(evaluateFn.complexity, EXPECTED_COMPLEXITY_WITH_FIVE_BRANCHES + 1);

    const anonArrow = parsed.symbols.find(
      (symbol) => symbol.kind === 'function' && symbol.name === '<anonymous>'
    );
    assert.ok(anonArrow);
    assert.equal(anonArrow.complexity, 1);
    assert.equal(parsed.rawSymbolRanges.has('<anonymous>'), false);

    const alphaVar = parsed.symbols.find((symbol) => symbol.kind === 'variable');
    assert.equal(alphaVar?.name, 'alpha');

    const importSym = parsed.symbols.find((symbol) => symbol.kind === 'import');
    assert.equal(importSym?.name, '');

    const exportSym = parsed.symbols.find((symbol) => symbol.kind === 'export');
    assert.equal(exportSym?.name, 'evaluateAlarm');
  });
});
