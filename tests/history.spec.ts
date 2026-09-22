import { test, expect } from 'playwright-test-coverage';

test('history page', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'History' }).click();

  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole('heading', { name: 'Mama Rucci, my my' })).toBeVisible();
  await expect(page.getByText("It all started in Mama Ricci's kitchen.")).toBeVisible();
});
