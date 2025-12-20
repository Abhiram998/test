from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime
import os

# ================== ENV ==================
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

print("🚀 FastAPI booting (Railway-safe mode)")
if DATABASE_URL:
    print("✅ DATABASE_URL detected")
else:
    print("⚠️ DATABASE_URL missing (healthcheck will still pass)")

# ================== DB (LAZY CONNECTION) ==================
engine = None
SessionLocal = None

def get_db():
    global engine, SessionLocal
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="Database not configured")

    if engine is None:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
        SessionLocal = sessionmaker(bind=engine)

    return SessionLocal()

# ================== APP ==================
app = FastAPI(title="Nilakkal Parking Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # OK for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================== HEALTH ==================
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "db_configured": DATABASE_URL is not None
    }

# ================== LIVE DASHBOARD ==================
@app.get("/api/zones")
def get_zones():
    db = get_db()
    try:
        rows = db.execute(text("""
            SELECT
                z.zone_id,
                z.zone_name,
                z.total_capacity,
                z.current_occupied,
                vt.type_name,
                zl.max_vehicles,
                zl.current_count
            FROM parking_zones z
            JOIN zone_type_limits zl ON zl.zone_id = z.zone_id
            JOIN vehicle_types vt ON vt.id = zl.vehicle_type_id
            WHERE z.status = 'ACTIVE'
            ORDER BY z.zone_id
        """)).fetchall()

        zones = {}

        for r in rows:
            if r.zone_id not in zones:
                zones[r.zone_id] = {
                    "id": r.zone_id,
                    "name": r.zone_name,
                    "capacity": r.total_capacity,
                    "occupied": r.current_occupied,
                    "limits": {"light": 0, "medium": 0, "heavy": 0},
                    "stats": {"light": 0, "medium": 0, "heavy": 0},
                }

            vtype = r.type_name.lower()
            zones[r.zone_id]["limits"][vtype] = r.max_vehicles
            zones[r.zone_id]["stats"][vtype] = r.current_count

        return list(zones.values())

    finally:
        db.close()

# ================== LIVE VEHICLES IN A ZONE ==================
@app.get("/api/zones/{zone_id}/vehicles")
def get_zone_vehicles(zone_id: str):
    db = get_db()
    try:
        rows = db.execute(text("""
            SELECT
                v.vehicle_number AS number,
                vt.type_name AS type,
                pt.ticket_code AS "ticketId",
                pt.entry_time AS "entryTime"
            FROM parking_tickets pt
            JOIN vehicles v ON pt.vehicle_id = v.vehicle_id
            JOIN vehicle_types vt ON v.vehicle_type_id = vt.id
            WHERE pt.zone_id = :zone_id
              AND pt.exit_time IS NULL
            ORDER BY pt.entry_time DESC
        """), {"zone_id": zone_id}).mappings().all()

        return [
            {
                "number": r["number"],
                "type": r["type"],
                "ticketId": r["ticketId"],
                "entryTime": r["entryTime"],
            }
            for r in rows
        ]

    finally:
        db.close()

# ================== SNAPSHOT API ==================
@app.post("/api/snapshot")
def save_snapshot():
    db = get_db()
    try:
        rows = db.execute(text("""
            SELECT
                z.zone_id,
                z.zone_name,
                z.total_capacity,
                z.current_occupied,
                SUM(CASE WHEN vt.type_name = 'Heavy' THEN zl.current_count ELSE 0 END) AS heavy,
                SUM(CASE WHEN vt.type_name = 'Medium' THEN zl.current_count ELSE 0 END) AS medium,
                SUM(CASE WHEN vt.type_name = 'Light' THEN zl.current_count ELSE 0 END) AS light
            FROM parking_zones z
            JOIN zone_type_limits zl ON zl.zone_id = z.zone_id
            JOIN vehicle_types vt ON vt.id = zl.vehicle_type_id
            WHERE z.status = 'ACTIVE'
            GROUP BY z.zone_id, z.zone_name, z.total_capacity, z.current_occupied
        """)).mappings().all()

        for r in rows:
            db.execute(text("""
                INSERT INTO parking_snapshots
                (snapshot_time, zone_id, zone_name, capacity, occupied, heavy, medium, light)
                VALUES (:time, :zone_id, :zone_name, :capacity, :occupied, :heavy, :medium, :light)
            """), {
                "time": datetime.now(),
                "zone_id": r["zone_id"],
                "zone_name": r["zone_name"],
                "capacity": r["total_capacity"],
                "occupied": r["current_occupied"],
                "heavy": r["heavy"],
                "medium": r["medium"],
                "light": r["light"],
            })

        db.commit()
        return {"ok": True, "zones_saved": len(rows)}

    finally:
        db.close()

# ================== REPORT API ==================
@app.get("/api/reports")
def get_reports(date: str, zone: str = "ALL"):
    db = get_db()
    try:
        query = """
            SELECT *
            FROM parking_snapshots
            WHERE DATE(snapshot_time) = :date
        """
        params = {"date": date}

        if zone != "ALL":
            query += " AND zone_id = :zone"
            params["zone"] = zone

        return db.execute(text(query), params).mappings().all()

    finally:
        db.close()

# ================== FRONTEND (SPA) ==================
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "dist" / "public"

if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")

    @app.get("/{path:path}")
    def serve_frontend(path: str):
        return FileResponse(FRONTEND_DIR / "index.html")
