import { format, formatDistanceToNow, isPast, isToday } from 'date-fns'

export const formatCurrency = (amount, currency = 'INR') => {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: currency, maximumFractionDigits: 2
  }).format(amount)
}

export const formatDate = (date) => {
  if (!date) return '—'
  return format(new Date(date), 'dd MMM yyyy')
}

export const formatDateTime = (date) => {
  if (!date) return '—'
  return format(new Date(date), 'dd MMM yyyy, hh:mm a')
}

export const formatRelative = (date) => {
  if (!date) return '—'
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export const statusColor = (status) => {
  switch (status) {
    case 'active':    return 'badge-blue'
    case 'partial':   return 'badge-yellow'
    case 'settled':   return 'badge-green'
    case 'overdue':   return 'badge-red'
    case 'cancelled': return 'badge-gray'
    case 'defaulted': return 'badge-red' // <--- NEW
    default:          return 'badge-gray'
  }
}

export const directionColor = (direction) =>
  direction === 'lent' ? 'badge-green' : 'badge-orange'

export const relationshipLabel = (r) => {
  const map = {
    friend: '👫 Friend', family: '👨‍👩‍👧 Family',
    colleague: '💼 Colleague', acquaintance: '🤝 Acquaintance', other: '👤 Other'
  }
  return map[r] || r
}
