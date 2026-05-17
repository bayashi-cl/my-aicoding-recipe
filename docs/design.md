# 設計書

要件定義は [`requirements.md`](./requirements.md) を参照。本書では以下を扱う。

1. 全体アーキテクチャ
2. アプリケーション設計（Notesアプリ）
3. AI開発フロー設計（**本PoCの主眼**）
4. 隔離環境設計
5. インフラ設計（AWS CDK）

---

## 1. 全体アーキテクチャ

```
┌────────────────────────────────────────────────────────────────┐
│                     Dev Container (隔離環境)                    │
│                                                                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │ Frontend     │───▶│ API (FastAPI)│───▶│ PostgreSQL   │     │
│  │ React + Vite │    │ Python       │    │ (Docker)     │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│         ▲                    ▲                                 │
│         └──── Claude Code ───┘                                 │
│                  ▲                                             │
└──────────────────┼─────────────────────────────────────────────┘
                   │ (handoff)
                   ▼
        ┌────────────────────────┐
        │ Cloud Agents / GitHub  │
        │ Actions (long-running) │
        └────────────────────────┘
```

### 1.1 リポジトリ構成（モノレポ）

```
my-aicoding-recipe/
├─ python/
│  └─ mar-api/                # FastAPI APIサーバー (uv workspace member)
├─ typescript/
│  ├─ mar-web/                # React + Vite フロントエンド (pnpm workspace member, M3)
│  ├─ mar-schema/             # OpenAPI 由来の型を共有 (pnpm workspace member, M3)
│  └─ mar-infra/              # AWS CDK (pnpm workspace member, M5)
├─ docs/                      # 要件・設計ドキュメント
├─ .devcontainer/             # Dev Container 定義
├─ .claude/                   # Claude Code 設定・スキル・コマンド
├─ CLAUDE.md                  # AI向けのプロジェクト指示
├─ docker-compose.yml         # ローカル実行用（workspace + db）
├─ mise.toml                  # dev ツール（uv / pnpm / claude-code）の宣言
├─ pnpm-workspace.yaml        # packages: ["typescript/*"]
├─ package.json               # pnpm workspace ルート
└─ pyproject.toml             # uv workspace ルート (members = ["python/*"])
```

**配置・命名の規約**:

- workspace member は **`python/{pkg}` / `typescript/{pkg}`** の 2 系統だけに置く。ルート側の glob 指定 (`python/*` / `typescript/*`) を 1 行に収めるため
- パッケージ名は **`mar-` プレフィックス**を付ける (my-aicoding-recipe の略)。公開パッケージとの名前衝突を簡易的に回避するため

### 1.2 技術スタック選定理由

| 層 | 採用技術 | 選定理由 |
|----|----------|----------|
| フロントエンド | React + Vite (TypeScript) | 情報量が多くAIが扱いやすい。ビルドが速くフィードバックループが短い |
| APIサーバー | FastAPI (Python) | OpenAPI自動生成、Pydanticで入出力が型安全。AIにとっても定型化しやすい |
| 型共有 | OpenAPI → TypeScript 型生成 | FastAPIが吐くOpenAPIから`openapi-typescript`等でフロントの型を生成し、契約を一元化 |
| 入出力スキーマ | Pydantic (API側) | リクエスト/レスポンスをモデルで宣言。AIが境界条件を理解しやすい |
| DB | PostgreSQL | 一般的でAIの知識も豊富。全文検索拡張も使える |
| ORM | SQLModel (or SQLAlchemy 2.0 + Alembic) | Pydanticと統合され型がはっきりする。マイグレーションはAlembic |
| dev ツール管理 | mise | uv / pnpm / claude-code 等のバイナリ版を `mise.toml` で一元宣言 |
| Pythonランタイム / パッケージ管理 | uv | Pythonランタイムも含めて uv が取得・管理 |
| Node ランタイム / パッケージ管理 | pnpm + workspaces | **プロジェクトの Node** はルート `package.json` の `devEngines.runtime` + `pnpm.executionEnv.nodeVersion` で固定し、`pnpm exec` / `pnpm run` 経由で実行する。**グローバル CLI 用の Node**（claude-code など）は mise が管理して PATH に出ている（実環境で「Node を完全に PATH から外す」のは Node ベース CLI の実行不能を意味するため。詳細は §8 変更履歴参照） |
| lint / format | Biome | Rust バイナリで Node 不要。TypeScript/JSON 系を一括カバー |
| IaC | AWS CDK (TypeScript) | 型補完が効きAIも扱いやすい。`typescript/mar-infra/` の devDependency として導入し `pnpm exec cdk` で実行 |
| 隔離環境 | Dev Container + Docker Compose | 後述（4章） |

---

## 2. アプリケーション設計（Notesアプリ）

### 2.1 データモデル

```python
# python/mar-api/src/mar_api/models/note.py
from datetime import datetime
from uuid import UUID, uuid4
from sqlmodel import SQLModel, Field
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy import Column, String

class Note(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str = Field(min_length=1, max_length=200)
    body: str                                  # Markdown
    tags: list[str] = Field(
        sa_column=Column(ARRAY(String), nullable=False, default=list)
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

**設計判断**: タグは独立テーブルにせず PostgreSQL の `text[]` として保持する。PoCの範囲では正規化のメリットより、AIがスキーマ全体を1ファイルで把握できる単純さを優先する。

フロント側はFastAPIが提供する`/openapi.json`から型を生成する:

```bash
# typescript/mar-web 側で実行
pnpm openapi-typescript http://localhost:8000/openapi.json -o src/types/api.ts
```

### 2.2 API設計

| メソッド | パス | 用途 |
|----------|------|------|
| GET | `/api/notes` | 一覧。`?q=...&tag=...` でフィルタ |
| POST | `/api/notes` | 作成 |
| GET | `/api/notes/:id` | 詳細 |
| PUT | `/api/notes/:id` | 更新 |
| DELETE | `/api/notes/:id` | 削除 |
| GET | `/api/tags` | タグ一覧（DB内の全タグをdistinctで取得） |

全文検索はPostgreSQLの`to_tsvector`を利用する。Alembicマイグレーションで生成カラム＋GINインデックスを作成する。

### 2.3 フロントエンド設計

- ルーティング: TanStack Router（ファイルベース、型安全）
- データフェッチ: TanStack Query
- スタイル: Tailwind CSS
- Markdownレンダリング: `react-markdown` + `remark-gfm`
- 主要画面: 一覧（左ペイン）+ 詳細/編集（右ペイン）の2ペイン構成

---

## 3. AI開発フロー設計（PoCの主眼）

本章は、本PoCの中核的な検証対象である。

### 3.1 開発フローの全体像

```
[人間が要件をissueで起票]
        │
        ▼
[ローカル Claude Code でPlan作成]
        │
        ▼
[git worktree でブランチを切る]──┐
        │                       │
        ▼                       ▼
[Local Claude が実装]    [Cloud Agent に長時間タスクをhandoff]
        │                       │
        └──────┬────────────────┘
               ▼
        [PR作成]
               │
               ▼
[ /ultrareview + CI レビュー]
               │
               ▼
       [人間が最終レビュー]
               │
               ▼
        [マージ→memory更新]
```

### 3.2 セッション間の引き継ぎ

#### 3.2.1 Git worktree による並行作業

複数の Claude Code セッションを並行で動かす際、組み込み `--worktree` 機能で worktree を切る。

```
my-aicoding-recipe/                 # main worktree (= DevContainer のマウント先、host bind mount)
$HOME/.claude-worktrees/
├─ feat-notes-search/                # ブランチ feat/notes-search (overlay FS)
└─ feat-notes-tags/                  # ブランチ feat/notes-tags  (overlay FS)
```

- **1 つの DevContainer 内に複数 worktree を持つ**。worktree ごとに DevContainer を立てる構成は採らない (起動時間・キャッシュ重複・ポート/.env の二重管理コストが PoC のメリットを上回るため)
- **worktree は `$HOME/.claude-worktrees/<name>/` (overlay FS) に置く**。リポジトリは host bind mount で別 FS のため、repo 内に worktree を作ると pnpm/uv の hardlink キャッシュ最適化が壊れて遅くなる。overlay FS 上ならキャッシュ (`~/.cache/pnpm`, `~/.cache/uv` 等) と同 FS なので hardlink が成立
- worktree 作成は `claude --worktree <type>-<topic>` 形式で呼ぶ。`.claude/hooks/worktree-create.sh` (WorktreeCreate hook) がブランチ名を `<type>/<topic>` に正規化し、`$HOME/.claude-worktrees/<type>-<topic>/` を作る
- `.env` / `.env.local` は同 hook が新規 worktree に自動コピー (`.worktreeinclude` ではなく hook 内で処理。hook が使われると `.worktreeinclude` は無効化されるため)
- worktree の場所は overlay FS なので、DevContainer をリビルドすると消える。作業中の worktree はリビルド前にコミット/プッシュしておくこと
- 並行作業の可視化は `git worktree list` + 関連 Issue/PR で行う (専用のトラッキングファイルは作らない)
- DB は単一の compose サービスを共有。複数 worktree のアプリを同時起動して両方の動作確認をしたい特殊ケースは、必要が出た時点で別タスクで対処

#### 3.2.2 PR/Issueを引き継ぎ単位にする

- 1つの作業 = 1つのIssue or PR
- PRのdescriptionに以下を必ず含める:
  - 関連Issue
  - 何を変更したか（What）
  - なぜそうしたか（Why）
  - 残課題（Open Questions）
- PRをまたぐ作業は新たにIssue化し、現PR内で完結させない

#### 3.2.3 CLAUDE.md / memory の階層

| レイヤ | 内容 | 寿命 |
|--------|------|------|
| `CLAUDE.md` (リポジトリ直下) | コーディング規約、コマンド、アーキテクチャ要点 | リポジトリの寿命 |
| `.claude/memory/*.md` | 過去のフィードバックや判断の経緯 | セッションをまたぐ |
| Plan / Tasks | 進行中の作業の分解 | セッション内 |

### 3.3 レビューとフィードバックのフロー

#### 3.3.1 多段レビューモデル

```
PR作成
  ↓
[Layer 1] CI: 型チェック、lint、ユニットテスト
  ↓
[Layer 2] AI自動レビュー: /ultrareview による複数視点レビュー
  ↓
[Layer 3] 人間レビュー: 上記の指摘を踏まえて判断
  ↓
マージ
```

#### 3.3.2 フィードバックの学習サイクル

レビューで繰り返し指摘される内容は、以下のいずれかに昇格させる:

- **コードで防げるもの** → lint ルール、型、テストへ
- **判断の指針** → `CLAUDE.md` に明文化
- **個別事情の知識** → `.claude/memory/` へ蓄積

### 3.4 クラウド上のAIへのハンドオフ

#### 3.4.1 ハンドオフパターン

| パターン | トリガ | 想定用途 |
|----------|--------|----------|
| ローカル → Cloud Agent | ユーザー操作 | 長時間の実装、調査、リファクタ |
| Issue → GitHub Actions経由のAI | Issueラベル付与 | 雑用タスク（型エラー修正、依存更新） |
| PR → AIレビュー | PR作成 | `/ultrareview` 相当を自動起動 |

#### 3.4.2 コンテキスト共有

ハンドオフ時、以下を引き継ぎ情報として明示的に渡す:

- 関連Issue/PRへのリンク
- 触ってよいファイル/触ってはいけないファイル
- 期待する成果物の形式（PR形式 or 報告形式）
- 完了条件

これらは `.claude/handoff-template.md` としてテンプレ化する。

---

## 4. 隔離環境設計（提案）

### 4.1 採用方針: **Dev Container + Docker Compose のハイブリッド**

| 役割 | 採用技術 | 理由 |
|------|----------|------|
| 開発環境（ツールチェイン） | Dev Container | mise / uv / pnpm / claude-code をコンテナに固定 |
| DB | Docker Compose (workspace と同一 compose) | DB は常時稼働のサービス。compose で同ネットワークに収める |
| アプリ実行 (web / api) | **workspace 内のプロセスとして起動**（compose サービスにはしない） | HMR / `--reload` の高速フィードバックを優先するため |
| エージェントの実行隔離 | Dev Container 内 + Claude Code の権限設定 | ホストFS への書き込みは workspace 配下のみ。許可コマンドを `.claude/settings.json` で制限 |

### 4.2 構成図

```
[Host: WSL2 / macOS]
   │
   └─ VS Code attaches to ─▶ [Dev Container = compose service "workspace"]
                                │
                                ├─ mise (uv / pnpm / claude-code)
                                ├─ pnpm dev (Vite dev server)        ← プロセスとして起動
                                ├─ uv run uvicorn (FastAPI --reload) ← プロセスとして起動
                                │
                                └─ ネットワーク同居 ────▶ [compose service "db"]
                                                              PostgreSQL
```

### 4.3 採用理由

- **Dev Container 単独だと DB が含めにくい** → Docker Compose で db を併設
- **app (web/api) も compose サービス化すると、依存追加・デバッグでコンテナ再ビルドが必要** → app はプロセスとして起動し、HMR / `--reload` のループを高速化
- **Claude Code Sandbox 単独だと不足** → Dev Container と組み合わせて補強

### 4.4 設定ファイル

```
.devcontainer/
├─ devcontainer.json     # VS Code / Claude Code の起動設定
├─ Dockerfile            # base + mise のみ。Node / Python は入れない
├─ post-create.sh        # mise install と疎通確認
└─ .env.example          # DATABASE_URL 等の雛形

docker-compose.yml       # workspace + db
mise.toml                # uv / pnpm / claude-code を宣言
.vscode/extensions.json  # Biome 等の推奨拡張
.claude/settings.json    # 権限、フック、許可コマンド（追加予定）
```

### 4.5 セキュリティ方針

- AWS 認証情報: M5 (IaC) で必要になった時点で、ホストの `~/.aws` を読み取り専用マウントする方針
- `git push --force` 等の破壊的操作は `.claude/settings.json` で要承認
- ネットワークは必要最小限の到達先のみ許可（必要に応じて）

---

## 5. インフラ設計（AWS CDK）

### 5.1 構成（コンテナ中心）

```
                       ┌─────────────────────┐
[User] ──▶ CloudFront ─┤ S3 (Web静的ファイル) │
                       └─────────────────────┘
                       │
                       └─▶ ALB ─▶ ECS Fargate (FastAPI コンテナ)
                                       │
                                       ▼
                                  RDS (PostgreSQL)
```

| サービス | 用途 |
|----------|------|
| S3 + CloudFront | フロントエンドの静的ファイル配信 |
| ALB | APIへのHTTPルーティング |
| ECS Fargate | FastAPI コンテナの実行 |
| RDS (PostgreSQL) | アプリケーションDB（Single-AZでよい） |
| ECR | APIコンテナイメージのレジストリ |
| Secrets Manager | DB認証情報 |
| VPC | ALB/ECS/RDSを収める |

**注記**: 実デプロイはせず、`cdk synth` で CloudFormation テンプレートが生成できることを完了条件とする。

### 5.2 CDK スタック分割

```
typescript/mar-infra/
├─ bin/app.ts
├─ lib/
│  ├─ network-stack.ts       # VPC, Subnet
│  ├─ database-stack.ts      # RDS
│  ├─ api-stack.ts           # ECS Fargate + ALB + ECR
│  └─ web-stack.ts           # S3 + CloudFront
└─ cdk.json
```

スタックを分けることで、AIが「どのファイルを触れば何が変わるか」を予測しやすくなる。

---

## 6. マイルストーン（実装順の提案）

| # | マイルストーン | 検証ポイント |
|---|----------------|--------------|
| M1 | リポジトリ初期化 + Dev Container + CLAUDE.md | 隔離環境が機能するか |
| M2 | Notes API のCRUD + DB スキーマ | AIが型を介して安全に実装できるか |
| M3 | Web フロントの一覧/編集画面 | フロント/APIの型共有が機能するか |
| M4 | 検索・タグ機能 + テスト | レビューフローを実運用してみる |
| M5 | AWS CDK で構成を記述（synth まで） | IaCをAIに書かせる体験 |
| M6 | worktree並行作業の検証 / Cloud Agentへのハンドオフ実験 | ハンドオフの型を確立 |
| M7 | フローを `CLAUDE.md` / `docs/` に逆輸入 | テンプレ化 |

各マイルストーンの終わりに、**「AI開発フローで気づいたこと」を `docs/journal/` に記録する**ことを推奨する。これがPoC本来の成果物となる。

---

## 7. 未決事項 / 今後の検討

- `/ultrareview` 等の有償機能をどの頻度で使うかのコスト感
- Cloud Agentへの具体的なhandoff手順（運用しながら整理）
- WORKTREES.md の自動更新スクリプトを書くかどうか
- memoryに溜める基準（書きすぎると劣化するため、運用ルールが必要）

## 8. 変更履歴（設計判断の更新）

- **2026-05-16**: `docker-compose` の構成を変更。当初は web/api/db を compose サービス化する案だったが、HMR/`--reload` の高速フィードバックを優先して **app はプロセスとして起動**、compose は workspace + db のみとする方針に修正
- **2026-05-16**: dev ツール管理を **mise に統一**。Dockerfile で Node を直接入れる方式から、mise → pnpm の `devEngines.runtime` で Node を取得する方式へ変更。linter/formatter も ESLint+Prettier 想定から **Biome** に変更（別セッションでの調査結果 `tmp/devtool-management.md` を反映）
- **2026-05-16**: 上記方針のうち「Node を PATH に置かない」は **実環境で破綻**。mise の npm バックエンドが npm を必要とし、また claude-code は Node.js アプリなので実行時にも Node が要る。`mise.toml` に `node = "lts"` を追加してグローバル用 Node を PATH に出す形に修正。プロジェクト Node を pnpm の `devEngines.runtime` で別管理する原則は維持
- **2026-05-16**: rootless Docker の UID マッピング（コンテナの root = ホストのユーザ）を踏まえ、devcontainer の `remoteUser` を **`root`** に変更。当初の `vscode` だと bind mount したワークスペースが書き込めなかったため
- **2026-05-17**: workspace member の配置を `apps/` `packages/` `infra/` から **`python/{pkg}` / `typescript/{pkg}`** に統一。同時にパッケージ名へ **`mar-` プレフィックス**を導入（公開パッケージとの簡易的な衝突回避）。意図はルート側からの member 指定を glob 1 行 (`python/*` / `typescript/*`) に収めること。FastAPI 側のモジュール名は uv の生成コマンドに合わせ `mar_api` とした (起動: `uv run --package mar-api uvicorn mar_api.main:app --reload`)
- **2026-05-17**: プロジェクト Node の `devEngines.runtime` 設定を **M3 → M2 (CI 整備時) に前倒し**。理由は GitHub Actions で `actions/setup-node` を消して pnpm 自身に Node を管理させたかったため。`devEngines.runtime` は宣言的な制約だが pnpm の自動 install を直接トリガしないので、併せて `pnpm.executionEnv.nodeVersion` も `package.json` に追加。CI は `pnpm/action-setup@v4` のみで完結する
- **2026-05-17**: worktree の運用方針を変更。当初は worktree ごとに DevContainer を立ち上げ、`../wt-<topic>/` (リポジトリ親) に worktree を置く想定だったが、PoC では DevContainer 起動時間・キャッシュ重複・ポート/.env の二重管理コストがメリットを上回ると判断し、**1 つの DevContainer 内に worktree を持つ** 方式に変更。配置場所は Claude Code 組み込み `--worktree` を使いつつ、`$HOME/.claude-worktrees/<name>/` (overlay FS) に置く (リポジトリは host bind mount で別 FS のため、repo 内に worktree を作ると pnpm/uv の hardlink キャッシュが効かない)。命名規約 `<type>/<short-topic>` との整合は `WorktreeCreate` hook (`.claude/hooks/worktree-create.sh`) で取り、`.worktreeinclude` の代わりに `.env` コピーも hook 内で実装 (hook 利用時は include 機能が無効化されるため)。独自シェルスクリプト (当初想定の `scripts/worktree.sh`) は作らない
