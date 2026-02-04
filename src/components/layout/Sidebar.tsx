import React from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../../hooks/useAuth'
import { typography, colors } from '../../utils/styles'

interface SidebarProps {
  isVisible: boolean
  onClose: () => void
}

const menuItems = [
  { id: 'Dashboard', label: '📊 Tableau de Bord', screen: 'Dashboard' },
  { id: 'Statistics', label: '📈 Statistiques', screen: 'Statistics' },
  { id: 'Treatments', label: '🚜 Traitements', screen: 'Treatments' },
  { id: 'Purchases', label: '🛒 Achats & Stock', screen: 'Purchases' },
  { id: 'StockBox', label: '📦 Stock Box', screen: 'StockBox' },
  { id: 'History', label: '📜 Historique', screen: 'History' },
  { id: 'Order', label: '📝 Commande', screen: 'Order' },
  { id: 'Settings', label: '⚙️ Paramètres', screen: 'Settings' },
]

export default function Sidebar({ isVisible, onClose }: SidebarProps) {
  const navigation = useNavigation()
  const { signOut } = useAuth()

  if (!isVisible) return null

  const handleNavigation = (screen: string) => {
    navigation.navigate(screen as never)
    onClose()
  }

  return (
    <View style={{
      position: 'absolute',
      top: 0, left: 0, bottom: 0,
      width: 280,
      backgroundColor: 'white',
      zIndex: 1000,
      elevation: 10,
    }}>
      <View style={{ backgroundColor: colors.primary, padding: 20, paddingTop: 50 }}>
        <Text style={[typography.h1, { color: 'white' }]}>AgriManager</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: 16 }}>
        {menuItems.map(item => (
          <TouchableOpacity
            key={item.id}
            onPress={() => handleNavigation(item.screen)}
            style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8 }}
          >
            <Text style={{ color: colors.text, fontSize: 16 }}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#eee' }}>
        <TouchableOpacity onPress={() => signOut()} style={{ backgroundColor: colors.danger, padding: 12, borderRadius: 8, alignItems: 'center' }}>
          <Text style={{ color: 'white', fontWeight: '600' }}>Déconnexion</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}