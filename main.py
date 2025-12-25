import json
import os
from datetime import datetime, date
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.orm import Session

from db import get_db

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

# ================== HELPERS ==================

def trigger_auto_snapshot(db: Session):
    """
    Captures the full system state (count + actual vehicle records).
    This ensures the 'data' column is never NULL.
    """
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS snapshots (
            id SERIAL PRIMARY KEY,
            snapshot_time TIMESTAMP DEFAULT NOW(),
            records_count INTEGER,
            data TEXT NOT NULL
        )
    """))

    rows = db.execute(text("""
        SELECT 
            v.vehicle_number AS plate,
            z.zone_id AS zone,
            pt.entry_time AS "timeIn",
            vt.type_name AS type
        FROM parking_tickets pt
        JOIN vehicles v ON pt.vehicle_id = v.vehicle_id
        JOIN vehicle_types vt ON v.vehicle_type_id = vt.id
        JOIN parking_zones z ON pt.zone_id = z.zone_id
        WHERE pt.exit_time IS NULL
    """)).mappings().all()

    records = []
    for r in rows:
        item = dict(r)
        if item["timeIn"]:
            item["timeIn"] = item["timeIn"].isoformat()
        records.append(item)

    db.execute(text("""
        INSERT INTO snapshots (records_count, data) 
        VALUES (:count, :data)
    """), {
        "count": len(records), 
        "data": json.dumps(records)
    })

# ================== STARTUP ==================
@app.on_event("startup")
def startup_db_check():
    """Ensure essential tables exist and schema is current on boot."""
    with next(get_db()) as db:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS snapshots (
                id SERIAL PRIMARY KEY,
                snapshot_time TIMESTAMP DEFAULT NOW(),
                records_count INTEGER,
                data TEXT NOT NULL
            )
        """))
        db.commit()

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

# ================== ADMIN: CREATE ZONE ==================
@app.post("/api/admin/zones")
def create_zone(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Creates a new parking zone and its associated vehicle type limits atomically.
    Calculates total capacity automatically.
    """
    try:
        name = payload.get("name")
        limits = payload.get("limits")  # { heavy: int, medium: int, light: int }

        if not name or not limits:
            raise HTTPException(400, "Zone name and vehicle limits are required")

        # Parse and validate numbers
        heavy = max(0, int(limits.get("heavy", 0)))
        medium = max(0, int(limits.get("medium", 0)))
        light = max(0, int(limits.get("light", 0)))
        total = heavy + medium + light

        if total <= 0:
            raise HTTPException(400, "Total capacity must be greater than zero")

        # 1. Generate next sequential ID (Z1, Z2, Z3...)
        zone_no = db.execute(text("""
            SELECT COALESCE(MAX(CAST(SUBSTRING(zone_id, 2) AS INT)), 0) + 1 
            FROM parking_zones
        """)).scalar()
        zone_id = f"Z{zone_no}"

        # 2. Insert main zone record
        db.execute(text("""
            INSERT INTO parking_zones(zone_id, zone_name, total_capacity, current_occupied, status)
            VALUES (:id, :name, :cap, 0, 'ACTIVE')
        """), {
            "id": zone_id,
            "name": name,
            "cap": total
        })

        # 3. Get vehicle type IDs and insert limits
        type_ids = dict(db.execute(
            text("SELECT type_name, id FROM vehicle_types")
        ).fetchall())

        for t_name, max_v in [("Heavy", heavy), ("Medium", medium), ("Light", light)]:
            if t_name in type_ids:
                db.execute(text("""
                    INSERT INTO zone_type_limits(zone_id, vehicle_type_id, max_vehicles, current_count)
                    VALUES (:z, :t, :m, 0)
                """), {
                    "z": zone_id,
                    "t": type_ids[t_name],
                    "m": max_v
                })

        db.commit()
        return {"success": True, "zoneId": zone_id, "totalCapacity": total}

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to create zone: {str(e)}")

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

# ================== VEHICLE SEARCH (SMART LOGIC) ==================
@app.get("/api/search")
def search_vehicle(q: str = Query(...), db: Session = Depends(get_db)):
    """
    Enhanced search that looks for LIVE vehicles first.
    If not found, it checks history to explain if the vehicle already left.
    """
    search_term = q.strip().replace("-", "").replace(" ", "").upper()
    
    # 1. Look for LIVE vehicle (Inside)
    row = db.execute(text("""
        SELECT 
            v.vehicle_number AS vehicle, pt.ticket_code, pt.entry_time, z.zone_name, 'INSIDE' as current_status
        FROM parking_tickets pt
        JOIN vehicles v ON pt.vehicle_id = v.vehicle_id
        JOIN parking_zones z ON pt.zone_id = z.zone_id
        WHERE REPLACE(REPLACE(UPPER(v.vehicle_number), '-', ''), ' ', '') LIKE :q 
          AND pt.exit_time IS NULL
        LIMIT 1
    """), {"q": f"%{search_term}%"}).mappings().first()

    # 2. If not inside, check HISTORY (Exited)
    if not row:
        row = db.execute(text("""
            SELECT 
                v.vehicle_number AS vehicle, pt.ticket_code, pt.entry_time, pt.exit_time, z.zone_name, 'EXITED' as current_status
            FROM parking_tickets pt
            JOIN vehicles v ON pt.vehicle_id = v.vehicle_id
            JOIN parking_zones z ON pt.zone_id = z.zone_id
            WHERE REPLACE(REPLACE(UPPER(v.vehicle_number), '-', ''), ' ', '') LIKE :q 
            ORDER BY pt.exit_time DESC
            LIMIT 1
        """), {"q": f"%{search_term}%"}).mappings().first()

    if not row:
        raise HTTPException(404, "Vehicle record not found")
        
    return {
        "vehicle": row["vehicle"],
        "ticketId": row["ticket_code"],
        "status": row["current_status"],
        "entryTime": row["entry_time"].isoformat() if row["entry_time"] else None,
        "exitTime": row.get("exit_time").isoformat() if row.get("exit_time") else None,
        "zone": row["zone_name"],
        "message": "Vehicle is inside" if row["current_status"] == 'INSIDE' else f"Vehicle exited at {row['exit_time']}"
    }

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

        db.flush() 
        trigger_auto_snapshot(db) 
        db.commit() 

        return {"success": True, "ticket": ticket_code}

    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))

# ================== EXIT VEHICLE ==================
@app.post("/api/exit")
def exit_vehicle(payload: dict = Body(...), db: Session = Depends(get_db)):
    try:
        ticket_code = payload.get("ticket_code") or payload.get("ticketId")
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

        db.flush()
        trigger_auto_snapshot(db)
        db.commit()
        return {"success": True, "message": "Vehicle exited successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))

# ================== REPORTS API ==================
@app.get("/api/reports")
def get_reports(
    zone: Optional[str] = Query(default=None),
    report_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = """
        SELECT
            pt.ticket_code       AS ticketid,
            v.vehicle_number     AS vehicle,
            vt.type_name         AS type,
            z.zone_id             AS zone,
            pt.entry_time         AS entrytime,
            pt.exit_time          AS exittime
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

# ================== SNAPSHOTS ==================

@app.get("/api/snapshots")
def get_snapshots(db: Session = Depends(get_db)):
    try:
        rows = db.execute(text("""
            SELECT id, snapshot_time, records_count AS records, data
            FROM snapshots 
            ORDER BY snapshot_time DESC
            LIMIT 20
        """)).mappings().all()
        
        result = []
        for r in rows:
            item = dict(r)
            if item["data"]:
                item["data"] = json.loads(item["data"])
            result.append(item)
        return result
    except Exception as e:
        return []

@app.post("/api/snapshot")
def create_snapshot(db: Session = Depends(get_db)):
    try:
        trigger_auto_snapshot(db)
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