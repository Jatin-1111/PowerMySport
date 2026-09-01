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

run(
  `aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI.split("/")[0]}`
);
run(`docker build -t ${ECR_URI}:${gitSha} -t ${ECR_URI}:latest .`);
run(`docker push ${ECR_URI}:${gitSha}`);
run(`docker push ${ECR_URI}:latest`);
run(`eb deploy ${EB_ENV}`);

console.log(`\nDeployed ${gitSha} to ${EB_ENV}.`);
