#!/usr/bin/env node

module.exports = {
  merge(results, strategy = 'merge') {
    if (results.length === 0) {
      return { summary: 'No results to aggregate', merged: false };
    }

    const succeeded = results.filter(r => r.status === 'ok');
    const failed = results.filter(r => r.status !== 'ok');

    switch (strategy) {
      case 'first': {
        const first = succeeded[0] || results[0];
        return {
          strategy: 'first',
          summary: `Used first result: ${first.unit}`,
          merged: true,
          primary: first
        };
      }

      case 'concatenate': {
        const text = succeeded.map(r => r.stdout || '').join('\n\n---\n\n');
        return {
          strategy: 'concatenate',
          summary: `Concatenated ${succeeded.length} results`,
          merged: true,
          output: text,
          length: text.length
        };
      }

      case 'merge':
      default: {
        const combined = {
          changes: [],
          findings: [],
          errors: []
        };

        for (const r of results) {
          const output = r.stdout || r.result || '';
          if (r.status === 'ok') {
            combined.findings.push({ unit: r.unit, text: output.slice(0, 2000) });
            // Extract changed file patterns
            const files = output.match(/^[+\-]{3}\s+\S+/gm) || [];
            combined.changes.push(...files.map(f => f.replace(/^[+\-]{3}\s+/, '')));
          } else {
            combined.errors.push({ unit: r.unit, error: r.error || r.stderr || 'Unknown error' });
          }
        }

        return {
          strategy: 'merge',
          summary: `Merged ${results.length} results (${succeeded.length} ok, ${failed.length} failed)`,
          merged: failed.length === 0,
          combined
        };
      }
    }
  },

  resolveConflicts(results, leadResult) {
    const conflicts = [];
    const merged = [];

    results.forEach(r => {
      if (leadResult && r.unit !== leadResult.unit) {
        const leadOutput = leadResult.stdout || '';
        const thisOutput = r.stdout || '';
        if (leadOutput && thisOutput && leadOutput !== thisOutput) {
          conflicts.push({
            unit: r.unit,
            difference: 'Outputs differ from lead result'
          });
        }
      }
      merged.push(r);
    });

    return { conflicts, merged, conflict_count: conflicts.length };
  }
};
