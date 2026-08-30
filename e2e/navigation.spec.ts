import { test, expect } from '@playwright/test';

test.describe('Navigation & Multi-Page Layout', () => {
  test('loads home page with brand identity and core sections', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/HobbyBoard/i);

    // Check brand header
    const brandTitle = page.locator('.header-brand-title');
    await expect(brandTitle).toHaveText('HobbyBoard');

    // Check hero heading
    const heroHeading = page.locator('.hero-heading');
    await expect(heroHeading).toBeVisible();
    await expect(heroHeading).toContainText('The Modern Multiplayer Web Tabletop');

    // Check featured games section
    const featuredHeading = page.locator('.featured-games-section .section-title');
    await expect(featuredHeading).toHaveText('Featured Tabletop Games');
  });

  test('navigates seamlessly between Home, Play, and Admin pages', async ({ page }) => {
    await page.goto('/');

    // 1. Navigate to Play page
    const playNavLink = page.getByRole('button', { name: /Play & Browse/i });
    await playNavLink.click();

    await expect(page).toHaveURL(/#play/);
    const playTitle = page.locator('.play-page-title');
    await expect(playTitle).toHaveText('Play & Browse Games');
    await expect(playNavLink).toHaveClass(/active/);

    // 2. Navigate to Admin page
    const adminNavLink = page.getByRole('button', { name: /Admin/i });
    await adminNavLink.click();

    await expect(page).toHaveURL(/#admin/);
    const adminHeader = page.locator('#admin-auth-title');
    await expect(adminHeader).toHaveText('Admin Access Gate');
    await expect(adminNavLink).toHaveClass(/active/);

    // 3. Exit admin modal to lobby and return to Home via brand logo
    const cancelAdminBtn = page.locator('.token-modal-actions button', { hasText: 'Cancel' });
    await cancelAdminBtn.click();
    await expect(page).toHaveURL(/#play/);

    const brandLink = page.locator('.header-brand-link');
    await brandLink.click();

    const heroHeading = page.locator('.hero-heading');
    await expect(heroHeading).toBeVisible();
  });
});
