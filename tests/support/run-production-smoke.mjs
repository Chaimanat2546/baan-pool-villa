import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key, value]) => {
    return value !== undefined && !key.startsWith("=");
  }),
);
const nodeOptions = [process.env.NODE_OPTIONS, "--use-system-ca"]
  .filter(Boolean)
  .join(" ");
const serverEnv = {
  ...cleanEnv,
  NODE_OPTIONS: nodeOptions,
};
const testEnv = {
  ...cleanEnv,
  PLAYWRIGHT_BASE_URL: baseUrl,
};

const nextCliPath = fileURLToPath(
  new URL("../../node_modules/next/dist/bin/next", import.meta.url),
);
const playwrightCliPath = fileURLToPath(
  new URL("../../node_modules/playwright/cli.js", import.meta.url),
);

let serverProcess;
let serverExited = false;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      resolve({ code: code ?? 0, signal });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForServer() {
  const loginUrl = new URL("/admin/login", baseUrl);

  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await fetch(loginUrl);

      if (response.status < 500) {
        return;
      }
    } catch {
      // Keep polling until next start is ready.
    }

    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for production server at ${baseUrl}`);
}

async function stopServer() {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  serverProcess.kill();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (serverExited) {
      return;
    }

    await sleep(100);
  }

  if (process.platform === "win32" && serverProcess.pid && !serverExited) {
    await run("taskkill", ["/pid", String(serverProcess.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }
}

async function main() {
  serverProcess = spawn(
    process.execPath,
    [nextCliPath, "start", "-H", "127.0.0.1", "-p", "3100"],
    {
      env: serverEnv,
      stdio: "inherit",
    },
  );
  serverProcess.on("exit", () => {
    serverExited = true;
  });

  await waitForServer();

  const result = await run(
    process.execPath,
    [playwrightCliPath, "test", "--project=chromium", ...process.argv.slice(2)],
    {
      env: testEnv,
    },
  );

  await stopServer();
  process.exit(result.code);
}

process.on("SIGINT", () => {
  void stopServer().finally(() => {
    process.exit(130);
  });
});
process.on("SIGTERM", () => {
  void stopServer().finally(() => {
    process.exit(143);
  });
});

main().catch(async (error) => {
  console.error(error);
  await stopServer();
  process.exit(1);
});
