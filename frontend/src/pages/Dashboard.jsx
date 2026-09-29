import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { getDashboard, getTrends, getTargetsProgress, createTarget, updateTarget } from '../utils/api'
import { useBackupReminder } from '../hooks/useBackupReminder'
import { runFullBackup } from '../utils/export'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate, statusColor, directionColor } from '../utils/format'

// --- NEW: Time Travel Helper ---
const getRecentMonths = () => {
  const months = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    months.push({ value, label });
    d.setMonth(d.getMonth() - 1); // Go back one month
  }
  return months;
};
const recentMonths = getRecentMonths();
// -------------------------------

export default function Dashboard() {
  const [data, setData]       = useState(null)
  const [trends, setTrends]   = useState([])
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [targetModal, setTargetModal] = useState(false)
  const [targetAmount, setTargetAmount] = useState('')
  const [savingTarget, setSavingTarget] = useState(false)
  // Automatically default to the exact current month (e.g., '2026-07')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const { showReminder, lastBackup, markBackupDone, dismiss } = useBackupReminder()

  const load = () => {
    setLoading(true)
    // THE FIX: The Time Machine now powers the entire dashboard, not just the targets!
    Promise.all([
      getDashboard(selectedMonth || undefined),
      getTrends(18),
      getTargetsProgress(selectedMonth || undefined)
    ])
      .then(([d, t, tg]) => {
        setData(d.data)
        setTrends(t.data)
        setTargets(tg.data)
      })
      .finally(() => setLoading(false))
  }
  // Auto-reload data when the selected month changes!
  useEffect(() => { load() }, [selectedMonth])

  const handleBackup = async () => {
    try {
      const result = await runFullBackup()
      markBackupDone()
      toast.success(
        `Backup complete! ${result.results.json_export.records.loans} loans, ` +
        `${result.results.uploads.files_copied} files, ` +
        `${result.size_kb}KB saved to backups folder`
      )
    } catch {
      toast.error('Backup failed — check server logs')
    }
  }

  const saveTarget = async () => {
    setSavingTarget(true)
    try {
      await createTarget({ scope: 'global', monthly_amount: parseFloat(targetAmount), currency: 'INR' })
      toast.success('Target updated')
      setTargetModal(false)
      load()
    } catch { toast.error('Failed to save target') }
    finally { setSavingTarget(false) }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>
  if (!data)   return null

  const { summary, overdue, due_soon, recent_loans, unread_alerts } = data
  const netBalance = (summary.total_receivable || 0) - (summary.total_payable || 0)
  const netCashflow = (summary.expected_monthly_in || 0) - (summary.expected_monthly_out || 0)
  const expectedYield = summary.expected_yield || 0

  const globalTarget = targets.find(t => t.scope === 'global')
  const loanTargets  = targets.filter(t => t.scope === 'loan')

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Your loan overview</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Time Travel Picker (Bulletproof Dropdown) */}
          {/* Time Travel Picker (Bulletproof Dropdown) */}
          <select
            className="btn btn-secondary"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ cursor: 'pointer', appearance: 'none', paddingRight: '24px' }}
          >
            {recentMonths.map((m, index) => (
              <option key={m.value} value={m.value}>
                {index === 0 ? `📅 Current (${m.label})` : `📅 ${m.label}`}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={() => { setTargetAmount(globalTarget?.monthly_amount?.toString() || ''); setTargetModal(true) }}>🎯 Set Target</button>
          <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* Backup Reminder Banner */}
      {showReminder && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--alert-yellow-bg)', border: '1px solid var(--alert-yellow-border)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13
        }}>
          <span style={{ fontSize: 18 }}>💾</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {lastBackup ? `Last backup: ${lastBackup.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'You have never backed up your data'}
            </span>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Back up your loans, payments and attachments regularly
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleBackup}>
            💾 Backup Now
          </button>
          <button className="btn btn-secondary btn-sm" onClick={dismiss}>
            Later
          </button>
        </div>
      )}

      {unread_alerts > 0 && (
        <Link to="/alerts">
          <div className="alert-banner" style={{ marginBottom: 20 }}>
            🔴 {unread_alerts} unread alert{unread_alerts > 1 ? 's' : ''} require your attention →
          </div>
        </Link>
      )}

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}>📈</div>
            <div>
              <div className="stat-label">Total Receivable</div>
              <div className="stat-value" style={{ color: '#16a34a' }}>
                {formatCurrency(summary.total_receivable)}
              </div>
              <div className="stat-sub">{summary.active_lent_count} active loans</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#ffedd5' }}>📉</div>
            <div>
              <div className="stat-label">Total Payable</div>
              <div className="stat-value" style={{ color: '#ea580c' }}>
                {formatCurrency(summary.total_payable)}
              </div>
              <div className="stat-sub">{summary.active_borrowed_count} active loans</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fee2e2' }}>⚠️</div>
            <div>
              <div className="stat-label">Overdue</div>
              <div className="stat-value" style={{ color: '#dc2626' }}>{summary.overdue_count}</div>
              <div className="stat-sub">Need attention</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dbeafe' }}>✅</div>
            <div>
              <div className="stat-label">Settled</div>
              <div className="stat-value" style={{ color: '#2563eb' }}>{summary.settled_count}</div>
              <div className="stat-sub">Completed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div className="card">
          <div className="stat-label">Net Principal Balance</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}
            className={netBalance >= 0 ? 'balance-positive' : 'balance-negative'}>
            {formatCurrency(netBalance)}
          </div>
          <div className="stat-sub" style={{ marginTop: 4 }}>
            {netBalance >= 0 ? 'You are owed more than you owe' : 'You owe more than you are owed'}
          </div>
        </div>

        <div className="card">
          <div className="stat-label">Expected Monthly Cashflow</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}
            className={netCashflow >= 0 ? 'balance-positive' : 'balance-negative'}>
            {formatCurrency(netCashflow)} / mo
          </div>
          <div className="stat-sub" style={{ marginTop: 4 }}>
            Net EMI cashflow expected every 30 days
          </div>
        </div>

        <div className="card" style={{ background: 'var(--bg-tertiary)', border: '1px solid #bbf7d0' }}>
          <div className="stat-label">Lifetime Expected Yield</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: '#16a34a' }}>
            {formatCurrency(expectedYield)}
          </div>
          <div className="stat-sub" style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
            Total projected profit from active loans
          </div>
        </div>
      </div>

      {/* 18-Month Trend Chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Lending vs Borrowing — Last 18 Months</div>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={trends} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="cumulative_lent" name="Total Lent" stroke="#16a34a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cumulative_borrowed" name="Total Borrowed" stroke="#ea580c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Targets */}
      {targets.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Monthly Payment Targets — {targets[0]?.month}</div>
          <div className="grid-2" style={{ gap: 14 }}>
            {globalTarget && (
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>🎯 Overall Target</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatCurrency(globalTarget.paid_this_month, globalTarget.currency)} / {formatCurrency(globalTarget.monthly_amount, globalTarget.currency)}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${globalTarget.percentage}%`,
                    background: globalTarget.percentage >= 100 ? '#16a34a' : '#2563eb'
                  }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {globalTarget.percentage}% achieved · {formatCurrency(globalTarget.remaining, globalTarget.currency)} remaining
                </div>
              </div>
            )}
            {loanTargets.map(t => (
              <div key={t.target_id} style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Link to={`/loans/${t.loan_id}`} style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-link)' }}>
                     {t.person_name ? `${t.person_name}'s Goal` : 'Loan Target'}
                  </Link>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatCurrency(t.paid_this_month, t.currency)} / {formatCurrency(t.monthly_amount, t.currency)}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${t.percentage}%`,
                    background: t.percentage >= 100 ? '#16a34a' : '#2563eb'
                  }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {t.percentage}% achieved · {formatCurrency(t.remaining, t.currency)} remaining
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Overdue */}
        <div className="card">
          <div className="card-title">
            🔴 Overdue Loans
            <Link to="/loans?status=overdue" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-link)', fontWeight: 400 }}>
              View all
            </Link>
          </div>
          {overdue.length === 0 ? (
            <div className="empty"><div className="empty-text">No overdue loans 🎉</div></div>
          ) : overdue.map(loan => (
            <Link key={loan.id} to={`/loans/${loan.id}`}>
              <div className="loan-item" style={{ background: 'var(--alert-red-bg)', borderRadius: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{loan.person_name}</div>
                  <div style={{ fontSize: 12, color: '#dc2626' }}>{loan.days_overdue} days overdue</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(loan.balance_due, loan.currency)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDate(loan.due_date)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Due Soon */}
        <div className="card">
          <div className="card-title">
            🟡 Due Soon
            <Link to="/loans" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-link)', fontWeight: 400 }}>
              View all
            </Link>
          </div>
          {due_soon.length === 0 ? (
            <div className="empty"><div className="empty-text">No loans due in 7 days</div></div>
          ) : due_soon.map(loan => (
            <Link key={loan.id} to={`/loans/${loan.id}`}>
              <div className="loan-item" style={{ background: 'var(--alert-yellow-bg)', borderRadius: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{loan.person_name}</div>
                  <div style={{ fontSize: 12, color: '#d97706' }}>{loan.days_until_due} days left</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(loan.balance_due, loan.currency)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDate(loan.due_date)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Loans */}
      <div className="card">
        <div className="card-title">
          Recent Loans
          <Link to="/loans" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-link)', fontWeight: 400 }}>
            View all
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Direction</th>
                <th>Amount</th>
                <th>Balance</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent_loans.map(loan => (
                <tr key={loan.id}>
                  <td>
                    <Link to={`/loans/${loan.id}`} style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                      {loan.person_name}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge ${directionColor(loan.direction)}`}>
                      {loan.direction === 'lent' ? '↑ Lent' : '↓ Borrowed'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(loan.principal, loan.currency)}</td>
                  <td>{formatCurrency(loan.balance_due, loan.currency)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{formatDate(loan.due_date)}</td>
                  <td><span className={`badge ${statusColor(loan.status)}`}>{loan.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Set Target Modal */}
      {targetModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setTargetModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-title">🎯 Set Monthly Target</div>
            <div className="form-group">
              <label className="label">Overall monthly payment target (₹)</label>
              <input className="input" type="number" min="0" step="100"
                placeholder="e.g. 15000"
                value={targetAmount}
                onChange={e => setTargetAmount(e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                This tracks how much you pay across all loans each month.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setTargetModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTarget} disabled={savingTarget}>
                {savingTarget ? 'Saving...' : 'Save Target'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
