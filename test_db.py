import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(override=True)  # IMPORTANT

DATABASE_URL = os.getenv("DATABASE_URL")
print("Using DB URL:", DATABASE_URL)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("✅ Database connected:", result.scalar())
except Exception as e:
    print("❌ Database connection failed")
    print(e)
