import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

// ── Dashboard ─────────────────────────────────
export const getDashboard = (month) => api.get('/dashboard/', { params: { month } })

// ── Persons ───────────────────────────────────
export const getPersons = (includeArchived = false) =>
  api.get(`/persons/?include_archived=${includeArchived}`)
export const getPerson = (id) => api.get(`/persons/${id}`)
export const createPerson = (data) => api.post('/persons/', data)
export const updatePerson = (id, data) => api.patch(`/persons/${id}`, data)
export const deletePerson = (id) => api.delete(`/persons/${id}`)

// ── Loans ─────────────────────────────────────
export const getLoans = (params = {}) => api.get('/loans/', { params })
export const getLoan = (id) => api.get(`/loans/${id}`)
export const createLoan = (data) => api.post('/loans/', data)
export const updateLoan = (id, data) => api.patch(`/loans/${id}`, data)
export const deleteLoan = (id) => api.delete(`/loans/${id}`)
export const cancelLoan = (id) => api.post(`/loans/${id}/cancel`)
export const getLoanPayments = (id) => api.get(`/loans/${id}/payments`)
export const getLoanAttachments = (id) => api.get(`/loans/${id}/attachments`)
export const getLoanAlerts = (id) => api.get(`/loans/${id}/alerts`)
export const getLoanInterest = (id) => api.get(`/loans/${id}/interest`)
export const getLoanAudit = (id) => api.get(`/loans/${id}/audit`)

// ── Payments ──────────────────────────────────
export const createPayment = (data) => api.post('/payments/', data)
export const updatePayment = (id, data) => api.patch(`/payments/${id}`, data)
export const deletePayment = (id) => api.delete(`/payments/${id}`)

// ── Attachments ───────────────────────────────
export const uploadAttachment = (loanId, formData) =>
  api.post(`/attachments/loan/${loanId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
export const deleteAttachment = (id) => api.delete(`/attachments/${id}`)

// ── Alerts ────────────────────────────────────
export const getAlerts = () => api.get('/alerts/')
export const dismissAlert = (id) => api.post(`/alerts/${id}/dismiss`)
export const dismissAllAlerts = () => api.post('/alerts/dismiss-all')

export default api

// ── Trends & Targets ──────────────────────────
export const getTrends = (months = 18) => api.get(`/dashboard/trends?months=${months}`)
export const getTargets = () => api.get('/targets/')
export const getTargetsProgress = (month) => api.get('/targets/progress', { params: { month } })
export const getGlobalTarget = (month) => api.get('/targets/global', { params: { month } })
export const getLoanTarget = (loanId, month) => api.get(`/targets/loan/${loanId}`, { params: { month } })
export const createTarget = (data) => api.post('/targets/', data)
export const updateTarget = (id, data) => api.patch(`/targets/${id}`, data)
export const deleteTarget = (id) => api.delete(`/targets/${id}`)
// --- LOAN FEES API ---
export const getLoanFees = (loanId) => api.get(`/loan-fees/loan/${loanId}`)
export const createLoanFee = (data) => api.post('/loan-fees/', data)
export const deleteLoanFee = (id) => api.delete(`/loan-fees/${id}`)
