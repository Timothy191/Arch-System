'use client';

import { Bot, Loader2, Send } from 'lucide-react';
import { useState } from 'react';

export function OperationsCopilot() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function submitQuestion() {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isLoading) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ai/operations-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmedQuestion }),
      });
      const result = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || 'Copilot unavailable');
      setAnswer(result.answer);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Copilot unavailable');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-card border border-arch-border-subtle bg-arch-surface-secondary/60 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-accent-amber/15 p-2 text-accent-amber">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-arch-text-primary">Operations Copilot</h2>
          <p className="text-arch-text-tertiary text-xs">
            Optional decision support. Verify recommendations before acting.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="operations-copilot-question">
          Ask the operations copilot
        </label>
        <input
          id="operations-copilot-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229)
              void submitQuestion();
          }}
          placeholder="Ask about a live operational concern..."
          className="min-w-0 flex-1 rounded-lg border border-arch-border-subtle bg-arch-surface-primary px-3 py-2 text-arch-text-primary text-sm outline-none focus:border-accent-amber"
          maxLength={4000}
        />
        <button
          type="button"
          onClick={() => void submitQuestion()}
          disabled={isLoading || !question.trim()}
          aria-label="Send question"
          className="rounded-lg bg-accent-amber px-3 text-black disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
      {answer && (
        <div className="mt-4 whitespace-pre-wrap rounded-lg border border-arch-border-subtle bg-arch-surface-primary/70 p-4 text-arch-text-secondary text-sm leading-6">
          {answer}
        </div>
      )}
    </section>
  );
}
