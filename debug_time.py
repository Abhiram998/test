import os
import json
from datetime import datetime
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def check_snapshot_time_format():
    with engine.connect() as conn:
        print("\n--- SNAPSHOT TIME FORMAT INSPECTION ---")
        
        # Pull one record
        row = conn.execute(text("""
            SELECT snapshot_time
            FROM snapshots 
            ORDER BY snapshot_time DESC
            LIMIT 1
        """)).mappings().first()
        
        if row and row["snapshot_time"]:
            ts = row["snapshot_time"]
            print(f"Raw Type: {type(ts)}")
            print(f"Raw Value: {ts}")
            print(f"Tzinfo: {ts.tzinfo}")
            
            # Simulate the fix logic
            iso_val = ts.isoformat() + ("Z" if ts.tzinfo is None else "")
            print(f"Formatted: {iso_val}")
        else:
            print("No snapshots found.")

if __name__ == "__main__":
    check_snapshot_time_format()
