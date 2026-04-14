import { test, expect } from '@playwright/test';

test('health modal layout on mobile', async ({ page }) => {
  // Change viewport to mobile
  await page.setViewportSize({ width: 375, height: 667 });

  // Mock API responses
  await page.route('**/api/session', async (route) => {
    const json = { authenticated: true, user: { id: "1", name: "User", email: "user@example.com", timezone: "UTC" } };
    await route.fulfill({ json });
  });

  await page.route('**/api/dashboard', async (route) => {
    const json = {
      data: {
        finance: [],
        journals: [],
        health: [],
        vault: []
      }
    };
    await route.fulfill({ json });
  });

  // Navigate to app (assuming dev server runs on 5173, bypassing API config check by not setting VITE_API_BASE_URL)
  await page.goto('http://localhost:5173');

  // Go to health view
  await page.click('button:has-text("健康")');

  // Open health modal
  await page.click('button:has-text("+ 新增紀錄")');

  // Wait for modal to be visible
  await expect(page.locator('.modal-content')).toBeVisible();

  // Take screenshot
  await page.screenshot({ path: 'health-modal-mobile.png' });
});
