import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
load_dotenv()
engine = create_engine(os.getenv('DATABASE_URL'))
with engine.connect() as conn:
    z = conn.execute(text("SELECT zone_id, zone_name, total_capacity, current_occupied FROM parking_zones WHERE zone_id='Z2'")).mappings().first()
    print(f"ZONE: {z['zone_id']} | CAP: {z['total_capacity']} | OCC: {z['current_occupied']}")
    limits = conn.execute(text("SELECT vehicle_type_id, max_vehicles, current_count FROM zone_type_limits WHERE zone_id='Z2'")).mappings().all()
    for l in limits:
        print(f"LIMIT: TypeID {l['vehicle_type_id']} | MAX: {l['max_vehicles']} | CUR: {l['current_count']}")
