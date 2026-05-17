# CLAUDE.md

このリポジトリで作業する Claude への **エントリーポイント**。
詳細な規約は `.claude/skills/` 配下の各 SKILL に分割されている。

---

## このプロジェクトは何か

AIコーディングの理想的な開発環境を探る PoC。題材として Notes アプリ（メモCRUD）を作りながら、以下を検証する。

- 人間とAIが共存する開発フロー（セッション間引き継ぎ、並行作業、レビュー）
- ローカルAIとクラウドAI（Cloud Agent / GitHub Actions）のハンドオフ

**重要**: アプリ完成は手段であり、目的は「再利用可能なAI開発の型」を作ること。コードと同程度に **開発プロセスの記録（journal）** が価値を持つ。

---

## まず読むべき資料

| 資料 | 内容 |
|------|------|
| [docs/requirements.md](./docs/requirements.md) | 要件定義（スコープ・機能要件・非機能要件） |
| [docs/design.md](./docs/design.md) | 設計（アーキテクチャ・AI開発フロー・隔離環境・IaC） |

コードとドキュメントに不一致を見つけたら、**ドキュメントを正** として扱い、必要なら更新提案を出す。

---

## 技術スタック（確定）

| 層 | 技術 |
|----|------|
| フロント | React + Vite (TypeScript) |
| API | FastAPI (Python) + SQLModel + Alembic |
| DB | PostgreSQL |
| 型共有 | FastAPI の OpenAPI → `openapi-typescript` でフロントに型生成 |
| IaC | AWS CDK (TypeScript) |
| dev ツール管理 | mise（`mise.toml` で uv / pnpm / claude-code を宣言） |
| Python ランタイム / パッケージ | uv（Python 自体も uv 経由で取得） |
| Node ランタイム / パッケージ | プロジェクトの Node は **pnpm の `devEngines.runtime`** で固定。グローバルツール用（claude-code 実行など）の Node は mise が管理して PATH に出している。**プロジェクトコードを動かすときは `pnpm exec` / `pnpm run` 経由を優先** し、素の `node` 直叩きは避ける |
| lint / format | Biome（Rust バイナリ、Node 非依存） |
| 隔離環境 | Dev Container + Docker Compose（workspace + db） |

他言語・他フレームワークへ勝手に置き換えない。変えたい場合は提案レベルで止めて確認を取る。

---

## リポジトリ構成（計画）

```
my-aicoding-recipe/
├─ python/mar-api                                # FastAPI API (uv workspace member)
├─ typescript/{mar-web,mar-schema,mar-infra}     # React / OpenAPI 型 / AWS CDK (pnpm workspace members)
├─ docs/                                         # 要件・設計・journal
├─ .devcontainer/                                # 隔離環境定義
├─ .vscode/                                      # 推奨拡張（コミット対象）
├─ .claude/skills/                               # AI 向け規約 SKILL（後述）
├─ CLAUDE.md                                     # 本ファイル
├─ docker-compose.yml                            # workspace + db
├─ mise.toml                                     # dev ツール宣言
├─ package.json                                  # pnpm workspace ルート
├─ pnpm-workspace.yaml                           # packages: ["typescript/*"]
└─ pyproject.toml                                # uv workspace ルート (members = ["python/*"])
```

**配置・命名規約**:

- workspace member は `python/{pkg}` または `typescript/{pkg}` 配下にのみ置く（ルート側の glob を 1 行で書くため）
- パッケージ名には `mar-` プレフィックスを付ける (my-aicoding-recipe の略。公開パッケージとの衝突回避)
- ただし Python モジュール名は uv の生成コマンド (`uv init --lib --package --name mar-api`) に従い `mar_api` のようにアンダースコア化したものを使う

`typescript/mar-web` `typescript/mar-schema` `typescript/mar-infra` は M3 / M5 で実体を作る。作業前に `ls` で実在を確認する。

---

## SKILL インデックス

作業内容に応じて、対応する SKILL を参照する。SKILL は `.claude/skills/<name>/SKILL.md`。

| SKILL | いつ参照するか |
|-------|----------------|
| [`coding-style`](./.claude/skills/coding-style/SKILL.md) | コードを書く・修正するとき。TS/Python/SQL/マイグレーションの規約 |
| [`git-workflow`](./.claude/skills/git-workflow/SKILL.md) | ブランチ作成・worktree 構築・コミット・PR 作成のとき |
| [`review-flow`](./.claude/skills/review-flow/SKILL.md) | PR 提出前・レビュー対応・マイルストーン完了時（journal 含む） |
| [`cloud-handoff`](./.claude/skills/cloud-handoff/SKILL.md) | 長時間タスク・調査・並行作業を Cloud Agent / Actions に委譲するとき |

該当 SKILL を読まずに作業を始めない。複数該当する場合は順に確認する。

---

## 絶対にやらないこと（このプロジェクトの憲法）

- `main` への直接コミット・直接 push
- `git push --force`（ユーザーが明示許可した場合のみ）
- 認証・認可機能の実装（PoC スコープ外）
- AWS への実デプロイ（IaC 作成までがスコープ。`cdk deploy` 禁止）
- Dev Container の外でホストの環境（apt 等）を勝手に変更
- 「動いたっぽい」での完了報告。最低限 dev サーバ起動 or テスト通過を確認する

詳細は各 SKILL の「やってはいけないこと」節を参照。

---

## 困ったとき

| 状況 | 対応 |
|------|------|
| スコープが要件と矛盾しそう | `docs/requirements.md` を正として、人間に判断を仰ぐ |
| 設計と実装に乖離がありそう | `docs/design.md` の更新提案を出す |
| 作業が長引きそう / 詰まった | 一旦コミットして状況を残し、判断を仰ぐ |
| 同じ指摘を何度も受けている | `review-flow` SKILL の「フィードバックの昇格ルール」を適用 |
