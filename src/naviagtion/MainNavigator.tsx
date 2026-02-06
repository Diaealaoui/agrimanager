// MainNavigator.tsx - Stack Navigation (Mobile-friendly)
import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import DashboardScreen from '../screens/main/DashboardScreen'
import StatisticsScreen from '../screens/main/StatisticsScreen'
import TreatmentsScreen from '../screens/main/TreatmentsScreen'
import HistoryScreen from '../screens/main/HistoryScreen'
import PurchasesScreen from '../screens/main/PurchasesScreen'
import PurchaseDetailScreen from '../screens/main/PurchaseDetailScreen'
import OrderScreen from '../screens/main/OrderScreen'
import SettingsScreen from '../screens/main/SettingsScreen'
import StockBoxScreen from '../screens/main/StockBoxScreen'

const Stack = createStackNavigator()

export default function MainNavigator() {
  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Dashboard">
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Statistics" component={StatisticsScreen} />
        <Stack.Screen name="Treatments" component={TreatmentsScreen} />
        <Stack.Screen name="Purchases" component={PurchasesScreen} />
        <Stack.Screen name="PurchaseDetail" component={PurchaseDetailScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="StockBox" component={StockBoxScreen} />
        <Stack.Screen name="Order" component={OrderScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </SafeAreaProvider>
  )
}