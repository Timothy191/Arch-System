'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { cn } from '@repo/ui/lib/utils';
import {
  ArrowRight,
  Eye,
  GitBranch,
  Key,
  Lock,
  Maximize2,
  Search,
  Table2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  computeErEdgeGeometry,
  ER_CANVAS_HEIGHT,
  ER_CANVAS_LEFT_PAD,
  ER_CANVAS_WIDTH,
  ER_COL_GAP,
  ER_COL_WIDTH,
  ER_DOMAIN_GROUPS,
  ER_RELATIONSHIPS,
  ER_TABLES,
  type ErDomainGroupId,
  type ErTableNode,
  getErTableBoxPosition,
} from './database-er-diagram-data';

const TOOLBAR_PILL_BASE_CLASS =
  'cursor-pointer rounded-lg border px-2.5 py-1 font-medium text-xs transition-colors';

const DOMAIN_BADGE_VARIANT: Record<ErDomainGroupId, 'default' | 'secondary' | 'outline'> = {
  org: 'default',
  access: 'secondary',
  operations: 'outline',
  fleet: 'secondary',
  telemetry: 'outline',
};

const MAX_BOX_COLUMNS_PREVIEW = 5;

function getColumnTag(columnName: string): 'PK' | 'FK' | 'COL' {
  if (columnName.includes('(UUID PK)') || columnName.includes(' PK')) return 'PK';
  if (columnName.includes('(FK)') || columnName.includes(' FK')) return 'FK';
  return 'COL';
}

function getDomainAccentColor(groupId: ErDomainGroupId): string {
  const match = ER_DOMAIN_GROUPS.find((group) => group.id === groupId);
  return match?.accentVar ?? 'var(--accent-blue)';
}

interface ErTableInspectorProps {
  readonly selectedTable: ErTableNode;
  readonly onSelectTable: (tableName: string) => void;
}

function ErTableInspector({ selectedTable, onSelectTable }: ErTableInspectorProps) {
  const domainMeta = ER_DOMAIN_GROUPS.find((group) => group.id === selectedTable.domainGroup);

  const outgoingEdges = ER_RELATIONSHIPS.filter((edge) => edge.targetTable === selectedTable.name);
  const incomingEdges = ER_RELATIONSHIPS.filter((edge) => edge.sourceTable === selectedTable.name);

  return (
    <Card data-testid="er-table-inspector" className="border-[var(--border-default)] bg-white/95">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-[var(--accent-blue)]" />
            <CardTitle className="font-mono text-[var(--text-heading)] text-lg">
              {selectedTable.name}
            </CardTitle>
            <Badge variant={DOMAIN_BADGE_VARIANT[selectedTable.domainGroup]}>
              {domainMeta?.label ?? selectedTable.domainGroup}
            </Badge>
          </div>
          {selectedTable.rls && (
            <Badge
              variant="outline"
              className="flex items-center gap-1 border-accent-green/30 bg-accent-green/10 text-accent-green text-xs"
            >
              <Lock className="h-3 w-3" />
              100% RLS InitPlan Protected
            </Badge>
          )}
        </div>
        <CardDescription className="text-[var(--text-secondary)] text-xs">
          {selectedTable.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-4 pt-0 lg:grid-cols-3">
        {/* Columns */}
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-3">
          <div className="mb-2 font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
            Columns ({selectedTable.columns.length})
          </div>
          <div className="space-y-1.5">
            {selectedTable.columns.map((column) => {
              const colTag = getColumnTag(column);
              return (
                <div
                  key={column}
                  className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1 text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    {colTag === 'PK' && <Key className="h-3 w-3 text-[var(--accent-green)]" />}
                    {colTag === 'FK' && (
                      <ArrowRight className="h-3 w-3 text-[var(--accent-blue)]" />
                    )}
                    {colTag === 'COL' && <span className="inline-block w-3" />}
                    <span className="font-mono text-[var(--text-heading)]">{column}</span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">{colTag}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Outgoing Foreign Keys (Parents) */}
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-3">
          <div className="mb-2 font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
            References Parent Tables ({outgoingEdges.length})
          </div>
          {outgoingEdges.length === 0 ? (
            <p className="text-[var(--text-muted)] text-xs">
              Root entity — no outbound foreign keys.
            </p>
          ) : (
            <div className="space-y-2">
              {outgoingEdges.map((edge) => (
                <button
                  key={edge.id}
                  type="button"
                  onClick={() => onSelectTable(edge.sourceTable)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-md border border-[var(--border-default)] bg-white px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
                >
                  <div>
                    <div className="font-mono font-semibold text-[var(--accent-blue)]">
                      {edge.fkColumn} → {edge.sourceTable}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {edge.description}
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2 shrink-0 font-mono text-[10px]">
                    N:1
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Incoming Foreign Keys (Children) */}
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 p-3">
          <div className="mb-2 font-semibold text-[var(--text-heading)] text-xs uppercase tracking-wider">
            Referenced By Child Tables ({incomingEdges.length})
          </div>
          {incomingEdges.length === 0 ? (
            <p className="text-[var(--text-muted)] text-xs">
              Leaf telemetry/log table — no dependent child tables.
            </p>
          ) : (
            <div className="space-y-2">
              {incomingEdges.map((edge) => (
                <button
                  key={edge.id}
                  type="button"
                  onClick={() => onSelectTable(edge.targetTable)}
                  className="flex w-full cursor-pointer items-center justify-between rounded-md border border-[var(--border-default)] bg-white px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
                >
                  <div>
                    <div className="font-mono font-semibold text-[var(--accent-green)]">
                      {edge.targetTable} ({edge.fkColumn})
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {edge.description}
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2 shrink-0 font-mono text-[10px]">
                    {edge.cardinality}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DatabaseSchema() {
  const [selectedTableName, setSelectedTableName] = useState<string>('departments');
  const [hoveredTableName, setHoveredTableName] = useState<string | null>(null);
  const [activeDomainFilter, setActiveDomainFilter] = useState<ErDomainGroupId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [focusSelectedOnly, setFocusSelectedOnly] = useState<boolean>(false);
  const [canvasZoom, setCanvasZoom] = useState<number>(1);

  const activeFocusTable = hoveredTableName ?? selectedTableName;

  const selectedTable = useMemo(
    () => ER_TABLES.find((table) => table.name === selectedTableName) ?? ER_TABLES[0]!,
    [selectedTableName]
  );

  const tableLookup = useMemo(() => {
    const map = new Map<string, ErTableNode>();
    for (const table of ER_TABLES) {
      map.set(table.name, table);
    }
    return map;
  }, []);

  const connectedTableNames = useMemo(() => {
    const connected = new Set<string>([activeFocusTable]);
    for (const edge of ER_RELATIONSHIPS) {
      if (edge.sourceTable === activeFocusTable) connected.add(edge.targetTable);
      if (edge.targetTable === activeFocusTable) connected.add(edge.sourceTable);
    }
    return connected;
  }, [activeFocusTable]);

  const filteredTables = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return ER_TABLES.filter((table) => {
      const matchesDomain =
        activeDomainFilter === 'all' || table.domainGroup === activeDomainFilter;
      if (!matchesDomain) return false;
      if (!normalizedQuery) return true;
      return (
        table.name.toLowerCase().includes(normalizedQuery) ||
        table.description.toLowerCase().includes(normalizedQuery) ||
        table.columns.some((col) => col.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [activeDomainFilter, searchQuery]);

  const visibleTableNameSet = useMemo(
    () => new Set(filteredTables.map((table) => table.name)),
    [filteredTables]
  );

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h2 className="font-semibold text-2xl text-text-heading">Database Schema</h2>
          <p className="mt-1 text-text-secondary">
            PostgreSQL tables with Row Level Security (RLS) policies — interactive Entity
            Relationship (ER) architecture diagram and key explorer
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {ER_TABLES.length} Tables · {ER_RELATIONSHIPS.length} FK Links
          </Badge>
          <Badge
            variant="outline"
            className="border-accent-green/30 bg-accent-green/10 font-mono text-accent-green text-xs"
          >
            5 Domain Swimlanes
          </Badge>
        </div>
      </div>

      {/* Interactive ER Controls */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-white/90 p-3.5 lg:flex-row lg:items-center">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Domain Filters"
        >
          <button
            type="button"
            onClick={() => setActiveDomainFilter('all')}
            aria-pressed={activeDomainFilter === 'all'}
            className={cn(
              TOOLBAR_PILL_BASE_CLASS,
              activeDomainFilter === 'all'
                ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white'
                : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-heading)] hover:bg-[var(--bg-tertiary)]'
            )}
          >
            All Domains ({ER_TABLES.length})
          </button>
          {ER_DOMAIN_GROUPS.map((group) => {
            const isActive = activeDomainFilter === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveDomainFilter(group.id)}
                aria-pressed={isActive}
                className={cn(
                  TOOLBAR_PILL_BASE_CLASS,
                  isActive
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white'
                    : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                )}
              >
                {group.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tables, columns, FK..."
              aria-label="Search database tables"
              className="w-56 rounded-lg border border-[var(--border-default)] bg-white py-1 pr-3 pl-8 text-[var(--text-heading)] text-xs focus:border-[var(--accent-blue)] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setFocusSelectedOnly((prev) => !prev)}
            aria-pressed={focusSelectedOnly}
            className={cn(
              TOOLBAR_PILL_BASE_CLASS,
              'inline-flex items-center gap-1',
              focusSelectedOnly
                ? 'border-[var(--accent-green)] bg-accent-green/10 text-accent-green'
                : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)]'
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{focusSelectedOnly ? 'Focused Links' : 'All Links'}</span>
          </button>

          <div className="flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-1.5 py-0.5">
            <button
              type="button"
              onClick={() => setCanvasZoom((z) => Math.max(0.75, Number((z - 0.1).toFixed(2))))}
              aria-label="Zoom out ER diagram"
              className="cursor-pointer rounded p-1 text-[var(--text-secondary)] hover:bg-white"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="px-1 font-mono text-[11px] text-[var(--text-heading)]">
              {Math.round(canvasZoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setCanvasZoom((z) => Math.min(1.2, Number((z + 0.1).toFixed(2))))}
              aria-label="Zoom in ER diagram"
              className="cursor-pointer rounded p-1 text-[var(--text-secondary)] hover:bg-white"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCanvasZoom(1)}
              aria-label="Reset ER diagram zoom"
              className="cursor-pointer rounded p-1 text-[var(--text-secondary)] hover:bg-white"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Visual ER Architecture Canvas */}
      <section aria-label="Table Relationships">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-medium text-lg text-text-heading">
              <GitBranch className="h-4 w-4 text-[var(--accent-blue)]" />
              Table Relationships
            </h3>
            <p className="text-[var(--text-secondary)] text-xs">
              Interactive Entity-Relationship (ER) diagram — click or hover any table box to trace
              foreign-key parents and child dependents
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1">
              <Key className="h-3 w-3 text-[var(--accent-green)]" />
              PK Primary Key
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowRight className="h-3 w-3 text-[var(--accent-blue)]" />
              FK Foreign Key (1:N)
            </span>
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3 text-[var(--accent-green)]" />
              RLS InitPlan
            </span>
          </div>
        </div>

        <div
          data-testid="er-diagram-canvas"
          className="glass-card relative overflow-x-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-2 shadow-card"
        >
          <div
            className="relative origin-top-left transition-transform"
            style={{
              width: `${ER_CANVAS_WIDTH}px`,
              height: `${ER_CANVAS_HEIGHT}px`,
              transform: `scale(${canvasZoom})`,
              marginBottom: canvasZoom < 1 ? `${(canvasZoom - 1) * ER_CANVAS_HEIGHT}px` : '0px',
            }}
          >
            {/* Domain Column Swimlanes */}
            {ER_DOMAIN_GROUPS.map((group) => {
              const colLeft = ER_CANVAS_LEFT_PAD + group.colIndex * (ER_COL_WIDTH + ER_COL_GAP);
              return (
                <div
                  key={group.id}
                  className="absolute top-2 bottom-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/55 p-2.5"
                  style={{ left: `${colLeft - 8}px`, width: `${ER_COL_WIDTH + 16}px` }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold font-mono text-[11px] text-[var(--text-heading)] uppercase tracking-wider">
                      {group.label}
                    </span>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: group.accentVar }}
                    />
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                    {group.description}
                  </p>
                </div>
              );
            })}

            {/* SVG Connecting Lines & Cardinality Markers Layer */}
            <svg
              data-testid="er-diagram-svg"
              width={ER_CANVAS_WIDTH}
              height={ER_CANVAS_HEIGHT}
              viewBox={`0 0 ${ER_CANVAS_WIDTH} ${ER_CANVAS_HEIGHT}`}
              className="pointer-events-none absolute inset-0"
              aria-label="Entity Relationship Foreign Key Connector Lines"
            >
              <defs>
                <marker
                  id="er-arrow-active"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="var(--accent-blue)" />
                </marker>
                <marker
                  id="er-arrow-inbound"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="var(--accent-green)" />
                </marker>
                <marker
                  id="er-arrow-muted"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="var(--border-default)" />
                </marker>
              </defs>

              {ER_RELATIONSHIPS.map((edge, edgeIndex) => {
                const srcNode = tableLookup.get(edge.sourceTable);
                const tgtNode = tableLookup.get(edge.targetTable);
                if (!srcNode || !tgtNode) return null;

                const isOutboundFromActive = edge.sourceTable === activeFocusTable;
                const isInboundToActive = edge.targetTable === activeFocusTable;
                const isHighlighted = isOutboundFromActive || isInboundToActive;
                const matchesVisibleFilter =
                  visibleTableNameSet.has(edge.sourceTable) ||
                  visibleTableNameSet.has(edge.targetTable);

                if (focusSelectedOnly && !isHighlighted) return null;

                const geometry = computeErEdgeGeometry({
                  sourceTable: srcNode,
                  targetTable: tgtNode,
                  edgeIndex,
                });

                const strokeColor = isOutboundFromActive
                  ? 'var(--accent-green)'
                  : isInboundToActive
                    ? 'var(--accent-blue)'
                    : 'var(--border-default)';

                const markerEnd = isOutboundFromActive
                  ? 'url(#er-arrow-inbound)'
                  : isInboundToActive
                    ? 'url(#er-arrow-active)'
                    : 'url(#er-arrow-muted)';

                return (
                  <g
                    key={edge.id}
                    data-testid={`er-edge-${edge.id}`}
                    style={{
                      opacity: isHighlighted ? 1 : matchesVisibleFilter ? 0.42 : 0.14,
                      transition: 'opacity 180ms ease',
                    }}
                  >
                    <path
                      d={geometry.pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isHighlighted ? 2.4 : 1.3}
                      strokeDasharray={isHighlighted ? undefined : '4 3'}
                      markerEnd={markerEnd}
                    />
                    {isHighlighted && (
                      <g transform={`translate(${geometry.labelX}, ${geometry.labelY})`}>
                        <rect
                          x={-34}
                          y={-10}
                          width={68}
                          height={20}
                          rx={6}
                          fill="var(--bg-primary)"
                          stroke={strokeColor}
                          strokeWidth={1.2}
                        />
                        <text
                          x={0}
                          y={3.5}
                          textAnchor="middle"
                          fontSize={9}
                          fontFamily="monospace"
                          fontWeight="600"
                          fill="var(--text-heading)"
                        >
                          {edge.cardinality} · {edge.fkColumn.replace(' / truck_id', '')}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Interactive Table Boxes */}
            {ER_TABLES.map((table) => {
              const box = getErTableBoxPosition(table);
              const isSelected = table.name === selectedTableName;
              const isConnected = connectedTableNames.has(table.name);
              const isVisibleByFilter = visibleTableNameSet.has(table.name);
              const accentColor = getDomainAccentColor(table.domainGroup);

              return (
                <button
                  key={table.name}
                  type="button"
                  data-testid={`er-table-box-${table.name}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedTableName(table.name)}
                  onMouseEnter={() => setHoveredTableName(table.name)}
                  onMouseLeave={() => setHoveredTableName(null)}
                  onFocus={() => setHoveredTableName(table.name)}
                  onBlur={() => setHoveredTableName(null)}
                  className={cn(
                    'absolute flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-white text-left shadow-card transition-opacity',
                    isSelected
                      ? 'z-20 border-[var(--accent-blue)] ring-2 ring-[var(--accent-blue)]/30'
                      : isConnected
                        ? 'z-10 border-[var(--accent-green)]/70'
                        : 'z-0 border-[var(--border-default)]'
                  )}
                  style={{
                    left: `${box.x}px`,
                    top: `${box.y}px`,
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                    opacity: isVisibleByFilter ? (isConnected ? 1 : 0.72) : 0.25,
                  }}
                >
                  {/* Box Header */}
                  <div
                    className="flex items-center justify-between gap-1.5 border-[var(--border-subtle)] border-b bg-[var(--bg-secondary)] px-2.5 py-1.5"
                    style={{ borderTop: `3px solid ${accentColor}` }}
                  >
                    <span className="truncate font-bold font-mono text-[11px] text-[var(--text-heading)]">
                      {table.name}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[9px] text-accent-green">
                      <Lock className="h-2.5 w-2.5" />
                      RLS
                    </span>
                  </div>

                  {/* Key Columns Preview */}
                  <div className="flex-1 space-y-0.5 overflow-hidden px-2.5 py-1.5">
                    {table.columns.slice(0, MAX_BOX_COLUMNS_PREVIEW).map((column) => {
                      const colTag = getColumnTag(column);
                      return (
                        <div
                          key={column}
                          className="flex items-center justify-between gap-1 text-[10px]"
                        >
                          <span className="truncate font-mono text-[var(--text-secondary)]">
                            {column}
                          </span>
                          {colTag !== 'COL' && (
                            <span
                              className={cn(
                                'shrink-0 rounded px-1 font-bold font-mono text-[8px]',
                                colTag === 'PK'
                                  ? 'bg-accent-green/15 text-accent-green'
                                  : 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                              )}
                            >
                              {colTag}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Selected Table Inspector */}
      <ErTableInspector selectedTable={selectedTable} onSelectTable={setSelectedTableName} />

      {/* Filterable Table Catalog Grid */}
      <section aria-label="Schema Table Catalog">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium text-lg text-text-heading">
            Table Definitions ({filteredTables.length} of {ER_TABLES.length})
          </h3>
          <span className="text-[var(--text-muted)] text-xs">
            Click any card to focus its FK connections on the ER diagram
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredTables.map((table) => {
            const isSelected = table.name === selectedTableName;
            return (
              <Card
                key={table.name}
                onClick={() => setSelectedTableName(table.name)}
                className={cn(
                  'cursor-pointer overflow-hidden transition-colors',
                  isSelected
                    ? 'border-[var(--accent-blue)] ring-2 ring-[var(--accent-blue)]/25'
                    : 'hover:border-[var(--border-emphasis)]'
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Table2 className="h-5 w-5 text-accent-blue" />
                      <CardTitle className="font-mono text-lg text-text-heading">
                        {table.name}
                      </CardTitle>
                    </div>
                    {table.rls && (
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1 border-accent-green/30 bg-accent-green/10 text-[10px] text-accent-green"
                      >
                        <Lock className="h-3 w-3" />
                        RLS
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">{table.description}</CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-1.5">
                    {table.columns.map((column) => (
                      <div
                        key={column}
                        className="flex items-center gap-2 rounded bg-bg-tertiary px-2 py-1.5 text-xs"
                      >
                        {column.includes('PK') && <Key className="h-3 w-3 text-accent-blue" />}
                        {column.includes('FK') && (
                          <ArrowRight className="h-3 w-3 text-accent-blue" />
                        )}
                        {!column.includes('PK') && !column.includes('FK') && (
                          <div className="w-3" />
                        )}
                        <span className="font-mono text-text-secondary">{column}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* RLS Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Lock className="h-5 w-5 text-accent-green" />
            <span className="font-medium text-sm text-text-heading">
              100% RLS InitPlan Security
            </span>
          </div>
          <p className="text-text-secondary text-xs">
            Every table enforces Row Level Security with cached (select auth.uid()) InitPlan
            department policies
          </p>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Key className="h-5 w-5 text-accent-blue" />
            <span className="font-medium text-sm text-text-heading">213 Versioned Migrations</span>
          </div>
          <p className="text-text-secondary text-xs">
            Supabase PostgreSQL 17 schema managed via zero-padded declarative migrations & atomic
            RPCs
          </p>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Table2 className="h-5 w-5 text-accent-blue" />
            <span className="font-medium text-sm text-text-heading">
              {ER_TABLES.length} Core Domain Tables
            </span>
          </div>
          <p className="text-text-secondary text-xs">
            Departments, employees, personnel, badges, visitors, machines, tires, daily_logs,
            breakdowns & audit trails
          </p>
        </Card>
      </div>

      {/* Helper Functions */}
      <div>
        <h3 className="mb-4 font-medium text-lg text-text-heading">RLS Helper Functions</h3>
        <div className="glass-card rounded-xl p-6 font-mono text-sm">
          <div className="space-y-2 text-text-secondary">
            <div className="text-text-muted">-- Department access check</div>
            <div>
              <span className="text-accent-green">auth.user_department_id</span>
              <span className="text-text-secondary">() → UUID</span>
            </div>
            <br />
            <div className="text-text-muted">-- Admin check</div>
            <div>
              <span className="text-accent-green">auth.is_admin</span>
              <span className="text-text-secondary">() → boolean</span>
            </div>
            <br />
            <div className="text-text-muted">-- Department access with array support</div>
            <div>
              <span className="text-accent-green">auth.has_department_access</span>
              <span className="text-text-secondary">(dept_id UUID) → boolean</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
