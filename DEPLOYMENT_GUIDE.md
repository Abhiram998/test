# STANDARD OPERATING PROCEDURE (SOP)
## NILAKKAL PARKING MANAGEMENT SYSTEM - DEPLOYMENT MANUAL

**Document Code:** NPMS-DEP-001  
**Classification:** OFFICIAL USE  
**Date:** January 4, 2026  
**Version:** 1.2 (Final Release)  

---

### 1. OBJECTIVE
To define the standard procedure for the installation, configuration, and deployment of the Nilakkal Parking Management System on authorized departmental infrastructure. This guide is designed for personnel with basic IT skills.

---

### 2. PREREQUISITES AND SYSTEM REQUIREMENTS
Ensure the target server or workstation meets the following specifications before proceeding.

| Component | Minimum Requirement | Recommended |
| :--- | :--- | :--- |
| **OS** | Windows 10/11 (64-bit) | Windows Server 2019 / Linux (Ubuntu) |
| **Python** | Version 3.10 | Version 3.11+ |
| **Node.js** | Version 18 (LTS) | Version 20 (LTS) |
| **Database** | PostgreSQL 14 | PostgreSQL 16 |
| **RAM** | 8 GB | 16 GB |

**Software Installation Checks:**
1.  **Python**: Open Command Prompt (`cmd`) and type `python --version`. If installed, it will show the version.
2.  **Node.js**: Type `node -v` in Command Prompt.
3.  **PostgreSQL**: Ensure `pgAdmin` is installed or the service is running.

---

### 3. INSTALLATION PROCEDURE

#### Phase A: Source Code Extraction
The application source code is provided in a secure archive format (`.zip`).

1.  Create a folder named `ParkingSystem` on the C: drive (e.g., `C:\ParkingSystem`).
2.  Copy the provided `NilakkalParking_Source.zip` file to this folder.
3.  Right-click the file and select **Extract All**.
4.  Opening the extracted folder, verify you see files like `main.py`, `requirements.txt`, and a folder named `client`.

#### Phase B: Backend Configuration (API Server)
1.  Open **Command Prompt** (Press Win+R, type `cmd`, press Enter).
2.  Navigate to the project directory:
    ```cmd
    cd C:\ParkingSystem\NilakkalParking_Source
    ```
3.  **Initialize Virtual Environment**:
    This isolates the software execution environment.
    ```cmd
    python -m venv venv
    ```
4.  **Activate Environment**:
    ```cmd
    venv\Scripts\activate
    ```
    *Check:* You should see `(venv)` appear at the start of the command line.
5.  **Install Required Modules**:
    ```cmd
    pip install -r requirements.txt
    ```

#### Phase C: Frontend Configuration (User Interface)
1.  In the same Command Prompt window, run usage:
    ```cmd
    npm install
    ```
    *Wait for the progress bar to complete.*

---

### 4. DATABASE INITIALIZATION

**Step 1: Create the Database**
1.  Open **pgAdmin 4** (or your preferred SQL tool).
2.  Right-click on **Databases** > **Create** > **Database...**
3.  Name: `parking_db`
4.  Click **Save**.

**Step 2: Configure Credentials**
1.  Go to the project folder `C:\ParkingSystem\NilakkalParking_Source`.
2.  Find the file named `.env.example`.
3.  Rename it to `.env` (Remove `.example`).
4.  Open `.env` with Notepad.
5.  Update the `DATABASE_URL` line with your PostgreSQL password:
    ```ini
    DATABASE_URL=postgresql://postgres:YOUR_PASSWORD_HERE@localhost:5432/parking_db
    ```
6.  Save and close the file.

**Step 3: Run Initialization Script**
1.  In pgAdmin, right-click `parking_db` and select **Query Tool**.
2.  Copy **ALL** the text from the **"APPENDIX: DATABASE SCHEMA"** section at the bottom of this document.
3.  Paste it into the Query Tool.
4.  Click the **Execute** (Play button) icon.
5.  Verify "Query returned successfully" message.

---

### 5. SYSTEM STARTUP

To run the system, you must start two separate services.

**Service 1: Backend API**
1.  Open Command Prompt.
2.  Navigate to folder: `cd C:\ParkingSystem\NilakkalParking_Source`
3.  Activate venv: `venv\Scripts\activate`
4.  Start Server:
    ```cmd
    uvicorn main:app --host 0.0.0.0 --port 8000
    ```

**Service 2: Frontend Interface**
1.  Open a **New** Command Prompt window.
2.  Navigate to folder: `cd C:\ParkingSystem\NilakkalParking_Source`
3.  Start Interface:
    ```cmd
    npm run dev:client
    ```

---

### 6. VERIFICATION
1.  Open Chrome or Edge.
2.  Go to: `http://localhost:5173`
3.  The **Live Parking Dashboard** should be visible.
4.  The system is now **LIVE**.

---

### APPENDIX: DATABASE SCHEMA (SQL SCRIPT)

**Copy and Run this entire block in pgAdmin:**

```sql
-- 1. Enable Crypto Extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Vehicle Types
CREATE TABLE IF NOT EXISTS vehicle_types (
    id SERIAL PRIMARY KEY,
    type_name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO vehicle_types (type_name) VALUES 
('Heavy'), ('Medium'), ('Light')
ON CONFLICT DO NOTHING;

-- 3. Parking Zones
CREATE TABLE IF NOT EXISTS parking_zones (
    zone_id VARCHAR(10) PRIMARY KEY,
    zone_name VARCHAR(100) NOT NULL,
    total_capacity INTEGER DEFAULT 0,
    current_occupied INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

-- 4. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    vehicle_number VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type_id INTEGER REFERENCES vehicle_types(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Zone Limits
CREATE TABLE IF NOT EXISTS zone_type_limits (
    id SERIAL PRIMARY KEY,
    zone_id VARCHAR(10) REFERENCES parking_zones(zone_id) ON DELETE CASCADE,
    vehicle_type_id INTEGER REFERENCES vehicle_types(id),
    max_vehicles INTEGER DEFAULT 0,
    current_count INTEGER DEFAULT 0
);

-- 6. Parking Tickets
CREATE TABLE IF NOT EXISTS parking_tickets (
    ticket_id SERIAL PRIMARY KEY,
    ticket_code VARCHAR(50) UNIQUE NOT NULL,
    vehicle_id INTEGER REFERENCES vehicles(vehicle_id),
    zone_id VARCHAR(10) REFERENCES parking_zones(zone_id),
    entry_time TIMESTAMP DEFAULT NOW(),
    exit_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

-- 7. Snapshots
CREATE TABLE IF NOT EXISTS snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_time TIMESTAMP DEFAULT NOW(),
    records_count INTEGER,
    data TEXT NOT NULL
);

-- 8. Officers
CREATE TABLE IF NOT EXISTS officers (
    officer_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    badge_number TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'OFFICER',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---
**Technical Support Unit**  
**Nilakkal Parking Control Room**  
*Internal Use Only*
