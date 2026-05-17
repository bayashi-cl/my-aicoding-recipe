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
