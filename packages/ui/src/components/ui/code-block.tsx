import * as React from "react";
import { cn } from "../../lib/utils";
import { Copy, Check, Terminal, ExternalLink } from "lucide-react";

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
  v0?: "ask" | "build";
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
    ref,
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
      typeof children === "string" ? children.replace(/\r\n/g, "\n").split("\n") : [];
    // If the last line is empty due to trailing newline, trim it
    const lines =
      rawLines.length > 0 && rawLines[rawLines.length - 1] === ""
        ? rawLines.slice(0, -1)
        : rawLines;

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800",
          "bg-neutral-950 text-neutral-100 font-mono text-xs shadow-sm",
          className,
        )}
        {...props}
      >
        {/* Header Bar */}
        {(filename || tabs || switcher || v0) && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-900/90 select-none">
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
                        "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                        tabs.value === opt.value
                          ? "bg-neutral-800 text-white shadow-2xs"
                          : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : filename ? (
                <div className="flex items-center gap-2 text-neutral-300 font-medium">
                  <Terminal className="w-3.5 h-3.5 text-neutral-500" />
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
                  className="bg-neutral-800 text-neutral-300 text-xs px-2 py-0.5 rounded border border-neutral-700 focus:outline-none cursor-pointer"
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
                  onClick={() => window.open(`https://v0.dev/${v0}`, "_blank")}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors border border-neutral-700"
                >
                  <span>Open in v0</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? "Copied" : "Copy code"}
                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
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
              aria-label={copied ? "Copied" : "Copy code"}
              className="absolute right-3 top-3 p-1.5 rounded bg-neutral-900/80 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
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
                    "flex items-center -mx-4 px-4 py-0.5 transition-colors",
                    isHighlighted && "bg-blue-500/15 border-l-2 border-l-blue-400",
                    isAdded && "bg-emerald-500/15 border-l-2 border-l-emerald-400 text-emerald-200",
                    isRemoved &&
                      "bg-red-500/15 border-l-2 border-l-red-400 text-red-200 opacity-75",
                  )}
                >
                  {!hideLineNumbers && (
                    <span
                      aria-hidden="true"
                      className="w-8 shrink-0 text-right pr-4 text-neutral-500 select-none text-[11px]"
                    >
                      {lineNum}
                    </span>
                  )}
                  {isAdded ? (
                    <span
                      aria-hidden="true"
                      className="select-none text-emerald-400 font-bold mr-2"
                    >
                      +
                    </span>
                  ) : isRemoved ? (
                    <span aria-hidden="true" className="select-none text-red-400 font-bold mr-2">
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
  },
);

CodeBlock.displayName = "CodeBlock";
