import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPerson, getLoans } from '../utils/api'
import { formatCurrency, formatDate, statusColor, directionColor, relationshipLabel } from '../utils/format'
import { ArrowLeft } from 'lucide-react'

export default function PersonDetail() {
  const { id } = useParams()
  const [person, setPerson] = useState(null)
  const [loans, setLoans]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getPerson(id),
      getLoans({ person_id: id })
    ]).then(([p, l]) => {
      setPerson(p.data)
      setLoans(l.data)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>
  if (!person) return <div className="empty"><div className="empty-text">Person not found</div></div>

  const totalLent     = loans.filter(l => l.direction === 'lent').reduce((s, l) => s + parseFloat(l.principal), 0)
  const totalBorrowed = loans.filter(l => l.direction === 'borrowed').reduce((s, l) => s + parseFloat(l.principal), 0)
  // THE FIX: Subtract borrowed balances from lent balances to get the True Net Balance
  const totalBalance  = loans.reduce((s, l) => {
    const balance = parseFloat(l.balance_due);
    return l.direction === 'lent' ? s + balance : s - balance;
  }, 0)

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link to="/people" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-link)', fontSize: 13 }}>
          <ArrowLeft size={14} /> Back to People
        </Link>
      </div>

      {/* Person header */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: '#dbeafe', color: 'var(--text-link)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 24
          }}>
            {person.full_name[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{person.full_name}</div>
            {person.nickname && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>"{person.nickname}"</div>}
            <span className="badge badge-blue" style={{ marginTop: 6 }}>{relationshipLabel(person.relationship)}</span>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {person.phone      && <div className="detail-row"><span className="detail-label">📞 Phone</span><span className="detail-value">{person.phone}</span></div>}
          {person.email      && <div className="detail-row"><span className="detail-label">✉️ Email</span><span className="detail-value">{person.email}</span></div>}
          {person.national_id && <div className="detail-row"><span className="detail-label">🪪 ID</span><span className="detail-value">{person.national_id}</span></div>}
          {person.address    && <div className="detail-row"><span className="detail-label">📍 Address</span><span className="detail-value">{person.address}</span></div>}
        </div>
        {person.notes && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            {person.notes}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Total Lent</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{formatCurrency(totalLent)}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Total Borrowed</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#ea580c' }}>{formatCurrency(totalBorrowed)}</div>
        </div>
        {/* THE FIX: Replaced the Outstanding Balance card */}
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Net Outstanding Balance</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: totalBalance > 0 ? '#16a34a' : totalBalance < 0 ? '#dc2626' : '#2563eb' }}>
            {formatCurrency(Math.abs(totalBalance))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {totalBalance > 0 ? 'They owe you' : totalBalance < 0 ? 'You owe them' : 'Fully Settled'}
          </div>
        </div>
      </div>

      {/* Loans */}
      <div className="card">
        <div className="card-title">Loan History ({loans.length})</div>
        {loans.length === 0 ? (
          <div className="empty"><div className="empty-text">No loans with this person yet</div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Direction</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Purpose</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loans.map(loan => (
                  <tr key={loan.id}>
                    <td><span className={`badge ${directionColor(loan.direction)}`}>{loan.direction === 'lent' ? '↑ Lent' : '↓ Borrowed'}</span></td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(loan.principal, loan.currency)}</td>
                    <td>{formatCurrency(loan.balance_due, loan.currency)}</td>
                    <td>{formatDate(loan.due_date)}</td>
                    <td><span className={`badge ${statusColor(loan.status)}`}>{loan.status}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{loan.purpose || '—'}</td>
                    <td><Link to={`/loans/${loan.id}`} style={{ color: 'var(--text-link)', fontSize: 12 }}>View →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
