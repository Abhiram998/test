from fastapi import FastAPI, HTTPException, Depends, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, date
from sqlalchemy import text
from sqlalchemy.orm import Session
from db import get_db
import os

# ================== ENV ==================
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

print("🚀 FastAPI booting (Railway-safe mode)")

# ================== APP ==================
app = FastAPI(title="Nilakkal Parking Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================== ROOT & HEALTH ==================
@app.get("/api")
def root():
    return {"status": "ok"}

@app.get("/api/health")
def health():
    return {"status": "ok", "db_configured": DATABASE_URL is not None}

# ================== LIVE DASHBOARD ==================
@app.get("/api/zones")
def get_zones(db: Session = Depends(get_db)):
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
        WHERE UPPER(z.status) = 'ACTIVE'
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

# ================== LIVE VEHICLES ==================
@app.get("/api/zones/{zone_id}/vehicles")
def get_zone_vehicles(zone_id: str, db: Session = Depends(get_db)):
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
    return rows

# ================== ENTER VEHICLE ==================
@app.post("/api/enter")
def enter_vehicle(payload: dict = Body(...), db: Session = Depends(get_db)):
    try:
        vehicle = payload.get("vehicle")
        vtype = payload.get("type", "light").capitalize()
        zone = payload.get("zone")

        if not vehicle:
            raise HTTPException(400, "Vehicle number required")
        
        z = db.execute(text("""
            SELECT * FROM parking_zones
            WHERE status='ACTIVE'
              AND current_occupied < total_capacity
              AND (:zone IS NULL OR zone_id = :zone)
            ORDER BY zone_id
            LIMIT 1
        """), {"zone": zone}).mappings().first()

        if not z:
            raise HTTPException(400, "No available zone")

        vt = db.execute(text("""
            SELECT id FROM vehicle_types WHERE type_name=:t
        """), {"t": vtype}).scalar()

        vehicle_id = db.execute(text("""
            INSERT INTO vehicles(vehicle_number, vehicle_type_id)
            VALUES (:n, :t) RETURNING vehicle_id
        """), {"n": vehicle, "t": vt}).scalar()

        ticket_code = f"TKT-{int(datetime.now().timestamp())}"

        db.execute(text("""
            INSERT INTO parking_tickets(ticket_code, vehicle_id, zone_id, entry_time, status)
            VALUES (:c, :v, :z, NOW(), 'ACTIVE')
        """), {"c": ticket_code, "v": vehicle_id, "z": z["zone_id"]})

        db.execute(text("""
            UPDATE parking_zones SET current_occupied = current_occupied + 1 WHERE zone_id=:z
        """), {"z": z["zone_id"]})

        db.execute(text("""
            UPDATE zone_type_limits SET current_count = current_count + 1
            WHERE zone_id=:z AND vehicle_type_id=:t
        """), {"z": z["zone_id"], "t": vt})

        db.commit()
        return {"success": True, "ticket": ticket_code}

    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))

# ================== EXIT VEHICLE ==================
@app.post("/api/exit")
def exit_vehicle(payload: dict = Body(...), db: Session = Depends(get_db)):
    try:
        ticket_code = payload.get("ticket_code")
        if not ticket_code:
            raise HTTPException(400, "Ticket code required")

        ticket = db.execute(text("""
            SELECT pt.*, v.vehicle_type_id 
            FROM parking_tickets pt
            JOIN vehicles v ON pt.vehicle_id = v.vehicle_id
            WHERE pt.ticket_code = :code AND pt.exit_time IS NULL
        """), {"code": ticket_code}).mappings().first()

        if not ticket:
            raise HTTPException(404, "Active ticket not found")

        db.execute(text("""
            UPDATE parking_tickets
            SET exit_time = NOW(), status = 'EXITED'
            WHERE ticket_code = :code
        """), {"code": ticket_code})

        db.execute(text("""
            UPDATE parking_zones 
            SET current_occupied = current_occupied - 1 
            WHERE zone_id = :z
        """), {"z": ticket["zone_id"]})

        db.execute(text("""
            UPDATE zone_type_limits 
            SET current_count = current_count - 1
            WHERE zone_id = :z AND vehicle_type_id = :t
        """), {"z": ticket["zone_id"], "t": ticket["vehicle_type_id"]})

        db.commit()
        return {"success": True, "message": "Vehicle exited successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))

# ================== REPORTS API ==================
@app.get("/api/reports")
def get_reports(
    zone: str | None = Query(default=None),
    report_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = """
        SELECT
            pt.ticket_code       AS ticketid,
            v.vehicle_number     AS vehicle,
            vt.type_name         AS type,
            z.zone_id            AS zone,
            pt.entry_time        AS entrytime,
            pt.exit_time         AS exittime
        FROM parking_tickets pt
        JOIN vehicles v ON pt.vehicle_id = v.vehicle_id
        JOIN vehicle_types vt ON v.vehicle_type_id = vt.id
        JOIN parking_zones z ON pt.zone_id = z.zone_id
        WHERE 1=1
    """
    params = {}

    if zone and zone not in ["All Zones", "all"]:
        query += " AND z.zone_id = :zone"
        params["zone"] = zone

    if report_date:
        query += """ 
            AND pt.entry_time < (:report_date + INTERVAL '1 day')
            AND (pt.exit_time IS NULL OR pt.exit_time >= :report_date)
        """
        params["report_date"] = report_date

    query += " ORDER BY pt.entry_time DESC"
    rows = db.execute(text(query), params).mappings().all()

    return [
        {
            "ticketId": r["ticketid"],
            "vehicle": r["vehicle"],
            "type": r["type"],
            "zone": r["zone"],
            "entryTime": r["entrytime"].isoformat() if r["entrytime"] else None,
            "exitTime": r["exittime"].isoformat() if r["exittime"] else None,
            "status": "INSIDE" if r["exittime"] is None else "EXITED",
        }
        for r in rows
    ]

# ================== SNAPSHOTS (BACKUP LOGIC) ==================

@app.get("/api/snapshots")
def get_snapshots(db: Session = Depends(get_db)):
    """ Fetches the history of snapshots for the Backup UI counter """
    try:
        # We wrap in a try block in case the snapshots table doesn't exist yet
        rows = db.execute(text("""
            SELECT snapshot_time, records_count AS records 
            FROM snapshots 
            ORDER BY snapshot_time DESC
        """)).mappings().all()
        return rows
    except Exception:
        # Return empty list so frontend doesn't show red error if table is missing
        return []

@app.post("/api/snapshot")
def create_snapshot(db: Session = Depends(get_db)):
    """ Saves a new snapshot of current 'INSIDE' vehicles """
    try:
        # 1. Ensure table exists
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS snapshots (
                id SERIAL PRIMARY KEY,
                snapshot_time TIMESTAMP DEFAULT NOW(),
                records_count INTEGER
            )
        """))

        # 2. Count current vehicles inside
        count = db.execute(text("""
            SELECT COUNT(*) FROM parking_tickets WHERE exit_time IS NULL
        """)).scalar()

        # 3. Insert metadata
        db.execute(text("""
            INSERT INTO snapshots (records_count) VALUES (:count)
        """), {"count": count})

        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))

# ================== STATIC FRONTEND ==================
BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "dist" / "public"

if PUBLIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=PUBLIC_DIR / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    def serve_root():
        return FileResponse(PUBLIC_DIR / "index.html")

    @app.get("/{path:path}", include_in_schema=False)
    def serve_spa(path: str):
        return FileResponse(PUBLIC_DIR / "index.html")