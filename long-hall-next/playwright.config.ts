/**
 * Playwright E2E Test Configuration
 * 
 * @see https://playwright.dev/docs/test-configuration
 * 
 * This config sets up E2E testing for The Long Hall game application.
 * Tests run against the Astro dev server on port 4321.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory - E2E tests are in tests/e2e
  testDir: './tests/e2e',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Limit workers in CI to reduce resource contention
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use - html for local, list for CI
  reporter: process.env.CI ? 'list' : 'html',
  
  // Shared settings for all the projects below
  use: {
    // Base URL for navigation (uses env var or default)
    baseURL: process.env.BASE_URL || 'http://localhost:4321',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video recording - only on failure in CI
    video: process.env.CI ? 'on-first-retry' : 'off',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Additional browsers can be added here for cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: process.env.BASE_URL || 'http://localhost:4321',
    reuseExistingServer: true, // Always try to reuse existing server
    timeout: 120 * 1000, // 2 minutes for dev server startup
  },
  
  // Test timeout
  timeout: 30000,
  
  // Expect timeout
  expect: {
    timeout: 5000,
  },
});
