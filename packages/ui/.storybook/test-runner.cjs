// CommonJS on purpose: @storybook/test-runner 0.24.x loads this file via require(),
// which fails on Node 26 for a .ts/ESM config ("Must use import to load ES Module").
// getStoryContext is inlined (same implementation as @storybook/test-runner) because the
// package's dist is ESM-only and cannot be require()'d from inside Jest's module registry.
const { checkA11y, configureAxe, injectAxe } = require('axe-playwright');

const getStoryContext = (page, context) =>
  page.evaluate(({ storyId }) => globalThis.__getContext(storyId), { storyId: context.id });

/*
 * See https://storybook.js.org/docs/writing-tests/test-runner#test-hook-api-hooks
 * to learn more about the test-runner hooks API.
 */
/** @type {import('@storybook/test-runner').TestRunnerConfig} */
const config = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page, context) {
    // Get the entire context of a story, including parameters, args, argTypes, etc.
    const storyContext = await getStoryContext(page, context);

    // Do not run a11y tests for stories that explicitly disable them
    if (storyContext.parameters?.a11y?.disable) {
      return;
    }

    // Apply story-level axe configuration
    await configureAxe(page, {
      rules: storyContext.parameters?.a11y?.config?.rules,
    });

    await checkA11y(page, '#storybook-root', {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
  },
};

module.exports = config;
