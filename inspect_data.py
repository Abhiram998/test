import os
from datetime import datetime
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import json

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def check_timezone():
    with engine.connect() as conn:
        print("\n--- TIMEZONE CHECK ---")
        res = conn.execute(text("SHOW TIMEZONE")).scalar()
        now_db = conn.execute(text("SELECT NOW()")).scalar()
        
        print(f"DB Timezone: {res}")
        print(f"DB NOW(): {now_db}")
        print(f"Python Local: {datetime.now()}")

if __name__ == "__main__":
    check_timezone()
