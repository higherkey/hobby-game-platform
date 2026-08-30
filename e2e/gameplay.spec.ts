import { test, expect } from '@playwright/test';

test.describe('Gameplay & Viewport Controls', () => {
  test('plays a full local So Clover match setup and tests view toggles', async ({ page }) => {
    await page.goto('/#play');

    // 1. Open Pass & Play for So Clover
    const cloverCard = page.locator('.directory-card', { hasText: 'So Clover!' });
    await cloverCard.locator('button', { hasText: /Pass & Play/i }).click();

    const localModal = page.locator('.modal-card', { hasText: 'Start Local Pass & Play' });
    await expect(localModal).toBeVisible();

    // Start local 2-player match
    await localModal.locator('button[type="submit"]', { hasText: /Start Game Now/i }).click();

    // 2. Assert In-Game Shell & Clue Writing Phase
    const gameShell = page.locator('.game-shell');
    await expect(gameShell).toBeVisible();

    const phasePill = page.locator('.phase-pill');
    await expect(phasePill).toHaveText(/clue writing/i);

    // 3. Fill in the 4 clue inputs
    const northInput = page.locator('.clue-banner-north .clue-input-field');
    const eastInput = page.locator('.clue-banner-east .clue-input-field');
    const southInput = page.locator('.clue-banner-south .clue-input-field');
    const westInput = page.locator('.clue-banner-west .clue-input-field');

    await northInput.fill('OCEAN');
    await eastInput.fill('FOREST');
    await southInput.fill('MOUNTAIN');
    await westInput.fill('DESERT');

    // Submit Clues
    const submitBtn = page.locator('button', { hasText: /Submit 4 Clues/i });
    await submitBtn.click();

    // 4. Test Viewport Mode Switcher (Desktop Side-by-Side vs Mobile Stacked)
    const viewToggleBtn = page.locator('.view-toggle-btn');
    await expect(viewToggleBtn).toBeVisible();

    // Toggle Side-by-Side mode
    await viewToggleBtn.click();
    const gameMainArea = page.locator('.game-main-area');
    await expect(gameMainArea).toHaveClass(/desktop-board-view/);

    // Toggle back to Stacked mode
    await viewToggleBtn.click();
    await expect(gameMainArea).not.toHaveClass(/desktop-board-view/);

    // 5. Exit match and verify return to Play hub
    const exitBtn = page.locator('header.app-header button', { hasText: /Exit/i });
    await exitBtn.click();

    await expect(page.locator('.play-page-title')).toHaveText('Play & Browse Games');
  });

  test('toggles So Clover House Rule (Rotate 1 Card) during secret clue writing', async ({ page }) => {
    await page.goto('/#play');

    // 1. Open Pass & Play for So Clover
    const cloverCard = page.locator('.directory-card', { hasText: 'So Clover!' });
    await cloverCard.locator('button', { hasText: /Pass & Play/i }).click();

    const localModal = page.locator('.modal-card', { hasText: 'Start Local Pass & Play' });
    await expect(localModal).toBeVisible();

    // Check the House Rule checkbox
    const houseRuleCheckbox = page.locator('#local-house-rule-rotate');
    await expect(houseRuleCheckbox).toBeVisible();
    await houseRuleCheckbox.check();
    await expect(houseRuleCheckbox).toBeChecked();

    // Start local match
    await localModal.locator('button[type="submit"]', { hasText: /Start Game Now/i }).click();

    // 2. Verify House Rule active banner in clue writing phase
    const rulesBanner = page.locator('.clue-rules-banner');
    await expect(rulesBanner).toContainText('House Rule Active');

    // 3. Verify rotate buttons appear on slots
    const rotateButtons = page.locator('.clue-rotate-overlay .slot-action-btn');
    await expect(rotateButtons).toHaveCount(4);

    // Rotate slot 1 once
    await rotateButtons.first().click();

    // Assert that slot 1 has the house-rule highlight
    const firstSlot = page.locator('.clover-slot').first();
    await expect(firstSlot).toHaveClass(/house-rule-rotated-slot/);

    // Assert that the other slots' rotate buttons are now disabled (enforcing single card constraint)
    const secondSlotBtn = rotateButtons.nth(1);
    await expect(secondSlotBtn).toBeDisabled();

    // Rotate slot 1 three more times (360 deg back to initial rotation) -> clears lock and unlocks all slots
    await rotateButtons.first().click();
    await rotateButtons.first().click();
    await rotateButtons.first().click();

    await expect(firstSlot).not.toHaveClass(/house-rule-rotated-slot/);
    await expect(secondSlotBtn).toBeEnabled();

    // Exit match
    await page.locator('header.app-header button', { hasText: /Exit/i }).click();
    await expect(page.locator('.play-page-title')).toHaveText('Play & Browse Games');
  });

  test('plays a local Counter Duel test match with real-time increment and reset', async ({ page }) => {
    await page.goto('/#play');

    // 1. Open Pass & Play for Counter Duel
    const counterCard = page.locator('.directory-card', { hasText: 'Counter Duel' });
    await counterCard.locator('button', { hasText: /Solo Play/i }).click();

    const localModal = page.locator('.modal-card', { hasText: 'Start Local Pass & Play' });
    await expect(localModal).toBeVisible();

    await localModal.locator('button[type="submit"]', { hasText: /Start Game Now/i }).click();

    // 2. Assert Counter Board View
    const counterDisplay = page.locator('.counter-huge-display');
    await expect(counterDisplay).toHaveText('0');

    // Increment +5
    await page.locator('.counter-action-btn', { hasText: '+5' }).click();
    await expect(counterDisplay).toHaveText('5');

    // Increment +10
    await page.locator('.counter-action-btn', { hasText: '+10' }).click();
    await expect(counterDisplay).toHaveText('15');

    // Reset
    await page.locator('.counter-action-btn', { hasText: 'Reset' }).click();
    await expect(counterDisplay).toHaveText('0');

    // Exit match
    await page.locator('header.app-header button', { hasText: /Exit Match/i }).click();
    await expect(page.locator('.play-page-title')).toHaveText('Play & Browse Games');
  });
});
