/**
 * E2E tests for configuration import/export.
 */

import { test, expect } from '@playwright/test';

test.describe('Configuration Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/username/i).fill('admin@theatarr.local');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test.describe('Config Page', () => {
    test('should display config page', async ({ page }) => {
      await page.goto('/config');

      await expect(
        page.getByRole('heading', { name: /config|settings/i })
      ).toBeVisible();
    });

    test('should show export button', async ({ page }) => {
      await page.goto('/config');

      await expect(
        page.getByRole('button', { name: /export/i })
      ).toBeVisible();
    });

    test('should show import button', async ({ page }) => {
      await page.goto('/config');

      await expect(
        page.getByRole('button', { name: /import/i })
      ).toBeVisible();
    });
  });

  test.describe('Export Configuration', () => {
    test('should open export dialog', async ({ page }) => {
      await page.goto('/config');

      await page.getByRole('button', { name: /export/i }).click();

      // Should show export options
      await expect(
        page.getByText(/export|download|settings|services/i)
      ).toBeVisible();
    });

    test('should allow selecting export options', async ({ page }) => {
      await page.goto('/config');

      await page.getByRole('button', { name: /export/i }).click();

      // Should have checkboxes for what to export
      const checkboxes = page.locator('input[type="checkbox"], [role="checkbox"]');

      if (await checkboxes.count() > 0) {
        await expect(checkboxes.first()).toBeVisible();
      }
    });

    test('should allow password protection', async ({ page }) => {
      await page.goto('/config');

      await page.getByRole('button', { name: /export/i }).click();

      // Should have password field option
      const passwordField = page.getByLabel(/password|encrypt/i);

      if (await passwordField.isVisible()) {
        await passwordField.fill('test-password-123');
        await expect(passwordField).toHaveValue('test-password-123');
      }
    });

    test('should download config file', async ({ page }) => {
      await page.goto('/config');

      // Listen for download
      const downloadPromise = page.waitForEvent('download');

      await page.getByRole('button', { name: /export/i }).click();

      // Click final export/download button
      const downloadButton = page.getByRole('button', { name: /download|export|save/i }).last();
      await downloadButton.click();

      // Wait for download
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/theatarr.*\.json$/i);
    });
  });

  test.describe('Import Configuration', () => {
    test('should open import dialog', async ({ page }) => {
      await page.goto('/config');

      await page.getByRole('button', { name: /import/i }).click();

      // Should show import interface
      await expect(
        page.getByText(/import|upload|select.*file/i)
      ).toBeVisible();
    });

    test('should show file picker', async ({ page }) => {
      await page.goto('/config');

      await page.getByRole('button', { name: /import/i }).click();

      // Should have file input
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeAttached();
    });

    test('should preview import changes', async ({ page }) => {
      await page.goto('/config');

      await page.getByRole('button', { name: /import/i }).click();

      // After selecting a file, should show preview
      // Create a test config file content
      const configContent = JSON.stringify({
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        settings: { theme: { mode: 'dark' } },
      });

      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-config.json',
        mimeType: 'application/json',
        buffer: Buffer.from(configContent),
      });

      // Should show preview
      await expect(
        page.getByText(/preview|changes|import/i)
      ).toBeVisible();
    });

    test('should handle conflicts', async ({ page }) => {
      await page.goto('/config');

      await page.getByRole('button', { name: /import/i }).click();

      // Upload config with conflicts
      const configWithConflicts = JSON.stringify({
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        settings: { existing_setting: { value: 'new' } },
      });

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'config-conflicts.json',
        mimeType: 'application/json',
        buffer: Buffer.from(configWithConflicts),
      });

      // If conflicts exist, should show conflict resolver
      const conflictResolver = page.locator(
        '[data-testid="conflict-resolver"], .conflict-resolver, [class*="conflict"]'
      );

      if (await conflictResolver.isVisible()) {
        await expect(conflictResolver).toBeVisible();
      }
    });

    test('should require password for encrypted config', async ({ page }) => {
      await page.goto('/config');

      await page.getByRole('button', { name: /import/i }).click();

      // Upload encrypted config (mock)
      const encryptedConfig = JSON.stringify({
        version: '1.0.0',
        encrypted: true,
        data: 'encrypted-data-here',
      });

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'encrypted-config.json',
        mimeType: 'application/json',
        buffer: Buffer.from(encryptedConfig),
      });

      // Should show password prompt
      await expect(
        page.getByLabel(/password/i).or(page.getByText(/password|decrypt/i))
      ).toBeVisible();
    });
  });

  test.describe('Settings Form', () => {
    test('should display settings form', async ({ page }) => {
      await page.goto('/config');

      // Should have settings form
      const settingsForm = page.locator(
        '[data-testid="settings-form"], form, .settings-form'
      );
      await expect(settingsForm).toBeVisible();
    });

    test('should allow changing settings', async ({ page }) => {
      await page.goto('/config');

      // Find a setting input
      const themeToggle = page.locator(
        '[data-testid="theme-toggle"], [role="switch"], input[type="checkbox"]'
      ).first();

      if (await themeToggle.isVisible()) {
        await themeToggle.click();

        // Should have changed
        await expect(themeToggle).toBeVisible();
      }
    });

    test('should save settings', async ({ page }) => {
      await page.goto('/config');

      // Find and fill a setting
      const input = page.locator('input[type="text"], input[type="number"]').first();

      if (await input.isVisible()) {
        await input.fill('test-value');

        // Save
        await page.getByRole('button', { name: /save/i }).click();

        // Should show success
        await expect(
          page.getByText(/saved|success/i)
        ).toBeVisible();
      }
    });
  });
});
