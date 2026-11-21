import { defineConfig } from '@playwright/test'

const baseURL = process.env.COSMOS_TEST_URL ?? 'http://127.0.0.1:8000'
const hostname = new URL(baseURL).hostname

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 100_000,
  reporter: 'list',
  use: {
    baseURL,
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--enable-unsafe-swiftshader', '--no-proxy-server', `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${hostname}`],
    },
  },
})
