import fs from "fs";
import path from "path";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import * as chromeLauncher from "chrome-launcher";

const BASE_URL = "https://powermysport.com";
const OUT_DIR = path.resolve("lighthouse-reports");

const ROUTES = [
  // marketing
  "/",
  "/about",
  "/careers",
  "/community-waitlist",
  "/contact",
  "/content-policy",
  "/cookies",
  "/faq",
  "/guidance",
  "/health-waiver",
  "/how-it-works",
  "/onboarding",
  "/parental-consent",
  "/privacy",
  "/refund-policy",
  "/roadmap",
  "/terms",
  // auth
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/parent-onboarding",
  // booking storefront
  "/booking",
  "/checkout",
  "/experts",
  "/experts/sessions",
  "/payment",
  "/saved",
  // shop
  "/shop",
  "/shop/cart",
  "/shop/checkout",
  "/shop/orders",
  "/shop/account",
  "/shop/wishlist",
  // other
  "/notifications",
];

fs.mkdirSync(OUT_DIR, { recursive: true });

function slugify(route) {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "_");
}

async function auditRoute(chrome, route) {
  const url = `${BASE_URL}${route}`;
  const result = await lighthouse(
    url,
    {
      port: chrome.port,
      output: ["html", "json"],
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      logLevel: "silent",
    },
    desktopConfig
  );

  const slug = slugify(route);
  fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), result.report[0]);
  fs.writeFileSync(path.join(OUT_DIR, `${slug}.json`), result.report[1]);

  const lhr = result.lhr;
  return {
    route,
    performance: Math.round(lhr.categories.performance.score * 100),
    accessibility: Math.round(lhr.categories.accessibility.score * 100),
    bestPractices: Math.round(lhr.categories["best-practices"].score * 100),
    seo: Math.round(lhr.categories.seo.score * 100),
  };
}

async function main() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--disable-gpu", "--no-sandbox"],
  });

  const summary = [];
  for (const route of ROUTES) {
    try {
      process.stderr.write(`Auditing ${route} ...\n`);
      const res = await auditRoute(chrome, route);
      summary.push(res);
      process.stderr.write(
        `  perf=${res.performance} a11y=${res.accessibility} bp=${res.bestPractices} seo=${res.seo}\n`
      );
    } catch (err) {
      process.stderr.write(`  FAILED ${route}: ${err.message}\n`);
      summary.push({ route, error: err.message });
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  await chrome.kill().catch(() => {});

  fs.writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log(JSON.stringify(summary, null, 2));
}

main();
