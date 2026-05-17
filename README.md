# my-aicoding-recipe

AI コーディングの「型」を確立するための PoC。題材として Notes アプリ（メモ CRUD + 検索）を作りつつ、
**再利用可能な開発フロー**そのものを成果物として整備する。

- 何をやっている PoC か: [`docs/requirements.md`](./docs/requirements.md) / [`docs/design.md`](./docs/design.md)
- AI 向けの指示: [`CLAUDE.md`](./CLAUDE.md) と [`.claude/skills/`](./.claude/skills/)
- 過去の作業ジャーナル: [`docs/journal/`](./docs/journal/)

このドキュメントは **人間向け** のエントリポイント。日常運用で何をどの順でやるかを書く。

---

## クイックスタート

前提: VS Code + Dev Containers 拡張、Docker、`mise`（ホスト側）。

1. リポジトリを clone し、VS Code で開く
2. コマンドパレット → `Dev Containers: Reopen in Container`
3. 初回起動時に `.devcontainer/post-create.sh` が走り `mise install` まで終わる
4. **`gh auth login`** をコンテナ内で実行（AI 側ではトークンを扱わない方針）
5. DB を起動: `docker compose up -d db`

アプリ実装は M2 以降。骨格が出来てからは `apps/api`, `apps/web` の起動コマンドを各 README に追記する。

---

## AI 開発の進め方

このリポジトリは **GitHub Issue を作業単位とし、PR でレビューする** 運用に乗っている。
AI セッションも人間も同じフローで動く。

### 前提となるラベル設計

| ラベル | 用途 |
|---|---|
| `type:milestone` | 設計書 §6 のマイルストーン (M2〜M7)。**親 Issue**。複数 PR にまたがる |
| `type:task` | PR 1 件分の作業単位。**子 Issue**。Milestone から派生 |
| `type:bug` `type:chore` `type:docs` | バグ / 雑務 / ドキュメント |
| `area:api` `area:web` `area:infra` `area:devcontainer` `area:docs` | スコープ |
| `status:blocked` | 外部要因で停止中（通常は Open/Closed で表現） |

親子関係は **慣習** で取る:

- Task Issue の本文 1 行目に `Parent: #<milestone>`
- Milestone Issue の本文に `- [ ] #<task>` のチェックリスト
  → `Closes #<task>` を含む PR をマージすると GitHub が自動でチェックを入れる

---

### ケース 1: 割り振られたタスク / マイルストーンを実装する

**典型シナリオ**: 「#9 (M2-3 CRUD エンドポイント) を進めて」と頼まれた、もしくは作業中の Task Issue が決まっている。

```bash
# 1. Issue 内容と親 Milestone の文脈を確認
gh issue view 9
gh issue view 1     # 親 Milestone (Parent 行から番号を拾う)

# 2. ブランチを切る。命名は <type>/<short-topic>（.claude/skills/git-workflow/SKILL.md §ブランチ運用）
git switch -c feat/notes-crud

# 3. 実装 → 1 コミット = 1 意味単位
git add ... && git commit -m "..."

# 4. push & PR 作成。.github/PULL_REQUEST_TEMPLATE.md がテンプレートとして自動表示される
git push -u origin feat/notes-crud
gh pr create --base main
```

**PR 本文の必須項目**（`.github/PULL_REQUEST_TEMPLATE.md` の枠を埋める）:

- `Closes #9` を必ず書く → マージ時に Task Issue が閉じ、親 Milestone のチェックボックスが自動で埋まる
- What / Why / Test plan は省略しない

**スコープ管理**:

- Task Issue の「何をやるか」から外れる作業を混ぜない。脇道は **ケース 3** に従って別 Issue 化する
- 差分が ~400 行を大きく超えそうなら、サブタスクへ分割を検討（人間に相談）

**レビュー後の対応**: [`.claude/skills/review-flow/SKILL.md`](./.claude/skills/review-flow/SKILL.md) を参照。指摘は採用 / 不採用 / 別 Issue のいずれかを明示し、沈黙させない。

---

### ケース 2: 次にやるべきタスクの判断が必要

**典型シナリオ**: 何から手を付けるか自分で決める必要がある。前のタスクが終わって次が無い状態。

```bash
# 1. 未完の Milestone を確認
gh issue list --label "type:milestone" --state open

# 2. 進行中の Milestone を選び、子 Task の状態を見る
gh issue view 1  # M2 の例。サブタスクのチェックリストを確認

# 3. 未着手の Task Issue があるか
gh issue list --label "type:task" --state open

# 4. 既存 Task が無ければ、Milestone のスコープを子 Task に分解する起票から始める
gh issue create  # template: task.yml を選択。本文 1 行目に Parent: #<milestone>
```

**判断基準**:

- **進行中の Milestone を優先**: 一度に複数の Milestone を並行で進めない（PoC 規模では摩擦の方が大きい）
- **Milestone 表 ([`docs/design.md §6`](./docs/design.md)) の順序を尊重**: M2 → M3 → M4 → M5 → M6 → M7 が基本順。理由なくスキップしない
- **未着手 Task が無い & 既存 Milestone が未完** な場合、Milestone のサブタスク分解を起票するところから着手する
- **すべての Milestone が完了 or 判断に迷う**: 人間に「次にやるべきはこれで良いか」を質問する。**勝手に新 Milestone を始めない**

**やってはいけないこと**:

- 「ついでに」を理由にスコープを混ぜる
- Milestone Issue 本文を勝手に大幅編集する（サブタスクのリンク追加は OK、ゴールの書き換えは要確認）

---

### ケース 3: コードの問題 / 改善点を発見したが、タスクに無い

**典型シナリオ**: 別タスクの実装中にバグ・タイポ・設計上の違和感を見つけた。

**原則: その場で直さず、まず Issue 化する**。今の PR にスコープを混ぜると差分が膨らみレビューが劣化する。

```bash
# 1. 問題の性質に応じてテンプレを選んで起票
gh issue create  # bug.yml: 不具合 / task.yml: 改善・リファクタ / 自由記述: その他

# 2. 起票内容の目安（題名は短く具体に）
#    - title: "bug: notes API が空 tags で 500 を返す"
#    - body: 再現手順、想定挙動、関連コード行
#    - labels: type:bug or type:task + area:<該当>

# 3. 緊急度を判定
```

**緊急度の判定フロー**:

| 状況 | 対応 |
|---|---|
| 修正が **現タスクの完了条件に必要** （依存している） | Issue を起票しつつ現 PR で対応。PR 本文に `Also addresses #<新Issue>` |
| 数行で済む軽微な修正（タイポ・コメント） | Issue 起票 + 別ブランチ・別 PR で即対応 |
| 中規模以上の修正（インターフェイス変更・複数ファイル） | Issue 起票のみ。優先度判断は人間に委ねる |
| 既存 Milestone のスコープを大きく超える | Issue 起票時に新規 Milestone を提案。本文に「親候補: 新規 Milestone 提案」と明記し、人間判断を仰ぐ |

**判断に迷ったら**:

- 「これは現タスクのスコープ内か？」を最初に問う。1 秒で答えが出ないなら **スコープ外** と判断して別 Issue 化する
- 「直さないと現タスクが壊れる」が無い限り、原則は分離

**やってはいけないこと**:

- 関連しない修正を「ついでに」現 PR に混ぜる（[`.claude/skills/coding-style/SKILL.md`](./.claude/skills/coding-style/SKILL.md) §共通方針）
- 大規模な改修を Issue 起票なしで勝手に始める

---

## レビューと振り返り

- レビューは多段（CI → AI 自動 → 人間）。詳細は [`.claude/skills/review-flow/SKILL.md`](./.claude/skills/review-flow/SKILL.md)
- マイルストーン完了時はジャーナルを `docs/journal/YYYY-MM-DD-<topic>.md` に残す（1 ファイル 100 行以下、プロセスについて書く）
- 同じ指摘を 3 回受けたら SKILL or memory に昇格させる（review-flow SKILL §フィードバックの昇格ルール）

## 並行作業・クラウドハンドオフ

- 複数セッションで並行で動かす場合は `git worktree`。[`.claude/skills/git-workflow/SKILL.md`](./.claude/skills/git-workflow/SKILL.md) §Worktree
- 長時間タスク / 独立性の高い実装は Cloud Agent / GitHub Actions へハンドオフ。[`.claude/skills/cloud-handoff/SKILL.md`](./.claude/skills/cloud-handoff/SKILL.md)

## リポジトリ構成

```
my-aicoding-recipe/
├─ apps/{web,api}        # フロント / API（M2 以降で作る）
├─ packages/schema       # 生成型ファイル
├─ infra/                # AWS CDK（M5）
├─ docs/                 # 要件・設計・ジャーナル
├─ .devcontainer/        # 隔離環境
├─ .github/              # Issue/PR テンプレ、ラベル定義
├─ .claude/skills/       # AI 向け SKILL（規約）
├─ scripts/              # 運用補助スクリプト（ラベル seed 等）
├─ CLAUDE.md             # AI 向けエントリポイント
└─ README.md             # 本ファイル（人間向けエントリポイント）
```

## 関連ドキュメント

| ファイル | 役割 |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | AI セッションのエントリポイント。読むべき SKILL の索引 |
| [`docs/requirements.md`](./docs/requirements.md) | 要件定義（スコープ・機能・非機能） |
| [`docs/design.md`](./docs/design.md) | 設計（アーキテクチャ・マイルストーン・隔離環境） |
| [`.claude/skills/`](./.claude/skills/) | コーディング規約・Git 規約・レビュー規約・ハンドオフ規約 |
| [`docs/journal/`](./docs/journal/) | 各マイルストーンの振り返り |
