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
  
  // Fix duplicated timeZone
  code = code.replace(/timeZone:\s*\"Asia\/Kolkata\",\s*timeZone:\s*\"Asia\/Kolkata\",/g, 'timeZone: "Asia/Kolkata",');
  
  // Remove timeZone from amount.toLocaleString or similar Number.toLocaleString
  // Look for .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" ... }) where it's a number
  // In email.ts, we know the exact lines, but let's just use regex for 'amountValue', 'refundAmount', 'amountPaid', 'Number('
  // Let's just fix it for any .toLocaleString that throws TS2769.
  
  if (code !== original) {
    fs.writeFileSync(file, code);
  }
}
