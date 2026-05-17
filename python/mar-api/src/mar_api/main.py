from fastapi import FastAPI

app = FastAPI(title="mar-api")


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}
