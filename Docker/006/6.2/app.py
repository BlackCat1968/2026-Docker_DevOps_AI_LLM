# app.py
from fastapi import FastAPI

app = FastAPI(title="玄貓示範服務")

VERSION = "1.0.0"


@app.get("/")
def read_root() -> dict:
    return {"message": "容器化成功", "version": VERSION}


@app.get("/healthz")
def health() -> dict:
    return {"status": "ok"}