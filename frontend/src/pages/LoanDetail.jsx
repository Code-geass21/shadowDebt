import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  getLoan, getLoanPayments, getLoanAttachments,
  getLoanInterest, getLoanAudit, getLoanAlerts,
  createPayment, deletePayment, uploadAttachment,
  deleteAttachment, deleteLoan, cancelLoan,
  getLoanTarget, createTarget, updateLoan,
  getLoanFees, createLoanFee, deleteLoanFee, dismissAlert
} from '../utils/api'
import { formatCurrency, formatDate, formatDateTime, statusColor, directionColor } from '../utils/format'
import { ArrowLeft, Plus, Trash2, Upload, XCircle, AlertTriangle } from 'lucide-react'
import { exportLoanStatement, exportPaymentsCSV } from '../utils/export'

const EMPTY_PAYMENT = {
  amount: '', payment_date: new Date().toISOString().split('T')[0],
  method: 'cash', reference: '', notes: '', tax_rate: '',
  is_manual: false, principal_component: '', interest_component: '', tax_amount: ''
}
const EMPTY_FEE = { fee_name: 'Appraisal Fee', amount: '', status: 'pending', tax_rate: '' }

export default function LoanDetail() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const [loan, setLoan]             = useState(null)
  const [payments, setPayments]     = useState([])
  const [attachments, setAttachments] = useState([])
  const [interest, setInterest]     = useState([])
  const [audit, setAudit]           = useState([])
  const [alerts, setAlerts]         = useState([])
  const [fees, setFees]             = useState([])
  const [tab, setTab]               = useState('payments')
  const [loading, setLoading]       = useState(true)
  const [payModal, setPayModal]     = useState(false)
  const [payForm, setPayForm]       = useState(EMPTY_PAYMENT)
  const [feeModal, setFeeModal]     = useState(false)
  const [feeForm, setFeeForm]       = useState(EMPTY_FEE)
  const [saving, setSaving]         = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [loanTarget, setLoanTarget] = useState(null)
  const [targetModal, setTargetModal] = useState(false)
  const [targetAmount, setTargetAmount] = useState('')
  const [savingTarget, setSavingTarget] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)

  const [preCloseModal, setPreCloseModal] = useState(false)
  const [preCloseForm, setPreCloseForm]   = useState({
    penalty: '', tax_rate: '', method: 'bank_transfer', date: new Date().toISOString().split('T')[0]
  })

  // --- NEW: Alert Dismissal Logic ---
  const handleDismissAlert = async (alertId) => {
    try {
      await dismissAlert(alertId);
      setAlerts(alerts.filter(a => a.id !== alertId)); // Instantly remove from screen
      toast.success('Alert dismissed');
    } catch (e) {
      toast.error('Failed to dismiss alert');
    }
  }
  // ----------------------------------

  const load = () => {
    setLoading(true)
    Promise.all([
      getLoan(id), getLoanPayments(id), getLoanAttachments(id),
      getLoanInterest(id), getLoanAudit(id), getLoanAlerts(id),
      getLoanTarget(id), getLoanFees(id)
    ]).then(([l, p, a, i, au, al, tg, f]) => {
      setLoan(l.data); setPayments(p.data); setAttachments(a.data);
      setInterest(i.data); setAudit(au.data); setAlerts(al.data);
      setLoanTarget(tg.data); setFees(f.data);

      console.log("ALERTS FROM BACKEND:", al.data); // <--- ADD THIS ONE LINE


    }).catch(() => toast.error('Failed to load loan'))
    .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const openEditModal = () => {
    setEditForm({
      institution_type: loan.institution_type || 'non_institutional',
      principal: loan.principal, currency: loan.currency,
      interest_rate: loan.interest_rate, interest_type: loan.interest_type,
      interest_period: loan.interest_period, date_issued: loan.date_issued,
      tenure_months: loan.tenure_months || '', // <--- ADD THIS
      emi_start_date: loan.emi_start_date || '', due_date: loan.due_date || '',
      purpose: loan.purpose || '', notes: loan.notes || '',
    })
    setEditModal(true)
  }

  const saveEdit = async () => {
    setSavingEdit(true)
    const payload = { ...editForm };
    payload.principal = parseFloat(payload.principal);
    payload.interest_rate = parseFloat(payload.interest_rate) || 0;
    // <--- ADD THIS --->
    if (payload.tenure_months) payload.tenure_months = parseInt(payload.tenure_months, 10);
    else payload.tenure_months = null;
    if (payload.emi_start_date === '') payload.emi_start_date = null;
    if (payload.due_date === '') payload.due_date = null;
    if (payload.purpose === '') payload.purpose = null;
    if (payload.notes === '') payload.notes = null;

    try {
      await updateLoan(id, payload); toast.success('Loan updated');
      setEditModal(false); load();
    } catch (err) { toast.error('Failed to update loan') }
    finally { setSavingEdit(false) }
  }

  const saveTarget = async () => {
    setSavingTarget(true);
    try {
      await createTarget({
        scope: 'loan',
        loan_id: id,
        monthly_amount: parseFloat(targetAmount),
        currency: loan.currency
      });
      toast.success('Monthly target set for this loan');
      setTargetModal(false);
      load(); // Reloads the page to fetch the new target progress
    } catch {
      toast.error('Failed to save target');
    } finally {
      setSavingTarget(false);
    }
  }

  const handlePreClose = async () => {
    if (!confirm("Are you sure you want to completely settle and close this loan?")) return;
    setSaving(true);
    try {
      const penalty = parseFloat(preCloseForm.penalty) || 0;
      const taxRate = parseFloat(preCloseForm.tax_rate) || 0;
      const taxAmt  = penalty * (taxRate / 100);
      const grandTotal = parseFloat(loan.balance_due) + penalty + taxAmt;

      if (penalty > 0) {
        await createLoanFee({
          loan_id: id, fee_name: 'Foreclosure / Pre-Closure Charge',
          amount: penalty, tax_rate: taxRate, status: 'paid'
        });
      }

      await createPayment({
        loan_id: id, amount: grandTotal, payment_date: preCloseForm.date,
        method: preCloseForm.method, notes: 'Full Settlement & Pre-Closure'
      });

      toast.success('Loan Successfully Closed!');
      setPreCloseModal(false); load();
    } catch (e) { toast.error('Failed to pre-close loan') }
    finally { setSaving(false) }
  }

  const addFee = async () => {
    if (!feeForm.amount) {
      alert("WARNING: The amount field is empty!");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        loan_id: id,
        fee_name: feeForm.fee_name || "Appraisal Fee",
        amount: parseFloat(feeForm.amount),
        status: feeForm.status || "pending",
        tax_rate: parseFloat(feeForm.tax_rate) || 0,
        tax_amount: 0,
        created_at: feeForm.created_at ? `${feeForm.created_at}T12:00:00Z` : undefined
      };

      console.log("Sending Fee Data to Backend:", payload);
      await createLoanFee(payload);

      toast.success('Fee successfully added to loan balance!');
      setFeeModal(false);
      setFeeForm(EMPTY_FEE);
      load();
    } catch (err) {
      const backendError = err.response?.data?.detail;
      if (backendError) {
        alert(`BACKEND SERVER REJECTED IT:\n${JSON.stringify(backendError, null, 2)}`);
      } else {
        alert(`REACT NETWORK ERROR:\n${err.message}`);
      }
    } finally {
      setSaving(false)
    }
  }

  const removeFee = async (fid) => {
    if (!confirm('Delete this fee? Your loan balance will be recalculated.')) return
    try { await deleteLoanFee(fid); toast.success('Fee removed'); load(); }
    catch { toast.error('Failed to remove fee') }
  }

  const addPayment = async () => {
    if (!payForm.amount) return toast.error('Enter amount')
    setSaving(true)
    const payload = { ...payForm, loan_id: id };
    payload.amount = parseFloat(payload.amount);

    if (payload.is_manual) {
      payload.principal_component = parseFloat(payload.principal_component) || 0;
      payload.interest_component = parseFloat(payload.interest_component) || 0;
      payload.tax_amount = parseFloat(payload.tax_amount) || 0;
      payload.tax_rate = 0;
    } else {
      payload.principal_component = 0;
      payload.interest_component = 0;
      payload.tax_amount = 0;
      payload.tax_rate = parseFloat(payload.tax_rate) || 0;
    }

    if (payload.reference === '') payload.reference = null;
    if (payload.notes === '') payload.notes = null;

    try {
      await createPayment(payload); toast.success('Payment recorded');
      setPayModal(false); setPayForm(EMPTY_PAYMENT); load();
    } catch (err) { toast.error('Failed to add payment') }
    finally { setSaving(false) }
  }

  const removePayment = async (pid) => {
    if (!confirm('Delete this payment?')) return
    try { await deletePayment(pid); toast.success('Payment deleted'); load(); }
    catch { toast.error('Failed to delete payment') }
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file);
      await uploadAttachment(id, fd); toast.success('File uploaded'); load();
    } catch { toast.error('Upload failed') }
    finally { setUploading(false); e.target.value = '' }
  }

  const removeAttachment = async (aid) => {
    if (!confirm('Delete this attachment?')) return
    try { await deleteAttachment(aid); toast.success('Attachment deleted'); load(); }
    catch { toast.error('Failed to delete attachment') }
  }

  const remove = async () => {
    if (!confirm('Delete this entire loan? This cannot be undone.')) return
    try { await deleteLoan(id); toast.success('Loan deleted'); navigate('/loans'); }
    catch { toast.error('Failed to delete loan') }
  }

  const cancel = async () => {
    if (!confirm('Cancel this loan?')) return
    try { await cancelLoan(id); toast.success('Loan cancelled'); load(); }
    catch { toast.error('Failed to cancel loan') }
  }

  const downloadStatement = async (e) => {
    const format = e.target.value;
    if (!format) return;

    try {
      const response = await fetch(`/api/loans/${id}/statement/download?format=${format}`);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Loan_Statement.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      e.target.value = "";
      load();
    } catch (error) {
      console.error("Failed to download statement", error);
      alert("Error generating statement.");
    }
  };

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>
  if (!loan)   return <div className="empty"><div className="empty-text">Loan not found</div></div>

  const paid   = parseFloat(loan.total_paid)
  const total  = parseFloat(loan.principal) + parseFloat(loan.total_interest)
  const pct    = total > 0 ? Math.min(100, (paid / total) * 100) : 0

  // --- NEW: Calculate exact totals from payment history for the UI ---
  let totalPrincipalPaid = 0;
  let totalInterestPaid = 0;
  let totalTaxPaid = 0;

  payments.forEach(p => {
    totalPrincipalPaid += parseFloat(p.principal_component || 0);
    totalInterestPaid += parseFloat(p.interest_component || 0);
    if (p.is_manual) {
      totalTaxPaid += parseFloat(p.tax_amount || 0);
    } else if (parseFloat(p.tax_rate || 0) > 0) {
      totalTaxPaid += parseFloat(p.amount) * (parseFloat(p.tax_rate) / 100);
    }
  });
  // --- NEW FIX: Include GST from Upfront Fees & Penalties! ---
  fees.forEach(f => {
    if (parseFloat(f.tax_rate || 0) > 0) {
      totalTaxPaid += parseFloat(f.amount) * (parseFloat(f.tax_rate) / 100);
    }
  });
  // ------------------------------------------------------------

  const principalProgress = loan.principal > 0 ? Math.min(100, (totalPrincipalPaid / loan.principal) * 100) : 0;
  // -------------------------------------------------------------------

  return (
    <div>
      {/* --- NEW: Active Alerts Banner --- */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map(alert => (
            <div key={alert.id} style={{
              background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b',
              padding: '12px 16px', borderRadius: 8, display: 'flex',
              justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{alert.message || alert.description}</span>
              </div>
              <button onClick={() => handleDismissAlert(alert.id)} style={{ background: 'transparent', border: 'none', color: '#991b1b', cursor: 'pointer', padding: 4 }}>
                <XCircle size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* --------------------------------- */}
      <div style={{ marginBottom: 20 }}>
        <Link to="/loans" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-link)', fontSize: 13 }}>
          <ArrowLeft size={14} /> Back to Loans
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span className={`badge ${directionColor(loan.direction)}`}>
                {loan.direction === 'lent' ? '↑ Lent' : '↓ Borrowed'}
              </span>
              <span className={`badge ${statusColor(loan.status)}`}>{loan.status}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(loan.principal, loan.currency)}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
              with <Link to={`/people/${loan.person_id}`} style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                {loan.person_name}
              </Link>
              {loan.person_nickname && ` (${loan.person_nickname})`}
            </div>
            {/* --- NEW: Visual Principal Progress Bar --- */}
            <div style={{ marginTop: 22, width: '100%', maxWidth: 400 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
                <span style={{ color: '#2563eb' }}>Principal Paid: {formatCurrency(totalPrincipalPaid, loan.currency)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>Original: {formatCurrency(loan.principal, loan.currency)}</span>
              </div>
              <div style={{ width: '100%', height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <div style={{ width: `${principalProgress}%`, height: '100%', background: '#2563eb', transition: 'width 0.5s ease-out' }} />
              </div>
            </div>

            {/* --- NEW: Monthly Goal Progress Bar --- */}
            {loanTarget && (
              <div style={{ marginTop: 16, width: '100%', maxWidth: 400 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
                  <span style={{ color: '#16a34a' }}>Goal Progress: {formatCurrency(loanTarget.paid_this_month, loan.currency)}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Target: {formatCurrency(loanTarget.monthly_amount, loan.currency)} / mo</span>
                </div>
                <div style={{ width: '100%', height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: `${loanTarget.percentage}%`, height: '100%', background: loanTarget.percentage >= 100 ? '#16a34a' : '#0ea5e9', transition: 'width 0.5s ease-out' }} />
                </div>
              </div>
            )}
            {/* ---------------------------------------- */}
          </div>

          {/* ACTION BUTTONS GROUP */}
          <div style={{ display: 'flex', gap: 8 }}>
            {loan.status !== 'cancelled' && loan.status !== 'settled' && (
              <>
                <button className="btn btn-danger btn-sm" onClick={() => setPreCloseModal(true)} style={{ background: '#dc2626', color: 'white', border: 'none' }}>
                  <AlertTriangle size={13} style={{ marginRight: 4 }} /> Pre-Close Loan
                </button>
                <button className="btn btn-success btn-sm" onClick={() => { setPayForm({...EMPTY_PAYMENT, amount: loan.balance_due}); setPayModal(true); }}>
                  <Plus size={13} /> Add Payment
                </button>
              </>
            )}

            <button className="btn btn-secondary btn-sm" onClick={() => { setTargetAmount(loanTarget?.monthly_amount?.toString() || ''); setTargetModal(true); }}>
              🎯 Set Target
            </button>
            <button className="btn btn-secondary btn-sm" onClick={openEditModal}>✏ Edit Loan</button>

            <select
                className="btn btn-secondary btn-sm"
                onChange={downloadStatement}
                defaultValue=""
                style={{ cursor: 'pointer', appearance: 'none', paddingRight: '24px' }}
            >
                <option value="" disabled>📄 Export Statement</option>
                <option value="pdf">Download as PDF</option>
                <option value="xlsx">Download as Excel</option>
                <option value="txt">Download as Text</option>
            </select>

            <button className="btn btn-danger btn-sm" onClick={remove}><Trash2 size={13} /> Delete</button>
          </div>
        </div>

       <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
         {[
           ['Institution',  loan.institution_type === 'institutional' ? '🏦 Bank/Formal' : '🤝 Informal'],
           ['Date Issued',  formatDate(loan.date_issued)],
           ['EMI Start',    loan.emi_start_date ? formatDate(loan.emi_start_date) : '—'],
           ['Due Date',     loan.due_date ? formatDate(loan.due_date) : 'Open-ended'],
           // <--- ADD THESE TWO NEW DISPLAY BLOCKS --->
           ['Tenure',       loan.tenure_months ? `${loan.tenure_months} Months` : 'Flexible'],
           ['Fixed EMI',    loan.emi_amount ? formatCurrency(loan.emi_amount, loan.currency) : 'N/A'],
           // ------------------------------------------
           ['Interest Rate',parseFloat(loan.interest_rate) > 0 ? `${loan.interest_rate}%` : 'None'],
           ['Period',       loan.interest_period],
           ['Total Interest Accrued',formatCurrency(loan.total_interest, loan.currency)],
           ['Total Paid',   formatCurrency(loan.total_paid, loan.currency)],
           ['Balance Due',  formatCurrency(loan.balance_due, loan.currency)],
          // 👇 PASTE THESE TWO LINES RIGHT HERE 👇
           ['Total Interest Paid', formatCurrency(totalInterestPaid, loan.currency)],
           ['Total Tax / GST Paid', formatCurrency(totalTaxPaid, loan.currency)],
         ].map(([label, value]) => (
            <div key={label} style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="tabs">
        {[
          ['payments',    `Payments (${payments.length})`],
          ['fees',        `Fees & Charges (${fees.length})`],
          ['attachments', `Attachments (${attachments.length})`],
          ['interest',    `Interest Ledger (${interest.length})`],
          ['audit',       `Audit Log (${audit.length})`],
          // --- NEW: Add the EMI Tab ---
          ['emi',         `EMI Schedule`],
          // ----------------------------
        ].map(([key, label]) => (
          <div key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </div>
        ))}
      </div>

      {/* --- NEW: EMI Schedule Tab Content --- */}
      {tab === 'emi' && (
        <div className="card">
          <div className="card-title">Projected EMI Schedule</div>
          {(!loan.emi_amount || !loan.tenure_months) ? (
            <div className="empty"><div className="empty-text">This loan does not have a fixed EMI amount or tenure set. Update the loan details to generate a schedule.</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Installment</th>
                    <th>Date</th>
                    <th>Total Expected</th>
                    <th>→ Interest</th>
                    <th>→ Fees / GST</th>
                    <th>→ Principal</th>
                    <th>Remaining Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const schedule = [];
                    // 1. Calculate total upfront fees + GST
                    let totalUpfront = 0;
                    fees.forEach(f => {
                      totalUpfront += parseFloat(f.amount) + (parseFloat(f.amount) * (parseFloat(f.tax_rate) || 0) / 100);
                    });

                    // 2. Setup variables for amortization
                    const startDate = new Date(loan.emi_start_date || loan.date_issued);
                    const emiBase = parseFloat(loan.emi_amount) || 0;
                    const isSimple = loan.interest_type === 'simple';
                    let annualRate = parseFloat(loan.interest_rate) || 0;
                    if (loan.interest_period === 'monthly' && annualRate < 10) {
                      annualRate = annualRate * 12;
                    }
                    let remainingPrincipal = parseFloat(loan.principal) || 0;

                    // Pre-calculate flat interest for simple interest loans
                    const flatInterest = isSimple && loan.tenure_months ? (remainingPrincipal * (annualRate/100) * (loan.tenure_months/12)) / loan.tenure_months : 0;

                    // 3. Loop through tenure and build rows
                    for (let i = 1; i <= loan.tenure_months; i++) {
                      const d = new Date(startDate);

                      // THE FIX: Safe month calculation to prevent skipping February
                      const targetMonth = d.getMonth() + (i - 1);
                      d.setMonth(targetMonth);
                      if (d.getMonth() !== targetMonth % 12) {
                        d.setDate(0); // Clamp to the absolute last day of the intended month
                      }

                      const feesIncluded = i === 1 ? totalUpfront : 0; // Fees only on month 1
                      const totalExpected = emiBase + feesIncluded;

                      let intComp = 0;
                      let princComp = 0;

                      if (isSimple) {
                        intComp = flatInterest;
                        princComp = emiBase - intComp;
                      } else {
                        // Standard compound amortization (Interest = Remaining * Monthly Rate)
                        intComp = remainingPrincipal * (annualRate / 12 / 100);
                        princComp = emiBase - intComp;
                      }

                      // Adjust for final month rounding differences
                      if (i === loan.tenure_months || princComp > remainingPrincipal) {
                        princComp = remainingPrincipal;
                      }

                      remainingPrincipal -= princComp;
                      if (remainingPrincipal < 0) remainingPrincipal = 0;

                      schedule.push(
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>#{i}</td>
                          <td>{formatDate(d.toISOString().split('T')[0])}</td>
                          <td style={{ fontWeight: 700, color: '#16a34a', fontSize: '14px' }}>
                            {formatCurrency(totalExpected, loan.currency)}
                          </td>
                          <td style={{ color: '#ea580c' }}>
                            {formatCurrency(intComp, loan.currency)}
                          </td>
                          <td style={{ color: feesIncluded > 0 ? '#dc2626' : 'var(--text-tertiary)' }}>
                            {feesIncluded > 0 ? `+ ${formatCurrency(feesIncluded, loan.currency)}` : '—'}
                          </td>
                          <td style={{ color: '#2563eb' }}>
                            {formatCurrency(princComp, loan.currency)}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {formatCurrency(remainingPrincipal, loan.currency)}
                          </td>
                        </tr>
                      );
                    }
                    return schedule;
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* --------------------------------------- */}

      {tab === 'fees' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Upfront Fees & Charges</div>
            <button className="btn btn-primary btn-sm" onClick={() => {
                setFeeForm({ ...EMPTY_FEE, created_at: loan.date_issued });
                setFeeModal(true);
              }}>
                <Plus size={13} /> Add Charge
              </button>
          </div>
          {fees.length === 0 ? (
            <div className="empty"><div className="empty-text">No upfront fees attached.</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fee Name</th><th>Amount (Base)</th><th>Status</th><th>Added On</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map(f => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600 }}>{f.fee_name}</td>
                      <td style={{ fontWeight: 600, color: '#dc2626' }}>
                        {formatCurrency(f.amount, loan.currency)}
                        {parseFloat(f.tax_rate) > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                            + {f.tax_rate}% GST
                          </div>
                        )}
                      </td>
                      <td><span className={`badge badge-yellow`}>{f.status.toUpperCase()}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{formatDate(f.created_at)}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => removeFee(f.id)}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Payment History & Breakdown</div>
            <button className="btn btn-primary btn-sm" onClick={() => {
                setPayForm({...EMPTY_PAYMENT, amount: loan.balance_due});
                setPayModal(true);
              }}>
                <Plus size={13} /> Add Payment
              </button>
          </div>
          {payments.length === 0 ? (
            <div className="empty"><div className="empty-text">No payments yet</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Total Cash Paid</th>
                    <th>→ Toward Interest</th>
                    <th>→ Toward Principal</th>
                    <th>Method / Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td>{formatDate(p.payment_date)}</td>
                      <td style={{ fontWeight: 600, color: '#16a34a', fontSize: 15 }}>
                        {formatCurrency(p.amount, loan.currency)}
                        {parseFloat(p.tax_rate) > 0 && !p.is_manual && (
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>+ {p.tax_rate}% TDS</div>
                        )}
                        {parseFloat(p.tax_amount) > 0 && p.is_manual && (
                          <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 400 }}>incl. {formatCurrency(p.tax_amount, loan.currency)} Tax</div>
                        )}
                      </td>
                      <td style={{ color: '#ea580c', fontWeight: 500 }}>
                        {formatCurrency(p.interest_component, loan.currency)}
                      </td>
                      <td style={{ color: '#2563eb', fontWeight: 500 }}>
                        {formatCurrency(p.principal_component, loan.currency)}
                      </td>
                      <td>
                        <span className="badge badge-blue" style={{ marginBottom: 4 }}>
                          {p.is_manual ? '🏦 Bank Match' : p.method.replace('_',' ')}
                        </span>
                        {p.notes && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.notes}</div>}
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => removePayment(p.id)}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'attachments' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Documents & Attachments</div>
            <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
              <Upload size={13} style={{ marginRight: 6 }} />
              {uploading ? 'Uploading...' : 'Upload File'}
              <input type="file" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
          {attachments.length === 0 ? (
            <div className="empty"><div className="empty-text">No documents uploaded yet</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Uploaded On</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attachments.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.original_name || a.file_name || a.filename || 'Document'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {a.uploaded_at ? (() => {
                          const d = new Date(a.uploaded_at);
                          const pad = (n) => n.toString().padStart(2, '0');
                          let hours = d.getHours();
                          const ampm = hours >= 12 ? 'pm' : 'am';
                          hours = hours % 12;
                          hours = hours ? hours : 12;
                          return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(hours)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
                        })() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <a href={`/api/attachments/${a.id}/download`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                            👁 View
                          </a>
                          <button className="btn btn-danger btn-sm" onClick={() => removeAttachment(a.id)}>
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'interest' && (
        <div className="card">
          <div className="card-title">Interest Accrual Ledger</div>
          {interest.length === 0 ? (
            <div className="empty"><div className="empty-text">No interest accrued yet</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Opening Balance</th>
                    <th>Interest Accrued</th>
                    <th>Closing Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {interest.map((row, idx) => (
                    <tr key={idx}>
                      <td>{formatDate(row.period_start)} to {formatDate(row.period_end)}</td>
                      <td>{formatCurrency(row.opening_balance, loan.currency)}</td>
                      <td style={{ color: '#ea580c', fontWeight: 600 }}>+ {formatCurrency(row.interest_accrued, loan.currency)}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(row.closing_balance, loan.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          <div className="card-title">Security & Audit Log</div>
          {audit.length === 0 ? (
            <div className="empty"><div className="empty-text">No audit history found</div></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((log, idx) => (
                    <tr key={idx}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(log.changed_at)}</td>
                      <td><span className="badge badge-blue">{log.action}</span></td>
                      <td>{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {preCloseModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPreCloseModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-title" style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} /> Foreclosure / Loan Settlement
            </div>

            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Current Balance Due (Incl. Interest):</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(loan.balance_due, loan.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                <span style={{ color: 'var(--text-secondary)' }}>+ Pre-Closure Penalty:</span>
                <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatCurrency(preCloseForm.penalty || 0, loan.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-color)', fontSize: 16 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Final Payoff Amount:</span>
                <span style={{ fontWeight: 700, color: '#16a34a' }}>
                  {formatCurrency(parseFloat(loan.balance_due) + (parseFloat(preCloseForm.penalty) || 0) + ((parseFloat(preCloseForm.penalty)||0) * (parseFloat(preCloseForm.tax_rate)||0)/100), loan.currency)}
                </span>
              </div>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="label">Pre-Closure Penalty Amount</label>
                <input className="input" type="number" min="0" step="0.01" value={preCloseForm.penalty} placeholder="0.00"
                  onChange={e => setPreCloseForm({...preCloseForm, penalty: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">GST / Tax on Penalty (%)</label>
                <input className="input" type="number" min="0" step="0.01" value={preCloseForm.tax_rate} placeholder="18"
                  onChange={e => setPreCloseForm({...preCloseForm, tax_rate: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Settlement Date</label>
                <input className="input" type="date" value={preCloseForm.date}
                  onChange={e => setPreCloseForm({...preCloseForm, date: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Payment Method</label>
                <select className="select" value={preCloseForm.method}
                  onChange={e => setPreCloseForm({...preCloseForm, method: e.target.value})}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => setPreCloseModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handlePreClose} disabled={saving} style={{ background: '#dc2626', border: 'none', color: 'white' }}>
                {saving ? 'Processing...' : 'Settle & Close Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {payModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPayModal(false)}>
          <div className="modal">
            <div className="modal-title">Record Payment</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <input type="checkbox" id="manual_split" checked={payForm.is_manual}
                     onChange={e => setPayForm({...payForm, is_manual: e.target.checked})}
                     style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="manual_split" style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>
                Manual Split (Match Bank Statement)
              </label>
            </div>

            {payForm.is_manual ? (
              <div className="grid-2" style={{ gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border-color)' }}>
                <div className="form-group">
                  <label className="label" style={{ color: '#2563eb' }}>Amount toward Principal *</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0.00"
                    value={payForm.principal_component} onChange={e => setPayForm({...payForm, principal_component: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="label" style={{ color: '#ea580c' }}>Amount toward Interest *</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0.00"
                    value={payForm.interest_component} onChange={e => setPayForm({...payForm, interest_component: e.target.value})} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="label" style={{ color: '#dc2626' }}>Tax / GST Deducted by Bank</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0.00"
                    value={payForm.tax_amount} onChange={e => setPayForm({...payForm, tax_amount: e.target.value})} />
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                Balance due: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(loan.balance_due, loan.currency)}</strong>
              </div>
            )}

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="label">Total Cash Deducted *</label>
                <input className="input" type="number" min="0" step="0.01"
                  value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} />
              </div>

              {!payForm.is_manual && (
                <div className="form-group">
                  <label className="label">Tax Rate (%) - e.g. 10 for TDS</label>
                  <input className="input" type="number" min="0" step="0.01"
                    value={payForm.tax_rate} placeholder="0.00" onChange={e => setPayForm({...payForm, tax_rate: e.target.value})} />
                </div>
              )}

              <div className="form-group">
                <label className="label">Date *</label>
                <input className="input" type="date" value={payForm.payment_date}
                  onChange={e => setPayForm({...payForm, payment_date: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Method</label>
                <select className="select" value={payForm.method}
                  onChange={e => setPayForm({...payForm, method: e.target.value})}>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="crypto">Crypto</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={payForm.notes} onChange={e => setPayForm({...payForm, notes: e.target.value})} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setPayModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={addPayment} disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}

      {feeModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setFeeModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Charge / Penalty</div>
            <div className="form-group">
              <label className="label">Charge Type *</label>
              <select className="select" value={feeForm.fee_name} onChange={e => setFeeForm({...feeForm, fee_name: e.target.value})}>
                <option value="Appraisal Fee">Appraisal Fee</option>
                <option value="Administrative Fee">Administrative Fee</option>
                <option value="Legal Fee">Legal Fee</option>
                <option value="Late Payment Penalty">Late Payment Penalty</option>
                <option value="Other Charge">Other Charge</option>
              </select>
            </div>

            <div className="form-group">
                <label className="label">Date Incurred *</label>
                <input className="input" type="date"
                  value={feeForm.created_at || ''}
                  onChange={e => setFeeForm({...feeForm, created_at: e.target.value})}
                />
              </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="label">Amount (Base) *</label>
                <input className="input" type="number" min="0" step="0.01" value={feeForm.amount} onChange={e => setFeeForm({...feeForm, amount: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Tax Rate (%) - e.g. 18 for GST</label>
                <input className="input" type="number" min="0" step="0.01" value={feeForm.tax_rate} placeholder="0.00" onChange={e => setFeeForm({...feeForm, tax_rate: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setFeeModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addFee} disabled={saving}>{saving ? 'Adding...' : 'Add Charge to Balance'}</button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal">
            <div className="modal-title">✏ Edit Loan Details</div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="label">Institution Type *</label>
                <select className="select" value={editForm.institution_type || 'non_institutional'}
                  onChange={e => setEditForm({...editForm, institution_type: e.target.value})}>
                  <option value="non_institutional">Non-Institutional (Informal)</option>
                  <option value="institutional">Institutional (Bank / Formal)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Principal Amount *</label>
                <input className="input" type="number" min="0" step="0.01"
                  value={editForm.principal}
                  onChange={e => setEditForm({...editForm, principal: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Currency</label>
                <select className="select" value={editForm.currency}
                  onChange={e => setEditForm({...editForm, currency: e.target.value})}>
                  <option value="INR">INR ₹</option>
                  <option value="EUR">EUR €</option>
                  <option value="USD">USD $</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Interest Rate (%)</label>
                <input className="input" type="number" min="0" step="0.01"
                  value={editForm.interest_rate}
                  onChange={e => setEditForm({...editForm, interest_rate: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Interest Type</label>
                <select className="select" value={editForm.interest_type}
                  onChange={e => setEditForm({...editForm, interest_type: e.target.value})}>
                  <option value="simple">Simple</option>
                  <option value="compound">Compound</option>
                </select>
              </div>
              <div className="form-group">
                <label className="label">Interest Period</label>
                <select className="select" value={editForm.interest_period}
                  onChange={e => setEditForm({...editForm, interest_period: e.target.value})}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              {/* --- NEW TENURE EDIT FIELD --- */}
              <div className="form-group">
                <label className="label">Tenure (in Months)</label>
                <input className="input" type="number" min="1" step="1"
                  value={editForm.tenure_months || ''}
                  onChange={e => setEditForm({...editForm, tenure_months: e.target.value})} />
              </div>
              {/* ----------------------------- */}
              <div className="form-group">
                <label className="label">Date Issued *</label>
                <input className="input" type="date" value={editForm.date_issued}
                  onChange={e => setEditForm({...editForm, date_issued: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">EMI Start Date</label>
                <input className="input" type="date" value={editForm.emi_start_date || ''}
                  onChange={e => setEditForm({...editForm, emi_start_date: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- NEW: Set Loan Target Modal --- */}
      {targetModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setTargetModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-title">🎯 Set Monthly Target</div>
            <div className="form-group">
              <label className="label">Monthly payment target for this loan ({loan.currency})</label>
              <input className="input" type="number" min="0" step="100"
                placeholder="e.g. 5000"
                value={targetAmount}
                onChange={e => setTargetAmount(e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                Track how much you want to collect or pay for this specific loan every month.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => setTargetModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTarget} disabled={savingTarget}>
                {savingTarget ? 'Saving...' : 'Save Target'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ---------------------------------- */}
    </div>
  );
}
