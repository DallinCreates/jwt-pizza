import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const admin: User = { id: '1', name: 'Admin Dude', email: 'a@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] };
  const userPages: Record<string, { users: User[]; more: boolean }> = {
    '1': {
      users: [
        { id: '3', name: 'Kai Chen', email: 'd@jwt.com', roles: [{ role: Role.Diner }] },
        { id: '5', name: 'Buddy', email: 'b@jwt.com', roles: [{ role: Role.Admin }] },
      ],
      more: true,
    },
    '2': { users: [{ id: '7', name: 'Zed Last', email: 'z@jwt.com', roles: [{ role: Role.Diner }] }], more: false },
  };
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
    const url = new URL(route.request().url());
    listUsersRequests.push(url);
    const nameFilter = url.searchParams.get('name') ?? '*';
    if (nameFilter !== '*') {
      const term = nameFilter.replace(/\*/g, '');
      const allUsers = Object.values(userPages).flatMap((p) => p.users);
      await route.fulfill({ json: { users: allUsers.filter((u) => u.name!.includes(term)), more: false } });
      return;
    }
    await route.fulfill({ json: userPages[url.searchParams.get('page')!] ?? { users: [], more: false } });
  });

  const deletedUserIds: string[] = [];
  await page.route(/\/api\/user\/\d+$/, async (route) => {
    expect(route.request().method()).toBe('DELETE');
    const userId = route.request().url().split('/').pop()!;
    deletedUserIds.push(userId);
    for (const userPage of Object.values(userPages)) {
      userPage.users = userPage.users.filter((u) => u.id !== userId);
    }
    await route.fulfill({ json: { message: 'user deleted' } });
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

  return { listUsersRequests, deletedUserIds };
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

test('admin dashboard does not load users for a non-admin', async ({ page }) => {
  const listUsersRequests: string[] = [];
  await page.route(/\/api\/user(\?.*)?$/, async (route) => {
    listUsersRequests.push(route.request().url());
    await route.fulfill({ status: 401, json: { message: 'unauthorized' } });
  });
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({ json: { franchises: [], more: false } });
  });

  await page.goto('/admin-dashboard');

  await expect(page.getByRole('heading', { name: 'Oops' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(listUsersRequests).toEqual([]);
});

test('admin pages through users', async ({ page }) => {
  const { listUsersRequests } = await basicInit(page);

  const previousButton = page.getByRole('button', { name: 'Previous users page' });
  const nextButton = page.getByRole('button', { name: 'Next users page' });

  await expect(page.getByRole('row', { name: /Kai Chen/ })).toBeVisible();
  await expect(previousButton).toBeDisabled();
  await expect(nextButton).toBeEnabled();

  await nextButton.click();
  await expect(page.getByRole('row', { name: /Zed Last/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Kai Chen/ })).toBeHidden();
  expect(listUsersRequests[listUsersRequests.length - 1].searchParams.get('page')).toBe('2');
  await expect(nextButton).toBeDisabled();
  await expect(previousButton).toBeEnabled();

  await previousButton.click();
  await expect(page.getByRole('row', { name: /Kai Chen/ })).toBeVisible();
  expect(listUsersRequests[listUsersRequests.length - 1].searchParams.get('page')).toBe('1');
});

test('admin filters users by name', async ({ page }) => {
  const { listUsersRequests } = await basicInit(page);

  // Start on page 2 so we can see that filtering goes back to page 1.
  await page.getByRole('button', { name: 'Next users page' }).click();
  await expect(page.getByRole('row', { name: /Zed Last/ })).toBeVisible();

  await page.getByRole('textbox', { name: 'Filter users' }).fill('Kai');
  await page.getByRole('button', { name: 'Submit user filter' }).click();

  await expect(page.getByRole('row', { name: /Kai Chen/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Buddy/ })).toBeHidden();
  await expect(page.getByRole('row', { name: /Zed Last/ })).toBeHidden();

  const filterRequest = listUsersRequests[listUsersRequests.length - 1];
  expect(filterRequest.searchParams.get('name')).toBe('*Kai*');
  expect(filterRequest.searchParams.get('page')).toBe('1');
});

test('admin deletes a user', async ({ page }) => {
  const { deletedUserIds } = await basicInit(page);

  const buddyRow = page.getByRole('row', { name: /Buddy/ });
  await buddyRow.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('row', { name: /Buddy/ })).toBeHidden();
  await expect(page.getByRole('row', { name: /Kai Chen/ })).toBeVisible();
  expect(deletedUserIds).toEqual(['5']);
});
