'use client';

import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

export interface JsonViewProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  value: any;
  defaultExpanded?: boolean;
}

export function JsonView({ value, defaultExpanded = true, className, ...props }: JsonViewProps) {
  return (
    <div
      className={cn('rounded-md border bg-muted/30 p-4 font-mono text-sm', className)}
      {...props}
    >
      <JsonNode value={value} name="root" defaultExpanded={defaultExpanded} isRoot />
    </div>
  );
}

function JsonNode({
  value,
  name,
  defaultExpanded,
  isRoot,
}: {
  value: any;
  name: string;
  defaultExpanded: boolean;
  isRoot?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (value === null) {
    return (
      <div className="ml-4">
        <span className="text-muted-foreground">"{name}":</span>{' '}
        <span className="text-muted-foreground">null</span>
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <div className="ml-4">
        <span className="text-muted-foreground">"{name}":</span>{' '}
        <span className="text-blue-500">{value.toString()}</span>
      </div>
    );
  }

  if (typeof value === 'number') {
    return (
      <div className="ml-4">
        <span className="text-muted-foreground">"{name}":</span>{' '}
        <span className="text-amber-500">{value}</span>
      </div>
    );
  }

  if (typeof value === 'string') {
    return (
      <div className="ml-4">
        <span className="text-muted-foreground">"{name}":</span>{' '}
        <span className="text-green-600">"{value}"</span>
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const isObject = typeof value === 'object';

  if (isArray || isObject) {
    const keys = Object.keys(value);
    const isEmpty = keys.length === 0;

    return (
      <div className={cn(!isRoot && 'ml-4')}>
        <div
          className="flex w-fit cursor-pointer items-center gap-1 rounded-sm px-1 hover:bg-muted/50"
          onClick={() => setExpanded(!expanded)}
        >
          {!isEmpty &&
            (expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
          {isEmpty && <span className="w-3" />}
          <span className="font-medium text-muted-foreground">
            {!isRoot && `"${name}": `}
            {isArray ? '[' : '{'}
            {isEmpty && (isArray ? ']' : '}')}
          </span>
          {!isEmpty && !expanded && (
            <span className="text-muted-foreground text-xs">
              {isArray ? `... ${keys.length} items ]` : `... ${keys.length} keys }`}
            </span>
          )}
          {isRoot && (
            <button
              onClick={handleCopy}
              className="ml-2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              title="Copy JSON"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
        </div>

        {expanded && !isEmpty && (
          <div className="mt-1 ml-1.5 border-border/50 border-l pl-1.5">
            {keys.map((k) => (
              <JsonNode
                key={k}
                value={value[k as keyof typeof value]}
                name={k}
                defaultExpanded={defaultExpanded}
              />
            ))}
          </div>
        )}

        {expanded && !isEmpty && (
          <div className="ml-1 font-medium text-muted-foreground">{isArray ? ']' : '}'}</div>
        )}
      </div>
    );
  }

  return null;
}
