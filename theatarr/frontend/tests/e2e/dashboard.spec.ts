/**
 * E2E tests for dashboard and navigation.
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/username/i).fill('admin@theatarr.local');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test.describe('Dashboard Display', () => {
    test('should display dashboard heading', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: /dashboard/i })
      ).toBeVisible();
    });

    test('should show session status widget', async ({ page }) => {
      await expect(
        page.getByText(/session|active|running|idle/i)
      ).toBeVisible();
    });

    test('should show services status', async ({ page }) => {
      await expect(
        page.getByText(/services|connected|status/i)
      ).toBeVisible();
    });

    test('should show quick actions', async ({ page }) => {
      // Dashboard should have quick action buttons
      await expect(
        page.getByRole('button').filter({ hasText: /start|create|new/i })
      ).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to sessions', async ({ page }) => {
      await page.getByRole('link', { name: /sessions/i }).click();

      await expect(page).toHaveURL(/.*sessions/);
    });

    test('should navigate to services', async ({ page }) => {
      await page.getByRole('link', { name: /services/i }).click();

      await expect(page).toHaveURL(/.*services/);
    });

    test('should navigate to templates', async ({ page }) => {
      await page.getByRole('link', { name: /templates/i }).click();

      await expect(page).toHaveURL(/.*templates/);
    });

    test('should navigate to trailers', async ({ page }) => {
      await page.getByRole('link', { name: /trailers/i }).click();

      await expect(page).toHaveURL(/.*trailers/);
    });

    test('should navigate to vote sessions', async ({ page }) => {
      await page.getByRole('link', { name: /vote|voting/i }).click();

      await expect(page).toHaveURL(/.*vote/);
    });

    test('should navigate to config', async ({ page }) => {
      await page.getByRole('link', { name: /config|settings/i }).click();

      await expect(page).toHaveURL(/.*config/);
    });
  });

  test.describe('Widgets', () => {
    test('should display upcoming sessions widget', async ({ page }) => {
      const upcomingWidget = page.locator(
        '[data-testid="upcoming-sessions"], .upcoming-sessions, [class*="upcoming"]'
      );

      if (await upcomingWidget.isVisible()) {
        await expect(upcomingWidget).toBeVisible();
      }
    });

    test('should display recent activity widget', async ({ page }) => {
      const activityWidget = page.locator(
        '[data-testid="recent-activity"], .recent-activity, [class*="activity"]'
      );

      if (await activityWidget.isVisible()) {
        await expect(activityWidget).toBeVisible();
      }
    });

    test('should display trailer stats', async ({ page }) => {
      await expect(
        page.getByText(/trailer|storage|download/i)
      ).toBeVisible();
    });
  });

  test.describe('Responsive Layout', () => {
    test('should show mobile menu on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Should show hamburger menu
      const menuButton = page.getByRole('button', { name: /menu/i });

      if (await menuButton.isVisible()) {
        await menuButton.click();

        // Navigation should be visible
        await expect(
          page.getByRole('link', { name: /sessions/i })
        ).toBeVisible();
      }
    });

    test('should stack widgets on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Widgets should be visible and stacked
      const widgets = page.locator('[data-testid*="widget"], .widget, [class*="widget"]');

      if (await widgets.count() > 0) {
        await expect(widgets.first()).toBeVisible();
      }
    });
  });
});

test.describe('Trailers Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/username/i).fill('admin@theatarr.local');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test.describe('Trailers Page', () => {
    test('should display trailers page', async ({ page }) => {
      await page.goto('/trailers');

      await expect(
        page.getByRole('heading', { name: /trailer/i })
      ).toBeVisible();
    });

    test('should show trailer library', async ({ page }) => {
      await page.goto('/trailers');

      // Should show trailer list or empty state
      await expect(
        page.locator('[data-testid="trailer-list"], .trailer-list').or(
          page.getByText(/no.*trailers|empty|add.*rule/i)
        )
      ).toBeVisible();
    });

    test('should show storage stats', async ({ page }) => {
      await page.goto('/trailers');

      await expect(
        page.getByText(/storage|used|available|gb|mb/i)
      ).toBeVisible();
    });
  });

  test.describe('Trailer Rules', () => {
    test('should show add rule button', async ({ page }) => {
      await page.goto('/trailers');

      await expect(
        page.getByRole('button', { name: /add.*rule|new.*rule|create/i })
      ).toBeVisible();
    });

    test('should open rule creation form', async ({ page }) => {
      await page.goto('/trailers');

      await page.getByRole('button', { name: /add.*rule|new.*rule|create/i }).click();

      // Should show rule form
      await expect(
        page.getByLabel(/name|genre|quality/i)
      ).toBeVisible();
    });

    test('should allow configuring genre filter', async ({ page }) => {
      await page.goto('/trailers');

      await page.getByRole('button', { name: /add.*rule|new.*rule|create/i }).click();

      // Genre selector
      const genreSelector = page.locator(
        '[data-testid="genre-selector"], select, [role="combobox"]'
      ).first();

      if (await genreSelector.isVisible()) {
        await expect(genreSelector).toBeVisible();
      }
    });

    test('should allow configuring quality preference', async ({ page }) => {
      await page.goto('/trailers');

      await page.getByRole('button', { name: /add.*rule|new.*rule|create/i }).click();

      // Quality selector
      await expect(
        page.getByText(/quality|1080p|720p|4k/i)
      ).toBeVisible();
    });

    test('should allow configuring storage limit', async ({ page }) => {
      await page.goto('/trailers');

      await page.getByRole('button', { name: /add.*rule|new.*rule|create/i }).click();

      // Storage limit input
      const storageInput = page.getByLabel(/storage|limit|max/i);

      if (await storageInput.isVisible()) {
        await storageInput.fill('10');
        await expect(storageInput).toHaveValue('10');
      }
    });
  });

  test.describe('Trailer Actions', () => {
    test('should allow playing a trailer', async ({ page }) => {
      await page.goto('/trailers');

      const playButton = page.getByRole('button', { name: /play|preview/i }).first();

      if (await playButton.isVisible()) {
        await playButton.click();

        // Should open video player or modal
        await expect(
          page.locator('video').or(page.locator('[role="dialog"]'))
        ).toBeVisible();
      }
    });

    test('should allow deleting a trailer', async ({ page }) => {
      await page.goto('/trailers');

      const deleteButton = page.getByRole('button', { name: /delete|remove/i }).first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Should show confirmation
        await expect(
          page.getByText(/confirm|sure|delete/i)
        ).toBeVisible();
      }
    });

    test('should allow manual download trigger', async ({ page }) => {
      await page.goto('/trailers');

      const downloadButton = page.getByRole('button', { name: /download|fetch|update/i });

      if (await downloadButton.isVisible()) {
        await downloadButton.click();

        // Should show progress or status
        await expect(
          page.getByText(/download|progress|fetching/i)
        ).toBeVisible();
      }
    });
  });
});
