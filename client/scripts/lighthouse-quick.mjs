import fs from "fs";
import path from "path";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import * as chromeLauncher from "chrome-launcher";

const BASE_URL = process.env.LH_BASE_URL || "https://powermysport.com";
const OUT_DIR = path.resolve("lighthouse-reports");
const ROUTES = process.argv.slice(2);

fs.mkdirSync(OUT_DIR, { recursive: true });

function slugify(route) {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "_");
}

async function main() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--disable-gpu", "--no-sandbox"],
  });

  for (const route of ROUTES) {
    const url = `${BASE_URL}${route}`;
    process.stderr.write(`Auditing ${url} ...\n`);
    const result = await lighthouse(
      url,
      {
        port: chrome.port,
        output: ["html", "json"],
        onlyCategories: ["performance"],
        logLevel: "silent",
      },
      desktopConfig
    );
    const slug = slugify(route);
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.desktop.html`), result.report[0]);
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.desktop.json`), result.report[1]);
    const lhr = result.lhr;
    process.stderr.write(
      `  perf=${Math.round(lhr.categories.performance.score * 100)} FCP=${lhr.audits["first-contentful-paint"].displayValue} LCP=${lhr.audits["largest-contentful-paint"].displayValue} TBT=${lhr.audits["total-blocking-time"].displayValue} CLS=${lhr.audits["cumulative-layout-shift"].displayValue}\n`
    );
    await new Promise((r) => setTimeout(r, 1000));
  }

  await chrome.kill().catch(() => {});
}

main();
