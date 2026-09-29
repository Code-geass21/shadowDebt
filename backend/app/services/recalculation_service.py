from sqlalchemy.orm import Session
from sqlalchemy import text
from decimal import Decimal
from datetime import date, timedelta
import calendar
from app.utils.finance import calculate_pro_rata_interest, calculate_tax, get_30_360_days

def _get_next_month_start(current_date: date) -> date:
    """Helper to find the 1st of the next month for exact date slicing."""
    _, last_day = calendar.monthrange(current_date.year, current_date.month)
    return date(current_date.year, current_date.month, last_day) + timedelta(days=1)

def recalculate_loan_state(db: Session, loan_id: str):
    # 1. Fetch Loan Details
    loan = db.execute(text("SELECT * FROM loans WHERE id = :id"), {"id": str(loan_id)}).mappings().first()
    if not loan:
        return

    # Clear the old ledger so we can write fresh, accurate receipts
    db.execute(text("DELETE FROM interest_ledger WHERE loan_id = :id"), {"id": str(loan_id)})

    # 2. Fetch all Payments
    payments = db.execute(text(
        "SELECT * FROM payments WHERE loan_id = :id ORDER BY payment_date ASC, created_at ASC"
    ), {"id": str(loan_id)}).mappings().all()

    # 3. Fetch all Active Fees
    fees = db.execute(text(
        "SELECT * FROM loan_fees WHERE loan_id = :id AND status != 'waived'"
    ), {"id": str(loan_id)}).mappings().all()

    principal_balance = Decimal(str(loan["principal"]))
    entered_rate = Decimal(str(loan["interest_rate"]))
    interest_period = loan["interest_period"]

    interest_type = loan.get("interest_type", "simple") if "interest_type" in loan else "simple"

    # If it's a formal bank loan, use 30/360. Otherwise, use exact Pro-Rata.
    if loan.get("institution_type") == "institutional":
        day_count_method = "bank_30_360"
    else:
        day_count_method = "actual_365"
    # -----------------------------------------------------------------------

    total_interest_accrued = Decimal('0')
    total_paid = Decimal('0')
    unpaid_interest = Decimal('0')

    # Tally Upfront Fees + Tax (GST)
    unpaid_fees = Decimal('0')
    for f in fees:
        fee_amt = Decimal(str(f["amount"]))
        fee_tax_rate = Decimal(str(f.get("tax_rate", 0) if f.get("tax_rate") is not None else 0))
        fee_tax = calculate_tax(fee_amt, fee_tax_rate)
        unpaid_fees += (fee_amt + fee_tax)

    last_event_date = loan["date_issued"]

    # Fetch the amortization type so we know the rules!
    amortization_type = loan.get("amortization_type", "simple")

    # --- THE MAGIC FIX: Dynamic Unified Ledger Engine ---
    def log_monthly_chunks(start_d: date, end_d: date, current_principal: Decimal):
        nonlocal total_interest_accrued, unpaid_interest

        curr = start_d
        while curr < end_d:

            # THE SPLIT PERSONALITY FIX:
            # If EMI, chunk by month. If informal, chunk strictly day-by-day!
            if amortization_type == "emi":
                next_step = _get_next_month_start(curr)
            else:
                next_step = curr + timedelta(days=1)

            chunk_end = min(next_step, end_d)

            # DYNAMIC MATH: Check the snapshot to decide how to count days!
            if day_count_method == "bank_30_360":
                days_in_chunk = get_30_360_days(curr, chunk_end)
                use_360 = True
            else:
                days_in_chunk = (chunk_end - curr).days  # Exact Calendar Days
                use_360 = False

            if days_in_chunk > 0:
                base_for_interest = current_principal
                if interest_type == 'compound':
                    base_for_interest = current_principal + unpaid_interest

                # Pass the dynamic flag into the calculator
                chunk_int = calculate_pro_rata_interest(
                    principal=base_for_interest,
                    entered_rate=entered_rate,
                    days=days_in_chunk,
                    period=interest_period,
                    use_360=use_360
                )

                if chunk_int > 0:
                    db.execute(text("""
                        INSERT INTO interest_ledger (
                            loan_id, period_start, period_end,
                            opening_balance, interest_accrued, closing_balance,
                            calc_type, rate_applied
                        ) VALUES (
                            :lid, :start, :end,
                            :open_bal, :interest, :close_bal,
                            :calc, :rate
                        )
                    """), {
                        "lid": str(loan_id),
                        "start": curr,
                        "end": chunk_end - timedelta(days=1),
                        "open_bal": float(base_for_interest),
                        "interest": float(chunk_int),
                        "close_bal": float(base_for_interest + chunk_int),
                        "calc": interest_type,
                        "rate": float(entered_rate)
                    })
                    unpaid_interest += chunk_int
                    total_interest_accrued += chunk_int
            curr = chunk_end
    # ------------------------------------------

    if interest_type in ('simple', 'compound', 'pro_rata'):
        for payment in payments:
            pay_date = payment["payment_date"]
            cash_paid = Decimal(str(payment["amount"]))

            # Step A: Accrue interest up to the payment date using the monthly chunker
            log_monthly_chunks(last_event_date, pay_date, principal_balance)

            is_manual = payment.get("is_manual", False)

            if is_manual:
                # BANK MODE (Manual Overrides)
                manual_prin = Decimal(str(payment.get("principal_component") or 0))
                manual_int  = Decimal(str(payment.get("interest_component") or 0))
                principal_balance -= manual_prin
                unpaid_interest -= manual_int
                if unpaid_interest < 0:
                    unpaid_interest = Decimal('0')
                total_paid += cash_paid
            else:
                # FRIEND MODE (Automatic Waterfall)
                cash_left = cash_paid
                pay_tax_rate = Decimal(str(payment.get("tax_rate", 0) if payment.get("tax_rate") is not None else 0))

                if cash_left >= unpaid_fees:
                    cash_left -= unpaid_fees
                    unpaid_fees = Decimal('0')
                else:
                    unpaid_fees -= cash_left
                    cash_left = Decimal('0')

                interest_cleared = Decimal('0')
                if cash_left >= unpaid_interest:
                    interest_cleared = unpaid_interest
                    cash_left -= unpaid_interest
                    unpaid_interest = Decimal('0')
                else:
                    interest_cleared = cash_left
                    unpaid_interest -= cash_left
                    cash_left = Decimal('0')

                tax_credit = interest_cleared * (pay_tax_rate / Decimal('100'))
                cash_left += tax_credit
                total_paid += (cash_paid + tax_credit)

                principal_cleared = cash_left if cash_left > 0 else Decimal('0')
                if principal_cleared > 0:
                    principal_balance -= principal_cleared

                # Single combined UPDATE to keep records clean
                db.execute(text("""
                    UPDATE payments
                    SET interest_component = :int_comp,
                        principal_component = :prin_comp
                    WHERE id = :pid
                """), {
                    "int_comp": float(interest_cleared),
                    "prin_comp": float(principal_cleared),
                    "pid": str(payment["id"])
                })

            last_event_date = pay_date

    # Step C: Accrue final interest to TODAY using the chunker
    # --- THE ZOMBIE INTEREST FIX ---
    # If the loan is already closed, the clock stops at the last payment date!
    is_closed = loan["status"] in ('settled', 'cancelled')
    target_date = last_event_date if is_closed else date.today()

    # Step C: Accrue final interest to the target date
    log_monthly_chunks(last_event_date, target_date, principal_balance)

    balance_due = principal_balance + unpaid_interest + unpaid_fees

    new_status = 'active'
    if balance_due <= 0:
        new_status = 'settled'
        balance_due = Decimal('0')
    elif total_paid > 0:
        new_status = 'partial'

    # Respect the admin's manual override! (Debt Forgiveness)
    if is_closed:
        new_status = loan["status"]
        balance_due = Decimal('0')  # Wipe out the ghost balance

    db.execute(text("""
        UPDATE loans
        SET total_paid = :paid,
            total_interest = :interest,
            balance_due = :balance,
            status = :status,
            updated_at = NOW()
        WHERE id = :id
    """), {
        "paid": float(total_paid),
        "interest": float(total_interest_accrued),
        "balance": float(balance_due),
        "status": new_status,
        "id": str(loan_id)
    })
    db.commit()
