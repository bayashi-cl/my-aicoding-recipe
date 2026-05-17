from fastapi import FastAPI

app = FastAPI(title="mar-api")


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    return {"ok": True}
