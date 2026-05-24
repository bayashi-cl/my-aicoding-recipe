import { expect, test } from "@playwright/test";

const API = "http://localhost:8000/api";

test.beforeEach(async ({ request, page }) => {
  // テスト間のデータ分離: 既存 note を全削除してからページを開く
  const res = await request.get(`${API}/notes`);
  const notes = (await res.json()) as { id: string }[];
  for (const note of notes) {
    await request.delete(`${API}/notes/${note.id}`);
  }
  await page.goto("/");
  await page.waitForLoadState("networkidle");
});

test("初期表示: 2 ペインレイアウトと空状態", async ({ page }) => {
  await expect(page.locator('button:has-text("新規作成")')).toBeVisible();
  await expect(page.locator("text=ノートがありません")).toBeVisible();
  await expect(page.locator("text=左からノートを選んでください")).toBeVisible();
});

test("新規作成キャンセルで空状態に戻る", async ({ page }) => {
  await page.click('button:has-text("新規作成")');
  await expect(page.locator('input[placeholder="タイトル"]')).toBeVisible();

  await page.fill('input[placeholder="タイトル"]', "下書き");
  await page.click('button:has-text("キャンセル")');

  await expect(page.locator("text=左からノートを選んでください")).toBeVisible();
  await expect(page.locator("text=ノートがありません")).toBeVisible();
});

test("CRUD フロー: 作成 → 詳細表示 → 編集 → 削除", async ({ page }) => {
  // --- 作成 ---
  await page.click('button:has-text("新規作成")');
  await page.fill('input[placeholder="タイトル"]', "E2Eテストノート");
  await page.fill('input[placeholder="タグ（カンマ区切り）"]', "e2e, playwright");
  await page.fill(
    "textarea",
    "# E2E テスト\n\nこれは **Playwright** で作成されたノートです。\n\n- 項目1\n- 項目2",
  );
  await page.click('button:has-text("保存")');
  await page.waitForLoadState("networkidle");

  // 一覧に追加されていること（リスト内のボタンで確認）
  await expect(
    page.getByRole("button", { name: /E2Eテストノート/ }),
  ).toBeVisible();

  // 詳細ペインにタイトル・タグが表示されていること
  await expect(page.locator('h1:has-text("E2Eテストノート")')).toBeVisible();
  await expect(page.locator('span:has-text("e2e")')).toBeVisible();
  await expect(page.locator('span:has-text("playwright")')).toBeVisible();

  // Markdown が HTML に変換されていること（<strong> タグの存在で確認）
  await expect(page.locator("strong:has-text('Playwright')")).toBeAttached();

  // --- 編集 ---
  await page.click('button:has-text("編集")');
  await expect(page.locator('input[placeholder="タイトル"]')).toHaveValue(
    "E2Eテストノート",
  );
  await page.fill('input[placeholder="タイトル"]', "E2Eテストノート（更新済）");
  await page.click('button:has-text("保存")');
  await page.waitForLoadState("networkidle");

  await expect(
    page.locator('h1:has-text("E2Eテストノート（更新済）")'),
  ).toBeVisible();
  // 一覧のタイトルも更新されていること
  await expect(
    page.getByRole("button", { name: /E2Eテストノート（更新済）/ }),
  ).toBeVisible();

  // --- 削除 ---
  await page.click('button:has-text("削除")');
  await page.waitForLoadState("networkidle");

  await expect(page.locator("text=ノートがありません")).toBeVisible();
  await expect(page.locator("text=左からノートを選んでください")).toBeVisible();
});
