import json
import os
from datetime import datetime, date
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.orm import Session

from db import get_db

# =================================================================
# ENVIRONMENT & INITIALIZATION
# =================================================================
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

print("🚀 FastAPI booting (Railway-safe mode)")
print("🛠️ System: Nilakkal Parking Management")

# =================================================================
# FASTAPI APP CONFIGURATION
# =================================================================
app = FastAPI(
    title="Nilakkal Parking Backend",
    description="Backend API for managing parking zones, vehicle entries, exits, and reporting.",
    version="1.2.0"
)

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =================================================================
# HELPERS & SYSTEM UTILITIES
# =================================================================

def trigger_auto_snapshot(db: Session):
    """
    Captures the full system state (count + actual vehicle records).
    This ensures the 'data' column is never NULL and provides a point-in-time
    reference for ground staff and administrators.
    """
    # Ensure the snapshots table exists before attempting an insert
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS snapshots (
            id SERIAL PRIMARY KEY,
            snapshot_time TIMESTAMP DEFAULT NOW(),
            records_count INTEGER,
            data TEXT NOT NULL
        )
    """))

    # Select all vehicles currently inside (exit_time is NULL)
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
            # Convert datetime objects to ISO strings for JSON serialization
            item["timeIn"] = item["timeIn"].isoformat()
        records.append(item)

    # Persist the snapshot to the database
    db.execute(text("""
        INSERT INTO snapshots (records_count, data) 
        VALUES (:count, :data)
    """), {
        "count": len(records), 
        "data": json.dumps(records)
    })

# =================================================================
# STARTUP EVENT HANDLERS
# =================================================================

@app.on_event("startup")
def startup_db_check():
    """
    Core system initialization. This ensures that essential tables exist
    and that the vehicle types (Heavy, Medium, Light) are seeded if the
    database is fresh or has been cleared.
    """
    print("📋 Performing Startup Database Check...")
    with next(get_db()) as db:

        db.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))

        # 1. Create Snapshots table if missing
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS snapshots (
                id SERIAL PRIMARY KEY,
                snapshot_time TIMESTAMP DEFAULT NOW(),
                records_count INTEGER,
                data TEXT NOT NULL
            )
        """))

        # 1.1 Create officers table
        db.execute(text("""
CREATE TABLE IF NOT EXISTS officers (
    officer_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    badge_number TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'OFFICER',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
)
        """))

        
        # 2. Ensure vehicle types exist for zone creation logic
        # This prevents 'Foreign Key' or 'Mapping' errors during zone setup.
        db.execute(text("""
            INSERT INTO vehicle_types (type_name)
            SELECT unnest(ARRAY['Heavy', 'Medium', 'Light'])
            WHERE NOT EXISTS (SELECT 1 FROM vehicle_types LIMIT 1)
        """))
        
        db.commit()
        print("✅ Startup Check Complete. Tables verified and Seeded.")

# =================================================================
# ROOT, HEALTH, & DIAGNOSTICS
# =================================================================

@app.get("/api", tags=["General"])
def root():
    """Returns the basic service status."""
    return {
        "status": "ok", 
        "service": "Nilakkal Parking Admin API",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/health", tags=["General"])
def health():
    """Diagnostic endpoint to check database connectivity configuration."""
    return {
        "status": "ok", 
        "db_configured": DATABASE_URL is not None,
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "production")
    }

# =================================================================
# LIVE DASHBOARD & ZONE MANAGEMENT (FRONTEND WRAPPERS)
# =================================================================

@app.get("/api/zones", tags=["Dashboard"])
def get_zones(db: Session = Depends(get_db)):
    """
    Fetches all active parking zones with their real-time occupancy
    and type-specific limits (Heavy/Medium/Light).
    """
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
        ORDER BY z.created_at ASC
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

# 🟢 FIX: Wrapper for frontend Add Parking Button
@app.post("/api/zones", tags=["Dashboard"])
def create_zone_public(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Direct bridge for frontend 'Add Parking' button which calls /api/zones.
    Routes the request to the main administrative creation logic.
    """
    return create_zone(payload, db)

# 🟢 FIX: Wrapper for frontend Edit Zone
@app.put("/api/zones/{zone_id}", tags=["Dashboard"])
def update_zone_public(
    zone_id: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Direct bridge for frontend 'Edit' functionality on the zone table.
    Ensures compatibility with standard REST patterns.
    """
    return update_zone(zone_id, payload, db)

# 🟢 FIX: Wrapper for frontend Delete Zone
@app.delete("/api/zones/{zone_id}", tags=["Dashboard"])
def delete_zone_public(
    zone_id: str,
    db: Session = Depends(get_db)
):
    """
    Direct bridge for frontend 'Delete' functionality.
    Forwards the request to the soft-delete administrative logic.
    """
    return delete_zone_admin(zone_id, db)

# =================================================================
# ADMIN: CORE ZONE BUSINESS LOGIC
# =================================================================

@app.post("/api/admin/zones", tags=["Admin"])
def create_zone(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Creates a new parking zone and its associated vehicle type limits atomically.
    Calculates total capacity automatically from the provided limits.
    """
    try:
        name = payload.get("name")
        limits = payload.get("limits")  # Expects: { heavy: int, medium: int, light: int }

        if not name or not limits:
            raise HTTPException(400, "Zone name and vehicle limits are required")

        # Parse and validate numbers safely
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

        # 3. Get vehicle type IDs from DB and insert limits
        type_ids_rows = db.execute(text("SELECT type_name, id FROM vehicle_types")).fetchall()
        type_ids = {r.type_name: r.id for r in type_ids_rows}

        if not type_ids:
            raise Exception("Critical: vehicle_types table is empty. Cannot map limits.")

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
        print(f"✅ Created Zone {zone_id} with capacity {total}")
        return {"success": True, "zoneId": zone_id, "totalCapacity": total, "name": name}

    except Exception as e:
        db.rollback()
        print(f"❌ Zone Creation Failed: {str(e)}")
        raise HTTPException(500, f"Failed to create zone: {str(e)}")

@app.put("/api/admin/zones/{zone_id}", tags=["Admin"])
def update_zone(
    zone_id: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Updates an existing zone's configuration. Includes logic to prevent
    reducing capacity below the current number of vehicles parked.
    """
    try:
        name = payload.get("name")
        limits = payload.get("limits")

        if not name or not limits:
            raise HTTPException(400, "Zone name and limits required")

        # Fetch existing zone data
        zone = db.execute(text("""
            SELECT * FROM parking_zones WHERE zone_id = :z AND status='ACTIVE'
        """), {"z": zone_id}).mappings().first()

        if not zone:
            raise HTTPException(404, "Zone not found or inactive")

        # Fetch current occupancy counts per type
        rows = db.execute(text("""
            SELECT vt.type_name, zl.current_count
            FROM zone_type_limits zl
            JOIN vehicle_types vt ON zl.vehicle_type_id = vt.id
            WHERE zl.zone_id = :z
        """), {"z": zone_id}).fetchall()

        current_counts = {r.type_name.lower(): r.current_count for r in rows}

        heavy = int(limits.get("heavy", 0))
        medium = int(limits.get("medium", 0))
        light = int(limits.get("light", 0))

        # SAFETY CHECK: ❌ Prevent reducing below active vehicles
        if heavy < current_counts.get("heavy", 0) \
           or medium < current_counts.get("medium", 0) \
           or light < current_counts.get("light", 0):
            raise HTTPException(
                400,
                "Cannot reduce capacity below current parked vehicles in this zone"
            )

        total_capacity = heavy + medium + light

        # Update core zone record
        db.execute(text("""
            UPDATE parking_zones
            SET zone_name = :name,
                total_capacity = :cap
            WHERE zone_id = :z
        """), {
            "name": name,
            "cap": total_capacity,
            "z": zone_id
        })

        # Update specific limits for each vehicle type
        for t_name, max_v in [("Heavy", heavy), ("Medium", medium), ("Light", light)]:
            db.execute(text("""
                UPDATE zone_type_limits
                SET max_vehicles = :m
                WHERE zone_id = :z
                  AND vehicle_type_id = (
                      SELECT id FROM vehicle_types WHERE type_name = :t
                  )
            """), {
                "m": max_v,
                "z": zone_id,
                "t": t_name
            })

        db.commit()
        return {"success": True, "message": f"Zone {zone_id} updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Database error during update: {str(e)}")

@app.delete("/api/admin/zones/{zone_id}", tags=["Admin"])
def delete_zone_admin(zone_id: str, db: Session = Depends(get_db)):
    """
    Deactivates a zone (Soft Delete).
    Fails if there are still vehicles parked inside.
    """
    try:
        zone = db.execute(text("""
            SELECT current_occupied FROM parking_zones
            WHERE zone_id = :z AND status='ACTIVE'
        """), {"z": zone_id}).scalar()

        if zone is None:
            raise HTTPException(404, "Zone not found")

        if zone > 0:
            raise HTTPException(
                400,
                "Access Denied: Cannot delete zone while vehicles are currently parked"
            )

        # Soft delete: change status so historical data is preserved
        db.execute(text("""
            UPDATE parking_zones
            SET status = 'INACTIVE'
            WHERE zone_id = :z
        """), {"z": zone_id})

        db.commit()
        return {"success": True, "message": f"Zone {zone_id} marked as inactive"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Database error during deletion: {str(e)}")
    

# =================================================================
# ADMIN: OFFICER MANAGEMENT
# =================================================================

# =================================================================
# ADMIN AUTH: LOGIN
# =================================================================

@app.post("/api/admin/login", tags=["Admin"])
def admin_login(payload: dict = Body(...), db: Session = Depends(get_db)):
    email = payload.get("email")
    password = payload.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    try:
        officer = db.execute(text("""
            SELECT
                officer_id,
                name,
                badge_number,
                email,
                role
            FROM officers
            WHERE email = :email
              AND password = crypt(:password, password)
              AND is_active = TRUE
            LIMIT 1
        """), {
            "email": email,
            "password": password
        }).mappings().first()

        if not officer:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        return {
            "success": True,
            "user": {
                "id": officer["officer_id"],
                "name": officer["name"],
                "policeId": officer["badge_number"],
                "email": officer["email"],
                "role": officer["role"]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/admin/officers", tags=["Admin"])
def register_officer(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Registers a new parking officer.
    Expected payload (frontend format):
    {
        name: string,
        policeId: string,
        email: string,
        password: string
    }
    """

    name = payload.get("name")
    police_id = payload.get("policeId")
    email = payload.get("email")
    password = payload.get("password")

    # 🔐 Basic validation
    if not name or not police_id or not email or not password:
        raise HTTPException(
            status_code=400,
            detail="name, policeId, email, and password are required"
        )

    try:
        # 🔒 Store password safely (simple hash for now)
        hashed_password = db.execute(
            text("SELECT crypt(:p, gen_salt('bf'))"),
            {"p": password}
        ).scalar()

        db.execute(text("""
            INSERT INTO officers (
                name,
                badge_number,
                email,
                password,
                role,
                is_active
            )
            VALUES (
                :name,
                :badge,
                :email,
                :password,
                'OFFICER',
                TRUE
            )
        """), {
            "name": name,
            "badge": police_id,
            "email": email,
            "password": hashed_password
        })

        db.commit()
        return {
            "success": True,
            "message": "Officer registered successfully"
        }

    except Exception as e:
        db.rollback()

        # Duplicate police ID or email
        if "unique" in str(e).lower():
            raise HTTPException(
                status_code=400,
                detail="Officer with this Police ID or Email already exists"
            )

        raise HTTPException(500, str(e))


@app.get("/api/admin/officers", tags=["Admin"])
def list_officers(db: Session = Depends(get_db)):
    """
    Returns all registered officers (safe fields only).
    """
    rows = db.execute(text("""
        SELECT
            officer_id,
            name,
            badge_number AS "policeId",
            email,
            role,
            is_active,
            created_at
        FROM officers
        ORDER BY created_at DESC
    """)).mappings().all()

    return rows

# =================================================================
# VEHICLE OPERATIONS (ENTER, EXIT, SEARCH)
# =================================================================

@app.get("/api/zones/{zone_id}/vehicles", tags=["Vehicles"])
def get_zone_vehicles(zone_id: str, db: Session = Depends(get_db)):
    """Returns a list of all vehicles currently parked in a specific zone."""
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

@app.get("/api/search", tags=["Vehicles"])
def search_vehicle(q: str = Query(...), db: Session = Depends(get_db)):
    """
    Enhanced search that looks for LIVE vehicles first.
    If not found, it checks history to explain if the vehicle already left.
    Uses regex-like cleaning to match plates regardless of formatting.
    """
    search_term = q.strip().replace("-", "").replace(" ", "").upper()
    
    # 1. Look for LIVE vehicle (Currently Inside)
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

    # 2. If not inside, check HISTORY (Recently Exited)
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
        raise HTTPException(404, "Vehicle record not found in live or historical data")
        
    return {
        "vehicle": row["vehicle"],
        "ticketId": row["ticket_code"],
        "status": row["current_status"],
        "entryTime": row["entry_time"].isoformat() if row["entry_time"] else None,
        "exitTime": row.get("exit_time").isoformat() if row.get("exit_time") else None,
        "zone": row["zone_name"],
        "message": "Vehicle is inside" if row["current_status"] == 'INSIDE' else f"Vehicle exited at {row['exit_time']}"
    }

@app.post("/api/enter", tags=["Operations"])
def enter_vehicle(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Registers a vehicle entry, assigns it to a zone, and triggers a snapshot."""
    try:
        vehicle = payload.get("vehicle")
        vtype = payload.get("type", "light").capitalize()
        zone = payload.get("zone")

        if not vehicle:
            raise HTTPException(400, "Vehicle number required for entry")
        
        # Determine target zone (automatic or requested)
        z = db.execute(text("""
            SELECT * FROM parking_zones
            WHERE status='ACTIVE'
              AND current_occupied < total_capacity
              AND (:zone IS NULL OR zone_id = :zone)
            ORDER BY created_at ASC
            LIMIT 1
        """), {"zone": zone}).mappings().first()

        if not z:
            raise HTTPException(400, "Capacity Alert: No available spots in selected zone")

        vt = db.execute(text("""
            SELECT id FROM vehicle_types WHERE type_name=:t
        """), {"t": vtype}).scalar()

        # Insert vehicle details
        vehicle_id = db.execute(text("""
            INSERT INTO vehicles(vehicle_number, vehicle_type_id)
            VALUES (:n, :t) RETURNING vehicle_id
        """), {"n": vehicle, "t": vt}).scalar()

        ticket_code = f"TKT-{int(datetime.now().timestamp())}"

        # Create active ticket
        db.execute(text("""
            INSERT INTO parking_tickets(ticket_code, vehicle_id, zone_id, entry_time, status)
            VALUES (:c, :v, :z, NOW(), 'ACTIVE')
        """), {"c": ticket_code, "v": vehicle_id, "z": z["zone_id"]})

        # Update occupancy counters
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

        return {"success": True, "ticket": ticket_code, "zone": z["zone_name"]}

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Entry Error: {str(e)}")

@app.post("/api/exit", tags=["Operations"])
def exit_vehicle(payload: dict = Body(...), db: Session = Depends(get_db)):
    """Processes a vehicle exit, frees up space, and triggers a snapshot."""
    try:
        ticket_code = payload.get("ticket_code") or payload.get("ticketId")
        if not ticket_code:
            raise HTTPException(400, "Valid Ticket code is required for exit")

        ticket = db.execute(text("""
            SELECT pt.*, v.vehicle_type_id 
            FROM parking_tickets pt
            JOIN vehicles v ON pt.vehicle_id = v.vehicle_id
            WHERE pt.ticket_code = :code AND pt.exit_time IS NULL
        """), {"code": ticket_code}).mappings().first()

        if not ticket:
            raise HTTPException(404, "Active ticket not found. Vehicle may have already exited.")

        # Update ticket status
        db.execute(text("""
            UPDATE parking_tickets
            SET exit_time = NOW(), status = 'EXITED'
            WHERE ticket_code = :code
        """), {"code": ticket_code})

        # Free up occupancy counters
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
        return {"success": True, "message": "Vehicle exited successfully and spot freed"}

    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Exit Error: {str(e)}")

# =================================================================
# REPORTS & ANALYTICS
# =================================================================

@app.get("/api/reports", tags=["Reporting"])
def get_reports(
    zone: Optional[str] = Query(default=None),
    report_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    """Generates detailed reports for specific zones or dates."""
    query = """
        SELECT
            pt.ticket_code       AS ticketid,
            v.vehicle_number     AS vehicle,
            vt.type_name         AS type,
            z.zone_id            AS zone,
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

@app.get("/api/predictions", tags=["Forecast"])
def get_predictions(db: Session = Depends(get_db)):

    # -------------------------------------------------
    # 1️⃣ Past 7 days peak occupancy (from snapshots)
    # -------------------------------------------------
    trend_rows = db.execute(text("""
        SELECT
            DATE(snapshot_time) AS day,
            MAX(records_count) AS peak
        FROM snapshots
        WHERE snapshot_time >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(snapshot_time)
        ORDER BY day
    """)).mappings().all()

    total_capacity = db.execute(text("""
        SELECT COALESCE(SUM(total_capacity), 1)
        FROM parking_zones
        WHERE status='ACTIVE'
    """)).scalar()

    past7 = []
    for r in trend_rows:
        past7.append({
            "day": r["day"].strftime("%a"),
            "occupancy": round((r["peak"] / total_capacity) * 100)
        })

    # -------------------------------------------------
    # 2️⃣ Trend direction (increase / decrease)
    # -------------------------------------------------
    if len(past7) >= 2:
        trend_delta = past7[-1]["occupancy"] - past7[0]["occupancy"]
    else:
        trend_delta = 0

    # Normalize trend to 0 → 1 range
    trend_factor = min(max(trend_delta / 20, 0), 1)

    # -------------------------------------------------
    # 3️⃣ Live occupancy pressure
    # -------------------------------------------------
    live_occupied = db.execute(text("""
        SELECT COALESCE(SUM(current_occupied), 0)
        FROM parking_zones
        WHERE status='ACTIVE'
    """)).scalar()

    live_ratio = live_occupied / total_capacity

    # -------------------------------------------------
    # 4️⃣ Historical peak pressure
    # -------------------------------------------------
    peak_ratio = max(
        (d["occupancy"] / 100 for d in past7),
        default=0
    )

    # -------------------------------------------------
    # 5️⃣ FINAL PROBABILITY (Weighted Model)
    # -------------------------------------------------
    probability = round(
        (peak_ratio * 50) +      # history impact
        (trend_factor * 30) +    # rising/falling trend
        (live_ratio * 20)        # current live load
    )

    probability = min(max(probability, 0), 100)

    # -------------------------------------------------
    # 6️⃣ Hourly curve for tomorrow (frontend graph)
    # -------------------------------------------------
    hourly = []
    base = probability * 0.4
    peak = probability

    for h in range(6):
        hourly.append({
            "time": f"{4 + h * 4}:00",
            "probability": round(
                base + (peak - base) * (h / 5)
            )
        })

    # -------------------------------------------------
    # 7️⃣ Zone-wise probability
    # -------------------------------------------------
    zone_rows = db.execute(text("""
        SELECT zone_id, total_capacity, current_occupied
        FROM parking_zones
        WHERE status='ACTIVE'
        ORDER BY CAST(SUBSTRING(zone_id, 2) AS INT)
    """)).mappings().all()

    zones = []
    for z in zone_rows:
        zone_ratio = z["current_occupied"] / max(z["total_capacity"], 1)
        zones.append({
            "zone": z["zone_id"],
            "probability": round(
                (zone_ratio * 60) + (probability * 0.4)
            )
        })

    # -------------------------------------------------
    # ✅ FINAL RESPONSE (SINGLE RETURN)
    # -------------------------------------------------
    return {
        "tomorrow": {
            "probability": probability,
            "confidence": (
                "HIGH" if probability > 70
                else "MEDIUM" if probability > 40
                else "LOW"
            ),
            "message": (
                "High congestion expected"
                if probability > 70
                else "Moderate traffic expected"
                if probability > 40
                else "Low congestion expected"
            )
        },
        "hourly": hourly,
        "past7Days": past7,
        "zones": zones
    }

# =================================================================
# SNAPSHOT HISTORY
# =================================================================

@app.get("/api/snapshots", tags=["Diagnostics"])
def get_snapshots(db: Session = Depends(get_db)):
    """Retrieves the last 20 automated snapshots for integrity checks."""
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
    except Exception:
        return []

@app.post("/api/snapshot", tags=["Diagnostics"])
def create_snapshot(db: Session = Depends(get_db)):
    """Manually triggers a system-wide record snapshot."""
    try:
        trigger_auto_snapshot(db)
        db.commit()
        return {"success": True, "message": "Manual snapshot captured"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))

# =================================================================
# STATIC FRONTEND DELIVERY (SPA SUPPORT)
# =================================================================
BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "dist" / "public"

if PUBLIC_DIR.exists():
    print(f"📁 Serving static files from: {PUBLIC_DIR}")
    app.mount("/assets", StaticFiles(directory=PUBLIC_DIR / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    def serve_root():
        """Serves the primary index file for the Dashboard."""
        return FileResponse(PUBLIC_DIR / "index.html")

    @app.get("/{path:path}", include_in_schema=False)
    def serve_spa(path: str):
        """Redirects all non-API routes to index.html to support SPA routing."""
        # Check if the requested path is an API route, if not, serve index.html
        if path.startswith("api"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        return FileResponse(PUBLIC_DIR / "index.html")
else:
    print("⚠️ Static files directory 'dist/public' not found. API-only mode active.")

# Final note for developer maintenance:
# This main.py acts as the central hub. All SQL logic is kept in text() blocks 
# for maximum transparency and speed. Ensure 'db.py' provides a reliable 'get_db' generator.
# =================================================================
# END OF FILE
# =================================================================