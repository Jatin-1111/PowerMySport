const fs = require('fs');

let file = 'd:/Web Development/PowerMySport/server/src/utils/email.ts';
let code = fs.readFileSync(file, 'utf8');

// The problematic lines from TS errors
// src/utils/email.ts(228,69)
// src/utils/email.ts(283,146)
// src/utils/email.ts(1529,68)
// src/utils/email.ts(2016,48)

// Let's just fix ANY toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ... }) that is on a Number or amount
// We can just look for "amountValue = options.totalAmount.toLocaleString" etc
code = code.replace(/options\.totalAmount\.toLocaleString\(\"en-IN\",\s*\{\s*timeZone:\s*\"Asia\/Kolkata\",/g, 'options.totalAmount.toLocaleString("en-IN", {');
code = code.replace(/refundAmount\s*\|\|\s*0\)\.toLocaleString\(\"en-IN\",\s*\{\s*timeZone:\s*\"Asia\/Kolkata\",/g, 'refundAmount || 0).toLocaleString("en-IN", {');
code = code.replace(/Number\(n\s*\|\|\s*0\)\.toLocaleString\(\"en-IN\",\s*\{\s*timeZone:\s*\"Asia\/Kolkata\"\s*\}\)/g, 'Number(n || 0).toLocaleString("en-IN")');
code = code.replace(/Number\(n\s*\|\|\s*0\)\.toLocaleString\(\"en-IN\",\s*\{\s*timeZone:\s*\"Asia\/Kolkata\",/g, 'Number(n || 0).toLocaleString("en-IN", {');

// Wait, the error TS1117 is "An object literal cannot have multiple properties with the same name."
// We might have `{ timeZone: "Asia/Kolkata", timeZone: "Asia/Kolkata",` remaining if there were more than two, or in ExpertsService.ts where I had `{ timeZone: "Asia/Kolkata", timeZone: "Asia/Kolkata" ... }`
// Let's just run a generic replace for all duplicate timeZones across ALL files again just to be safe.
code = code.replace(/(timeZone:\s*\"Asia\/Kolkata\",\s*)+timeZone:\s*\"Asia\/Kolkata\"/g, 'timeZone: "Asia/Kolkata"');
code = code.replace(/(timeZone:\s*\"Asia\/Kolkata\",\s*)+/g, 'timeZone: "Asia/Kolkata", ');

fs.writeFileSync(file, code);

// Fix ExpertsService.ts duplicate timeZones
file = 'd:/Web Development/PowerMySport/server/src/client/services/ExpertsService.ts';
code = fs.readFileSync(file, 'utf8');
code = code.replace(/(timeZone:\s*\"Asia\/Kolkata\",\s*)+/g, 'timeZone: "Asia/Kolkata", ');
fs.writeFileSync(file, code);

// Fix all other files for TS1117
const globFiles = [
  'd:/Web Development/PowerMySport/server/src/client/controllers/bookingController.ts',
  'd:/Web Development/PowerMySport/server/src/client/services/RefundService.ts',
  'd:/Web Development/PowerMySport/server/src/client/services/ReminderMonitoringService.ts',
  'd:/Web Development/PowerMySport/server/src/shared/controllers/WebhookController.ts',
  'd:/Web Development/PowerMySport/server/src/shared/services/roadmapChatService.ts'
];

for(const f of globFiles) {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/(timeZone:\s*\"Asia\/Kolkata\",\s*)+/g, 'timeZone: "Asia/Kolkata", ');
  fs.writeFileSync(f, c);
}

