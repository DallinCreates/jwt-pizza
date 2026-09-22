import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page) {
  const registeredUser: User = { id: '99', name: 'New Guy', email: 'newguy@jwt.com', roles: [{ role: Role.Diner }] };

  await page.route('*/**/api/auth', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ json: { user: registeredUser, token: 'abcdef' } });
  });

  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: registeredUser });
  });

  await page.goto('/');
}

test('register', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Register' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome to the party' })).toBeVisible();

  await page.getByPlaceholder('Full name').fill('New Guy');
  await page.getByPlaceholder('Email address').fill('newguy@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByRole('link', { name: 'NG' })).toBeVisible();
});
