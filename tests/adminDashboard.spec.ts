import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const admin: User = { id: '1', name: 'Admin Dude', email: 'a@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] };
  const users: User[] = [
    { id: '3', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] },
    { id: '5', name: 'Buddy', email: 'b@jwt.com', roles: [{ role: Role.Admin }] },
  ];
  const listUsersRequests: URL[] = [];

  await page.route('*/**/api/auth', async (route) => {
    const loginReq = route.request().postDataJSON();
    if (loginReq.email !== admin.email || loginReq.password !== admin.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    loggedInUser = admin;
    await route.fulfill({ json: { user: loggedInUser, token: 'abcdef' } });
  });

  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  await page.route(/\/api\/user(\?.*)?$/, async (route) => {
    expect(route.request().method()).toBe('GET');
    listUsersRequests.push(new URL(route.request().url()));
    await route.fulfill({ json: { users, more: false } });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({ json: { franchises: [], more: false } });
  });

  await page.goto('/');

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(admin.email!);
  await page.getByRole('textbox', { name: 'Password' }).fill(admin.password!);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Admin' }).click();

  return { listUsersRequests };
}

test('admin dashboard lists users', async ({ page }) => {
  const { listUsersRequests } = await basicInit(page);

  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

  const kaiRow = page.getByRole('row', { name: /Kai Chen/ });
  await expect(kaiRow).toContainText('d@jwt.com');
  await expect(kaiRow).toContainText('diner');

  const buddyRow = page.getByRole('row', { name: /Buddy/ });
  await expect(buddyRow).toContainText('b@jwt.com');
  await expect(buddyRow).toContainText('admin');

  expect(listUsersRequests[0].searchParams.get('page')).toBe('1');
  expect(listUsersRequests[0].searchParams.get('limit')).toBe('10');
  expect(listUsersRequests[0].searchParams.get('name')).toBe('*');
});
