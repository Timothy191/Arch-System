'use client';

import type { IDisposable } from '@univerjs/presets';
import { useEffect, useRef } from 'react';

import '@univerjs/preset-sheets-core/lib/index.css';

interface UniverSheetProps {
  id?: string;
  data?: object;
  // eslint-disable-next-line no-unused-vars
  onReady?: (api: unknown) => void;
}

export default function UniverSheet({ id, data, onReady }: UniverSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<IDisposable | null>(null);

  useEffect(() => {
    const containerElement = containerRef.current;
    if (!containerElement) return;

    let isCancelled = false;
    let univerAPI: IDisposable | null = null;

    async function mountUniverSheet() {
      const [presetsModule, sheetsCoreModule, enUsLocaleModule] = await Promise.all([
        import('@univerjs/presets'),
        import('@univerjs/preset-sheets-core'),
        import('@univerjs/preset-sheets-core/locales/en-US'),
      ]);

      if (isCancelled || !containerRef.current) return;

      const { createUniver, LocaleType, mergeLocales } = presetsModule;
      const { UniverSheetsCorePreset } = sheetsCoreModule;

      const created = createUniver({
        locale: LocaleType.EN_US,
        locales: {
          [LocaleType.EN_US]: mergeLocales(enUsLocaleModule.default),
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerRef.current,
          }),
        ],
      });

      univerAPI = created.univerAPI;
      apiRef.current = created.univerAPI;

      const workbook = created.univerAPI.createWorkbook(data ?? {});

      if (onReady) {
        onReady(workbook);
      }
    }

    void mountUniverSheet();

    return () => {
      isCancelled = true;
      univerAPI?.dispose();
      univerAPI = null;
      apiRef.current = null;
    };
  }, [data, onReady]);

  return (
    <div
      ref={containerRef}
      id={id}
      className="h-[600px] w-full overflow-hidden rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)]"
    />
  );
}
