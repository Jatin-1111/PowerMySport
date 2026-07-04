const fs = require('fs');

const files = [
  'd:/Web Development/PowerMySport/server/src/utils/email.ts',
  'd:/Web Development/PowerMySport/server/src/client/services/ReminderMonitoringService.ts',
  'd:/Web Development/PowerMySport/server/src/shared/controllers/WebhookController.ts',
  'd:/Web Development/PowerMySport/server/src/client/controllers/bookingController.ts'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  
  code = code.replace(/toLocaleDateString\(\s*[\"']en-IN[\"']\s*,\s*\{/g, 'toLocaleDateString(\"en-IN\", { timeZone: \"Asia/Kolkata\",');
  code = code.replace(/toLocaleString\(\s*[\"']en-IN[\"']\s*,\s*\{/g, 'toLocaleString(\"en-IN\", { timeZone: \"Asia/Kolkata\",');
  
  code = code.replace(/toLocaleDateString\(\s*[\"']en-IN[\"']\s*\)/g, 'toLocaleDateString(\"en-IN\", { timeZone: \"Asia/Kolkata\" })');
  code = code.replace(/toLocaleString\(\s*[\"']en-IN[\"']\s*\)/g, 'toLocaleString(\"en-IN\", { timeZone: \"Asia/Kolkata\" })');

  code = code.replace(/toLocaleDateString\(\s*[\"']en-US[\"']\s*,\s*\{/g, 'toLocaleDateString(\"en-US\", { timeZone: \"Asia/Kolkata\",');

  fs.writeFileSync(file, code);
  console.log('Fixed', file);
}
