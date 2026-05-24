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
    titles = [n["title"] for n in res.json()]
    assert {"a", "b"} <= set(titles)


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
    assert body["updated_at"] >= created["updated_at"]


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
