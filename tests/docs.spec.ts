import { test, expect } from 'playwright-test-coverage';

test('docs', async ({ page }) => {
  await page.route('*/**/api/docs', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({
      json: {
        endpoints: [
          {
            requiresAuth: false,
            method: 'GET',
            path: '/api/order/menu',
            description: 'Get the pizza menu',
            example: `curl -X GET localhost:3000/api/order/menu`,
            response: [{ id: '1', title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' }],
          },
          {
            requiresAuth: true,
            method: 'PUT',
            path: '/api/auth',
            description: 'Login existing user',
            example: `curl -X PUT localhost:3000/api/auth -d '{"email":"a@jwt.com", "password":"admin"}'`,
            response: { user: { id: '1', name: '常用名字', email: 'a@jwt.com' }, token: 'tttttt' },
          },
        ],
      },
    });
  });

  await page.goto('/docs');

  await expect(page.getByRole('heading', { name: 'JWT Pizza API' })).toBeVisible();
  await expect(page.getByText('[GET] /api/order/menu')).toBeVisible();
  await expect(page.getByText('Get the pizza menu')).toBeVisible();
  await expect(page.getByText('🔐 [PUT] /api/auth')).toBeVisible();
  await expect(page.getByText('Login existing user')).toBeVisible();
});
