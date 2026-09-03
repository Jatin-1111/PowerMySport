const { execSync } = require("child_process");

// Recreates the ElastiCache Redis replication group that was deleted on
// 2026-09-01 to cut cost during a low-traffic period. Every setting here
// mirrors the original (captured from CloudTrail's CreateReplicationGroup
// event) EXCEPT it provisions 1 node instead of 3 and drops Multi-AZ /
// automatic failover — every Redis call site in this codebase already
// fails open (see src/config/redis.ts, chatRateLimitService.ts, etc.), so
// HA failover for the cache was paying for resilience the app doesn't need.
//
// The replication group's primary endpoint is stable across replacement,
// but this is a NEW cluster, so run `eb setenv REDIS_URL=...` (printed at
// the end) to point the app at it — the old REDIS_URL from before deletion
// will not resolve.

const AWS_PROFILE = "powermysport";
const REGION = "ap-south-1";
const REPLICATION_GROUP_ID = "powermysport-redis";
const EB_ENV = "powermysport-api-docker";

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  return execSync(cmd, {
    env: { ...process.env, AWS_PROFILE },
    encoding: "utf8",
  });
}

run(
  [
    "aws elasticache create-replication-group",
    `--replication-group-id ${REPLICATION_GROUP_ID}`,
    `--replication-group-description "PowerMySport app cache (single-node, recreated)"`,
    "--num-cache-clusters 1",
    "--cache-node-type cache.t3.micro",
    "--engine redis",
    "--engine-version 7.1",
    "--cache-parameter-group-name default.redis7",
    `--cache-subnet-group-name ${REPLICATION_GROUP_ID}`,
    "--security-group-ids sg-0dcd62f75dc271a39",
    "--port 6379",
    "--transit-encryption-enabled",
    "--transit-encryption-mode required",
    "--at-rest-encryption-enabled",
    "--snapshot-retention-limit 1",
    `--region ${REGION}`,
  ].join(" ")
);

console.log("\nProvisioning started — this takes 5-10 minutes.");
console.log("Poll status with:");
console.log(
  `  aws elasticache describe-replication-groups --replication-group-id ${REPLICATION_GROUP_ID} --query "ReplicationGroups[0].Status" --output text --profile ${AWS_PROFILE}`
);
console.log("\nOnce status is 'available', get the new endpoint with:");
console.log(
  `  aws elasticache describe-replication-groups --replication-group-id ${REPLICATION_GROUP_ID} --query "ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address" --output text --profile ${AWS_PROFILE}`
);
console.log("\nThen point the app at it (from server/):");
console.log(`  eb setenv REDIS_URL=rediss://<new-endpoint>:6379 --environment ${EB_ENV}`);
