import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def inspect_constraints(table_name):
    with engine.connect() as conn:
        print(f"\n--- {table_name} Constraints ---")
        rows = conn.execute(text(f"""
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = '{table_name}'::regclass
        """)).fetchall()
        for r in rows:
            print(f"Name: {r[0]}")
            print(f"Def: {r[1]}")
            print("-" * 20)

if __name__ == "__main__":
    inspect_constraints("parking_tickets")
    # Also check unique indexes which are not technically constraints
    with engine.connect() as conn:
        print("\n--- UNIQUE INDEXES ---")
        rows = conn.execute(text(f"""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'parking_tickets' AND indexdef LIKE '%UNIQUE%'
        """)).fetchall()
        for r in rows:
            print(f"Name: {r[0]}")
            print(f"Def: {r[1]}")
            print("-" * 20)
