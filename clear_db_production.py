import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def clear_all():
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # 1. Get all tables in public schema
            rows = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).fetchall()
            tables = [row[0] for row in rows]
            
            # Filter out spatial_ref_sys if it exists (usually from PostGIS, shouldn't be touched)
            tables = [t for t in tables if t != 'spatial_ref_sys' and not t.startswith('pg_')]
            
            if not tables:
                print("No tables found to clear.")
                return

            print(f"Tables identified: {', '.join(tables)}")
            
            # 2. Truncate all tables with CASCADE to handle foreign keys
            truncate_query = f"TRUNCATE TABLE {', '.join(tables)} RESTART IDENTITY CASCADE;"
            conn.execute(text(truncate_query))
            
            trans.commit()
            print("\nSUCCESS: All database tables cleared and identities reset.")
            print("System is now in a clean 'Production Ready' state.")
        except Exception as e:
            trans.rollback()
            print(f"\nERROR: Failed to clear database: {e}")

if __name__ == "__main__":
    clear_all()
