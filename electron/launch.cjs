// Launches the Electron binary without ELECTRON_RUN_AS_NODE.
//
// This repo opened against a user environment that already has
// ELECTRON_RUN_AS_NODE=1 set globally — which forces Electron to run as plain
// Node and skip the main-process API. Deleting the var here ensures our main
// process boots correctly regardless of what the user's shell has.

const { spawn } = require("node:child_process");
const electronPath = require("electron");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
if (!env.SEMESTRA_DEV_URL && !process.argv.includes("--prod")) {
  env.SEMESTRA_DEV_URL = "http://127.0.0.1:5173";
}

const args = [require("node:path").join(__dirname, "..")];

const child = spawn(electronPath, args, {
  stdio: "inherit",
  env,
  windowsHide: false,
});

child.on("exit", (code) => process.exit(code ?? 0));
