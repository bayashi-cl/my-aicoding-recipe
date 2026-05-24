from datetime import datetime
from uuid import uuid4

from fastapi.testclient import TestClient


def test_create_note(client: TestClient) -> None:
    res = client.post(
        "/api/notes",
        json={"title": "first", "body": "hello", "tags": ["x"]},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["title"] == "first"
    assert body["body"] == "hello"
    assert body["tags"] == ["x"]
    assert "id" in body
    assert "created_at" in body
    assert "updated_at" in body


def test_list_notes(client: TestClient) -> None:
    client.post("/api/notes", json={"title": "a", "body": "1", "tags": []})
    client.post("/api/notes", json={"title": "b", "body": "2", "tags": []})

    res = client.get("/api/notes")
    assert res.status_code == 200
    notes = res.json()
    # 件数を固定して、SAVEPOINT rollback で他テストのデータが残らないことも担保する
    assert len(notes) == 2
    assert sorted(n["title"] for n in notes) == ["a", "b"]


def test_get_note(client: TestClient) -> None:
    created = client.post("/api/notes", json={"title": "g", "body": "x", "tags": ["k"]}).json()

    res = client.get(f"/api/notes/{created['id']}")
    assert res.status_code == 200
    assert res.json() == created


def test_update_note_partial(client: TestClient) -> None:
    created = client.post(
        "/api/notes",
        json={"title": "orig", "body": "keep-body", "tags": ["keep"]},
    ).json()

    res = client.put(f"/api/notes/{created['id']}", json={"title": "updated"})
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "updated"
    assert body["body"] == "keep-body"
    assert body["tags"] == ["keep"]
    # 文字列比較だと "Z" vs "+00:00" 等の表記揺れで脆いので datetime にパースする
    assert datetime.fromisoformat(body["updated_at"]) >= datetime.fromisoformat(
        created["updated_at"]
    )


def test_delete_note(client: TestClient) -> None:
    created = client.post("/api/notes", json={"title": "d", "body": "d", "tags": []}).json()

    res = client.delete(f"/api/notes/{created['id']}")
    assert res.status_code == 204

    res = client.get(f"/api/notes/{created['id']}")
    assert res.status_code == 404


def test_get_note_not_found(client: TestClient) -> None:
    missing = uuid4()
    res = client.get(f"/api/notes/{missing}")
    assert res.status_code == 404
    assert res.json() == {"detail": f"Note {missing} not found"}


def test_create_note_validation(client: TestClient) -> None:
    res = client.post("/api/notes", json={"title": "", "body": "x", "tags": []})
    assert res.status_code == 422


def test_update_note_explicit_null_is_ignored(client: TestClient) -> None:
    # NOT NULL カラムに client が null を送ってきても 500 にせず、
    # 未送信と同じ「変更なし」として扱う
    created = client.post(
        "/api/notes", json={"title": "keep-title", "body": "keep-body", "tags": ["keep"]}
    ).json()

    res = client.put(f"/api/notes/{created['id']}", json={"body": None, "tags": None})
    assert res.status_code == 200
    body = res.json()
    assert body["body"] == "keep-body"
    assert body["tags"] == ["keep"]
