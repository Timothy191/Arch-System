export default {
  '*.{css,scss}': ['stylelint --fix', 'prettier --write'],
  '*.{js,jsx,ts,tsx,md,json}': ['prettier --write'],
  'packages/theme/**/*': ['pnpm --filter @repo/theme lint:tokens']
};
