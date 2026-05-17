---
name: git-workflow
description: ブランチ作成、worktree、コミット、PR作成など Git 操作を行うときに従う運用ルール。並行作業セットアップ時も参照する。
---

# Gitワークフロー規約

## Issue 駆動フロー

すべての作業は GitHub Issue を起点にする（要件 A-02）。

### Issue の種別

| 種別 | ラベル | 用途 |
|------|--------|------|
| Milestone | `type:milestone` | 設計書 §6 のマイルストーン (M2〜M7 等)。複数 PR にまたがる親 Issue |
| Task | `type:task` | PR 1 件分の作業単位。親 Milestone から派生 |
| Bug | `type:bug` | 不具合報告 |

Milestone と Task の区別は **ラベル** で取る（GitHub の Milestone 機能は使わない）。

### 親子関係の表現

GitHub に親子 Issue の組み込み機能はないため、慣習で取る:

- **Task 本文の Parent 欄** に親 Milestone Issue 番号 (`#N`) を記載
- **Milestone 本文のサブタスク欄** に子 Task のチェックリスト (`- [ ] #M`) を並べる
  → `Closes #M` を含む PR をマージすると GitHub が自動でチェックを入れる

### 作業開始時の手順

1. 親 Milestone Issue を確認 (`gh issue view <N>`)
2. 対応する Task Issue が無ければ起票 (`gh issue create --template task.yml`)
3. ブランチを切る (`<type>/<short-topic>`、後述)
4. 実装 → コミット
5. PR を出し、本文の `Closes #<task>` で Task Issue を閉じる
6. PR description テンプレ (`.github/PULL_REQUEST_TEMPLATE.md`) が初期表示されるので、それを埋める

### gh CLI が未認証なら

Issue・PR を扱う前に `gh auth login` を実行する（人間が認証。AI 側でトークンは扱わない）。

---

## ブランチ運用

- `main` への直接コミット禁止。すべての変更はブランチ → PR を経由する。
- ブランチ名は `<type>/<short-topic>` 形式:
  - `feat/notes-search`, `fix/tag-filter`, `chore/devcontainer`, `docs/journal-m1`
- 1ブランチ = 1関心事。混ぜたくなったら2つに分ける。

## コミット

- 1コミット = 1意味単位。動作が壊れた途中状態をコミットしない（WIP コミットは例外、PRマージ前に整理する）。
- コミットメッセージは命令形・現在形・英語または日本語で統一（最初の数コミットで決める）。
- AI が作るコミットは必ず `Co-Authored-By: Claude` のフッタを付ける。
- `--amend` は **直前の自分のコミットを直したいときだけ**。push 済みコミットは原則 amend しない。
- `git push --force` 禁止（ユーザーが明示的に許可した場合のみ）。必要なら `--force-with-lease` を検討。

## Worktree（並行作業時）

複数セッションで並行作業する場合、worktree を使ってブランチごとに独立したディレクトリで作業する。

```bash
# 例: ../wt-feature-search/ にブランチ feat/notes-search の worktree を作る
git worktree add ../wt-feature-search -b feat/notes-search
```

- worktree のルートは `../wt-<topic>/` に置く（リポジトリ親ディレクトリ）。
- worktree 内では Dev Container を別ポートで立てる（DBポートの衝突に注意）。
- 作業中の worktree は `WORKTREES.md` に追記して可視化する:
  ```
  | path | branch | 担当 | 状態 |
  |------|--------|------|------|
  | ../wt-feature-search | feat/notes-search | Cloud Agent | 実装中 |
  ```
- 作業完了後は `git worktree remove ../wt-<topic>` で片付ける（ブランチは別途マージ判断）。

## Pull Request

### PR の単位

- 1 PR = 1 Issue。スコープが膨らんだら別 Issue に切り出す。
- レビューしやすいサイズ（差分 ~400行以内）を目安にする。超える場合は分割を検討。

### PR description テンプレート

実体は [`.github/PULL_REQUEST_TEMPLATE.md`](../../../.github/PULL_REQUEST_TEMPLATE.md) を参照。
PR 作成時に初期表示されるので、それを埋める。テンプレートの構造を変えたい場合は SKILL ではなくテンプレ本体を編集する（二重管理を避けるため）。

### マージ前チェック

- [ ] CI が通っている
- [ ] セルフレビュー or `/review` を実施した
- [ ] PR description が埋まっている
- [ ] スコープから外れた変更を含んでいない

## やってはいけないこと（Git）

- `main` への直接 push
- `git push --force`（許可された場合のみ）
- 不要なファイル（`.env`, 認証情報, ビルド成果物）のコミット
- 関係ないファイルの一括フォーマット
- 履歴の改変（`reset --hard` で他人の作業を消す等）
