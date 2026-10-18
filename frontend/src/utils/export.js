import api from './api'

export const downloadFile = (url, filename) => {
  const token = localStorage.getItem('token');
  const authUrl = url.includes('?') ? `${url}&token=${token}` : `${url}?token=${token}`;

  const a = document.createElement('a')
  a.href = authUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export const exportLoansCSV = () =>
downloadFile('/api/export/loans/csv', 'loans_export.csv')

export const exportLoanStatement = (loanId) =>
downloadFile(`/api/export/loans/${loanId}/statement`, `statement_${loanId}.txt`)

export const exportPaymentsCSV = (loanId) =>
downloadFile(`/api/export/loans/${loanId}/payments/csv`, `payments_${loanId}.csv`)

export const fullBackup = () =>
downloadFile('/api/export/full-backup', 'loan_tracker_backup.json')

export const runFullBackup = async () => {
  const response = await api.post('/backup/run')
  return response.data
}

export const listBackups = async () => {
  const response = await api.get('/backup/list')
  return response.data
}
