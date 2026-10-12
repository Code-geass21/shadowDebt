-- ═══════════════════════════════════════════════════════════════
--  Migration 007 — Defaulted Status (Bad Debt)
--  Adds the defaulted status to the enum and updates the views
-- ═══════════════════════════════════════════════════════════════

-- 1. Add the new status to the ENUM safely
ALTER TYPE loan_status ADD VALUE IF NOT EXISTS 'defaulted';

-- 2. Rebuild the Dashboard View to exclude defaulted loans from active expected revenue
DROP VIEW IF EXISTS v_dashboard_summary CASCADE;

CREATE VIEW v_dashboard_summary AS
SELECT
    COUNT(*) FILTER (WHERE direction = 'lent'     AND status NOT IN ('settled','cancelled', 'defaulted')) AS active_lent_count,
    COUNT(*) FILTER (WHERE direction = 'borrowed' AND status NOT IN ('settled','cancelled', 'defaulted')) AS active_borrowed_count,
    COUNT(*) FILTER (WHERE status = 'overdue')                                               AS overdue_count,
    COUNT(*) FILTER (WHERE status = 'settled')                                               AS settled_count,
    COALESCE(SUM(balance_due) FILTER (WHERE direction = 'lent'     AND status NOT IN ('settled','cancelled', 'defaulted')), 0) AS total_receivable,
    COALESCE(SUM(balance_due) FILTER (WHERE direction = 'borrowed' AND status NOT IN ('settled','cancelled', 'defaulted')), 0) AS total_payable
FROM loans;

-- 3. Rebuild the Loan Summary View to freeze the overdue/due clocks for defaulted loans
DROP VIEW IF EXISTS v_loan_summary CASCADE;

CREATE VIEW v_loan_summary AS
SELECT
    l.id, l.direction, l.status, l.currency, l.principal,
    l.interest_rate, l.interest_type, l.interest_period,
    l.tenure_months, l.emi_amount, l.day_count_method, l.institution_type,
    l.total_paid, l.total_interest, l.balance_due,
    l.date_issued, l.emi_start_date, l.due_date, l.purpose,
    p.id AS person_id, p.full_name AS person_name, p.nickname AS person_nickname,
    p.phone AS person_phone, p.relationship AS person_relationship,
    CASE
        WHEN l.due_date IS NOT NULL AND l.due_date < CURRENT_DATE AND l.status NOT IN ('settled','cancelled', 'defaulted')
        THEN (CURRENT_DATE - l.due_date)
        ELSE NULL
    END AS days_overdue,
    CASE
        WHEN l.due_date IS NOT NULL AND l.due_date >= CURRENT_DATE AND l.status NOT IN ('settled','cancelled', 'defaulted')
        THEN (l.due_date - CURRENT_DATE)
        ELSE NULL
    END AS days_until_due
FROM loans l
JOIN persons p ON l.person_id = p.id;
