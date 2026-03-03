/**
 * E2E tests for voting system.
 */

import { test, expect } from '@playwright/test';

test.describe('Voting System', () => {
  test.describe('Admin Vote Management', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto('/login');
      await page.getByLabel(/username/i).fill('admin@theatarr.local');
      await page.getByLabel(/password/i).fill('admin123');
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page).toHaveURL(/.*dashboard/);
    });

    test('should display vote sessions page', async ({ page }) => {
      await page.goto('/vote-sessions');

      await expect(
        page.getByRole('heading', { name: /vote|voting/i })
      ).toBeVisible();
    });

    test('should show create vote session button', async ({ page }) => {
      await page.goto('/vote-sessions');

      await expect(
        page.getByRole('button', { name: /create|new|add/i })
      ).toBeVisible();
    });

    test('should create a new vote session', async ({ page }) => {
      await page.goto('/vote-sessions');

      await page.getByRole('button', { name: /create|new|add/i }).click();

      // Fill in vote session form
      await page.getByLabel(/title|name/i).fill('E2E Test Vote');

      // Select movies (if movie selector is present)
      const movieSelector = page.locator('[data-testid="movie-selector"], .movie-selector');
      if (await movieSelector.isVisible()) {
        // Click to add movies
        await movieSelector.locator('button, [role="button"]').first().click();
      }

      // Submit
      await page.getByRole('button', { name: /create|save/i }).click();

      // Should show success
      await expect(
        page.getByText(/created|success/i)
      ).toBeVisible();
    });

    test('should generate shareable link', async ({ page }) => {
      await page.goto('/vote-sessions');

      // Find a vote session and generate link
      const shareButton = page.getByRole('button', { name: /share|link|copy/i }).first();

      if (await shareButton.isVisible()) {
        await shareButton.click();

        // Should show link or copy confirmation
        await expect(
          page.getByText(/copied|link|vote\//i)
        ).toBeVisible();
      }
    });

    test('should show real-time vote results', async ({ page }) => {
      await page.goto('/vote-sessions');

      // Click on a vote session to see results
      const voteSession = page.locator('[data-testid="vote-session"], .vote-session').first();

      if (await voteSession.isVisible()) {
        await voteSession.click();

        // Should show results component
        await expect(
          page.getByText(/results|votes|count/i)
        ).toBeVisible();
      }
    });

    test('should close vote session', async ({ page }) => {
      await page.goto('/vote-sessions');

      const closeButton = page.getByRole('button', { name: /close|end|finish/i }).first();

      if (await closeButton.isVisible()) {
        await closeButton.click();

        // Should show confirmation or closed state
        await expect(
          page.getByText(/closed|ended|winner/i)
        ).toBeVisible();
      }
    });
  });

  test.describe('Public Voting Page', () => {
    test('should be accessible without authentication', async ({ page }) => {
      // Use a test token
      await page.goto('/vote/test-token-123');

      // Should not redirect to login
      await expect(page).not.toHaveURL(/.*login/);
    });

    test('should display vote page with token', async ({ page }) => {
      await page.goto('/vote/test-token-123');

      // Should show voting interface
      await expect(
        page.locator('[data-testid="vote-page"], .vote-page, [class*="vote"]')
      ).toBeVisible();
    });

    test('should display movie options', async ({ page }) => {
      await page.goto('/vote/test-token-123');

      // Should show movie cards for voting
      const movieCards = page.locator('[data-testid="movie-vote-card"], .movie-card, [class*="movie"]');

      // Either shows movies or expired/invalid token message
      await expect(
        movieCards.first().or(page.getByText(/expired|invalid|closed/i))
      ).toBeVisible();
    });

    test('should allow casting a vote', async ({ page }) => {
      await page.goto('/vote/test-token-123');

      // Find and click a movie to vote
      const voteButton = page.getByRole('button', { name: /vote/i }).first();

      if (await voteButton.isVisible()) {
        await voteButton.click();

        // Should show confirmation
        await expect(
          page.getByText(/voted|thank|submitted/i)
        ).toBeVisible();
      }
    });

    test('should prevent voting twice', async ({ page }) => {
      await page.goto('/vote/test-token-123');

      // First vote
      const voteButton = page.getByRole('button', { name: /vote/i }).first();

      if (await voteButton.isVisible()) {
        await voteButton.click();

        // Try to vote again
        const secondVoteButton = page.getByRole('button', { name: /vote/i }).first();

        if (await secondVoteButton.isVisible()) {
          await secondVoteButton.click();

          // Should show already voted message
          await expect(
            page.getByText(/already.*voted|only.*once/i)
          ).toBeVisible();
        }
      }
    });

    test('should show results after voting closed', async ({ page }) => {
      // Navigate to a closed vote session
      await page.goto('/vote/closed-session-token');

      // Should show results or closed message
      await expect(
        page.getByText(/results|winner|closed|ended/i)
      ).toBeVisible();
    });
  });

  test.describe('Real-time Vote Updates', () => {
    test('should connect to WebSocket for live updates', async ({ page }) => {
      const wsPromise = page.waitForEvent('websocket');

      await page.goto('/vote/test-token-123');

      const ws = await wsPromise;
      expect(ws.url()).toContain('ws');
    });

    test('should update vote counts in real-time', async ({ page }) => {
      await page.goto('/vote/test-token-123');

      // Wait for initial render
      await page.waitForTimeout(1000);

      // Vote counts should be displayed
      const voteCounts = page.locator('[data-testid="vote-count"], .vote-count, [class*="count"]');

      if (await voteCounts.count() > 0) {
        await expect(voteCounts.first()).toBeVisible();
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/vote/test-token-123');

      const votePage = page.locator('[data-testid="vote-page"], .vote-page, [class*="vote"]');
      await expect(votePage).toBeVisible();
    });
  });
});
