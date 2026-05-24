import { expect, test } from "@playwright/test";

const API = "http://localhost:8000/api";

test.beforeEach(async ({ request, page }) => {
  const res = await request.get(`${API}/notes`);
  const notes = (await res.json()) as { id: string }[];
  for (const note of notes) {
    await request.delete(`${API}/notes/${note.id}`);
  }

  await request.post(`${API}/notes`, {
    data: { title: "Python基礎", body: "Pythonの基礎メモ", tags: ["python"] },
  });
  await request.post(`${API}/notes`, {
    data: { title: "JavaScript入門", body: "JSの入門メモ", tags: ["web"] },
  });
  await request.post(`${API}/notes`, {
    data: {
      title: "DBメモ",
      body: "データベースのメモ",
      tags: ["python"],
    },
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
});

test("テキスト検索: 入力文字列で絞り込む", async ({ page }) => {
  await page.fill('input[type="search"]', "Python基礎");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: /Python基礎/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /JavaScript入門/ })
  ).toBeHidden();
  await expect(page.getByRole("button", { name: /DBメモ/ })).toBeHidden();
});

test("タグフィルター: タグボタンで絞り込む", async ({ page }) => {
  await page.click('button:has-text("web")');
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("button", { name: /JavaScript入門/ })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Python基礎/ })).toBeHidden();
  await expect(page.getByRole("button", { name: /DBメモ/ })).toBeHidden();
});

test("クリア: 検索クリア後に全件表示", async ({ page }) => {
  await page.fill('input[type="search"]', "Python基礎");
  await page.waitForLoadState("networkidle");

  await page.fill('input[type="search"]', "");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: /Python基礎/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /JavaScript入門/ })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /DBメモ/ })).toBeVisible();
});

test("クリア: タグ再クリックで選択解除して全件表示", async ({ page }) => {
  await page.click('button:has-text("web")');
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("button", { name: /JavaScript入門/ })
  ).toBeVisible();

  await page.click('button:has-text("web")');
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: /Python基礎/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /JavaScript入門/ })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /DBメモ/ })).toBeVisible();
});
