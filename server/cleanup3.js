const fs = require('fs');
const files = [
  'd:/Web Development/PowerMySport/server/src/client/services/ExpertsService.ts',
  'd:/Web Development/PowerMySport/server/src/client/services/RefundService.ts',
  'd:/Web Development/PowerMySport/server/src/client/services/ReminderMonitoringService.ts',
  'd:/Web Development/PowerMySport/server/src/shared/controllers/WebhookController.ts',
  'd:/Web Development/PowerMySport/server/src/shared/services/roadmapChatService.ts',
  'd:/Web Development/PowerMySport/server/src/utils/email.ts'
];

for(const f of files) {
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, 'utf8');
  let old = c;
  // Fix multiple timeZone properties
  c = c.replace(/(timeZone:\s*[\"']Asia\/Kolkata[\"'],\s*)+timeZone:/g, 'timeZone:');
  // Fix timeZone: \"Asia/Kolkata\" appearing twice like { timeZone: \"Asia/Kolkata\", timeZone: tz }
  c = c.replace(/timeZone:\s*[\"']Asia\/Kolkata[\"'],\s*timeZone:\s*tz/g, 'timeZone: tz');
  // Fix email.ts(2013) which is Number().toLocaleString
  c = c.replace(/`₹\$\{Number\(n\s*\|\|\s*0\)\.toLocaleString\(\"en-IN\",\s*\{\s*timeZone:\s*\"Asia\/Kolkata\"\s*\}\)\}`/g, '`₹${Number(n || 0).toLocaleString(\"en-IN\")}`');
  
  if (old !== c) {
    fs.writeFileSync(f, c);
  }
}
