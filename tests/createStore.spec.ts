import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = {
    'f@jwt.com': { id: '5', name: 'Frank Chise', email: 'f@jwt.com', password: 'a', roles: [{ role: Role.Franchisee }] },
  };

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

  await page.route('*/**/api/franchise/5', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: [{ id: '2', name: 'pizzaPocket', admins: [{ id: '5', name: 'Frank Chise', email: 'f@jwt.com' }], stores: [] }] });
  });

  await page.route('*/**/api/franchise/2/store', async (route) => {
    expect(route.request().method()).toBe('POST');
    const req = route.request().postDataJSON();
    await route.fulfill({ json: { id: '11', ...req } });
  });

  await page.goto('/');
}

test('create store', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('f@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('navigation', { name: 'Global' }).getByRole('link', { name: 'Franchise' }).click();
  await expect(page.getByRole('heading', { name: 'pizzaPocket' })).toBeVisible();

  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page.getByRole('heading', { name: 'Create store' })).toBeVisible();

  await page.getByPlaceholder('store name').fill('SLC');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('heading', { name: 'pizzaPocket' })).toBeVisible();
});
