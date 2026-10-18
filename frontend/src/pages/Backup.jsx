import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Database, HardDrive, RefreshCw } from 'lucide-react'
import api from '../utils/api'

export default function Backup() {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [backingUp, setBackingUp] = useState(false)

  const loadBackups = () => {
    setLoading(true)
    api.get('/backup/list')
    .then(r => setBackups(Array.isArray(r.data) ? r.data : []))
    .catch(() => toast.error('Failed to load backups'))
    .finally(() => setLoading(false))
  }

  useEffect(() => { loadBackups() }, [])

  const runBackup = async () => {
    if (!confirm('Run a full system backup now? This might take a few moments.')) return
      setBackingUp(true)

      try {
        const res = await api.post('/backup/run')
        const data = res.data

        if (data.status === 'ok') {
          toast.success('Backup completed successfully!')
          loadBackups()
        } else {
          toast.error(data.error || 'Backup failed')
        }
      } catch {
        toast.error('Network error while running backup')
      } finally {
        setBackingUp(false)
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
    <div className="page-title">System Backup</div>
    <div className="page-sub">Generate and manage manual data backups</div>
    </div>
    <button className="btn btn-primary" onClick={runBackup} disabled={backingUp} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    {backingUp ? <RefreshCw size={14} className="spin" /> : <Database size={14} />}
    {backingUp ? 'Generating Backup...' : 'Run Full Backup Now'}
    </button>
    </div>

    <div className="card">
    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <HardDrive size={16} /> Backup History
    </div>

    {loading ? (
      <div className="spinner-wrap"><div className="spinner" /></div>
    ) : backups.length === 0 ? (
      <div className="empty"><div className="empty-text">No backups found. Run your first backup!</div></div>
    ) : (
      <div className="table-wrap">
      <table>
      <thead>
      <tr><th>Backup Directory Name</th><th>Date Created</th><th>Total Size</th><th>Contents</th></tr>
      </thead>
      <tbody>
      {backups.map(b => (
        <tr key={b.name}>
        <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12, color: '#2563eb' }}>{b.name}</td>
        <td>{formatDate(b.created)}</td>
        <td style={{ fontWeight: 600 }}>{b.size_kb} KB</td>
        <td style={{ color: 'var(--text-secondary)' }}>JSON Data, SQL Dump, & Uploads</td>
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
