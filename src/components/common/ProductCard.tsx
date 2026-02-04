import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { globalStyles, typography, colors } from '../../utils/styles'
import { formatCurrency, getStockLevel } from '../../utils/helpers'

interface ProductCardProps {
  product: any
  onPress?: () => void
}

export default function ProductCard({ product, onPress }: ProductCardProps) {
  const stockValue = (product.stock_actuel || 0) * (product.prix_moyen || 0)
  const stockInfo = getStockLevel(product.stock_actuel || 0, product.type_produit || '')
  
  const badgeStyle = globalStyles[stockInfo.badgeClass as keyof typeof globalStyles]
  const badgeTextStyle = globalStyles[`badgeText${stockInfo.level}` as keyof typeof globalStyles]

  const CardContent = (
    <View style={globalStyles.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.h3, { marginBottom: 4 }]}>{product.nom}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={[globalStyles.badge, badgeStyle]}>
              <Text style={badgeTextStyle}>{stockInfo.level}</Text>
            </View>
            <Text style={[typography.small, { marginLeft: 8 }]}>{product.type_produit}</Text>
          </View>
          {product.matiere_active && (
            <Text style={[typography.small, { color: colors.textSecondary }]}>
              MA: {product.matiere_active}
            </Text>
          )}
        </View>
        
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.h3, { color: colors.primaryLight }]}>
            {product.stock_actuel?.toFixed(2) || '0'} {product.unite_reference}
          </Text>
          <Text style={[typography.caption, { color: colors.secondary }]}>
            {formatCurrency(stockValue)}
          </Text>
        </View>
      </View>
    </View>
  )

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{CardContent}</TouchableOpacity>
  }
  
  return CardContent
}