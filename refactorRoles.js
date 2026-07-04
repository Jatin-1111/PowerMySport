const fs = require('fs');
const path = require('path');

const directoriesToScan = [
  'client/src',
  'server/src',
  'admin/src',
  'community/src'
];

const extensionsToScan = ['.ts', '.tsx', '.js', '.jsx'];

const replacements = [
  { regex: /(["'`])PLAYER\1/g, replacement: '$1Player$1' },
  { regex: /(["'`])VENUE_LISTER\1/g, replacement: '$1VenueLister$1' },
  { regex: /(["'`])COACH\1/g, replacement: '$1Coach$1' },
  { regex: /(["'`])ACADEMY_OWNER\1/g, replacement: '$1Academy$1' },
  { regex: /(["'`])ADMIN\1/g, replacement: '$1Admin$1' }
];

let totalReplacements = 0;
let filesModified = 0;

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath);
    } else {
      if (extensionsToScan.includes(path.extname(filePath))) {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        
        for (const { regex, replacement } of replacements) {
          content = content.replace(regex, replacement);
        }
        
        if (content !== originalContent) {
          fs.writeFileSync(filePath, content, 'utf8');
          filesModified++;
          console.log(`Modified: ${filePath}`);
        }
      }
    }
  }
}

const basePath = "d:/Web Development/PowerMySport";
for (const dir of directoriesToScan) {
  const fullPath = path.join(basePath, dir);
  if (fs.existsSync(fullPath)) {
    walk(fullPath);
  } else {
    console.warn(`Directory not found: ${fullPath}`);
  }
}

console.log(`Done! Modified ${filesModified} files.`);
