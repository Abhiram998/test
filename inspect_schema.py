import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def inspect_triggers(table_name):
    with engine.connect() as conn:
        print(f"\n--- {table_name} Triggers ---")
        rows = conn.execute(text(f"""
            SELECT tgname
            FROM pg_trigger
            WHERE tgrelid = '{table_name}'::regclass
        """)).fetchall()
        for r in rows:
            print(r)

if __name__ == "__main__":
    inspect_triggers("parking_tickets")
