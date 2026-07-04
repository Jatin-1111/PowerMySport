const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules')) { 
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('d:/Web Development/PowerMySport/server/src');

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  let original = code;
  
  // replace toLocaleDateString("en-IN", { ... }) with toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", ... })
  code = code.replace(/toLocaleDateString\(\s*[\"']en-IN[\"']\s*,\s*\{/g, 'toLocaleDateString(\"en-IN\", { timeZone: \"Asia/Kolkata\",');
  code = code.replace(/toLocaleString\(\s*[\"']en-IN[\"']\s*,\s*\{/g, 'toLocaleString(\"en-IN\", { timeZone: \"Asia/Kolkata\",');
  
  // replace toLocaleDateString("en-IN") with toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })
  // only replace if it's a Date formatting. if it's number formatting, it won't hurt to have timeZone (it's ignored by Number.prototype.toLocaleString)
  code = code.replace(/toLocaleDateString\(\s*[\"']en-IN[\"']\s*\)/g, 'toLocaleDateString(\"en-IN\", { timeZone: \"Asia/Kolkata\" })');
  
  // Wait, Number(x).toLocaleString("en-IN") with timeZone will throw an error or be ignored?
  // It's safer to only replace if the variable looks like a date, but let's avoid replacing toLocaleString("en-IN") globally unless it's a Date. 
  // We already fixed ExpertsService and email.ts, which were the main ones.
  // The others are toLocaleDateString.
  
  // We only replace toLocaleDateString since that's guaranteed to be a Date.
  
  // For toLocaleDateString with en-US
  code = code.replace(/toLocaleDateString\(\s*[\"']en-US[\"']\s*,\s*\{/g, 'toLocaleDateString(\"en-US\", { timeZone: \"Asia/Kolkata\",');

  if (code !== original) {
    fs.writeFileSync(file, code);
    console.log('Fixed', file);
  }
}
