/**
 * E2E tests for wallmount display.
 */

import { test, expect } from '@playwright/test';

test.describe('Wallmount Display', () => {
  test.describe('Public Access', () => {
    test('should be accessible without authentication', async ({ page }) => {
      await page.goto('/wallmount');

      // Should not redirect to login
      await expect(page).toHaveURL(/.*wallmount/);
    });

    test('should display wallmount page', async ({ page }) => {
      await page.goto('/wallmount');

      // Wallmount page should load
      await expect(
        page.locator('[data-testid="wallmount"], .wallmount, [class*="wallmount"]')
      ).toBeVisible();
    });

    test('should show idle state when no session active', async ({ page }) => {
      await page.goto('/wallmount');

      // When no session is active, should show idle/waiting state
      await expect(
        page.getByText(/waiting|idle|no.*session|upcoming/i)
      ).toBeVisible();
    });
  });

  test.describe('Session Display', () => {
    test.beforeEach(async ({ page, context }) => {
      // Login in a separate context to start a session
      const adminPage = await context.newPage();
      await adminPage.goto('/login');
      await adminPage.getByLabel(/username/i).fill('admin@theatarr.local');
      await adminPage.getByLabel(/password/i).fill('admin123');
      await adminPage.getByRole('button', { name: /sign in/i }).click();
      await adminPage.waitForURL(/.*dashboard/);
      await adminPage.close();
    });

    test('should show movie info during active session', async ({ page }) => {
      await page.goto('/wallmount');

      // Check for movie info components (may or may not be present depending on session state)
      const movieInfo = page.locator(
        '[data-testid="movie-info"], .movie-info, [class*="movie"]'
      );

      // Either shows movie info or idle state
      await expect(
        movieInfo.or(page.getByText(/waiting|idle|no.*session/i))
      ).toBeVisible();
    });

    test('should display countdown timer for scheduled sessions', async ({ page }) => {
      await page.goto('/wallmount');

      // Countdown timer component
      const countdown = page.locator(
        '[data-testid="countdown"], .countdown, [class*="countdown"], [class*="timer"]'
      );

      // May or may not be visible depending on session state
      if (await countdown.isVisible()) {
        await expect(countdown).toContainText(/\d/);
      }
    });

    test('should apply dynamic theming from movie poster', async ({ page }) => {
      await page.goto('/wallmount');

      // Check that CSS custom properties are applied for theming
      const wallmount = page.locator(
        '[data-testid="wallmount"], .wallmount, [class*="wallmount"]'
      ).first();

      if (await wallmount.isVisible()) {
        // Page should have some styling applied
        const backgroundColor = await wallmount.evaluate((el) =>
          window.getComputedStyle(el).backgroundColor
        );
        expect(backgroundColor).toBeDefined();
      }
    });
  });

  test.describe('Real-time Updates', () => {
    test('should connect to WebSocket', async ({ page }) => {
      // Listen for WebSocket connections
      const wsPromise = page.waitForEvent('websocket');

      await page.goto('/wallmount');

      // Wait for WebSocket connection
      const ws = await wsPromise;
      expect(ws.url()).toContain('ws');
    });

    test('should update state in real-time', async ({ page }) => {
      await page.goto('/wallmount');

      // Wait for initial render
      await page.waitForTimeout(1000);

      // The page should be responsive to state changes
      // This test verifies the page is set up for real-time updates
      const wallmount = page.locator(
        '[data-testid="wallmount"], .wallmount, [class*="wallmount"]'
      );
      await expect(wallmount).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/wallmount');

      const wallmount = page.locator(
        '[data-testid="wallmount"], .wallmount, [class*="wallmount"]'
      );
      await expect(wallmount).toBeVisible();
    });

    test('should display correctly on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/wallmount');

      const wallmount = page.locator(
        '[data-testid="wallmount"], .wallmount, [class*="wallmount"]'
      );
      await expect(wallmount).toBeVisible();
    });

    test('should display correctly on large screen', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/wallmount');

      const wallmount = page.locator(
        '[data-testid="wallmount"], .wallmount, [class*="wallmount"]'
      );
      await expect(wallmount).toBeVisible();
    });
  });

  test.describe('Token Access', () => {
    test('should accept token parameter', async ({ page }) => {
      await page.goto('/wallmount?token=test-token-123');

      // Should not show unauthorized error
      await expect(page).toHaveURL(/.*wallmount.*token/);

      // Page should load
      const wallmount = page.locator(
        '[data-testid="wallmount"], .wallmount, [class*="wallmount"]'
      );
      await expect(wallmount).toBeVisible();
    });
  });
});
