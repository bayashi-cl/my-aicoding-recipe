---
name: testing
description: テストを書く・追加するとき (pytest / TypeScript) に従う方針。テスト対象の選び方、DB の扱い、fixture 規約、実行コマンドを含む。
---

# テスト方針

## 基本方針

- **PoC スコープの線引き**: すべてを網羅しない。ハッピーパス（正常系の主要フロー）を最優先にし、テスト工数よりも「動く実証」を取る。
- **実装とテストは同一 Issue / 同一 PR**: テストを後回しにする別 Issue は作らない。機能単位（実装＋テスト）を 1 Issue / 1 PR にまとめる。
- **型チェックとテストは補完関係**: `ty`（mypy 相当）で型エラーを先に潰してからテストを書く。型で防げる誤りはテストに書かない。
- **テストを書かないケース**: 設定値の読み取りのみ、純粋な定数定義、自動生成コード（Alembic マイグレーション等）。

## 何をテストするか

| 優先度 | 対象 | 理由 |
|--------|------|------|
| 高 | API エンドポイントのハッピーパス（CRUD の正常系） | 機能の動作保証として最低限必要 |
| 中 | バリデーションエラー (422)、存在しないリソース (404) | フロントが依存するエラーレスポンスの形式を固定するため |
| 低 | 複雑なビジネスロジック（分岐・計算が多い service 関数） | PoC 段階では省略可。ロジックが育ったら追加 |
| 対象外 | 自動生成型・Alembic マイグレーション・設定読み取り | コストに対して得られる保証が薄い |

## どこにテストを置くか

```
python/mar-api/
├─ src/mar_api/          # プロダクションコード
└─ tests_mar_api/        # テスト (パッケージ名 = tests_<pkg名>)
   ├─ conftest.py        # session / client fixture を定義
   └─ test_<module>.py   # テストファイル (test_ プレフィックス必須)
```

- テストディレクトリ名は `tests_<pkg名>` (アンダースコア区切り)。`tests/` とは名付けない（パッケージ衝突の回避）。
- テストファイル名は `test_<対象モジュール名>.py`。例: `test_notes.py`、`test_health.py`。
- 1テストファイル = 1エンドポイント群（router ファイルに対応させる）。

## DB の扱い

**実 PostgreSQL を使う。モックは使わない。**

開発環境では `docker-compose.yml` で起動している `db` サービスに接続する。テスト用 DB は本番 DB と同じエンジンを使うことで「動く」保証を得る。接続先は `DATABASE_URL`（`Settings.database_url`）で管理し、テスト実行時は別スキーマや別 DB に向けた URL を環境変数で上書きして切り替える。

### テスト間のデータ分離

- fixture でトランザクションを開始し、テスト終了後に **rollback** する（truncate より速く、並列実行にも強い）。
- テスト間で共有すべきデータ（マスタデータ等）が生まれた場合は `scope="session"` fixture で一度だけ投入する。

## fixture / TestClient 規約

`conftest.py` に以下の fixture を定義する（実装例は参考であり、コードに先行するため実際は差異が生じる可能性がある）:

```python
# tests_mar_api/conftest.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from mar_api.main import app
from mar_api.db import get_session
from mar_api.settings import get_settings


@pytest.fixture(scope="session")
def engine():
    settings = get_settings()
    eng = create_engine(settings.database_url)
    SQLModel.metadata.create_all(eng)
    yield eng
    SQLModel.metadata.drop_all(eng)


@pytest.fixture
def session(engine):
    # 外側トランザクションを開き、その中で SAVEPOINT を張る。サービス層が
    # session.commit() を呼ぶたびに SAVEPOINT が解放されてしまうため、
    # after_transaction_end で再度 begin_nested() し、テスト中はずっと
    # SAVEPOINT 内に居続けるようにする (SQLAlchemy 公式の "Joining a
    # Session into an External Transaction" パターン)。最終 rollback() で
    # 全変更がリセットされる。
    connection = engine.connect()
    transaction = connection.begin()
    s = Session(bind=connection)
    s.begin_nested()

    @event.listens_for(s, "after_transaction_end")
    def _restart_savepoint(sess, trans):
        if trans.nested and not trans._parent.nested:
            sess.begin_nested()

    try:
        yield s
    finally:
        s.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(session):
    def _get_session_override():
        yield session

    app.dependency_overrides[get_session] = _get_session_override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- `get_session` を `Depends` で受け取る全エンドポイントは、この override でテスト用セッションに差し替わる。
- `TestClient` は `with` ブロックで使い、lifespan イベント（起動・終了フック）を確実に動かす。
- fixture は `conftest.py` 一箇所にまとめ、テストファイル側では import せず pytest に自動解決させる。

## 実行方法

```bash
# ワークスペースルートから
uv run pytest python/mar-api/tests_mar_api/ -v

# 特定ファイルのみ
uv run pytest python/mar-api/tests_mar_api/test_notes.py -v

# カバレッジ付き (任意。PoC では省略可。事前に pytest-cov を dev 依存に追加すること)
# uv add --dev pytest-cov  # 初回のみ
uv run pytest python/mar-api/tests_mar_api/ --cov=mar_api --cov-report=term-missing
```

- pytest の設定（`testpaths`、`asyncio_mode` 等）が必要になったら `pyproject.toml` の `[tool.pytest.ini_options]` に追加する。今は設定なしで動かす。
- CI（GitHub Actions）への組み込みは今後追加予定。追加時は PostgreSQL を `services` ブロックで起動し、同じ `uv run pytest` コマンドを実行する。

## やってはいけないこと

- **モックで DB を差し替える**: モックでテストが通っても本番 DB との差分（型、制約、クエリの挙動）で本番が落ちる（過去の教訓）。
- **本番 DB（`DATABASE_URL`）への接続**: テスト実行前に接続先を必ず確認する。環境変数で分離すること。
- **テスト間の副作用を放置する**: rollback しないとテストの実行順で結果が変わる。fixture でトランザクションを閉じること。
- **テストコードに過剰な抽象化を持ち込む**: テストは読んでわかることが最優先。DRY より明瞭さを取る。
- **実装コードのコピペでテストデータを作る**: テストデータ（ID・タイムスタンプ等）はハードコードするか factory 関数で生成し、実装コードに依存しない。
