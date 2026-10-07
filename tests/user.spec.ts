import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = {};

  await page.route('*/**/api/auth', async (route) => {
    const method = route.request().method();

    if (method === 'POST') {
      const registerReq = route.request().postDataJSON();
      const user: User = { id: '99', name: registerReq.name, email: registerReq.email, password: registerReq.password, roles: [{ role: Role.Diner }] };
      validUsers[user.email!] = user;
      loggedInUser = user;
      await route.fulfill({ json: { user, token: 'abcdef' } });
      return;
    }

    if (method === 'PUT') {
      const loginReq = route.request().postDataJSON();
      const user = validUsers[loginReq.email];
      if (!user || user.password !== loginReq.password) {
        await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
        return;
      }
      loggedInUser = user;
      await route.fulfill({ json: { user, token: 'abcdef' } });
      return;
    }

    if (method === 'DELETE') {
      loggedInUser = undefined;
      await route.fulfill({ json: { message: 'logout successful' } });
      return;
    }

    await route.fallback();
  });

  await page.route(/\/api\/user\/[^/]+$/, async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({ json: loggedInUser });
      return;
    }

    if (method === 'PUT') {
      const updateReq = route.request().postDataJSON();
      const existing = Object.values(validUsers).find((u) => u.id === updateReq.id)!;
      delete validUsers[existing.email!];
      const updated: User = { ...existing, name: updateReq.name, email: updateReq.email, password: updateReq.password ?? existing.password };
      validUsers[updated.email!] = updated;
      loggedInUser = updated;
      await route.fulfill({ json: { user: updated, token: 'abcdef' } });
      return;
    }

    await route.fallback();
  });

  await page.route('*/**/api/order', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: { dinerId: '99', orders: [], page: 1 } });
  });

  await page.goto('/');
}

test('updateUser', async ({ page }) => {
  await basicInit(page);

  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Register' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza diner');

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('textbox').first().fill('pizza dinerx');
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza dinerx');

  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza dinerx');
});
