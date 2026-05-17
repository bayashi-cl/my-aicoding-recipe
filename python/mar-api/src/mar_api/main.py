from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="mar-api")


class HealthResponse(BaseModel):
    ok: bool


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(ok=True)
