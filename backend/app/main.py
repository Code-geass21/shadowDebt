from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import settings
from app.database import engine
from app.models import Person, Loan, Payment, InterestLedger, Attachment, Alert, AuditLog

app = FastAPI(
    title="Personal Loan Tracker",
    description="Track loans you lent and borrowed — fully local",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok", "currency": settings.DEFAULT_CURRENCY}

from app.api import persons, loans, payments, attachments, alerts, dashboard
from app.api import export, targets, backup, restore
from app.api import settings as settings_router
from app.api import loan_fees

# 1. Import the new auth router and security dependency
from app.api import auth
from app.api.deps import get_current_user

# 2. Leave the auth router completely open so users can log in
app.include_router(auth.router, prefix="/auth", tags=["auth"])

# 3. Create the security lock
secure = [Depends(get_current_user)]

# 4. Apply the lock to ALL existing data routes
app.include_router(persons.router,     prefix="/persons",     tags=["persons"],     dependencies=secure)
app.include_router(loans.router,       prefix="/loans",       tags=["loans"],       dependencies=secure)
app.include_router(payments.router,    prefix="/payments",    tags=["payments"],    dependencies=secure)
app.include_router(loan_fees.router,   prefix="/loan-fees",   tags=["loan_fees"],   dependencies=secure)
app.include_router(attachments.router, prefix="/attachments", tags=["attachments"], dependencies=secure)
app.include_router(alerts.router,      prefix="/alerts",      tags=["alerts"],      dependencies=secure)
app.include_router(dashboard.router,   prefix="/dashboard",   tags=["dashboard"],   dependencies=secure)
app.include_router(export.router,      prefix="/export",      tags=["export"],      dependencies=secure)
app.include_router(targets.router,     prefix="/targets",     tags=["targets"],     dependencies=secure)
app.include_router(backup.router,      prefix="/backup",      tags=["backup"],      dependencies=secure)
app.include_router(restore.router,     prefix="/restore",     tags=["restore"],     dependencies=secure)
app.include_router(settings_router.router, prefix="/settings", tags=["settings"],   dependencies=secure)
