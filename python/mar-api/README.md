# mar-api

Notes アプリの FastAPI サーバ。uv workspace member。

## ローカル起動

リポジトリルートから:

```bash
uv run --package mar-api uvicorn mar_api.main:app --reload
```

確認:

```bash
curl localhost:8000/health
# => {"ok":true}
```

`DATABASE_URL` は Dev Container の docker-compose が `postgresql+psycopg://app:app@db:5432/notes` を環境変数で注入する。

## テスト

dev データを保護するため、テストは別 DB (`notes_test`) に対して実行する。初回のみ作成 (devcontainer 内から):

```bash
PGPASSWORD=app pgcli -h db -U app -d postgres \
  --init-command "CREATE DATABASE notes_test;" --ping
```

`DATABASE_URL` を上書きして pytest を実行:

```bash
DATABASE_URL=postgresql+psycopg://app:app@db:5432/notes_test \
  uv run pytest python/mar-api/tests_mar_api/ -v
```

テスト fixture が `SQLModel.metadata.create_all` でスキーマを張り、各テストは SAVEPOINT 内で実行されて終了時に rollback される (testing SKILL `.claude/skills/testing/SKILL.md` 参照)。
