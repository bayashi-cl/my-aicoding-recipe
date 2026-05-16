# 2026-05-16 M1: Dev Container 構築

## 何をやったか

- `.devcontainer/`（Dockerfile / devcontainer.json / post-create.sh / .env.example）
- `docker-compose.yml`（workspace + db の2サービス）
- `mise.toml`（uv / pnpm / claude-code を宣言）
- `.vscode/extensions.json`（Biome ほか推奨拡張）
- `.gitignore` の初版
- `docs/design.md` と `CLAUDE.md` を、変更後の方針に合わせて更新

apps/ 配下のコードはまだ作っていない（M2 で着手）。

## うまくいったこと

- 別セッションでまとめられた `tmp/devtool-management.md` を **文書ベースで引き継げた**。プランを書いた後にその文書の存在を知らされたが、衝突点を表で並べて差分を取ることで自然に統合できた。
  → 「**設計上のすり合わせを Markdown でやる**」のは AI 同士・人間との並行作業で十分機能する、というのが本 PoC で確認したかった核の一つ。最小規模ながらこれが確認できた。
- compose 構成（workspace + db のみ、app はプロセス）への変更を **design.md に逆輸入** し、変更履歴節も追加した。設計変更の痕跡を残すルートが定着するかは今後の課題だが、初回は手応えがあった。

## つまずいたこと

- 最初のプラン作成時、技術スタックを確認した後でも「Hono (TypeScript)」と書く誤りをしてしまった（ユーザー選択は FastAPI だった）。
  → 設計初期の確認内容を **memory ではなく conversation 上で何度も参照する** だけだと取りこぼす。SKILL に "確定スタック" を書き出した今後は同種のブレが減るはず。
- 初回ビルド時、`docker-compose.yml` の `env_file: .devcontainer/.env` でエラー。`.env` は `post-create.sh` で生成する想定だったが、compose の検証は post-create より前に走る **鶏卵問題** だった。
  → 非機密のデフォルトを `.env` に置いていたのが筋悪。`environment:` に直接書き、`env_file` は `required: false` で override 用に残す形に修正。「設定の置き場は **必要性のレベルで分ける**（必須=compose、override=env_file）」が学び。
- 2回目のビルドで `mise install` が **パーミッションエラー**。原因は `mise-data` 名前付きボリュームが root 所有で作られていたこと（vscode ユーザでは書き込めない）。ボリュームを廃止して書き込み層に置くことで解決。再ビルド時の再インストールは数秒で許容範囲。
- 同じく `mise install` で `npm:@anthropic-ai/claude-code` が **`No such file or directory`** で失敗。`tmp/devtool-management.md` は「mise が内部で Node を解決するため Node を PATH に追加不要」と書いていたが、**実際の mise は外部 npm を必要としており**、その記述は誤り。さらに本質的に Claude Code は Node.js アプリなので、インストール後の実行にも Node が必須。
  → 戦略ドキュメントの「Node を PATH に置かない」原則を **claude-code 等のグローバル CLI ツールについては緩める** 形で `mise.toml` に `node = "lts"` を追加。プロジェクト Node（apps/web のビルド時）は引き続き pnpm の `devEngines.runtime` で別管理する方針は維持。
- workspace の bind mount が **コンテナ内では root 所有に見える**。原因は **rootless Docker の UID マッピング**: コンテナの root が host bayashi、コンテナの vscode (UID 1000) はホストの sub-uid (100999 等) にマップされる。
  → `remoteUser: root` に変更（rootless Docker では「コンテナの root = ホスト本人」なので UID 整合性が取れる）。Dockerfile も `USER root` で揃え、mise を `/root/` 配下にインストール。

これら 3 件は、いずれも「**抽象的な設計方針が実環境に当たって変わった**」典型例。journal に残すことで、後続のプロジェクトでは初回から避けられる。

## 次に活かすこと

- M2 着手前に、コンテナ内で Verification セクションを実行して **post-create.sh が冪等であること**、**`which node` が空であること** を必ず確認する。
- mise.toml の `latest` 指定は M1 完了後に **実際に解決されたバージョンを書き戻す**。再現性確保のため。
- 設計ドキュメントを変えるたびに「変更履歴」節を伸ばすことを習慣化する。journal と変更履歴の役割分担を整理するのは数ヶ月運用してから。
