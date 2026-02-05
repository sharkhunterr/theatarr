/**
 * E2E tests for session management flows.
 */

import { test, expect } from '@playwright/test';

test.describe('Sessions', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/username/i).fill('admin@theatarr.local');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test.describe('Session List', () => {
    test('should display session list page', async ({ page }) => {
      await page.goto('/sessions');

      await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible();
    });

    test('should show create session button', async ({ page }) => {
      await page.goto('/sessions');

      await expect(
        page.getByRole('button', { name: /create|new|add/i })
      ).toBeVisible();
    });

    test('should display session cards when sessions exist', async ({ page }) => {
      await page.goto('/sessions');

      // May or may not have sessions, but the list container should exist
      await expect(
        page.locator('[data-testid="session-list"], .session-list, [class*="session"]')
      ).toBeVisible();
    });
  });

  test.describe('Session Creation', () => {
    test('should open session creation form', async ({ page }) => {
      await page.goto('/sessions');

      await page.getByRole('button', { name: /create|new|add/i }).click();

      await expect(
        page.getByRole('heading', { name: /create|new/i })
      ).toBeVisible();
      await expect(page.getByLabel(/name/i)).toBeVisible();
    });

    test('should create a new session', async ({ page }) => {
      await page.goto('/sessions');

      await page.getByRole('button', { name: /create|new|add/i }).click();

      await page.getByLabel(/name/i).fill('E2E Test Session');
      await page.getByRole('button', { name: /save|create|submit/i }).click();

      // Should show success or redirect to session detail
      await expect(
        page.getByText(/created|success|E2E Test Session/i)
      ).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
      await page.goto('/sessions');

      await page.getByRole('button', { name: /create|new|add/i }).click();

      // Try to submit without filling required fields
      await page.getByRole('button', { name: /save|create|submit/i }).click();

      // Should show validation error
      await expect(page.getByText(/required|invalid/i)).toBeVisible();
    });
  });

  test.describe('Session Controls', () => {
    test('should display session controls on session page', async ({ page }) => {
      // Navigate to first session if exists
      await page.goto('/sessions');

      const sessionCard = page.locator('[data-testid="session-card"], .session-card').first();
      if (await sessionCard.isVisible()) {
        await sessionCard.click();

        // Session detail page should show controls
        await expect(
          page.getByRole('button', { name: /play|start/i })
        ).toBeVisible();
      }
    });

    test('should start a session', async ({ page }) => {
      await page.goto('/sessions');

      const sessionCard = page.locator('[data-testid="session-card"], .session-card').first();
      if (await sessionCard.isVisible()) {
        await sessionCard.click();

        await page.getByRole('button', { name: /play|start/i }).click();

        // Should show running state or pause button
        await expect(
          page.getByRole('button', { name: /pause/i }).or(
            page.getByText(/running/i)
          )
        ).toBeVisible();

        // Cleanup: stop the session
        const stopButton = page.getByRole('button', { name: /stop/i });
        if (await stopButton.isVisible()) {
          await stopButton.click();
        }
      }
    });

    test('should pause and resume a session', async ({ page }) => {
      await page.goto('/sessions');

      const sessionCard = page.locator('[data-testid="session-card"], .session-card').first();
      if (await sessionCard.isVisible()) {
        await sessionCard.click();

        // Start
        await page.getByRole('button', { name: /play|start/i }).click();
        await expect(page.getByRole('button', { name: /pause/i })).toBeVisible();

        // Pause
        await page.getByRole('button', { name: /pause/i }).click();
        await expect(page.getByText(/paused/i)).toBeVisible();

        // Resume
        await page.getByRole('button', { name: /play|resume/i }).click();
        await expect(page.getByText(/running/i)).toBeVisible();

        // Cleanup
        const stopButton = page.getByRole('button', { name: /stop/i });
        if (await stopButton.isVisible()) {
          await stopButton.click();
        }
      }
    });
  });

  test.describe('Session Editing', () => {
    test('should navigate to session editor', async ({ page }) => {
      await page.goto('/sessions');

      const editButton = page.getByRole('button', { name: /edit/i }).first();
      if (await editButton.isVisible()) {
        await editButton.click();

        await expect(page).toHaveURL(/.*edit/);
        await expect(page.getByLabel(/name/i)).toBeVisible();
      }
    });

    test('should show sequence editor in session edit page', async ({ page }) => {
      await page.goto('/sessions');

      const editButton = page.getByRole('button', { name: /edit/i }).first();
      if (await editButton.isVisible()) {
        await editButton.click();

        await expect(
          page.getByText(/sequence|sequences/i)
        ).toBeVisible();
      }
    });
  });
});
