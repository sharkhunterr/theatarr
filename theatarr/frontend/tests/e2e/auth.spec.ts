/**
 * E2E tests for authentication flows.
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login/);
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/username/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/username/i).fill('admin@theatarr.local');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect to dashboard after login
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.getByLabel(/username/i).fill('admin@theatarr.local');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/.*dashboard/);

    // Find and click logout button
    await page.getByRole('button', { name: /logout|sign out/i }).click();

    // Should redirect back to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('should persist session across page reloads', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel(/username/i).fill('admin@theatarr.local');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/.*dashboard/);

    // Reload page
    await page.reload();

    // Should still be on dashboard (session persisted)
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
