declare module 'tree-sitter-typescript' {
  const typescript: {
    language: new () => unknown;
    tsx: { Language: new () => unknown };
  };
  export = typescript;
}
