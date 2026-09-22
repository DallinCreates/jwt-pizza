import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = { 'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] } };

  await page.route('*/**/api/auth', async (route) => {
    const loginReq = route.request().postDataJSON();
    const user = validUsers[loginReq.email];
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    loggedInUser = user;
    expect(route.request().method()).toBe('PUT');
    await route.fulfill({ json: { user: loggedInUser, token: 'abcdef' } });
  });

  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({
      json: {
        id: '1',
        dinerId: '3',
        orders: [
          { id: '23', franchiseId: '2', storeId: '4', date: '2024-06-01T12:00:00.000Z', items: [{ menuId: '1', description: 'Veggie', price: 0.0038 }] },
        ],
      },
    });
  });

  await page.goto('/');
}

test('diner dashboard', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'KC' }).click();

  await expect(page.getByRole('heading', { name: 'Your pizza kitchen' })).toBeVisible();
  await expect(page.getByText('Kai Chen')).toBeVisible();
  await expect(page.getByText('d@jwt.com')).toBeVisible();
  await expect(page.getByText('diner', { exact: true })).toBeVisible();
  await expect(page.getByText('Here is your history of all the good times.')).toBeVisible();
  await expect(page.getByRole('cell', { name: '23' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '0.004' })).toBeVisible();
});
