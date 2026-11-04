// Runs the Expo dev server and starts it again if it crashes.
//
// On Windows, Metro can die with "EMFILE: too many open files" during a burst of bundling (for
// example when a phone and a browser load the app at the same time). It is a crash of the dev
// server only, not of the app, and a restart recovers it. This keeps the server up so Expo Go on a
// phone reconnects by itself instead of needing a manual restart.
//
//   npm run dev
//
// One worker keeps the number of files open at once low.
const { spawn } = require("node:child_process");

const args = ["expo", "start", "--lan", "--max-workers", "1", ...process.argv.slice(2)];
let stopping = false;
let child = null;

function start() {
  child = spawn("npx", args, { stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    if (stopping) return;
    console.log(
      `\n[dev] Expo stopped (code ${code}). Restarting in 2 seconds. Press Ctrl+C to quit.\n`
    );
    setTimeout(start, 2000);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    if (child) child.kill();
    process.exit(0);
  });
}

start();
