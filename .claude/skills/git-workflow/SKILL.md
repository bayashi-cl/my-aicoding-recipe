---
name: git-workflow
description: ブランチ作成、worktree、コミット、PR作成など Git 操作を行うときに従う運用ルール。並行作業セットアップ時も参照する。
---

# Gitワークフロー規約

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

```markdown
## 関連 Issue
- Closes #<num>

## What
- <変更点を箇条書きで3-5行>

## Why
- <なぜこの変更が必要か。背景・代替案を却下した理由>

## Open Questions
- <未確定事項。なければ「なし」>

## Test plan
- [ ] <手動確認の手順 or 通したテスト>
```

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
