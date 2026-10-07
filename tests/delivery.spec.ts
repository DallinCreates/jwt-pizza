import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page, verifyFails = false) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = { 'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] } };

  await page.route('*/**/api/auth', async (route) => {
    const loginReq = route.request().postDataJSON();
    const user = validUsers[loginReq.email];
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    loggedInUser = validUsers[loginReq.email];
    expect(route.request().method()).toBe('PUT');
    await route.fulfill({ json: { user: loggedInUser, token: 'abcdef' } });
  });

  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
      { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const franchiseRes = { franchises: [{ id: 2, name: 'LotaPizza', stores: [{ id: 4, name: 'Lehi' }] }] };
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: franchiseRes });
  });

  await page.route('*/**/api/order', async (route) => {
    const orderReq = route.request().postDataJSON();
    const orderRes = { order: { ...orderReq, id: 23 }, jwt: 'eyJpYXQ' };
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ json: orderRes });
  });

  await page.route('*/**/api/order/verify', async (route) => {
    expect(route.request().method()).toBe('POST');
    if (verifyFails) {
      await route.fulfill({ status: 500, json: { message: 'invalid signature' } });
      return;
    }
    await route.fulfill({ json: { message: 'valid', payload: { pizzas: 1 } } });
  });

  await page.goto('/');
}

async function orderPizza(page: Page) {
  await page.getByRole('button', { name: 'Order now' }).click();
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('button', { name: 'Pay now' }).click();
}

test('delivery', async ({ page }) => {
  await basicInit(page);
  await orderPizza(page);

  await expect(page.getByRole('heading', { name: 'Here is your JWT Pizza!' })).toBeVisible();
  await expect(page.getByText('23', { exact: true })).toBeVisible();
  await expect(page.getByText('eyJpYXQ')).toBeVisible();

  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: 'JWT Pizza - valid' })).toBeVisible();
  await expect(page.getByText('"pizzas": 1')).toBeVisible();
});

test('invalid jwt verification', async ({ page }) => {
  await basicInit(page, true);
  await orderPizza(page);

  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: 'JWT Pizza - invalid signature' })).toBeVisible();
  await expect(page.getByText('invalid JWT. Looks like you have a bad pizza!')).toBeVisible();
});

test('delivery without an order', async ({ page }) => {
  await page.goto('/delivery');

  await expect(page.getByRole('heading', { name: 'Here is your JWT Pizza!' })).toBeVisible();
  await expect(page.getByText('error', { exact: true })).toBeVisible();
});

test('order more', async ({ page }) => {
  await basicInit(page);
  await orderPizza(page);

  await expect(page.getByRole('heading', { name: 'Here is your JWT Pizza!' })).toBeVisible();

  await page.getByRole('button', { name: 'Order more' }).click();
  await expect(page.getByRole('heading', { name: 'Awesome is a click away' })).toBeVisible();
});
