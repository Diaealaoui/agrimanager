import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import PurchasesScreen from './PurchasesScreen'
import StockBoxScreen from './StockBoxScreen'
import PurchaseDetailScreen from './PurchaseDetailScreen'
import OrderScreen from './OrderScreen'
import Header from '../../components/layout/Header'
import { typography, colors } from '../../utils/styles'

export default function StockMainScreen() {
  const [activeScreen, setActiveScreen] = useState<'purchases' | 'stock-box' | 'purchase-detail' | 'order'>('purchases')

  const navItems = [
    { id: 'purchases' as const, label: 'Achats & Stock', icon: '🛒' },
    { id: 'stock-box' as const, label: 'Inventaire', icon: '📦' },
    { id: 'purchase-detail' as const, label: 'Détail des Achats', icon: '📊' },
    { id: 'order' as const, label: 'Bon de Commande', icon: '📋' },
  ]

  const renderContent = () => {
    switch (activeScreen) {
      case 'purchases':
        return <PurchasesScreen />
      case 'stock-box':
        return <StockBoxScreen />
      case 'purchase-detail':
        return <PurchaseDetailScreen />
      case 'order':
        return <OrderScreen />
      default:
        return <PurchasesScreen />
    }
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      {/* Sidebar */}
      <View style={{
        width: 200,
        backgroundColor: '#1e293b',
        paddingTop: 60,
        paddingHorizontal: 8,
      }}>
        <Text style={{
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold',
          paddingHorizontal: 12,
          paddingBottom: 20,
          borderBottomWidth: 1,
          borderBottomColor: '#334155',
          marginBottom: 8,
        }}>
          📦 Stock
        </Text>
        
        <ScrollView>
          {navItems.map(item => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setActiveScreen(item.id)}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 12,
                marginVertical: 4,
                borderRadius: 8,
                backgroundColor: activeScreen === item.id ? colors.primary : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 20, marginRight: 8 }}>
                {item.icon}
              </Text>
              <Text style={{
                color: activeScreen === item.id ? 'white' : '#94a3b8',
                fontSize: 13,
                fontWeight: activeScreen === item.id ? '600' : '400',
              }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Content */}
      <View style={{ flex: 1 }}>
        {renderContent()}
      </View>
    </View>
  )
}