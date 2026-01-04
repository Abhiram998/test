import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def inspect_occupancy():
    with engine.connect() as conn:
        print("\n=== ZONE OCCUPANCY SUMMARY ===")
        zones = conn.execute(text("""
            SELECT z.zone_id, z.zone_name, z.total_capacity, z.current_occupied
            FROM parking_zones z
            WHERE z.status = 'ACTIVE'
        """)).fetchall()

        for z in zones:
            print(f"\nZone: {z.zone_name} ({z.zone_id})")
            print(f"  Total Capacity: {z.total_capacity} | Currently Occupied: {z.current_occupied}")
            
            limits = conn.execute(text("""
                SELECT vt.type_name, zl.max_vehicles, zl.current_count
                FROM zone_type_limits zl
                JOIN vehicle_types vt ON zl.vehicle_type_id = vt.id
                WHERE zl.zone_id = :z_id
            """), {"z_id": z.zone_id}).fetchall()
            
            for l in limits:
                print(f"    - {l.type_name}: {l.current_count} / {l.max_vehicles}")
            
            # Count actual tickets
            tickets = conn.execute(text("""
                SELECT vt.type_name, COUNT(*) as actual_count
                FROM parking_tickets pt
                JOIN vehicles v ON pt.vehicle_id = v.vehicle_id
                JOIN vehicle_types vt ON v.vehicle_type_id = vt.id
                WHERE pt.zone_id = :z_id AND pt.exit_time IS NULL
                GROUP BY vt.type_name
            """), {"z_id": z.zone_id}).fetchall()
            
            print("  Actual Tickets Inside:")
            for t in tickets:
                print(f"    - {t.type_name}: {t.actual_count}")

if __name__ == "__main__":
    inspect_occupancy()
