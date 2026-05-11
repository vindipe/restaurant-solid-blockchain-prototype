const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = process.cwd();
const runtimePath = path.join(root, "utils", "runtime");

const TEST_PORT = 8099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let serverProcess;

function log(message) {
  console.log(`[local-flow] ${message}`);
}

function fail(message) {
  console.error(`[local-flow] FAIL: ${message}`);
  cleanupAndExit(1);
}

function cleanRuntime() {
  fs.rmSync(runtimePath, { recursive: true, force: true });
}

function cleanupAndExit(code) {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }

  cleanRuntime();
  process.exit(code);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer() {
  const maxAttempts = 30;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/`, {}, 1000);

      if (response.ok) {
        return;
      }
    } catch (_) {
      // Server not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  fail(`Server did not become ready at ${BASE_URL}`);
}

async function assertHtmlPage(url, expectedText) {
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    fail(`${url} returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    fail(`${url} did not return HTML. Content-Type: ${contentType}`);
  }

  const body = await response.text();

  if (!body.includes(expectedText)) {
    fail(`${url} did not contain expected text: ${expectedText}`);
  }

  log(`OK ${url}`);
}

function startServer() {
  log(`Starting server on ${BASE_URL}`);

  serverProcess = spawn("node", ["restaurant.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      BASE_URL,
      TABLE_COUNT: "4",
      USE_LOCAL_DATA_FALLBACK: "true",
      SOLID_AUTH_ENABLED: "false",
      PAYMENT_MODE: "mock",
      ALLOW_POD_RESET: "false",
      ADMIN_POD_BASE_URL: process.env.ADMIN_POD_BASE_URL || "https://example.org/your-pod/",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (data) => {
    process.stdout.write(`[server] ${data}`);
  });

  serverProcess.stderr.on("data", (data) => {
    process.stderr.write(`[server] ${data}`);
  });

  serverProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      fail(`Server exited unexpectedly with code ${code}`);
    }
  });
}

async function main() {
  try {
    cleanRuntime();

    startServer();

    await waitForServer();

    await assertHtmlPage(`${BASE_URL}/`, "Restaurant");
    await assertHtmlPage(`${BASE_URL}/1`, "Table");

    log("Local flow smoke test completed successfully.");

    cleanupAndExit(0);
  } catch (error) {
    fail(error.message);
  }
}

process.on("SIGINT", () => cleanupAndExit(130));
process.on("SIGTERM", () => cleanupAndExit(143));

main();