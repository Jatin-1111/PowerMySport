// Must be the FIRST import of every load-test entry point. It pins the process
// to the throwaway Mongo container before any app module can read process.env,
// and refuses to run against anything that is not a local replica-set port.
const URI =
  process.env.LOADTEST_MONGO_URI ||
  "mongodb://127.0.0.1:27117/pms_loadtest?replicaSet=rs0&directConnection=true";

const host = (URI.match(/^mongodb:\/\/([^/?]+)/) || [])[1] || "";
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || /Powermysport/i.test(URI)) {
  console.error(`REFUSING TO RUN: ${host} is not a local throwaway Mongo.`);
  process.exit(1);
}

process.env.MONGO_URI = URI;
process.env.NODE_ENV = "development";
process.env.JWT_SECRET = process.env.JWT_SECRET || "loadtest-secret";
process.env.MONGO_MAX_POOL_SIZE = process.env.MONGO_MAX_POOL_SIZE || "100";
process.env.MONGO_MIN_POOL_SIZE = process.env.MONGO_MIN_POOL_SIZE || "10";
process.env.REDIS_ENABLED = "false";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "error";

// Throwaway push keys: the push module throws at import without them. The fake
// users have no push subscriptions, so nothing is ever sent.
if (!process.env.VAPID_PUBLIC_KEY) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const keys = require("web-push").generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_EMAIL = "mailto:loadtest@example.invalid";
}

export const LOADTEST_URI = URI;
