import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page, user: User = { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] }, orders: any[] = [
  { id: '23', franchiseId: '2', storeId: '4', date: '2024-06-01T12:00:00.000Z', items: [{ menuId: '1', description: 'Veggie', price: 0.0038 }] },
]) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = { [user.email!]: user };

  await page.route('*/**/api/auth', async (route) => {
    const loginReq = route.request().postDataJSON();
    const matchedUser = validUsers[loginReq.email];
    if (!matchedUser || matchedUser.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    loggedInUser = matchedUser;
    expect(route.request().method()).toBe('PUT');
    await route.fulfill({ json: { user: loggedInUser, token: 'abcdef' } });
  });

  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: { id: '1', dinerId: user.id, orders } });
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

test('diner dashboard for a franchisee with multiple roles', async ({ page }) => {
  await basicInit(
    page,
    { id: '5', name: 'Frank Chise', email: 'f@jwt.com', password: 'a', roles: [{ role: Role.Diner }, { role: Role.Franchisee, objectId: '2' }] },
    []
  );

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('f@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'FC' }).click();

  await expect(page.getByRole('heading', { name: 'Your pizza kitchen' })).toBeVisible();
  await expect(page.getByText('diner, Franchisee on 2')).toBeVisible();
});

test('diner dashboard without login', async ({ page }) => {
  await page.route('*/**/api/order', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: { id: '', dinerId: '', orders: [] } });
  });

  await page.goto('/diner-dashboard');

  await expect(page.getByRole('heading', { name: 'Your pizza kitchen' })).toBeVisible();
  await expect(page.getByText('How have you lived this long without having a pizza?')).toBeVisible();
});

test('diner dashboard with no orders', async ({ page }) => {
  await basicInit(page, undefined, []);

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'KC' }).click();

  await expect(page.getByRole('heading', { name: 'Your pizza kitchen' })).toBeVisible();
  await expect(page.getByText('How have you lived this long without having a pizza?')).toBeVisible();
  await page.getByRole('link', { name: 'Buy one' }).click();
  await expect(page.getByRole('heading', { name: 'Awesome is a click away' })).toBeVisible();
});
