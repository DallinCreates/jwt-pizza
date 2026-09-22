import { test, expect } from 'playwright-test-coverage';

test('not found', async ({ page }) => {
  await page.goto('/this-page-does-not-exist');

  await expect(page.getByRole('heading', { name: 'Oops' })).toBeVisible();
  await expect(page.getByText('It looks like we have dropped a pizza on the floor.')).toBeVisible();
});
