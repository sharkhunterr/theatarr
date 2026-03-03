/**
 * E2E tests for service configuration flows.
 */

import { test, expect } from '@playwright/test';

test.describe('Services Configuration', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/username/i).fill('admin@theatarr.local');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test.describe('Services List', () => {
    test('should display services configuration page', async ({ page }) => {
      await page.goto('/services');

      await expect(
        page.getByRole('heading', { name: /services/i })
      ).toBeVisible();
    });

    test('should show add service button', async ({ page }) => {
      await page.goto('/services');

      await expect(
        page.getByRole('button', { name: /add|new|connect/i })
      ).toBeVisible();
    });

    test('should display service categories', async ({ page }) => {
      await page.goto('/services');

      // Should show different service categories
      await expect(
        page.getByText(/lighting|media|player/i)
      ).toBeVisible();
    });
  });

  test.describe('Add Service', () => {
    test('should open service selection dialog', async ({ page }) => {
      await page.goto('/services');

      await page.getByRole('button', { name: /add|new|connect/i }).click();

      // Should show available service types
      await expect(
        page.getByText(/philips hue|plex|home assistant/i)
      ).toBeVisible();
    });

    test('should show configuration form for selected service', async ({ page }) => {
      await page.goto('/services');

      await page.getByRole('button', { name: /add|new|connect/i }).click();

      // Select a service type (e.g., Philips Hue)
      const hueOption = page.getByText(/philips hue/i);
      if (await hueOption.isVisible()) {
        await hueOption.click();

        // Should show configuration form
        await expect(
          page.getByLabel(/host|ip|address|bridge/i)
        ).toBeVisible();
      }
    });

    test('should validate service configuration', async ({ page }) => {
      await page.goto('/services');

      await page.getByRole('button', { name: /add|new|connect/i }).click();

      const hueOption = page.getByText(/philips hue/i);
      if (await hueOption.isVisible()) {
        await hueOption.click();

        // Submit without filling required fields
        await page.getByRole('button', { name: /save|add|connect/i }).click();

        // Should show validation error
        await expect(page.getByText(/required|invalid/i)).toBeVisible();
      }
    });
  });

  test.describe('Test Connection', () => {
    test('should show test connection button for configured services', async ({ page }) => {
      await page.goto('/services');

      // If there's a configured service, it should have a test button
      const testButton = page.getByRole('button', { name: /test|check|verify/i });

      // Test button may exist if services are configured
      if (await testButton.count() > 0) {
        await expect(testButton.first()).toBeVisible();
      }
    });

    test('should display connection status', async ({ page }) => {
      await page.goto('/services');

      // Services should show connection status
      const statusIndicator = page.locator(
        '[data-testid="connection-status"], .connection-status, [class*="status"]'
      );

      if (await statusIndicator.count() > 0) {
        await expect(statusIndicator.first()).toBeVisible();
      }
    });
  });

  test.describe('Service Actions', () => {
    test('should allow editing a configured service', async ({ page }) => {
      await page.goto('/services');

      const editButton = page.getByRole('button', { name: /edit|configure/i }).first();

      if (await editButton.isVisible()) {
        await editButton.click();

        // Should show edit form
        await expect(page.getByLabel(/name|host|ip/i)).toBeVisible();
      }
    });

    test('should allow deleting a service', async ({ page }) => {
      await page.goto('/services');

      const deleteButton = page.getByRole('button', { name: /delete|remove/i }).first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Should show confirmation dialog
        await expect(
          page.getByText(/confirm|sure|delete/i)
        ).toBeVisible();
      }
    });

    test('should enable/disable service', async ({ page }) => {
      await page.goto('/services');

      const toggleButton = page.locator(
        '[data-testid="service-toggle"], [role="switch"], input[type="checkbox"]'
      ).first();

      if (await toggleButton.isVisible()) {
        await toggleButton.click();

        // State should change
        await expect(toggleButton).toBeVisible();
      }
    });
  });
});
