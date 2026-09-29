from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from typing import Optional
from datetime import datetime, date

router = APIRouter()

@router.get("/")
def get_dashboard(month: Optional[str] = None, db: Session = Depends(get_db)):
    date_filter = ""
    params = {}

    # 1. The Time Machine Logic
    if month:
        dt = datetime.strptime(month, "%Y-%m").date()
        month_start = dt.replace(day=1)
        if month_start.month == 12:
            month_end = date(month_start.year + 1, 1, 1)
        else:
            month_end = date(month_start.year, month_start.month + 1, 1)

        date_filter = "AND date_issued >= :month_start AND date_issued < :month_end"
        params = {"month_start": month_start, "month_end": month_end}

    try:
        # 2. Bypass the static SQL view to inject our dynamic temporal filter!
        # Bonus: Added expected_monthly_in, out, and yield to fix the UI's empty cards!
        summary = db.execute(text(f"""
            SELECT
                COUNT(*) FILTER (WHERE direction = 'lent'     AND status NOT IN ('settled','cancelled')) AS active_lent_count,
                COUNT(*) FILTER (WHERE direction = 'borrowed' AND status NOT IN ('settled','cancelled')) AS active_borrowed_count,
                COUNT(*) FILTER (WHERE status = 'overdue')                                               AS overdue_count,
                COUNT(*) FILTER (WHERE status = 'settled')                                               AS settled_count,
                COALESCE(SUM(balance_due) FILTER (WHERE direction = 'lent'     AND status NOT IN ('settled','cancelled')), 0) AS total_receivable,
                COALESCE(SUM(balance_due) FILTER (WHERE direction = 'borrowed' AND status NOT IN ('settled','cancelled')), 0) AS total_payable,
                COALESCE(SUM(emi_amount) FILTER (WHERE direction = 'lent' AND status NOT IN ('settled','cancelled')), 0) AS expected_monthly_in,
                COALESCE(SUM(emi_amount) FILTER (WHERE direction = 'borrowed' AND status NOT IN ('settled','cancelled')), 0) AS expected_monthly_out,
                COALESCE(SUM(total_interest) FILTER (WHERE direction = 'lent' AND status NOT IN ('settled','cancelled')), 0) AS expected_yield
            FROM loans
            WHERE 1=1 {date_filter}
        """), params).mappings().first()
    except Exception as e:
        summary = {}

    try:
        overdue = db.execute(text(f"""
            SELECT id, direction, status, currency, principal, balance_due, due_date, days_overdue, person_name
            FROM v_loan_summary
            WHERE status = 'overdue' {date_filter}
            ORDER BY days_overdue DESC LIMIT 5
        """), params).mappings().all()
    except Exception as e:
        overdue = []

    try:
        due_soon = db.execute(text(f"""
            SELECT id, direction, status, currency, principal, balance_due, due_date, days_until_due, person_name
            FROM v_loan_summary
            WHERE days_until_due <= 7 AND days_until_due IS NOT NULL {date_filter}
            ORDER BY days_until_due ASC LIMIT 5
        """), params).mappings().all()
    except Exception as e:
        due_soon = []

    try:
        recent = db.execute(text(f"""
            SELECT id, direction, status, currency, principal, balance_due, due_date, person_name
            FROM v_loan_summary
            WHERE 1=1 {date_filter}
            ORDER BY date_issued DESC LIMIT 5
        """), params).mappings().all()
    except Exception as e:
        recent = []

    try:
        unread_alerts = db.execute(text(
            "SELECT COUNT(*) as count FROM alerts WHERE is_dismissed = FALSE AND is_sent = FALSE"
        )).mappings().first()
    except Exception as e:
        unread_alerts = None

    return {
        "summary":       dict(summary) if summary else {},
        "overdue":       [dict(r) for r in overdue],
        "due_soon":      [dict(r) for r in due_soon],
        "recent_loans":  [dict(r) for r in recent],
        "unread_alerts": unread_alerts["count"] if unread_alerts else 0,
    }

from app.services.trends_service import get_lending_trends

@router.get("/trends")
def lending_trends(months: int = 18, db: Session = Depends(get_db)):
    return get_lending_trends(db, months)

from app.services.interest_service import accrue_interest

@router.post("/accrue-interest")
def trigger_interest_accrual(db: Session = Depends(get_db)):
    """Manually trigger interest accrual — normally runs automatically daily."""
    stats = accrue_interest(db)
    return {"status": "ok", "stats": stats}
