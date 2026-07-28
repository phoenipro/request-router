import { test, expect } from '@playwright/test';

test('トップページが表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '依頼受付・振り分けボード' })).toBeVisible();
});

test('Firebase 未設定のときは設定を促す案内が出る', async ({ page }) => {
  // CI では認証情報を渡していないため、この分岐に入ることを確認する
  await page.goto('/');
  await expect(page.getByText('Firebase が未設定です')).toBeVisible();
});
