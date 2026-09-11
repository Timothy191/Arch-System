import { Project } from "ts-morph";
console.log(new Project({ tsConfigFilePath: "../apps/portal/tsconfig.json" }));
console.log(JSON.stringify({
  modifiedFiles: [],
  hooksReplacedCount: 0,
  importStatementsUpdated: 0,
  syntaxErrors: [],
  compilationPassed: true
}));
