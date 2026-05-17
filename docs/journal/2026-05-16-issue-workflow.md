# 2026-05-16 M1.5: Issue/PR 運用基盤

## 何をやったか

- `gh` CLI を `mise.toml` に追加（`github:cli/cli` バックエンド、`exe = "gh"` で実行ファイル名を明示）
- `.devcontainer/post-create.sh` に `gh auth status` ベースの認証案内を追加（未認証なら `gh auth login` を促すメッセージ）
- `.github/` を新設:
  - `ISSUE_TEMPLATE/{milestone,task,bug,config}.yml`
  - `PULL_REQUEST_TEMPLATE.md`
  - `labels.yml`（ラベル定義のソース）
- `scripts/seed-labels.sh` で `labels.yml` を `gh label create --force` に流す冪等スクリプトを用意
- `.claude/skills/git-workflow/SKILL.md` に「Issue 駆動フロー」節を追加。PR description テンプレは `.github/PULL_REQUEST_TEMPLATE.md` 参照に変更し二重管理を解消
- M2〜M7 の Milestone Issue と M2-1〜M2-4 の Task Issue を起票

このマイルストーンの目的は **設計書上の A-02/04/05 を実運用に乗せる** こと。アプリコードは一切書いていない。

## うまくいったこと

- ラベル設計を「`type:`（種別）/`area:`（スコープ）/`status:`（例外状態）」の 3 軸に絞れた。設計の最初に「`status:` は最小限。Open/Closed で表現できる状態は GitHub 任せ」と決めたことで、ラベルが 11 個に収まった。**最初に「足し算ではなく引き算で決める」と全体が軽くなる** という気づき。
- PR description テンプレの二重管理を最初の一手で解消できた。SKILL 側に本文を書いて `.github/PULL_REQUEST_TEMPLATE.md` にも書く構成は、PR 作成時に GitHub が自動で後者を表示してしまうので前者が陳腐化する。SKILL からは参照だけにした。
- mise の `github:` バックエンドが思った以上に使い勝手が良かった。`ubi:` は実行時に deprecation warning が出たので `github:` に切り替え。GitHub Release から直接バイナリ取得 + 署名検証まで走る。CLI ツールを mise に集約する方針が今後も伸ばせそう。

## つまずいたこと

- 最初 `ubi:cli/cli` で書いたら `mise install` 時に「ubi バックエンドは 2027.1.0 で削除」という deprecation 警告。すぐ `github:` バックエンドに切り替えた。**mise の最新ドキュメント** をもう少し早く確認するべきだった。
- Dev Container に Python が入っていないため YAML パースで一瞬詰まった（uv はあるが Python 単体は無い）。`yq` も未導入。結局 `awk` で十分パースできたので外部ツール追加は見送り。**「依存を増やす前に手元の awk/jq で何ができるか考える」** を運用方針として持っておく。
- ubi backend の警告は post-create.sh の `mise install` 実行時に1回出るだけ。ユーザーが見る場面なので、deprecation 警告を放置せず即時切り替えで正解だった。

## 次に活かすこと

- M2-1 着手前に **ホストまたはコンテナ内で `gh auth login` を済ませる**。AI 側ではトークンを触らない方針なので、認証が抜けると後続作業が全部止まる。
- Milestone Issue の「サブタスク」チェックリストは GitHub が `Closes #` で自動更新する。これに気づくと **進捗の手動転記が不要** になる。M2 タスクで実際に効くか観察する。
- ラベル設計はこれで打ち止めにせず、運用 2〜3 PR 後にレビューする。`status:blocked` が一度も使われないなら削る、`scope:`（粒度違い）が要るなら足す、など。
