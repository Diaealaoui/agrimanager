// MainNavigator.tsx - Sidebar Navigation (Fixed)
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import DashboardScreen from '../screens/main/DashboardScreen'
import StatisticsScreen from '../screens/main/StatisticsScreen'
import TreatmentsScreen from '../screens/main/TreatmentsScreen'
import HistoryScreen from '../screens/main/HistoryScreen'
import PurchasesScreen from '../screens/main/PurchasesScreen'
import PurchaseDetailScreen from '../screens/main/PurchaseDetailScreen'
import OrderScreen from '../screens/main/OrderScreen'
import SettingsScreen from '../screens/main/SettingsScreen'
import StockBoxScreen from '../screens/main/StockBoxScreen'
import { colors } from '../utils/styles'

function MainNavigatorContent() {
  const [activeScreen, setActiveScreen] = useState('Dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const menuItems = [
    { id: 'Dashboard', label: 'Tableau de Bord', icon: '📊' },
    { id: 'Statistics', label: 'Statistiques', icon: '📈' },
    { id: 'Treatments', label: 'Traitements', icon: '🚜' },
    { id: 'Purchases', label: 'Achats & Stock', icon: '📦' },
    { id: 'PurchaseDetail', label: 'Détail Achats', icon: '📋' },
    { id: 'History', label: 'Historique', icon: '📜' },
    { id: 'StockBox', label: 'Stock Produits', icon: '🎁' },
    { id: 'Order', label: 'Commande', icon: '📝' },
    { id: 'Settings', label: 'Paramètres', icon: '⚙️' },
  ]

  const renderScreen = () => {
    switch (activeScreen) {
      case 'Dashboard': return <DashboardScreen />
      case 'Statistics': return <StatisticsScreen />
      case 'Treatments': return <TreatmentsScreen />
      case 'Purchases': return <PurchasesScreen />
      case 'PurchaseDetail': return <PurchaseDetailScreen />
      case 'History': return <HistoryScreen />
      case 'StockBox': return <StockBoxScreen />
      case 'Order': return <OrderScreen />
      case 'Settings': return <SettingsScreen />
      default: return <DashboardScreen />
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {/* Sidebar */}
      <View style={{
        width: sidebarCollapsed ? 70 : 250,
        backgroundColor: '#1e293b',
        borderRightWidth: 1,
        borderRightColor: '#334155',
      }}>
        {/* Toggle Button */}
        <TouchableOpacity
          onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            padding: 16,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: '#334155',
          }}
        >
          <Text style={{ color: 'white', fontSize: 24 }}>
            {sidebarCollapsed ? '☰' : '✕'}
          </Text>
        </TouchableOpacity>

        {/* Menu Items */}
        <ScrollView>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setActiveScreen(item.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                backgroundColor: activeScreen === item.id ? '#3b82f6' : 'transparent',
                borderLeftWidth: activeScreen === item.id ? 4 : 0,
                borderLeftColor: '#60a5fa',
              }}
            >
              <Text style={{ fontSize: 20, marginRight: 12 }}>{item.icon}</Text>
              {!sidebarCollapsed && (
                <Text style={{
                  color: 'white',
                  fontSize: 14,
                  fontWeight: activeScreen === item.id ? '600' : '400',
                }}>
                  {item.label}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Content */}
      <View style={{ flex: 1 }}>
        {renderScreen()}
      </View>
    </SafeAreaView>
  )
}

export default function MainNavigator() {
  return (
    <SafeAreaProvider>
      <MainNavigatorContent />
    </SafeAreaProvider>
  )
}