import { test, expect } from '@playwright/test';

test.describe('Account System (Guest & Magic Link Auth)', () => {
  test('updates guest nickname and saves in navbar and localStorage', async ({ page }) => {
    await page.goto('/');

    const accountTrigger = page.locator('.account-trigger-btn');
    await expect(accountTrigger).toBeVisible();
    await expect(page.locator('.account-role-tag')).toHaveText(/guest/i);

    // Open Auth Modal
    await accountTrigger.click();
    const modal = page.locator('.modal-card');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toHaveText('Account & Profile');

    // Switch to Guest Nickname tab if not active
    const guestTab = page.locator('.auth-tab-btn', { hasText: 'Guest Nickname' });
    await guestTab.click();

    // Fill in new nickname
    const nicknameInput = page.locator('#guest-nickname-input');
    await nicknameInput.fill('SpeedyClover');
    await page.locator('button[type="submit"]', { hasText: 'Save Nickname' }).click();

    // Verify banner and modal closing
    await expect(page.locator('.banner-success')).toBeVisible();
    await expect(modal).toBeHidden({ timeout: 2000 });

    // Verify navbar displays updated nickname
    await expect(page.locator('.account-username')).toHaveText('SpeedyClover');
  });

  test('completes magic link sign-in and switches account to authenticated member', async ({ page }) => {
    await page.goto('/');

    const accountTrigger = page.locator('.account-trigger-btn');
    await accountTrigger.click();

    // Switch to Magic Link tab
    const magicTab = page.locator('.auth-tab-btn', { hasText: 'Magic Link Sign-In' });
    await magicTab.click();

    // Enter email and username
    const testEmail = `player_${Date.now()}@tabletop.com`;
    await page.locator('#magic-email-input').fill(testEmail);
    await page.locator('#magic-username-input').fill('ChampionPlayer');

    await page.locator('button[type="submit"]', { hasText: 'Send Magic Link' }).click();

    // Verify transition to verification panel
    await expect(page.locator('.verify-intro')).toContainText(testEmail);

    // Click 1-Click Instant Sign-In simulation button (available in dev/test)
    const instantBtn = page.locator('.simulated-btn');
    await expect(instantBtn).toBeVisible();
    await instantBtn.click();

    // Assert logged in successfully
    await expect(page.locator('.banner-success')).toHaveText(/Logged in successfully/i);
    await expect(page.locator('.modal-card')).toBeHidden({ timeout: 2000 });

    // Assert navbar member role tag
    await expect(page.locator('.account-username')).toHaveText('ChampionPlayer');
    await expect(page.locator('.account-role-tag')).toHaveText(/member/i);

    // Test sign out back to guest
    await accountTrigger.click();
    await expect(page.locator('.profile-name')).toHaveText('ChampionPlayer');
    await page.locator('button', { hasText: /Sign Out/i }).click();

    await expect(page.locator('.account-role-tag')).toHaveText(/guest/i);
  });
});
