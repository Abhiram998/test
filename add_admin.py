import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def add_admin():
    with engine.connect() as conn:
        # Check if admin already exists
        existing = conn.execute(text("SELECT COUNT(*) FROM officers WHERE email = 'admin@police.gov'")).scalar()
        
        if existing > 0:
            print("Admin already exists!")
            return
        
        # Insert admin with hashed password
        # Password: admin123 (hashed using pgcrypto)
        conn.execute(text("""
            INSERT INTO officers (name, badge_number, email, password, role, is_active)
            VALUES (
                'Admin Officer',
                'ADMIN001',
                'admin@police.gov',
                crypt('admin123', gen_salt('bf')),
                'ADMIN',
                TRUE
            )
        """))
        conn.commit()
        print("✅ Admin account created successfully!")
        print("\n--- LOGIN CREDENTIALS ---")
        print("Email: admin@police.gov")
        print("Password: admin123")
        print("\n⚠️  Please change this password after first login!")

if __name__ == "__main__":
    add_admin()
