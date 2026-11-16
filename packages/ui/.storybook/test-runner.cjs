// CommonJS on purpose: @storybook/test-runner 0.24.x loads this file via require(),
// which fails on Node 26 for a .ts/ESM config ("Must use import to load ES Module").
// getStoryContext is inlined (same implementation as @storybook/test-runner) because the
// package's dist is ESM-only and cannot be require()'d from inside Jest's module registry.
// A11y scans use Deque's official @axe-core/playwright binding (AxeBuilder) instead of the
// stale axe-playwright helper package.
const { AxeBuilder } = require('@axe-core/playwright');
const { expect } = require('@playwright/test');

const A11Y_ROOT_SELECTOR = '#storybook-root';

const getStoryContext = (page, context) =>
  page.evaluate(({ storyId }) => globalThis.__getContext(storyId), { storyId: context.id });

/*
 * See https://storybook.js.org/docs/writing-tests/test-runner#test-hook-api-hooks
 * to learn more about the test-runner hooks API.
 */
/** @type {import('@storybook/test-runner').TestRunnerConfig} */
const config = {
  async postVisit(page, context) {
    // Get the entire context of a story, including parameters, args, argTypes, etc.
    const storyContext = await getStoryContext(page, context);

    // Do not run a11y tests for stories that explicitly disable them
    if (storyContext.parameters?.a11y?.disable) {
      return;
    }

    // Preserve story-level axe rule configuration verbatim via raw axe options
    // (same semantics as the previous configureAxe(page, { rules }) call).
    const storyAxeRules = storyContext.parameters?.a11y?.config?.rules;
    let axeBuilder = new AxeBuilder({ page }).include(A11Y_ROOT_SELECTOR);
    if (storyAxeRules) {
      axeBuilder = axeBuilder.options({ rules: storyAxeRules });
    }

    const axeResults = await axeBuilder.analyze();

    const axeViolations = axeResults.violations.map((violation) => ({
      ruleId: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
      help: `${violation.help} (${violation.helpUrl})`,
    }));

    // Detailed report: one expect per rule group so Jest output lists every failing rule.
    if (axeViolations.length > 0) {
      const failureReport = axeViolations
        .map((violation) => {
          const nodeLines = violation.nodes.map((selector) => `      - ${selector}`).join('\n');
          return `  [${violation.impact ?? 'unknown'}] ${violation.ruleId}: ${violation.help}\n${nodeLines}`;
        })
        .join('\n');
      expect(
        `axe found ${axeViolations.length} accessibility violation rule(s) on story "${context.id}":\n${failureReport}`,
        'Expected zero axe violations'
      ).toBe('');
    }
  },
};

module.exports = config;
