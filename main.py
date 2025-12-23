from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime
from db import get_db
import os

# ================== ENV ==================
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

print("🚀 FastAPI booting (Railway-safe mode)")
if DATABASE_URL:
    print("✅ DATABASE_URL detected")
else:
    print("⚠️ DATABASE_URL missing (healthcheck will still pass)")

# ================== APP ==================
app = FastAPI(title="Nilakkal Parking Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # OK for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ================== ROOT (RAILWAY HEALTH SAFETY) ==================
@app.get("/api")
def root():
    return {"status": "ok"}

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

# ================== ENTER VEHICLE (GENERATE TICKET) ==================
from fastapi import Body

@app.post("/api/enter")
def enter_vehicle(payload: dict = Body(...)):
    db = get_db()
    try:
        vehicle = payload.get("vehicle")
        vtype_raw = payload.get("type", "light")
        zone = payload.get("zone")
        slot = payload.get("slot")

        if not vehicle:
            raise HTTPException(status_code=400, detail="Vehicle number required")

        # 1️⃣ Normalize type
        vtype = vtype_raw.capitalize()
        if vtype not in ("Light", "Medium", "Heavy"):
            raise HTTPException(status_code=400, detail="Invalid vehicle type")

        # 2️⃣ Find zone
        if zone:
            z = db.execute(text("""
                SELECT *
                FROM parking_zones
                WHERE zone_id = :zone
                  AND status = 'ACTIVE'
                  AND current_occupied < total_capacity
            """), {"zone": zone}).mappings().first()
        else:
            z = db.execute(text("""
                SELECT *
                FROM parking_zones
                WHERE status = 'ACTIVE'
                  AND current_occupied < total_capacity
                ORDER BY zone_id
                LIMIT 1
            """)).mappings().first()

        if not z:
            raise HTTPException(status_code=400, detail="No available zone")

        zone_id = z["zone_id"]

        # 3️⃣ Vehicle type ID
        vt = db.execute(text("""
            SELECT id FROM vehicle_types WHERE type_name = :type
        """), {"type": vtype}).mappings().first()

        if not vt:
            raise HTTPException(status_code=400, detail="Vehicle type not found")

        vehicle_type_id = vt["id"]

        # 4️⃣ Insert vehicle
        vehicle_id = db.execute(text("""
            INSERT INTO vehicles (vehicle_number, vehicle_type_id)
            VALUES (:number, :type)
            RETURNING vehicle_id
        """), {
            "number": vehicle,
            "type": vehicle_type_id
        }).scalar()

        # 5️⃣ Create ticket (MANDATORY columns only)
        ticket_code = f"TKT-{int(datetime.now().timestamp())}"

        db.execute(text("""
            INSERT INTO parking_tickets
            (ticket_code, vehicle_id, zone_id, entry_time, status)
            VALUES (:code, :vehicle_id, :zone_id, NOW(), 'ACTIVE')
        """), {
            "code": ticket_code,
            "vehicle_id": vehicle_id,
            "zone_id": zone_id
        })

        # 6️⃣ UPDATE ZONE OCCUPANCY (LIVE STATE)
        db.execute(text("""
            UPDATE parking_zones
            SET current_occupied = current_occupied + 1
            WHERE zone_id = :zone_id
        """), {"zone_id": zone_id})

        # 7️⃣ UPDATE VEHICLE TYPE COUNT (LIVE STATE)
        db.execute(text("""
            UPDATE zone_type_limits
            SET current_count = current_count + 1
            WHERE zone_id = :zone_id
              AND vehicle_type_id = :vt_id
        """), {
            "zone_id": zone_id,
            "vt_id": vehicle_type_id
        })

        # ✅ ONE COMMIT — ALL OR NOTHING
        db.commit()

        return {
            "success": True,
            "ticket": ticket_code,
            "zone": z["zone_name"],
            "vehicle": vehicle
        }

    except Exception as e:
        db.rollback()
        print("❌ ENTER FAILED:", e)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()

#search vechile...................................................................................

@app.get("/api/search/vehicle")
def search_vehicle(number: str):
    db = get_db()
    try:
        row = db.execute(text("""
            SELECT
                v.vehicle_number,
                vt.type_name,
                z.zone_id,
                z.zone_name,
                pt.ticket_code,
                pt.entry_time
            FROM parking_tickets pt
            JOIN vehicles v ON v.vehicle_id = pt.vehicle_id
            JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
            JOIN parking_zones z ON z.zone_id = pt.zone_id
            WHERE v.vehicle_number ILIKE :number
              AND pt.exit_time IS NULL
            LIMIT 1
        """), {"number": f"%{number}%"}).mappings().first()

        if not row:
            raise HTTPException(status_code=404, detail="Vehicle not found")

        return row
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

# ================== LIST SNAPSHOTS (BACKUP PAGE) ==================
@app.get("/api/snapshots")
def list_snapshots():
    db = get_db()
    try:
        rows = db.execute(text("""
            SELECT
                DATE(snapshot_time) AS snapshot_date,
                snapshot_time,
                COUNT(*) AS records
            FROM parking_snapshots
            GROUP BY snapshot_time
            ORDER BY snapshot_time DESC
        """)).mappings().all()

        return [
            {
                "snapshot_time": r["snapshot_time"],
                "records": r["records"]
            }
            for r in rows
        ]

    finally:
        db.close()

# ================== QUICK RECOVERY ==================
@app.post("/api/restore/latest")
def restore_latest_snapshot():
    db = get_db()
    try:
        snapshot = db.execute(text("""
            SELECT *
            FROM parking_snapshots
            ORDER BY snapshot_time DESC
            LIMIT 1
        """)).mappings().first()

        if not snapshot:
            raise HTTPException(status_code=404, detail="No snapshot found")

        # Restore zone occupancy
        db.execute(text("""
            UPDATE parking_zones
            SET current_occupied = :occupied
            WHERE zone_id = :zone_id
        """), {
            "occupied": snapshot["occupied"],
            "zone_id": snapshot["zone_id"]
        })

        # Restore vehicle type counts
        db.execute(text("""
            UPDATE zone_type_limits
            SET current_count = CASE
                WHEN vehicle_type_id = (SELECT id FROM vehicle_types WHERE type_name='Heavy') THEN :heavy
                WHEN vehicle_type_id = (SELECT id FROM vehicle_types WHERE type_name='Medium') THEN :medium
                WHEN vehicle_type_id = (SELECT id FROM vehicle_types WHERE type_name='Light') THEN :light
            END
            WHERE zone_id = :zone_id
        """), {
            "zone_id": snapshot["zone_id"],
            "heavy": snapshot["heavy"],
            "medium": snapshot["medium"],
            "light": snapshot["light"]
        })

        db.commit()
        return {"ok": True, "restored_from": snapshot["snapshot_time"]}

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

    # ================== MONTHLY REPORT ==================
@app.get("/api/reports/monthly")
def get_monthly_report(year: int, month: int, zone: str = "ALL"):
    db = get_db()
    try:
        query = """
            SELECT
                zone_id,
                zone_name,
                SUM(heavy) AS heavy,
                SUM(medium) AS medium,
                SUM(light) AS light,
                AVG(occupied)::INT AS avg_occupied,
                MAX(capacity) AS capacity
            FROM parking_snapshots
            WHERE EXTRACT(YEAR FROM snapshot_time) = :year
              AND EXTRACT(MONTH FROM snapshot_time) = :month
        """
        params = {"year": year, "month": month}

        if zone != "ALL":
            query += " AND zone_id = :zone"
            params["zone"] = zone

        query += " GROUP BY zone_id, zone_name ORDER BY zone_id"

        return db.execute(text(query), params).mappings().all()
    finally:
        db.close()


# ================== YEARLY REPORT ==================
@app.get("/api/reports/yearly")
def get_yearly_report(year: int, zone: str = "ALL"):
    db = get_db()
    try:
        query = """
            SELECT
                zone_id,
                zone_name,
                SUM(heavy) AS heavy,
                SUM(medium) AS medium,
                SUM(light) AS light,
                AVG(occupied)::INT AS avg_occupied,
                MAX(capacity) AS capacity
            FROM parking_snapshots
            WHERE EXTRACT(YEAR FROM snapshot_time) = :year
        """
        params = {"year": year}

        if zone != "ALL":
            query += " AND zone_id = :zone"
            params["zone"] = zone

        query += " GROUP BY zone_id, zone_name ORDER BY zone_id"

        return db.execute(text(query), params).mappings().all()
    finally:
        db.close()
    

# ================== FRONTEND (SPA) ==================
BASE_DIR = Path(__file__).resolve().parent

DIST_DIR = BASE_DIR / "dist"
PUBLIC_DIR = DIST_DIR / "public"
INDEX_HTML = PUBLIC_DIR / "index.html"

if PUBLIC_DIR.exists():
    # Serve static assets
    app.mount(
        "/assets",
        StaticFiles(directory=PUBLIC_DIR / "assets"),
        name="assets",
    )

    # Serve index.html at root
    @app.get("/", include_in_schema=False)
    def serve_root():
        return FileResponse(INDEX_HTML)

    # Catch-all for React/Vite routing (must be LAST)
    @app.get("/{path:path}", include_in_schema=False)
    def serve_spa(path: str):
        return FileResponse(INDEX_HTML)
