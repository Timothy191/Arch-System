'use client';

import { Check, Copy, ExternalLink, Terminal } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface LanguageOption {
  label: string;
  value: string;
}

export interface SwitcherConfig {
  options: LanguageOption[];
  value: string;
  onChange: (value: string) => void;
}

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  filename?: string;
  language?: string;
  hideLineNumbers?: boolean;
  highlightedLinesNumbers?: number[];
  addedLinesNumbers?: number[];
  removedLinesNumbers?: number[];
  switcher?: SwitcherConfig;
  tabs?: SwitcherConfig;
  v0?: 'ask' | 'build';
  children: string;
}

export const CodeBlock = React.forwardRef<HTMLDivElement, CodeBlockProps>(
  (
    {
      filename,
      language,
      hideLineNumbers = false,
      highlightedLinesNumbers = [],
      addedLinesNumbers = [],
      removedLinesNumbers = [],
      switcher,
      tabs,
      v0,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(children);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // clipboard access fallback
      }
    };

    // Split code into lines
    const rawLines =
      typeof children === 'string' ? children.replace(/\r\n/g, '\n').split('\n') : [];
    // If the last line is empty due to trailing newline, trim it
    const lines =
      rawLines.length > 0 && rawLines[rawLines.length - 1] === ''
        ? rawLines.slice(0, -1)
        : rawLines;

    return (
      <div
        ref={ref}
        className={cn(
          'overflow-hidden rounded-lg border border-neutral-200',
          'bg-neutral-50 font-mono text-neutral-900 text-xs shadow-sm',
          className
        )}
        {...props}
      >
        {/* Header Bar */}
        {(filename || tabs || switcher || v0) && (
          <div className="flex select-none items-center justify-between border-neutral-200 border-b bg-neutral-100/90 px-4 py-2">
            {/* Left: Filename or Tabs */}
            <div className="flex items-center gap-3">
              {tabs ? (
                <div className="flex items-center gap-1">
                  {tabs.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => tabs.onChange(opt.value)}
                      className={cn(
                        'rounded px-2.5 py-1 font-medium text-xs transition-colors',
                        tabs.value === opt.value
                          ? 'bg-white text-neutral-900 shadow-2xs'
                          : 'text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : filename ? (
                <div className="flex items-center gap-2 font-medium text-neutral-700">
                  <Terminal className="h-3.5 w-3.5 text-neutral-500" />
                  <span>{filename}</span>
                </div>
              ) : null}
            </div>

            {/* Right: Switcher dropdown, v0 button, Copy button */}
            <div className="flex items-center gap-2">
              {switcher && (
                <select
                  value={switcher.value}
                  onChange={(e) => switcher.onChange(e.target.value)}
                  className="cursor-pointer rounded border border-neutral-300 bg-white px-2 py-0.5 text-neutral-700 text-xs focus:outline-none"
                >
                  {switcher.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {v0 && (
                <button
                  type="button"
                  onClick={() => window.open(`https://v0.dev/${v0}`, '_blank')}
                  className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-2 py-0.5 font-medium text-[11px] text-neutral-700 transition-colors hover:bg-neutral-100"
                >
                  <span>Open in v0</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? 'Copied' : 'Copy code'}
                className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-200/70 hover:text-neutral-900"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Code Content */}
        <div className="relative overflow-x-auto p-4 leading-relaxed">
          {/* If no header was rendered, put floating copy button in top right */}
          {!(filename || tabs || switcher || v0) && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Copied' : 'Copy code'}
              className="absolute top-3 right-3 rounded border border-neutral-200 bg-white/90 p-1.5 text-neutral-500 transition-colors hover:text-neutral-900"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          <pre className="m-0 p-0 font-mono">
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isHighlighted = highlightedLinesNumbers.includes(lineNum);
              const isAdded = addedLinesNumbers.includes(lineNum);
              const isRemoved = removedLinesNumbers.includes(lineNum);

              return (
                <div
                  key={lineNum}
                  className={cn(
                    '-mx-4 flex items-center px-4 py-0.5 transition-colors',
                    isHighlighted && 'border-l-2 border-l-blue-500 bg-blue-500/10',
                    isAdded && 'border-l-2 border-l-emerald-600 bg-emerald-500/10 text-emerald-900',
                    isRemoved && 'border-l-2 border-l-red-600 bg-red-500/10 text-red-900 opacity-75'
                  )}
                >
                  {!hideLineNumbers && (
                    <span
                      aria-hidden="true"
                      className="w-8 shrink-0 select-none pr-4 text-right text-[11px] text-neutral-500"
                    >
                      {lineNum}
                    </span>
                  )}
                  {isAdded ? (
                    <span
                      aria-hidden="true"
                      className="mr-2 select-none font-bold text-emerald-600"
                    >
                      +
                    </span>
                  ) : isRemoved ? (
                    <span aria-hidden="true" className="mr-2 select-none font-bold text-red-600">
                      -
                    </span>
                  ) : null}
                  <span className="flex-1 whitespace-pre">{line}</span>
                </div>
              );
            })}
          </pre>
        </div>
      </div>
    );
  }
);

CodeBlock.displayName = 'CodeBlock';
