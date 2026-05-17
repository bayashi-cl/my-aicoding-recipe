# my-aicoding-recipe

AI コーディングの「型」を確立するための PoC。題材として Notes アプリ（メモ CRUD + 検索）を作りつつ、
**人間 × コーディングエージェント（Claude Code 等）の協働フロー**そのものを成果物として整備する。

- 何をやっている PoC か: [`docs/requirements.md`](./docs/requirements.md) / [`docs/design.md`](./docs/design.md)
- エージェント向けの指示: [`CLAUDE.md`](./CLAUDE.md) と [`.claude/skills/`](./.claude/skills/)
- 過去の作業ジャーナル: [`docs/journal/`](./docs/journal/)

このドキュメントは **人間向け** のエントリポイント。**コーディングエージェントを使う前提**で、
日常運用で人間がどう指示を出し、どこを手動で握るかを書く。

---

## クイックスタート

前提: VS Code + Dev Containers 拡張、Docker、`mise`（ホスト側）。

1. リポジトリを clone し、VS Code で開く
2. コマンドパレット → `Dev Containers: Reopen in Container`
3. 初回起動時に `.devcontainer/post-create.sh` が走り `mise install` まで終わる
4. **`gh auth login`** をコンテナ内で実行（人間がやる。AI 側にトークンを渡さない）
5. DB (`db`) は devcontainer の compose で workspace と同時に立ち上がっているため別途起動不要
6. API を起動する場合: `uv run --package mar-api uvicorn mar_api.main:app --reload` → `curl localhost:8000/healthz`

エージェント側の作業は VS Code 拡張の Claude Code から実行する。

---

## 人間 × エージェントの役割分担

このリポジトリでは、人間が **ディレクター**（方針判断・レビュー・最終マージ）として動き、
エージェントが **実装担当**（Issue 読み・計画・実装・PR）として動く。

| 領域 | エージェント | 人間 |
|---|---|---|
| Issue/PR 読み、計画作成、コード書き、テスト実行、PR 作成、自己レビュー、別エージェント由来のレビュー対応 | ◯ | |
| `gh auth login`（GitHub トークン管理） | × | ◯ |
| Plan mode で出された計画の承認 | × | ◯ |
| **PR の最終マージ判断** | 補助のみ | ◯ |
| `/review` などの AI レビュー起動 | ◯ | ◯ |
| スコープ判断・優先順位 | 提案する | 最終判断 |
| 設計書・要件書の更新 | 提案する | 承認後に AI が編集 |

詳細な禁止事項は [`CLAUDE.md` §絶対にやらないこと](./CLAUDE.md) と [`.claude/skills/git-workflow/SKILL.md`](./.claude/skills/git-workflow/SKILL.md) に集約してある。

### 共通の進め方

- **最初に Plan mode で計画を承認する**: 非自明なタスクはエージェントに `/plan` 相当で計画を立てさせ、`ExitPlanMode` で承認してから着手させる
- **Issue 番号を明示する**: 「いい感じにやって」より「`#9` を実装して」の方が成果が大きく変わる
- **認証は人間**: `gh auth login` は人間がコンテナ内で実行（Claude Code のセッション内では `! gh auth login` でも可）
- **レビューは別エージェントで**: 同じセッションでの自己レビューは観点が偏る。別タブ / 別エージェント / `/review` を活用

---

## ケース 1: 割り振られたタスク / マイルストーンの実装を進める

**状況**: Task Issue が既に立っている（例: `#9 M2-3 CRUD エンドポイント`）。

### 人間が出す指示（例）

最小:

```
Issue #9 の実装を進めて。Plan mode で計画を出してから着手して。
```

精度を上げたい場合:

```
#9 を実装。完了条件は Issue 本文の DoD を満たすこと。
スコープから外れる改善点は別 Issue に切ってよい（ケース 3）。
Plan mode で計画を出してから着手。
```

### エージェントが進める作業

1. `gh issue view 9` で Task 内容と親 Milestone を確認
2. 関連するコード・SKILL を読む（[`CLAUDE.md`](./CLAUDE.md) → 該当 SKILL）
3. Plan mode で計画を書く → `ExitPlanMode` で承認を仰ぐ
4. 承認後: ブランチ作成（`<type>/<short-topic>`）、実装、1 コミット = 1 意味単位、テスト実行
5. `gh pr create` で PR 作成（`.github/PULL_REQUEST_TEMPLATE.md` が自動表示される）
   - 本文に **`Closes #9`** を必ず書く → マージ時に Task Issue が閉じ、親 Milestone のチェックボックスが自動更新される
6. 必要なら自己レビュー、または別エージェント / Copilot レビューに引き渡す

### 人間が手動で握るポイント

| タイミング | 何をするか |
|---|---|
| Plan mode 承認時 | 計画の読み合わせ。スコープが膨らんでいないか、依存が誤っていないか確認 |
| PR 作成後 | 別エージェントを開いて `/review` を実行（または GitHub Copilot レビュー）。同じセッションでの自己レビューは盲点が残る |
| レビュー指摘が来たら | 「対応の要否は判断していい」と委ねるか、特定の指摘だけ「ここは却下で」と方針を渡すか選ぶ |
| CI 緑 + レビュー OK 後 | **マージは人間が実行**（`gh pr merge` を AI に打たせない運用を当面採る） |

### 注意（人間側）

- 雑な指示は雑な PR を呼ぶ。最低限 **Issue 番号** を渡す
- AI が PR description テンプレを埋めずに出してきたら「テンプレを埋めて」と指示する
- スコープ拡大を提案されたら **ケース 3** へ誘導する

---

## ケース 2: 次にやるべきタスクの判断が必要

**状況**: 直前のタスクが終わった、もしくは新セッションを開いて何をやるか決まっていない。

### 人間が出す指示（例）

```
次は何をやるべきか把握していますか？
```

または

```
M2 の進行状況を見て、次に着手すべき Task を提案して。
判断に迷う部分は質問して。
```

### エージェントが進める作業

1. [`CLAUDE.md`](./CLAUDE.md) → [`docs/design.md §6`](./docs/design.md) のマイルストーン表を確認
2. `gh issue list --label "type:milestone" --state open` で未完 Milestone を取得
3. 進行中 Milestone を `gh issue view` で開き、サブタスクの状態を確認
4. `gh issue list --label "type:task" --state open` で未着手 Task を抽出
5. マイルストーン順序を尊重した上で、候補を 1〜3 件提示
6. 未着手 Task が無く Milestone が未完なら、**Milestone のサブタスク分解を起票するところから始める**ことを提案
7. `AskUserQuestion` で人間に選択を仰ぐ

### 人間が手動で握るポイント

| タイミング | 何をするか |
|---|---|
| 候補提示時 | どれを着手するか選ぶ。違和感があれば redirect（ただし理由なくマイルストーン順序を飛ばすのは避ける） |
| Milestone サブタスク分解の起票時 | 起票内容（タイトル・DoD・本文）を確認してから AI に `gh issue create` を許可するか、ドラフトを `tmp/` 配下に書かせてから人間が起票 |
| 設計書の更新提案が出たら | `docs/design.md` 側を AI に編集させる前に内容を確認 |

### 注意（人間側）

- 「Milestone を飛ばしても良いか」の判断は人間が握る。AI に「順序通りでいい？」と聞かれたら明確に返す
- セッション開始直後はエージェントが文脈を把握していない場合がある。**最初に CLAUDE.md と最新ジャーナルを読ませる**指示を入れると精度が上がる

---

## ケース 3: コードの問題 / 改善点を発見したが、タスクに無い

**状況**: 別タスクの実装中、または手元のレビュー中に、現タスクに無い問題を見つけた。
発見者は AI 側でも人間側でもありうる。**割り込み的・受動的** な作業。
（計画的なメンテナンス作業はケース 4 を参照）

### 原則

**その場で直さず、まず Issue 化する**。現 PR にスコープを混ぜると差分が膨らみレビュー精度が落ちる
（[`.claude/skills/coding-style/SKILL.md`](./.claude/skills/coding-style/SKILL.md) §共通方針）。

### AI が発見した場合

エージェントは SKILL に従い「これは脇道です、別 Issue に切ってよいですか？」と相談してくる。
**人間は緊急度判定（後述）に基づいて指示する**。

### 人間が発見した場合

エージェントに起票を依頼:

```
python/mar-api/src/mar_api/.../foo.py の bar 関数で X というバグがある。
type:bug ラベルで Issue を起票して。
緊急度は低い。M2-3 完了後に対応する候補として残す。
```

エージェントが起票内容のドラフトを作る → 人間が確認 → 起票実行（人間が承認したコマンドを打つ or AI に許可する）。

### 緊急度判定（共通）

| 状況 | 対応 | 人間の指示例 |
|---|---|---|
| 修正が現タスクの完了条件に必要（依存） | Issue 起票 + 現 PR で対応 | 「現 PR で一緒に直して。PR 本文に `Also addresses #<新>` を追記」 |
| 数行で済む軽微な修正（タイポ等） | Issue 起票 + 別 PR で即対応 | 「別ブランチで小 PR を立てて。Closes 付きで」 |
| 中規模以上（複数ファイル・I/F 変更） | Issue 起票のみ | 「Issue だけ作って、優先度判断はあとで」 |
| 既存 Milestone のスコープ越え | Issue 起票 + 新 Milestone を提案 | 「新 Milestone 候補の Issue を立てて、`docs/design.md` 更新提案も添えて」 |

### 人間が手動で握るポイント

| タイミング | 何をするか |
|---|---|
| AI が脇道を発見して相談してきたとき | 緊急度を判定し、上表のいずれかに振り分ける指示を出す |
| 起票内容を確認するとき | タイトル・本文・ラベル・親 Issue リンクが妥当か |
| AI が「ついで」に現 PR に混ぜようとしたとき | 止める。「現 PR は #9 完結。これは別 Issue で」 |

---

## ケース 4: マイルストーンに紐づかない定常運用作業

**状況**: 設計マイルストーン (M2〜M7) のスコープ外だが、放置するとリポジトリの健全性が落ちる
**計画的・能動的** な作業。例:

- 依存パッケージの更新（pnpm / uv / mise.toml のバージョン引き上げ）
- Dev Container / Dockerfile / CI 設定の見直し
- ドキュメントの typo・リンク切れ修正、`docs/journal/` の整理
- ラベル定義 (`.github/labels.yml`) の追加・整理
- 内部スクリプト (`scripts/`) のリファクタ

### ケース 3 との違い

| | ケース 3 | ケース 4 |
|---|---|---|
| トリガ | 別タスク中に **発見** | 人間が **計画的に依頼** / Dependabot 等の通知 |
| 性質 | 受動・割り込み | 能動・定常運用 |
| 親 Milestone | 必要なら新規 Milestone を提案 | 紐付けない（Parent 行は省略 or 「定常運用」と明記） |
| ラベル | `type:bug` / `type:task` | `type:chore` / `type:docs` |

### 人間が出す指示（例）

依存パッケージ更新の例:

```
依存パッケージの outdated を確認してほしい。
pnpm の outdated と uv の確認結果をリスト化して、
更新候補を type:chore ラベルで Issue 起票して。
重要パッケージ（FastAPI、SQLModel、React 等）は別 Issue に分ける。
```

ツールチェイン更新の例:

```
mise.toml の latest 指定を解決済みバージョンに固定したい。
現在の `mise list` 出力をベースに更新案を出して、Issue 起票 → PR。
```

### エージェントが進める作業

1. 状況を観察（`pnpm outdated`, `uv tree`, `mise list`, GitHub の Dependabot アラート等）
2. 候補をリスト化して人間に提示（`AskUserQuestion` または対話で）
3. 承認後、`gh issue create` で `type:chore` または `type:docs` ラベル付きの Issue を起票
   - 親 Milestone は紐付けない（本文 Parent 欄は「定常運用」と明記、または省略）
4. 起票後の実装は **ケース 1** のフローに乗る（Issue → ブランチ → PR → `Closes #<N>`）

### 人間が手動で握るポイント

| タイミング | 何をするか |
|---|---|
| 候補リスト提示時 | 一括 PR にするか分けるか判断。**重要パッケージ・破壊的変更を含む更新は別 PR が安全** |
| 起票内容確認時 | 影響範囲（どのパッケージが何に効くか）が記述されているか |
| 更新 PR 作成後 | 重要パッケージは手動で動作確認（dev サーバ起動・基本動作の確認） |
| 大量更新で CI が荒れたとき | 切り戻して 1 件ずつ進めるよう指示 |

### 注意（人間側）

- **単独で大量パッケージを一気に上げない**: 回帰の原因特定が困難になる
- メジャーバージョン更新は ケース 3 の「中規模以上」と同等の慎重さで扱う
- 「とりあえず最新に揃える」を理由に未検証の更新を混ぜない
- 設計マイルストーンに割り込む形でケース 4 を入れる場合、進行中の Milestone 着手を優先するか相談する

---

## レビューフローの運用

エージェントの出した PR は **多段レビュー** で確認する:

1. **CI**（型・lint・テスト） — 機械的検出
2. **AI 自動レビュー**（`/review`、`/ultrareview`、Copilot レビュー等） — 別エージェントが観点違いで見る
3. **人間レビュー** — 上記を踏まえた最終判断

人間が指摘を入れる場合は、コメント本文だけでなく「**判断は AI に委ねる**」「**この方針で対応して**」を明示すると、エージェントの動きが安定する。

詳細: [`.claude/skills/review-flow/SKILL.md`](./.claude/skills/review-flow/SKILL.md)

---

## マイルストーン完了時の振り返り

マイルストーン（M1, M2, …）完了時、人間はエージェントに以下を依頼する:

```
M2 の振り返りジャーナルを docs/journal/YYYY-MM-DD-m2-<topic>.md に書いて。
review-flow SKILL のテンプレに従う。100 行以下。
```

エージェントがドラフトを作る → 人間が見て補強 → コミット。
**コードでわかる「何を作ったか」ではなく「プロセスについて何を学んだか」を書かせる**のがコツ。

---

## 並行作業・クラウドハンドオフ

- 複数セッションを並行で動かす場合は `git worktree` を使う。詳細: [`.claude/skills/git-workflow/SKILL.md`](./.claude/skills/git-workflow/SKILL.md) §Worktree
- 長時間タスク / 独立性の高い実装を Cloud Agent / GitHub Actions に委譲する場合: [`.claude/skills/cloud-handoff/SKILL.md`](./.claude/skills/cloud-handoff/SKILL.md)

人間は「どのタスクをどのエージェントに振るか」の差配だけを担当する。

---

## リポジトリ構成

```
my-aicoding-recipe/
├─ python/mar-api                                # FastAPI API (M2)
├─ typescript/{mar-web,mar-schema,mar-infra}     # フロント / 型 / AWS CDK (M3 以降で作る)
├─ docs/                                         # 要件・設計・ジャーナル
├─ .devcontainer/                                # 隔離環境
├─ .github/                                      # Issue/PR テンプレ、ラベル定義
├─ .claude/skills/                               # エージェント向け SKILL（規約）
├─ scripts/                                      # 運用補助スクリプト（ラベル seed 等）
├─ CLAUDE.md                                     # エージェント向けエントリポイント
└─ README.md                                     # 本ファイル（人間向けエントリポイント）
```

workspace member の置き場所は **`python/{pkg}` / `typescript/{pkg}`** の 2 系統に統一し、パッケージ名には **`mar-` プレフィックス**を付ける規約。詳細: [`docs/design.md` §1.1](./docs/design.md)

## 関連ドキュメント

| ファイル | 役割 |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | エージェントのエントリポイント。読むべき SKILL の索引 |
| [`docs/requirements.md`](./docs/requirements.md) | 要件定義（スコープ・機能・非機能） |
| [`docs/design.md`](./docs/design.md) | 設計（アーキテクチャ・マイルストーン・隔離環境） |
| [`.claude/skills/`](./.claude/skills/) | コーディング規約・Git 規約・レビュー規約・ハンドオフ規約 |
| [`docs/journal/`](./docs/journal/) | 各マイルストーンの振り返り |
