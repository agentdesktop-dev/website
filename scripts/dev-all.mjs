import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

// Keep the Hugo flags in sync with dev:docs and dev:blog in package.json.
const servers = [
  { name: "next", command: process.execPath, args: [nextBin, "dev"] },
  {
    name: "docs",
    command: "hugo",
    args: ["server", "--source", "docs", "--disableFastRender"],
  },
  {
    name: "blog",
    command: "hugo",
    args: ["server", "--source", "blog", "--port", "1314", "--disableFastRender"],
  },
];

const children = [];
let stopping = false;
let signals = 0;

function stop(signal) {
  stopping = true;
  for (const child of children) child.kill(signal);
}

function relay(name, stream, output) {
  let partial = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    const lines = (partial + chunk).split("\n");
    partial = lines.pop();
    for (const line of lines) output.write(`[${name}] ${line}\n`);
  });
  stream.on("end", () => {
    if (partial) output.write(`[${name}] ${partial}\n`);
  });
}

function ended(name, reason, code) {
  if (stopping) return;
  console.error(`[${name}] ${reason}; stopping the other servers`);
  process.exitCode = code;
  stop("SIGTERM");
}

for (const { name, command, args } of servers) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  relay(name, child.stdout, process.stdout);
  relay(name, child.stderr, process.stderr);
  child.on("error", (error) =>
    ended(name, error.code === "ENOENT" ? `${command} not found on PATH` : error.message, 1),
  );
  child.on("close", (code, signal) =>
    ended(name, `exited with ${signal ?? `code ${code}`}`, code ?? 1),
  );
}

// A second interrupt force-kills servers that ignore the first.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => stop(++signals > 1 ? "SIGKILL" : "SIGTERM"));
}
