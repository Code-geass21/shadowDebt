from app.services.recalculation_service import recalculate_loan_state
from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import UUID
from typing import List, Optional
from datetime import date
from decimal import Decimal                                     # <--- NEW IMPORT
from app.utils.finance import calculate_emi, smart_annualize_rate                     # <--- NEW IMPORT
from app.models.loan import Loan, LoanStatus, DayCountMethod
from app.models.person import Person, EntityType
from app.schemas.loan import LoanCreate, LoanUpdate

def get_all(
    db: Session,
    direction: Optional[str] = None,
    status: Optional[str] = None,
    person_id: Optional[UUID] = None,
    currency: Optional[str] = None,
) -> List[dict]:
    query = "SELECT * FROM v_loan_summary WHERE 1=1"
    params = {}
    if direction:
        query += " AND direction = :direction"
        params["direction"] = direction
    if status:
        query += " AND status = :status"
        params["status"] = status
    if person_id:
        query += " AND person_id = :person_id"
        params["person_id"] = str(person_id)
    if currency:
        query += " AND currency = :currency"
        params["currency"] = currency
    query += " ORDER BY due_date ASC NULLS LAST"
    result = db.execute(text(query), params).mappings().all()
    return [dict(r) for r in result]

def get_by_id(db: Session, loan_id: UUID) -> Optional[Loan]:
    return db.query(Loan).filter(Loan.id == loan_id).first()

def get_summary_by_id(db: Session, loan_id: UUID) -> Optional[dict]:
    result = db.execute(
        text("SELECT * FROM v_loan_summary WHERE id = :id"),
        {"id": str(loan_id)}
    ).mappings().first()
    return dict(result) if result else None

def create(db: Session, data: LoanCreate):
    loan_data = data.model_dump()

    # --- THE SNAPSHOT FIX: Dynamic Math Assignment ---
    # Fetch the person to see if they are a bank/institution
    person = db.query(Person).filter(Person.id == loan_data["person_id"]).first()

    # Automatically stamp Bank Math (30/360) if they are an institution!
    if person and person.entity_type == EntityType.institution:
        loan_data["day_count_method"] = DayCountMethod.bank_30_360
    else:
        loan_data["day_count_method"] = DayCountMethod.actual_365

    # --- NEW: THE EMI EXPECTATION: Calculate and Freeze! ---
    if loan_data.get("tenure_months") and loan_data.get("interest_rate") is not None:
        prin = Decimal(str(loan_data["principal"]))
        raw_rate = Decimal(str(loan_data["interest_rate"]))
        period = loan_data.get("interest_period", "monthly")
        months = int(loan_data["tenure_months"])

        # THE FIX: Run the raw rate through our smart annualizer first!
        true_annual_rate = smart_annualize_rate(raw_rate, period)

        # Lock in the exact monthly payment using the TRUE annual rate
        loan_data["emi_amount"] = float(calculate_emi(prin, true_annual_rate, months))
    else:
        # Friends and family loans might not have a strict tenure!
        loan_data["emi_amount"] = None
    # -------------------------------------------------------

    loan = Loan(**loan_data)
    loan.balance_due = loan.principal
    db.add(loan)
    db.commit()
    # Trigger the real-time engine!
    recalculate_loan_state(db, str(loan.id))
    db.refresh(loan)
    return loan

def update(db: Session, loan_id: UUID, data: LoanUpdate):
    loan = get_by_id(db, loan_id)
    if not loan:
        return None

    # --- 1. Calculate the exact State Diff ---
    changes = []
    for field, new_val in data.model_dump(exclude_unset=True).items():
        old_val = getattr(loan, field)

        # Only log it if the value actually changed
        if str(old_val) != str(new_val):
            clean_name = field.replace('_', ' ').title()
            changes.append(f"{clean_name}: {old_val} ➔ {new_val}")

        setattr(loan, field, new_val)

    db.commit()

    # 2. Trigger the real-time engine!
    recalculate_loan_state(db, str(loan.id))
    db.refresh(loan)

    # --- 3. Secretly attach the diff to the loan object for the API to read ---
    loan._audit_diff = " | ".join(changes) if changes else None

    return loan

def delete(db: Session, loan_id: UUID) -> bool:
    loan = get_by_id(db, loan_id)
    if not loan:
        return False
    db.delete(loan)
    db.commit()
    return True

def cancel(db: Session, loan_id: UUID) -> Optional[Loan]:
    loan = get_by_id(db, loan_id)
    if not loan:
        return None

    # 1. Change the status to cancelled
    loan.status = LoanStatus.cancelled

    # 2. THE FIX: Wipe out the zombie debt!
    loan.balance_due = 0
    loan.total_interest = 0

    # 3. Clear the math ledger so no ghost interest shows up on the UI
    db.execute(text("DELETE FROM interest_ledger WHERE loan_id = :id"), {"id": str(loan_id)})

    db.commit()
    db.refresh(loan)
    return loan

def get_overdue(db: Session) -> List[dict]:
    result = db.execute(
        text("SELECT * FROM v_loan_summary WHERE status = 'overdue' ORDER BY days_overdue DESC")
    ).mappings().all()
    return [dict(r) for r in result]

def get_due_soon(db: Session, days: int = 7) -> List[dict]:
    result = db.execute(
        text("SELECT * FROM v_loan_summary WHERE days_until_due <= :days AND days_until_due IS NOT NULL ORDER BY days_until_due ASC"),
        {"days": days}
    ).mappings().all()
    return [dict(r) for r in result]

def write_off(db: Session, loan_id: UUID) -> Optional[Loan]:
    loan = get_by_id(db, loan_id)
    if not loan:
        return None

    loan.status = LoanStatus.defaulted
    db.commit()
    db.refresh(loan)

    # Run the recalculation engine one last time to freeze the final balances
    recalculate_loan_state(db, str(loan_id))

    # Secure the audit log
    from app.models.audit_log import AuditLog
    db.add(AuditLog(
        loan_id=loan_id,
        action="Defaulted / Bad Debt",
        description="Loan explicitly marked as Defaulted. Remaining balance frozen as an unrecoverable loss."
    ))
    db.commit()
    return loan
