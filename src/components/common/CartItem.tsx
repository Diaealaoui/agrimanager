import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { globalStyles, typography, colors } from '../../utils/styles'
import { formatCurrency } from '../../utils/helpers'

interface CartItemProps {
  item: any
  index: number
  onRemove: (index: number) => void
}

export default function CartItem({ item, index, onRemove }: CartItemProps) {
  const ht = item.quantite * item.prix
  const ttc = ht * (1 + item.tva / 100)

  return (
    <View style={[globalStyles.card, { marginBottom: 8 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.body, { fontWeight: '600', marginBottom: 4 }]}>
            {item.produit}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 2 }]}>
            {item.type} • {item.quantite} {item.unite}
          </Text>
          <Text style={[typography.small, { color: colors.textSecondary }]}>
            {item.prix} MAD x {item.quantite} • TVA {item.tva}%
          </Text>
        </View>
        
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[typography.h3, { color: colors.primary }]}>
            {formatCurrency(ttc)}
          </Text>
          <TouchableOpacity
            onPress={() => onRemove(index)}
            style={{ marginTop: 8, padding: 8 }}
          >
            <Text style={{ color: colors.danger, fontSize: 14 }}>❌ Retirer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}