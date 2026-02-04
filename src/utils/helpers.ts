import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export const formatDate = (dateString: string, formatStr: string = 'dd/MM/yyyy'): string => {
  try {
    return format(parseISO(dateString), formatStr, { locale: fr })
  } catch {
    return dateString
  }
}

export const getStockLevel = (stock: number, typeProduit: string): { level: string; badgeClass: string } => {
  let threshold = 5
  const typeLower = typeProduit.toLowerCase()
  
  if (typeLower.includes('insecticide')) threshold = 1
  else if (typeLower.includes('engrais')) threshold = 100
  
  if (stock < threshold) return { level: 'Faible', badgeClass: 'badgeLow' }
  if (stock < threshold * 5) return { level: 'Moyen', badgeClass: 'badgeMedium' }
  return { level: 'Élevé', badgeClass: 'badgeHigh' }
}