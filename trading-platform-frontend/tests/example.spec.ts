import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Trading Platform|Backtesting/);
});

test('navigation links exist', async ({ page }) => {
    await page.goto('/');

    // Check if we have navigation links
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
});
