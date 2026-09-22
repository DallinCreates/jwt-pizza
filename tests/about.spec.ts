import { test, expect } from 'playwright-test-coverage';

test('about page', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'About' }).click();

  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { name: 'The secret sauce' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Our employees' })).toBeVisible();
  await expect(page.getByAltText('Employee stock photo').first()).toBeVisible();
});
