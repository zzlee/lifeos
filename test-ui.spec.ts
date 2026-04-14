import { test, expect } from '@playwright/test';

test('Verify health list layout changes', async ({ page }) => {
  // Setup API responses
  await page.route('**/api/session', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        user: { id: 1, email: 'test@example.com', name: 'Test User', timezone: 'Asia/Taipei' }
      })
    });
  });

  await page.route('**/api/dashboard', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          finance: [],
          journals: [],
          vault: [],
          health: [
            { id: 1, date: '2023-10-27T08:00:00.000Z', sys: 120, dia: 80, hr: 70, weight: 65 },
            { id: 2, date: '2023-10-26T08:00:00.000Z', sys: 125, dia: 82, hr: 72, weight: 65.5 }
          ]
        }
      })
    });
  });

  await page.goto('http://localhost:5173');

  await page.waitForTimeout(1000);

  // Click on the health nav link
  await page.click('text="生理資訊"');

  await page.waitForTimeout(1000);

  // Scroll down to the list part
  await page.evaluate(() => window.scrollBy(0, 1000));

  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'screenshot.png' });
});
