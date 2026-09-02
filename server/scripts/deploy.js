const { execSync } = require("child_process");

const REGION = "ap-south-1";
const ECR_URI = "369435096566.dkr.ecr.ap-south-1.amazonaws.com/powermysport-api";
const AWS_PROFILE = "powermysport";
const EB_ENV = "powermysport-api-docker";

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: { ...process.env, AWS_PROFILE }, ...opts });
}

const gitSha = execSync("git rev-parse --short HEAD").toString().trim();
const dirtyFiles = execSync("git status --porcelain").toString().trim();
const allowDirty = process.argv.includes("--allow-dirty");

if (dirtyFiles) {
  console.log(
    `\nWorking tree has uncommitted changes — the image will NOT match commit ${gitSha}:\n`,
  );
  console.log(dirtyFiles);
  if (!allowDirty) {
    console.log(
      "\nCommit (or stash) first, or re-run with --allow-dirty to deploy this working tree anyway.",
    );
    process.exit(1);
  }
  console.log("\n--allow-dirty passed — proceeding with uncommitted changes.");
}

const imageTag = dirtyFiles ? `${gitSha}-dirty` : gitSha;

run(
  `aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI.split("/")[0]}`
);
run(`docker build -t ${ECR_URI}:${imageTag} -t ${ECR_URI}:latest .`);
run(`docker push ${ECR_URI}:${imageTag}`);
run(`docker push ${ECR_URI}:latest`);
run(`eb deploy ${EB_ENV}`);

console.log(`\nDeployed ${imageTag} to ${EB_ENV}.`);
