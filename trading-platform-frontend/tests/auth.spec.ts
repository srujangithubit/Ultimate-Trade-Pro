import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
    const timestamp = Date.now();
    const user = {
        email: `testuser_${timestamp}@example.com`,
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
    };

    test.beforeEach(({ page }) => {
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        page.on('requestfailed', request => console.log(`REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`));
    });

    test('should register a new user successfully', async ({ page }) => {
        await page.goto('/register');

        // Fill registration form
        await page.getByLabel('First Name').fill(user.firstName);
        await page.getByLabel('Last Name').fill(user.lastName);
        await page.getByLabel('Email').fill(user.email);
        await page.getByLabel('Password').first().fill(user.password); // .first() because confirm password also has label 'Password'? No, usually unique. Checked file: yes 'Password' and 'Confirm Password'.
        // Actually label "Password" matches both? "Confirm Password" is distinct.
        // Let's be specific with placeholders if needed, or exact label text.
        await page.getByLabel('Confirm Password').fill(user.password);

        // Submit
        await page.getByRole('button', { name: 'Create account' }).click();

        // Verify redirect to overview
        await expect(page).toHaveURL(/.*\/overview/);

        // Verify welcome message or dashboard element
        // Dashboard layout has "TradePro" logo
        await expect(page.getByText('TradePro')).toBeVisible();
    });

    test('should logout successfully', async ({ page }) => {
        // Assuming previous test registered the user, but tests are isolated by default in Playwright unless configured otherwise.
        // We need to login first or use the same state. Playwright tests are isolated.
        // So we must register (or login) again.
        // Strategy: Register a NEW user for this test to ensure clean state.
        const uniqueEmail = `logout_${Date.now()}@example.com`;

        await page.goto('/register');
        await page.getByLabel('First Name').fill('Logout');
        await page.getByLabel('Last Name').fill('Tester');
        await page.getByLabel('Email').fill(uniqueEmail);
        await page.getByLabel('Password').first().fill(user.password);
        await page.getByLabel('Confirm Password').fill(user.password);
        await page.getByRole('button', { name: 'Create account' }).click();
        await expect(page).toHaveURL(/.*\/overview/);

        // Perform Logout
        // Open user dropdown (Avatar) - Selector strategy: role button containing text "LT" (Logout Tester) or just the avatar button
        // The layout has a dropdown trigger button with an Avatar inside.
        // We can target the button by looking for the one in the header (hidden md:block one)
        await page.locator('header').getByRole('button').filter({ has: page.locator('span', { hasText: 'LT' }) }).first().click().catch(async () => {
            // Fallback or try different selector if initials logic fails
            // Try clicking the button that contains the Avatar
            await page.locator('header .hidden.md\\:block button').click();
            // Let's look at the layout code again.
            // <Button variant="ghost" size="icon"> <Avatar> ... </Avatar> </Button>
            // Use a more generic selector for the user menu in header
            await page.locator('header .hidden.md\\:block button').click();
        });

        // Click "Sign Out"
        await page.getByRole('menuitem', { name: 'Sign Out' }).click();

        // Verify redirect to login or home
        // The logout function usually pushes router to /login
        await expect(page).toHaveURL(/.*\/login/);
    });

    test('should login with valid credentials', async ({ page }) => {
        // We need a user to login WITH.
        // Since DB might be persistent or clean, safest is to register one first, then logout, then login.
        const loginEmail = `login_${Date.now()}@example.com`;

        // 1. Register
        await page.goto('/register');
        await page.getByLabel('First Name').fill('Login');
        await page.getByLabel('Last Name').fill('User');
        await page.getByLabel('Email').fill(loginEmail);
        await page.getByLabel('Password').first().fill(user.password);
        await page.getByLabel('Confirm Password').fill(user.password);
        await page.getByRole('button', { name: 'Create account' }).click();
        await expect(page).toHaveURL(/.*\/overview/);

        // 2. Logout (reuse logic or clean session)
        // Actually, simpler to just clear cookies/storage?
        // Playwright page isolation means new context = no cookies.
        // But wait, I need to create the user in the backend to login with them!
        // So I DO need to register in this test (or a `beforeAll` if I could rely on order).
        // I'll just do: Register -> Logout -> Login.

        // Logout
        await page.locator('header .hidden.md\\:block button').click();
        await page.getByRole('menuitem', { name: 'Sign Out' }).click();
        await expect(page).toHaveURL(/.*\/login/);
        await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

        // 3. Login
        await page.getByLabel('Email').fill(loginEmail);
        await page.getByLabel('Password').fill(user.password);
        await page.getByRole('button', { name: 'Sign in' }).click();

        await expect(page).toHaveURL(/.*\/overview/);
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/login');
        await page.getByLabel('Email').fill('nonexistent@example.com');
        await page.getByLabel('Password').fill('WrongPass123!');
        await page.getByRole('button', { name: 'Sign in' }).click();

        // Expect error message
        // Based on file content: {error && <div>{error}</div>}
        // We should look for an alert or error text.
        // Common error: "Invalid email or password" or "User not found"
        // Let's verify visible error container
        await expect(page.locator('.text-destructive').first()).toBeVisible();
    });
});
