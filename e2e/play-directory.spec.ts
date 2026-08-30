import { test, expect } from '@playwright/test';

test.describe('Play & Browse Directory and Live Filters', () => {
  test('displays game directory cards and player metadata', async ({ page }) => {
    await page.goto('/#play');

    const dirSection = page.locator('.directory-section');
    await expect(dirSection).toBeVisible();

    // Verify So Clover card
    const cloverCard = page.locator('.directory-card', { hasText: 'So Clover!' });
    await expect(cloverCard).toBeVisible();
    await expect(cloverCard).toContainText('1-6 Players');
    await expect(cloverCard).toContainText('Cooperative');

    // Verify Counter Duel card
    const counterCard = page.locator('.directory-card', { hasText: 'Counter Duel' });
    await expect(counterCard).toBeVisible();
    await expect(counterCard).toContainText('1-4 Players');
  });

  test('filters live matches by game dropdown, open seats, and search input', async ({ page }) => {
    await page.goto('/#play');

    const filterToolbar = page.locator('.filter-toolbar');
    await expect(filterToolbar).toBeVisible();

    // 1. Search input filtering
    const searchInput = page.locator('.search-input');
    await searchInput.fill('non-existent-room-9999');

    const emptyState = page.locator('.empty-rooms-card');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No matching rooms found');

    // Clear search
    await page.locator('.search-clear-btn').click();
    await expect(searchInput).toHaveValue('');

    // 2. Open Seats checkbox toggle
    const openSeatsCheckbox = page.locator('.checkbox-custom');
    await openSeatsCheckbox.check();
    await expect(openSeatsCheckbox).toBeChecked();
    await openSeatsCheckbox.uncheck();
  });

  test('opens and closes host match and pass-and-play modals', async ({ page }) => {
    await page.goto('/#play');

    // Host modal
    await page.locator('.play-header-actions button', { hasText: /Host Online Match/i }).click();
    const hostModal = page.locator('.modal-card', { hasText: 'Host an Online Room' });
    await expect(hostModal).toBeVisible();
    await hostModal.locator('.modal-close-btn').click();
    await expect(hostModal).toBeHidden();

    // Local Pass & Play modal
    await page.locator('.play-header-actions button', { hasText: /Pass & Play/i }).click();
    const localModal = page.locator('.modal-card', { hasText: 'Start Local Pass & Play' });
    await expect(localModal).toBeVisible();
    await localModal.locator('.btn-secondary', { hasText: 'Cancel' }).click();
    await expect(localModal).toBeHidden();
  });
});
