import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = {
    'a@jwt.com': { id: '1', name: 'Admin Dude', email: 'a@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] },
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

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({
      json: {
        franchises: [{ id: '2', name: 'pizzaPocket', admins: [{ id: '5', name: 'Frank Chise', email: 'f@jwt.com' }], stores: [{ id: '4', name: 'Lehi', totalRevenue: 100 }] }],
        more: false,
      },
    });
  });

  await page.route('*/**/api/franchise/2', async (route) => {
    expect(route.request().method()).toBe('DELETE');
    await route.fulfill({ json: { message: 'franchise deleted' } });
  });

  await page.goto('/');
}

test('close franchise', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByRole('heading', { name: "Mama Ricci's kitchen" })).toBeVisible();

  await page.getByRole('row', { name: 'pizzaPocket' }).getByRole('button', { name: 'Close' }).click();

  await expect(page.getByRole('heading', { name: 'Sorry to see you go' })).toBeVisible();
  await expect(page.getByText('close the pizzaPocket franchise')).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByRole('heading', { name: "Mama Ricci's kitchen" })).toBeVisible();
});
