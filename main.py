from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

app = FastAPI(title="Nilakkal Parking Backend")

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- API ROUTES ----------------
@app.get("/api/health")
def health():
    return {"ok": True}

@app.get("/api/zones")
def get_zones():
    return [
        {"id": "P1", "capacity": 200, "occupied": 120},
        {"id": "P2", "capacity": 150, "occupied": 90},
    ]

# ---------------- FRONTEND SERVING ----------------
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "dist" / "public"

if FRONTEND_DIR.exists():

    # Serve static assets
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIR / "assets"),
        name="assets",
    )

    # Serve React app for all routes
    @app.get("/{full_path:path}")
    def serve_react_app(full_path: str):
        return FileResponse(FRONTEND_DIR / "index.html")

else:
    @app.get("/")
    def frontend_missing():
        return {"error": "Frontend not built"}
