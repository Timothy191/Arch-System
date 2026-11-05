import { CodeBlock } from '@repo/ui/components/ui/code-block';
import { GlassCard } from '@repo/ui/GlassCard';
import Link from 'next/link';

export const metadata = {
  title: 'How React 18 Improves Application Performance | Arch Systems',
  description:
    'Concurrent features like Transitions, Suspense, and React Server Components improve application performance.',
};

const TRANSITION_CODE = `import { useTransition } from "react";
function Button() {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => {
        urgentUpdate();
        startTransition(() => {
          nonUrgentUpdate();
        });
      }}
    >
      ...
    </button>
  );
}`;

const RSC_CODE = `// server/index.js
import App from '../src/App.js';
app.get('/rsc', async function (req, res) {
  const { pipe } = renderToPipeableStream(React.createElement(App));
  return pipe(res);
});

// src/index.js
import { createRoot } from 'react-dom/client';
import { createFromFetch } from 'react-server-dom-webpack/client';
export function Index() {
  return createFromFetch(fetch('/rsc'));
}
const root = createRoot(document.getElementById('root'));
root.render(<Index />);`;

const SUSPENSE_CODE = `async function BlogPosts() {
  const posts = await db.posts.findAll();
  return '...';
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <BlogPosts />
    </Suspense>
  );
}`;

const CACHE_CODE = `import { cache } from 'react';

export const getUser = cache(async (id) => {
  const user = await db.user.findUnique({ id });
  return user;
});

getUser(1);
getUser(1); // Called within same render pass: returns memoized result.`;

export default function React18PerformancePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-md py-10 sm:px-lg lg:px-xl">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/docs" className="text-[var(--accent-blue)] hover:underline">
          Documentation
        </Link>
        <span className="text-[var(--text-muted)]">/</span>
        <span className="text-[var(--text-muted)]">React 18 Performance</span>
      </div>

      <header className="space-y-3">
        <h1 className="font-extrabold text-3xl text-[var(--text-heading)] tracking-tight sm:text-4xl">
          How React 18 Improves Application Performance
        </h1>
        <p className="text-[var(--text-muted)] text-sm">
          Published July 19, 2023 · Lydia Hallie · Field Engineering
        </p>
        <p className="max-w-3xl text-[var(--text-secondary)] text-base leading-relaxed">
          React 18 introduces concurrent features that fundamentally change how React applications
          render. Concurrent React, Transitions, React Server Components, Suspense, and the new
          cache API each reduce blocking time and improve responsiveness.
        </p>
      </header>

      <GlassCard className="space-y-6 p-6">
        <section className="space-y-3">
          <h2 className="font-bold text-[var(--text-heading)] text-xl">
            Main Thread and Long Tasks
          </h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            JavaScript runs on a single-threaded main thread that also handles user input,
            animations, and paint. Any task over 50ms is a long task. React 18&apos;s concurrent
            renderer yields back to the main thread every 5ms while rendering low-priority
            components, keeping the UI responsive.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-bold text-[var(--text-heading)] text-xl">Transitions</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Wrap non-urgent state updates in startTransition so React can defer or interrupt
            rendering while keeping the current UI interactive.
          </p>
          <CodeBlock language="tsx" filename="transition.tsx">
            {TRANSITION_CODE}
          </CodeBlock>
        </section>

        <section className="space-y-3">
          <h2 className="font-bold text-[var(--text-heading)] text-xl">React Server Components</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Server Components send a serialized component tree to the client, avoiding hydration
            cost. Mark interactive leaf components with &quot;use client&quot;.
          </p>
          <CodeBlock language="tsx" filename="rsc.tsx">
            {RSC_CODE}
          </CodeBlock>
        </section>

        <section className="space-y-3">
          <h2 className="font-bold text-[var(--text-heading)] text-xl">Suspense</h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Suspense delays rendering until data is ready, showing a fallback in the meantime.
            Combined with Server Components it enables streaming content.
          </p>
          <CodeBlock language="tsx" filename="suspense.tsx">
            {SUSPENSE_CODE}
          </CodeBlock>
        </section>

        <section className="space-y-3">
          <h2 className="font-bold text-[var(--text-heading)] text-xl">
            Data Fetching and cache()
          </h2>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            React 18&apos;s cache() memoizes results within a render pass; fetch() is cached
            automatically. This deduplicates requests in a single render.
          </p>
          <CodeBlock language="tsx" filename="cache.tsx">
            {CACHE_CODE}
          </CodeBlock>
        </section>

        <section className="space-y-3">
          <h2 className="font-bold text-[var(--text-heading)] text-xl">Conclusion</h2>
          <ul className="list-disc space-y-1 pl-5 text-[var(--text-secondary)] text-sm leading-relaxed">
            <li>Concurrent React pauses/resumes/abandons renders to keep UI responsive.</li>
            <li>Transitions smooth data fetches and screen changes without blocking input.</li>
            <li>Server Components combine interactivity with server-rendering performance.</li>
            <li>Suspense improves loading by streaming ready parts first.</li>
          </ul>
          <p className="text-[var(--text-muted)] text-xs">
            Source: Vercel blog post by Lydia Hallie (July 19, 2023).
          </p>
        </section>
      </GlassCard>

      <div className="flex items-center gap-3">
        <Link
          href="/docs"
          className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent-blue)] text-sm hover:underline"
        >
          ← Back to Documentation
        </Link>
      </div>
    </div>
  );
}
