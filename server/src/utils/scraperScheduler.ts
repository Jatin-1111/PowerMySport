import cron from "node-cron";
import { exec } from "child_process";
import path from "path";

export function initializeScraperScheduler() {
  console.log("📅 Initializing scraper scheduler...");

  // Run every Sunday at 2:00 AM
  const job = cron.schedule(
    "0 2 * * 0",
    async () => {
      console.log(`\n🔔 [${new Date().toISOString()}] Running scheduled scraper bots...`);
      
      const aitaScriptPath = path.join(__dirname, "../scripts/scrapeTournaments.ts");
      const uniScriptPath = path.join(__dirname, "../scripts/scrapeUniversities.ts");
      
      // Execute the Tournament scraper script via ts-node
      exec(`npx ts-node "${aitaScriptPath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ Tournament Scraper Bot Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`⚠️ Tournament Scraper Bot Stderr: ${stderr}`);
        }
        console.log(`✅ Tournament Scraper Bot Output:\n${stdout}`);
      });

      // Execute the University scraper script via ts-node
      exec(`npx ts-node "${uniScriptPath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error(`❌ University Scraper Bot Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`⚠️ University Scraper Bot Stderr: ${stderr}`);
        }
        console.log(`✅ University Scraper Bot Output:\n${stdout}`);
      });
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  console.log("✅ Scraper scheduler initialized (cron: 0 2 * * 0)");
  return job;
}
