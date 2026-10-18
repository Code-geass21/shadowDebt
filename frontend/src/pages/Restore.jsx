import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../utils/api'

export default function Restore() {
  const [backups, setBackups]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [restoring, setRestoring] = useState(false)
  const [result, setResult]     = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/restore/backups')
    .then(r => setBackups(r.data))
    .catch(() => {})
    .finally(() => setLoading(false))
  }, [])

  const restoreFromFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
      if (!confirm(`Restore from "${file.name}"?\n\nThis will DELETE all current data and replace it with the backup. This cannot be undone.`)) {
        e.target.value = ''
        return
      }
      setRestoring(true)
      setResult(null)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await api.post('/restore/from-json', fd, { headers: { 'Content-Type': 'multipart/form-data' }})
        const data = res.data

        if (data.status === 'ok') {
          setResult(data)
          toast.success(`Restored successfully! ${data.summary.loans} loans, ${data.summary.persons} persons`)
        } else {
          toast.error(data.error || 'Restore failed')
        }
      } catch {
        toast.error('Restore failed — check the file and try again')
      } finally {
        setRestoring(false)
        e.target.value = ''
      }
  }

  const formatDate = (str) => {
    if (!str || str.length < 13) return str
      return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)} ${str.slice(9,11)}:${str.slice(11,13)}`
  }

  return (
    <div>
    <div className="page-header">
    <div>
    <div className="page-title">Restore Data</div>
    <div className="page-sub">Restore from a previous backup</div>
    </div>
    </div>

    <div style={{ background: 'var(--alert-red-bg)', border: '1px solid var(--alert-red-border)', borderRadius: 10, padding: '14px 16px', marginBottom: 24, fontSize: 13 }}>
    <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>⚠ Important — Read before restoring</div>
    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
    Restoring will <strong>permanently delete all current data</strong> (persons, loans, payments, targets)
    and replace it with the backup contents. Uploaded files (photos, PDFs) are not affected by JSON restore.
    </div>
    </div>

    <div className="card" style={{ marginBottom: 20 }}>
    <div className="card-title">📂 Upload Backup File</div>
    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
    Select a <code style={{ background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 4 }}>data_*.json</code> file
    </div>
    <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
    {restoring ? '⏳ Restoring...' : '📂 Choose Backup File'}
    <input type="file" accept=".json" style={{ display: 'none' }} onChange={restoreFromFile} disabled={restoring} />
    </label>
    </div>

    {result && (
      <div className="card" style={{ marginBottom: 20, border: '1px solid #16a34a' }}>
      <div className="card-title" style={{ color: '#16a34a' }}>✅ Restore Complete</div>
      <div className="grid-4" style={{ gap: 10 }}>
      {Object.entries(result.summary).map(([key, val]) => (
        <div key={key} style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{val}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{key}</div>
        </div>
      ))}
      </div>
      <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/dashboard')}>
      Go to Dashboard →
      </button>
      </div>
    )}

    <div className="card">
    <div className="card-title">📋 Available Backups</div>
    {loading ? (
      <div className="spinner-wrap"><div className="spinner" /></div>
    ) : backups.length === 0 ? (
      <div className="empty"><div className="empty-text">No backups found in the backups folder yet</div></div>
    ) : (
      <div className="table-wrap">
      <table>
      <thead>
      <tr><th>Backup Name</th><th>Date & Time</th><th>Size</th><th>Files</th></tr>
      </thead>
      <tbody>
      {backups.map(b => (
        <tr key={b.name}>
        <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{b.name}</td>
        <td>{formatDate(b.created)}</td>
        <td>{b.size_kb} KB</td>
        <td style={{ color: 'var(--text-secondary)' }}>{b.files ? b.files.length : 'Multiple'} files</td>
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
