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


def test_list_notes_filter_by_q(client: TestClient) -> None:
    client.post("/api/notes", json={"title": "alpha", "body": "lorem ipsum", "tags": []})
    client.post("/api/notes", json={"title": "beta", "body": "dolor sit", "tags": []})
    client.post("/api/notes", json={"title": "gamma", "body": "amet ipsum", "tags": []})

    res = client.get("/api/notes", params={"q": "ipsum"})
    assert res.status_code == 200
    titles = sorted(n["title"] for n in res.json())
    assert titles == ["alpha", "gamma"]


def test_list_notes_q_matches_title_and_tags(client: TestClient) -> None:
    client.post("/api/notes", json={"title": "rust language", "body": "x", "tags": []})
    client.post("/api/notes", json={"title": "x", "body": "x", "tags": ["rust"]})
    client.post("/api/notes", json={"title": "x", "body": "x", "tags": ["python"]})

    res = client.get("/api/notes", params={"q": "rust"})
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_list_notes_q_no_hit_returns_empty(client: TestClient) -> None:
    client.post("/api/notes", json={"title": "alpha", "body": "lorem", "tags": []})

    res = client.get("/api/notes", params={"q": "nomatch"})
    assert res.status_code == 200
    assert res.json() == []


def test_list_notes_filter_by_tag(client: TestClient) -> None:
    client.post("/api/notes", json={"title": "a", "body": "x", "tags": ["work", "urgent"]})
    client.post("/api/notes", json={"title": "b", "body": "x", "tags": ["work"]})
    client.post("/api/notes", json={"title": "c", "body": "x", "tags": ["personal"]})

    res = client.get("/api/notes", params={"tag": "work"})
    assert res.status_code == 200
    titles = sorted(n["title"] for n in res.json())
    assert titles == ["a", "b"]


def test_list_notes_q_and_tag_are_combined(client: TestClient) -> None:
    client.post("/api/notes", json={"title": "alpha", "body": "lorem", "tags": ["work"]})
    client.post("/api/notes", json={"title": "beta", "body": "lorem", "tags": ["personal"]})
    client.post("/api/notes", json={"title": "gamma", "body": "ipsum", "tags": ["work"]})

    res = client.get("/api/notes", params={"q": "lorem", "tag": "work"})
    assert res.status_code == 200
    titles = [n["title"] for n in res.json()]
    assert titles == ["alpha"]


def test_list_notes_ordered_by_created_at_desc(client: TestClient) -> None:
    # 連続作成で created_at の前後関係が確定する程度の精度はあるという前提
    client.post("/api/notes", json={"title": "first", "body": "x", "tags": []})
    client.post("/api/notes", json={"title": "second", "body": "x", "tags": []})
    client.post("/api/notes", json={"title": "third", "body": "x", "tags": []})

    res = client.get("/api/notes")
    assert res.status_code == 200
    assert [n["title"] for n in res.json()] == ["third", "second", "first"]


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
