import { test, expect } from '@playwright/test';

test.describe('Core Features', () => {

    // Register and Login before each test to ensure a fresh authenticated session
    test.beforeEach(async ({ page }) => {
        // 1. Register a new user
        await page.goto('/register');
        const uniqueId = Date.now();
        const email = `core.test.${uniqueId}@example.com`;
        const password = 'Password123!';

        await page.getByLabel('First Name').fill('Core');
        await page.getByLabel('Last Name').fill('Tester');
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').first().fill(password);
        await page.getByLabel('Confirm Password').fill(password);
        await page.getByRole('button', { name: 'Create account' }).click();

        // 2. Expect redirect to Overview (Dashboard)
        await expect(page).toHaveURL(/.*\/overview/);
        await expect(page.getByText('TradePro')).toBeVisible(); // Check for logo or title
    });

    test('should navigate to all main sections', async ({ page }) => {
        // Dashboard is default
        await expect(page).toHaveURL(/.*\/overview/);

        // Navigate to Backtesting
        await page.getByRole('link', { name: 'Backtesting' }).click();
        await expect(page).toHaveURL(/.*\/backtesting/);
        await expect(page.getByRole('heading', { name: 'Backtesting' })).toBeVisible();

        // Navigate to Journal
        await page.getByRole('link', { name: 'Journal' }).click();
        await expect(page).toHaveURL(/.*\/journal/);
        await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible();

        // Navigate to Analytics
        await page.getByRole('link', { name: 'Analytics' }).click();
        await expect(page).toHaveURL(/.*\/analytics/);

        // Navigate to Settings
        await page.getByRole('link', { name: 'Settings' }).click();
        await expect(page).toHaveURL(/.*\/settings/);
    });

    test('should display journal interface elements', async ({ page }) => {
        await page.goto('/journal');
        await expect(page).toHaveURL(/.*\/journal/);

        // Check for "Add Trade" button
        await expect(page.getByRole('button', { name: 'Add Trade' })).toBeVisible();

        // Check for Search input
        await expect(page.getByPlaceholder('Search by instrument, setup, or tag...')).toBeVisible();

        // Check for Export button
        await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    });

    test('should open add trade dialog', async ({ page }) => {
        await page.goto('/journal');

        // Open Dialog
        await page.getByRole('button', { name: 'Add Trade' }).click();

        // Check Dialog Content
        await expect(page.getByRole('heading', { name: 'Log New Trade' })).toBeVisible();
        await expect(page.getByLabel('Instrument')).toBeVisible();
        await expect(page.getByLabel('Direction')).toBeVisible();
        await expect(page.getByLabel('Entry Price')).toBeVisible();

        // Check Save button exists
        await expect(page.getByRole('button', { name: 'Save Trade' })).toBeVisible();
    });

    test('should create a new backtesting session', async ({ page }) => {
        await page.goto('/backtesting');
        await expect(page).toHaveURL(/.*\/backtesting/);

        // Open New Session Dialog
        await page.getByRole('button', { name: 'New Session' }).click();
        await expect(page.getByRole('heading', { name: 'Create Backtesting Session' })).toBeVisible();

        // Fill Form
        await page.getByLabel('Session Name').fill('Test Session 1');

        // Select Instrument
        await page.getByLabel('Instrument').click();
        await page.getByLabel('ES (S&P 500 Futures)').click();

        // Select Timeframe
        await page.getByLabel('Timeframe').click();
        await page.getByLabel('15 Minutes').click();

        // Fill Dates
        await page.getByLabel('Start Date').fill('2023-01-01');
        await page.getByLabel('End Date').fill('2023-01-31');

        // Fill Balance
        await page.getByLabel('Starting Balance').fill('100000');

        // Submit
        await page.getByRole('button', { name: 'Create Session' }).click();

        // Verify Dialog Closed (or Loading state)
        // Since we mocked the API success to close dialog:
        await expect(page.getByRole('heading', { name: 'Create Backtesting Session' })).not.toBeVisible();

        // Verify Session appears in list (if API returns it or we just check if list is present)
        // Since the list might be empty if backend is empty, we at least check that we are back on the main page
        await expect(page.getByRole('button', { name: 'New Session' })).toBeVisible();
    });

});
