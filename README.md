# Shadow Debt

A modern, containerized full-stack application designed to manage personal loans, calculate strict EMIs, track historical financial goals, quarantine unrecoverable bad debt, and securely store loan-related documents.  

## 🏗 Architecture Stack
This application is 100% containerized and orchestrated via Docker/Portainer.
- **Frontend:** React + Vite
- **Backend:** Python + FastAPI
- **Database:** PostgreSQL 16 (with automated JSON backup/restore capabilities)
- **Background Tasks:** Python Worker
- **Web Server / Proxy:** Nginx

---
## 🚀 Quick Start (Local Development)

1. **Clone the repository:**
```bash
git clone '[https://github.com/Code-geass21/Personal-loan-tracker.git](https://github.com/Code-geass21/Personal-loan-tracker.git)'
cd Personal-loan-tracker
```

2. **Set up Environment Variables:**
For security, secrets are not stored in version control. You must create your own `.env` file.
```bash
cp .env.example .env
# Edit .env and insert your secure passwords and keys
```

3. **Start the Stack:**
```bash
docker-compose up -d --build
```

4. **Access the App:**
Open your browser and navigate to `http://localhost:54316` (Routed via Nginx).

---
## 🛠 Production Deployment & Troubleshooting Guide

When migrating this application to a new host machine, cloud server (AWS/DigitalOcean), or simply recovering from a crash, be aware of these **6 Critical Deployment Rules**.

*(Note: I have also added a folder named `"Read me !"` in this repository where you can find detailed PDF solution guides and necessary files for fixing these initial deployment problems.)*

### 1. The Secrets Rule (Missing `.env`)
**Issue:** The app crashes instantly on a new server complaining about database credentials.
**Fix:** Git ignores `.env`. You must manually create the `.env` file on the new server using `.env.example` as a template before starting Docker.

### 2. The Networking Rule (CORS & Localhost)
**Issue:** The UI loads on a mobile phone or external network, but shows no data or throws a `CORS Error`.
**Fix:** Never hardcode `http://localhost:8000` in the React frontend. Ensure `frontend/vite.config.js` and `frontend/src/utils/api.js` use relative paths (`baseURL: '/api'`). Nginx will automatically route the traffic to the FastAPI backend.

### 3. The Port Collision Rule
**Issue:** `docker-compose up` fails with `Bind for 0.0.0.0:XXXX failed: port is already allocated.`
**Fix:** The host server is already using that port. Edit `docker-compose.yml` and change the *left side* of the mapping to an open port (e.g., change `54314:5432` to `54399:5432`).

### 4. The Production Volume Rule (Bind Mounts)
**Issue:** The backend throws `ModuleNotFoundError` when deployed to a new system because the empty host directory overwrites the container's built-in Python libraries.
**Fix:** Bind mounts (`- ./backend:/app`) are for local development live-reloading ONLY. In a production environment, comment out source-code volume mounts in `docker-compose.yml` so the container relies purely on its built image.

### 5. The Persistent Uploads Rule
**Issue:** Container restarts cause all uploaded Loan PDF attachments to permanently disappear.
**Fix:** Ensure the uploads directory is securely mounted to the host in `docker-compose.yml` (`- ./backend/uploads:/app/uploads`). Also, ensure the host directory has the proper Linux write permissions (`chmod -R 777 ./backend/uploads`).

### 6. The Database Update Rule (`init.sql` Ignored)
**Issue:** Changes made to `backend/migrations/init.sql` do not apply when restarting the container.
**Fix:** Postgres only runs `/docker-entrypoint-initdb.d/` scripts if the data volume is completely empty. To force a schema update without losing data:
1. Back up current data via the UI (or `bash scripts/backup.sh`).
2. Destroy the database hard drive: `docker-compose down -v`
3. Restart to trigger the baked-in migration scripts: `docker-compose up -d`
4. Restore your data via the UI's Restore tab.

---
## 🔒 Security Notes
- Database and Backend ports are explicitly bound to `127.0.0.1` in `docker-compose.yml` to prevent public internet access and bypasses.
- All external HTTP traffic MUST pass through the Nginx reverse proxy on port `54316`.
