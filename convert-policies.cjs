const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'packages/database/migrations/014_schema_refinement.sql');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all CREATE POLICY with DO $$ block that drops policy if exists first
content = content.replace(/DROP POLICY IF EXISTS "([^"]+)" ON ([a-zA-Z0-9_]+);\s*CREATE POLICY "\1" ON \2/g, (match, policyName, tableName) => {
  return `DO $$ BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', '${policyName}', '${tableName}');
END $$;
CREATE POLICY "${policyName}" ON ${tableName}`;
});

fs.writeFileSync(filePath, content);
console.log('Successfully wrapped policies in DO blocks');
