const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let modifiedCount = 0;
walkDir('packages/ui/src/components/ui', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
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
