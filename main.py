from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
from db import get_db
import os

# ================== ENV ==================
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

print("🚀 FastAPI booting (Railway-safe mode)")
if DATABASE_URL:
    print("✅ DATABASE_URL detected")
else:
    print("⚠️ DATABASE_URL missing")

# ================== APP ==================
app = FastAPI(title="Nilakkal Parking Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================== ROOT ==================
@app.get("/api")
def root():
    return {"status": "ok"}

# ================== HEALTH ==================
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
        if vtype not in ("Light", "Medium", "Heavy"):
            raise HTTPException(400, "Invalid vehicle type")

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
            UPDATE parking_zones
            SET current_occupied = current_occupied + 1
            WHERE zone_id=:z
        """), {"z": z["zone_id"]})

        db.execute(text("""
            UPDATE zone_type_limits
            SET current_count = current_count + 1
            WHERE zone_id=:z AND vehicle_type_id=:t
        """), {"z": z["zone_id"], "t": vt})

        db.commit()
        print("✅ COMMITTED:", ticket_code)

        return {"success": True, "ticket": ticket_code}

    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    
# ================================
# REPORTS API (FINAL)
# ================================
from datetime import date
from fastapi import Query

@app.get("/api/reports")
def get_reports(
    zone: str | None = Query(default=None),
    report_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Returns parking reports:
    - Current vehicles (exit_time IS NULL)
    - Past vehicles (exit_time IS NOT NULL)
    - Filterable by zone & date
    """

    query = """
        SELECT
            pt.ticket_code        AS ticketId,
            v.vehicle_number     AS vehicle,
            vt.type_name         AS type,
            z.zone_id            AS zone,
            pt.entry_time        AS entryTime,
            pt.exit_time         AS exitTime
        FROM parking_tickets pt
        JOIN vehicles v ON pt.vehicle_id = v.vehicle_id
        JOIN vehicle_types vt ON v.vehicle_type_id = vt.id
        JOIN parking_zones z ON pt.zone_id = z.zone_id
        WHERE 1=1
    """

    params = {}

    if zone and zone != "All Zones":
        query += " AND z.zone_id = :zone"
        params["zone"] = zone

    if report_date:
        query += " AND DATE(pt.entry_time) = :report_date"
        params["report_date"] = report_date

    query += " ORDER BY pt.entry_time DESC"

    rows = db.execute(text(query), params).mappings().all()

    # 🔥 Convert datetime → ISO string (IMPORTANT)
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

# ================== STATIC FRONTEND ==================
BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "dist" / "public"
INDEX_HTML = PUBLIC_DIR / "index.html"

if PUBLIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=PUBLIC_DIR / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    def serve_root():
        return FileResponse(INDEX_HTML)

    @app.get("/{path:path}", include_in_schema=False)
    def serve_spa(path: str):
        return FileResponse(INDEX_HTML)
