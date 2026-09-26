const fs = require('node:fs');
const path = require('node:path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach((f) => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let modifiedCount = 0;
walkDir('packages/ui/src/components/ui', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /\s*dark:[a-zA-Z0-9_/-]+/g;
    if (regex.test(content)) {
      const newContent = content.replace(regex, '');
      fs.writeFileSync(filePath, newContent, 'utf8');
      modifiedCount++;
      console.log(`Cleaned: ${filePath}`);
    }
  }
});

console.log(`Total files modified: ${modifiedCount}`);
