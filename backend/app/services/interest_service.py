from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
import traceback
from app.services.recalculation_service import recalculate_loan_state

logger = logging.getLogger(__name__)

def accrue_interest(db: Session, loan_id: str = None):
    """
    Unified Engine: Forces every active loan to run through the master recalculator.
    This groups history into clean monthly rows, but grows the current month's interest day-by-day!
    """
    stats = {"processed": 0, "entries_added": 0, "errors": 0}

    query = "SELECT id FROM loans WHERE status IN ('active', 'partial')"
    params = {}
    if loan_id:
        query += " AND id = CAST(:lid AS UUID)"
        params["lid"] = str(loan_id)

    loans = db.execute(text(query), params).mappings().all()

    for loan in loans:
        try:
            # Let the master engine handle EVERYTHING.
            # It deletes the ledger and dynamically rebuilds it perfectly up to TODAY.
            recalculate_loan_state(db, str(loan["id"]))
            stats["processed"] += 1
        except Exception as e:
            db.rollback()
            stats["errors"] += 1
            logger.error(f"Accrual error for loan {loan['id']}: {e}")
            traceback.print_exc()

    return stats

def recalculate_loan(db: Session, lid: str) -> None:
    """Wrapper for backward compatibility."""
    recalculate_loan_state(db, str(lid))
