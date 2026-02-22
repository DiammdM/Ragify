#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const LOGIN_USERNAME = process.env.LOGIN_USERNAME ?? "admin@qq.com";
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD ?? "123456";
const HEADLESS =
  process.env.HEADLESS === "1" || process.env.HEADLESS === "true";
const KEEP_DEV_SERVER =
  process.env.KEEP_DEV_SERVER === "1" || process.env.KEEP_DEV_SERVER === "true";

const SERVER_TIMEOUT_MS = 120_000;
const LOGIN_TIMEOUT_MS = 20_000;
const READY_PATTERNS = [/Ready in/i, /ready - started server/i];
const STARTUP_ERROR_PATTERNS = [/Failed to start server/i, /Error:\s+listen /i];

let devProcess;
let browser;
let isStoppingDevServer = false;

function startDevServer() {
  return new Promise((resolve, reject) => {
    let isSettled = false;
    const timeout = setTimeout(() => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      reject(new Error("Timed out waiting for next dev startup logs."));
    }, SERVER_TIMEOUT_MS);

    const settle = (action, value) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      clearTimeout(timeout);
      action(value);
    };

    const handleOutput = (chunk, stream) => {
      const text = chunk.toString();
      process[stream].write(text);

      if (STARTUP_ERROR_PATTERNS.some((pattern) => pattern.test(text))) {
        settle(
          reject,
          new Error("Dev server failed to start. Check logs above."),
        );
        return;
      }

      if (READY_PATTERNS.some((pattern) => pattern.test(text))) {
        settle(resolve);
      }
    };

    devProcess = spawn("npm", ["run", "dev"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      detached: process.platform !== "win32",
      env: process.env,
    });

    devProcess.stdout?.on("data", (chunk) => handleOutput(chunk, "stdout"));
    devProcess.stderr?.on("data", (chunk) => handleOutput(chunk, "stderr"));

    devProcess.on("exit", (code, signal) => {
      if (isStoppingDevServer) {
        return;
      }

      if (!isSettled) {
        settle(
          reject,
          new Error(`dev server exited early (code=${code}, signal=${signal})`),
        );
        return;
      }

      if (code !== 0 && signal !== "SIGINT") {
        console.error(
          `dev server exited early (code=${code}, signal=${signal})`,
        );
      }
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${url}/login`, {
        redirect: "manual",
      });

      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }

    await delay(1000);
  }

  throw new Error(`Timed out waiting for dev server at ${url}`);
}

async function stopDevServer() {
  if (!devProcess || devProcess.killed) {
    return;
  }

  isStoppingDevServer = true;
  const killTarget =
    process.platform !== "win32" && devProcess.pid
      ? -devProcess.pid
      : devProcess.pid;

  if (killTarget) {
    try {
      process.kill(killTarget, "SIGINT");
    } catch {
      // Ignore and continue to wait/hard-kill.
    }
  }

  const exited = await Promise.race([
    new Promise((resolve) => devProcess.once("exit", () => resolve(true))),
    delay(10_000).then(() => false),
  ]);

  if (!exited) {
    try {
      if (killTarget) {
        process.kill(killTarget, "SIGKILL");
      }
    } catch {
      // Best-effort hard stop.
    }
  }
}

async function getLoginErrorText(page) {
  const messages = await page.locator("form p").allTextContents();
  const cleaned = messages
    .map((text) => text.trim())
    .filter(Boolean)
    .filter(
      (text) =>
        !text.includes("还没有账号") &&
        !text.includes("Already have") &&
        !text.includes("Don't have an account"),
    );

  return cleaned[0] ?? "Login failed: still on /login page.";
}

async function fillInputWithRetry(locator, value, label) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await locator.click({ clickCount: 3 });
    await locator.fill(value);
    await delay(600);

    const current = await locator.inputValue();
    if (current === value) {
      return;
    }

    if (attempt < 5) {
      await delay(600);
    }
  }

  throw new Error(`Failed to fill ${label} after multiple retries.`);
}

async function run() {
  let playwrightModule;
  try {
    playwrightModule = await import("playwright");
  } catch {
    throw new Error(
      "Playwright is not installed. Run: pnpm add -D playwright && pnpm exec playwright install chromium",
    );
  }

  await startDevServer();
  await waitForServer(BASE_URL, 30_000);

  const { chromium } = playwrightModule;
  browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

  const nameInput = page
    .locator('form input[type="text"], form input[type="email"]')
    .first();
  const passwordInput = page.locator('form input[type="password"]').first();
  const submitButton = page.locator("form button").first();

  await nameInput.waitFor({ state: "visible", timeout: 20_000 });
  await passwordInput.waitFor({ state: "visible", timeout: 20_000 });

  await fillInputWithRetry(nameInput, LOGIN_USERNAME, "username");
  await fillInputWithRetry(passwordInput, LOGIN_PASSWORD, "password");

  await submitButton.click();

  try {
    await page.waitForURL((url) => url.pathname !== "/login", {
      timeout: LOGIN_TIMEOUT_MS,
    });
  } catch {
    const loginError = await getLoginErrorText(page);
    throw new Error(loginError);
  }

  await delay(1000);

  await page.goto(`${BASE_URL}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/settings(?:\?.*)?$/, { timeout: 20_000 });

  console.log(`Success: logged in as ${LOGIN_USERNAME} and opened /settings`);

  if (!HEADLESS) {
    console.log("Browser left open for 5 seconds for visual confirmation...");
    await delay(5000);
  }
}

async function cleanup() {
  if (browser) {
    await browser.close();
  }

  if (!KEEP_DEV_SERVER) {
    await stopDevServer();
  }
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
