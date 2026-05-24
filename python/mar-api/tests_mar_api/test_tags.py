from fastapi.testclient import TestClient


def test_list_tags_empty(client: TestClient) -> None:
    res = client.get("/api/tags")
    assert res.status_code == 200
    assert res.json() == []


def test_list_tags_returns_distinct_sorted(client: TestClient) -> None:
    client.post("/api/notes", json={"title": "a", "body": "x", "tags": ["work", "urgent"]})
    client.post("/api/notes", json={"title": "b", "body": "x", "tags": ["work", "personal"]})
    client.post("/api/notes", json={"title": "c", "body": "x", "tags": []})

    res = client.get("/api/tags")
    assert res.status_code == 200
    assert res.json() == ["personal", "urgent", "work"]
