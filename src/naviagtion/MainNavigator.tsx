// MainNavigator.tsx - Sidebar Navigation (Fixed)
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Modal, Pressable, useWindowDimensions, StyleSheet } from 'react-native'
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
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false)
  const { width } = useWindowDimensions()
  const isMobile = width < 768

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

  const handleMenuSelect = (screenId: string) => {
    setActiveScreen(screenId)
    setMobileMenuVisible(false)
  }

  return (
    <SafeAreaView style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {/* Sidebar */}
      {!isMobile && (
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
      )}

      {/* Main Content */}
      <View style={{ flex: 1 }}>
        {isMobile && (
          <TouchableOpacity
            onPress={() => setMobileMenuVisible(true)}
            style={styles.mobileMenuButton}
          >
            <Text style={styles.mobileMenuIcon}>☰</Text>
          </TouchableOpacity>
        )}
        {renderScreen()}
      </View>

      {isMobile && (
        <Modal
          transparent
          animationType="fade"
          visible={mobileMenuVisible}
          onRequestClose={() => setMobileMenuVisible(false)}
        >
          <View style={styles.mobileMenuOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMobileMenuVisible(false)} />
            <View style={styles.mobileMenuDrawer}>
              <View style={styles.mobileMenuHeader}>
                <Text style={styles.mobileMenuTitle}>Menu</Text>
                <TouchableOpacity onPress={() => setMobileMenuVisible(false)}>
                  <Text style={styles.mobileMenuClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {menuItems.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleMenuSelect(item.id)}
                    style={[
                      styles.mobileMenuItem,
                      activeScreen === item.id && styles.mobileMenuItemActive
                    ]}
                  >
                    <Text style={styles.mobileMenuItemIcon}>{item.icon}</Text>
                    <Text style={[
                      styles.mobileMenuItemLabel,
                      activeScreen === item.id && styles.mobileMenuItemLabelActive
                    ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
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

const styles = StyleSheet.create({
  mobileMenuButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 20,
    backgroundColor: '#1e293b',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  mobileMenuIcon: {
    color: 'white',
    fontSize: 22,
  },
  mobileMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
  },
  mobileMenuDrawer: {
    width: 280,
    backgroundColor: '#1e293b',
    paddingTop: 48,
    paddingHorizontal: 12,
    paddingBottom: 20,
    height: '100%',
  },
  mobileMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  mobileMenuTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  mobileMenuClose: {
    color: 'white',
    fontSize: 20,
  },
  mobileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  mobileMenuItemActive: {
    backgroundColor: '#3b82f6',
  },
  mobileMenuItemIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  mobileMenuItemLabel: {
    color: 'white',
    fontSize: 14,
  },
  mobileMenuItemLabelActive: {
    fontWeight: '700',
  },
})