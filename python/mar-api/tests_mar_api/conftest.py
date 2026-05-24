from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from mar_api.db import get_session
from mar_api.main import app
from mar_api.settings import get_settings
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine


@pytest.fixture(scope="session")
def engine() -> Generator[Engine]:
    eng = create_engine(get_settings().database_url)
    SQLModel.metadata.create_all(eng)
    yield eng
    SQLModel.metadata.drop_all(eng)


@pytest.fixture
def session(engine: Engine) -> Generator[Session]:
    # 外側トランザクション + SAVEPOINT で、サービス層の commit() を受けても
    # 最終 rollback で全変更が消える (testing SKILL / SQLAlchemy 公式 "Joining
    # a Session into an External Transaction" パターン)。
    # commit() のたびに SAVEPOINT が解放されてしまうため、after_transaction_end
    # で再 begin_nested し、テスト中はずっと SAVEPOINT 内に居続けるようにする。
    connection = engine.connect()
    transaction = connection.begin()
    s = Session(bind=connection)
    s.begin_nested()

    @event.listens_for(s, "after_transaction_end")
    def _restart_savepoint(sess: Session, trans: object) -> None:
        if trans.nested and not trans._parent.nested:  # ty: ignore[unresolved-attribute]
            sess.begin_nested()

    try:
        yield s
    finally:
        s.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(session: Session) -> Generator[TestClient]:
    def _override() -> Generator[Session]:
        yield session

    app.dependency_overrides[get_session] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
