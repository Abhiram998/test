import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import json

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def trace_z2_tickets():
    with engine.connect() as conn:
        print("\n--- Z2 ACTIVE TICKETS ---")
        rows = conn.execute(text("""
            SELECT pt.ticket_code, pt.entry_time, pt.status, v.vehicle_number, vt.type_name
            FROM parking_tickets pt
            JOIN vehicles v ON pt.vehicle_id = v.vehicle_id
            JOIN vehicle_types vt ON v.vehicle_type_id = vt.id
            WHERE pt.zone_id = 'Z2' AND pt.exit_time IS NULL
        """)).fetchall()
        for r in rows:
            print(f"Ticket: {r.ticket_code} | Vehicle: {r.vehicle_number} | Type: {r.type_name} | Entered: {r.entry_time} | Status: {r.status}")

if __name__ == "__main__":
    trace_z2_tickets()
