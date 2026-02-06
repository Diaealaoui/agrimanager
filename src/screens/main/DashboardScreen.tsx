import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  useWindowDimensions
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import { globalStyles, typography, colors, shadows } from '../../utils/styles'
import { formatCurrency } from '../../utils/helpers'
import { Feather } from '@expo/vector-icons'
import Sidebar from '../../components/layout/Sidebar'

interface DashboardStats {
  totalSpent: number
  totalOrders: number
  monthlyAvg: number
  topProducts: Array<{
    id?: string;
    name: string;
    amount: number;
    activeIngredients?: string[];
    supplier?: string;
    type?: string;
  }>
  topSuppliers: Array<{
    id: string;
    name: string;
    amount: number;
    orderCount: number;
  }>
  topActiveIngredients: Array<{
    id: string;
    name: string;
    count: number;
    totalAmount: number;
  }>
  parcelStats: Array<{
    id?: string;
    name: string;
    surface: number;
    cost: number;
    costPerHa: number;
  }>
  monthlyData: Array<{
    month: string;
    amount: number;
    orders: number;
    previousYearAmount?: number;
  }>
  productTypes: Array<{
    type: string;
    count: number;
    amount: number;
  }>
}

interface SearchResult {
  type: 'product' | 'supplier' | 'ingredient' | 'parcel' | 'type'
  id: string
  name: string
  details: string
  amount?: number
  icon: string
  color: string
}

export default function DashboardScreen() {
  const { user } = useAuth()
  const navigation = useNavigation()
  const { width } = useWindowDimensions()
  const isSmallScreen = width < 380
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const currentYear = new Date().getFullYear()
  const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'product' | 'supplier' | 'ingredient'>('all')
  const [selectedMetric, setSelectedMetric] = useState<'spending' | 'orders' | 'avg'>('spending')
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [sidebarVisible, setSidebarVisible] = useState(false)

  const [selectedItemDetails, setSelectedItemDetails] = useState<any>(null)
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false)

  const [allProducts, setAllProducts] = useState<any[]>([])
  const [allSuppliers, setAllSuppliers] = useState<any[]>([])
  const [allActiveIngredients, setAllActiveIngredients] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      loadDashboardData()
      loadAllDataForSearch()
    }
  }, [user, selectedYear])

  const loadDashboardData = async () => {
    if (!user) return
    try {
      setLoading(true)
      const result = await Database.getDashboardStats(user.id, selectedYear)
      if (result.success && result.stats) {
        setStats(result.stats)
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllDataForSearch = async () => {
    if (!user) return
    try {
      const [productsResult, suppliersResult, ingredientsResult] = await Promise.all([
        Database.getAllProducts(user.id),
        Database.getAllSuppliers(user.id),
        Database.getAllActiveIngredients(user.id)
      ])
      if (productsResult.success) setAllProducts(productsResult.products || [])
      if (suppliersResult.success) setAllSuppliers(suppliersResult.suppliers || [])
      if (ingredientsResult.success) setAllActiveIngredients(ingredientsResult.ingredients || [])
    } catch (error) {
      console.error('Error loading search data:', error)
    }
  }

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([])
      return
    }
    const query = searchQuery.toLowerCase().trim()
    const results: SearchResult[] = []

    if (selectedFilter === 'all' || selectedFilter === 'product') {
      allProducts
        .filter(product => 
          (product.nom || '').toLowerCase().includes(query) ||
          (product.type_produit || '').toLowerCase().includes(query) ||
          (product.matiere_active || '').toLowerCase().includes(query)
        )
        .forEach(product => {
          results.push({
            type: 'product',
            id: product.id,
            name: product.nom || 'Inconnu',
            details: `${product.type_produit || 'Non spécifié'} • MA: ${product.matiere_active || 'Aucune'}`,
            amount: product.totalAmount || 0,
            icon: 'package',
            color: colors.primary
          })
        })
    }

    if (selectedFilter === 'all' || selectedFilter === 'supplier') {
      allSuppliers
        .filter(supplier => supplier.name.toLowerCase().includes(query))
        .forEach(supplier => {
          results.push({
            type: 'supplier',
            id: supplier.id,
            name: supplier.name,
            details: `${supplier.orderCount} commandes`,
            amount: supplier.totalAmount,
            icon: 'building',
            color: colors.secondary
          })
        })
    }

    if (selectedFilter === 'all' || selectedFilter === 'ingredient') {
      allActiveIngredients
        .filter(ingredient => ingredient.name.toLowerCase().includes(query))
        .forEach(ingredient => {
          results.push({
            type: 'ingredient',
            id: ingredient.id,
            name: ingredient.name,
            details: `Utilisé dans ${ingredient.productCount} produits`,
            amount: ingredient.totalAmount,
            icon: 'flask',
            color: colors.gold
          })
        })
    }
    setSearchResults(results.slice(0, 10))
  }, [searchQuery, selectedFilter, allProducts, allSuppliers, allActiveIngredients])

  const handleSearchResultPress = (item: SearchResult) => {
    setIsSearching(false)
    if (item.type === 'product') {
      const fullProduct = allProducts.find(p => p.id === item.id)
      setSelectedItemDetails(fullProduct)
      setIsDetailModalVisible(true)
    } else if (item.type === 'ingredient') {
      const relatedProducts = allProducts.filter(p => 
        (p.matiere_active || '').toLowerCase().includes(item.name.toLowerCase())
      )
      setSelectedItemDetails({ name: item.name, isIngredient: true, products: relatedProducts })
      setIsDetailModalVisible(true)
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadDashboardData(), loadAllDataForSearch()])
    setRefreshing(false)
  }

  const growthData = useMemo(() => {
    if (!stats?.monthlyData || stats.monthlyData.length === 0) return null
    const currentYearTotal = stats.totalSpent
    const previousYearTotal = stats.monthlyData.reduce((sum, month) => sum + (month.previousYearAmount || 0), 0)
    if (previousYearTotal === 0) return null
    const growth = ((currentYearTotal - previousYearTotal) / previousYearTotal) * 100
    return { value: growth, isPositive: growth > 0, previousYearTotal }
  }, [stats])

  const chartValues = useMemo(() => {
    const data = stats?.monthlyData || []
    return data.map(month => {
      if (selectedMetric === 'orders') return month.orders || 0
      if (selectedMetric === 'avg') return month.orders ? month.amount / month.orders : 0
      return month.amount || 0
    })
  }, [stats, selectedMetric])

  const maxChartValue = useMemo(() => {
    if (chartValues.length === 0) return 0
    return Math.max(...chartValues)
  }, [chartValues])

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    )
  }

  const totalSpent = stats?.totalSpent || 0
  const totalOrders = stats?.totalOrders || 0
  const monthlyAvg = stats?.monthlyAvg || 0
  const topProducts = stats?.topProducts || []
  const topSuppliers = stats?.topSuppliers || []
  const productTypes = stats?.productTypes || []
  const parcelStats = stats?.parcelStats || []
  const monthlyData = stats?.monthlyData || []

  const selectedMonthData = selectedMonth ? monthlyData.find(m => m.month === selectedMonth) : null
  const selectedMonthIndex = selectedMonth ? monthlyData.findIndex(m => m.month === selectedMonth) : -1
  const selectedMonthLabel = selectedMonthData
    ? `${monthLabels[parseInt(selectedMonthData.month.split('-')[1], 10) - 1] || selectedMonthData.month.split('-')[1]} ${selectedYear}`
    : ''
  const formatMetricValue = (value: number) => {
    if (selectedMetric === 'orders') return `${Math.round(value)}`
    return formatCurrency(value)
  }
  const selectedMetricValue = selectedMonthIndex >= 0 ? chartValues[selectedMonthIndex] : null

  const content = (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      
      {/* Header with Search */}
      <View style={{ backgroundColor: colors.primary, padding: isSmallScreen ? 16 : 24, paddingTop: isSmallScreen ? 48 : 60, borderBottomLeftRadius: isSmallScreen ? 22 : 30, borderBottomRightRadius: isSmallScreen ? 22 : 30, ...shadows.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isSmallScreen ? 16 : 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
                <TouchableOpacity
                  onPress={() => setSidebarVisible(true)}
                  style={{
                    width: isSmallScreen ? 36 : 40,
                    height: isSmallScreen ? 36 : 40,
                    borderRadius: isSmallScreen ? 18 : 20,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                >
                  <Feather name="menu" size={isSmallScreen ? 18 : 20} color="white" />
                </TouchableOpacity>
                <View>
                  <Text style={[typography.h1, { color: colors.gold, marginBottom: 4, fontSize: isSmallScreen ? 24 : 32 }]}>Tableau de Bord</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: isSmallScreen ? 12 : 14 }}>Analyse financière d'exploitation</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsSearching(true)} style={{ width: isSmallScreen ? 40 : 44, height: isSmallScreen ? 40 : 44, borderRadius: isSmallScreen ? 20 : 22, backgroundColor: colors.gold, justifyContent: 'center', alignItems: 'center', ...shadows.md }}>
                <Feather name="search" size={isSmallScreen ? 20 : 22} color="white" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setIsSearching(true)} style={{ backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 16, paddingVertical: isSmallScreen ? 10 : 12, flexDirection: 'row', alignItems: 'center', ...shadows.sm }}>
              <Feather name="search" size={20} color={colors.textSecondary} />
              <Text style={{ marginLeft: 12, color: colors.textSecondary, fontSize: isSmallScreen ? 14 : 16, flex: 1 }} numberOfLines={1}>{searchQuery || "Rechercher produits, matières actives..."}</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', marginTop: isSmallScreen ? 16 : 20 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: colors.gold, fontSize: isSmallScreen ? 16 : 20, fontWeight: 'bold' }}>{formatCurrency(totalSpent)}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: isSmallScreen ? 11 : 12 }}>Dépenses</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: colors.gold, fontSize: isSmallScreen ? 16 : 20, fontWeight: 'bold' }}>{totalOrders}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: isSmallScreen ? 11 : 12 }}>Commandes</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: colors.gold, fontSize: isSmallScreen ? 16 : 20, fontWeight: 'bold' }}>{formatCurrency(monthlyAvg)}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: isSmallScreen ? 11 : 12 }}>Moyenne/mois</Text>
              </View>
            </View>
          </View>

          {/* Search Modal */}
          <Modal visible={isSearching} animationType="slide" transparent={true}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: isSmallScreen ? 60 : 80 }}>
              <View style={{ backgroundColor: colors.background, marginHorizontal: isSmallScreen ? 12 : 20, borderRadius: 20, maxHeight: '80%', ...shadows.xl }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={[typography.h3, { color: colors.primary }]}>Recherche</Text>
                  <TouchableOpacity onPress={() => setIsSearching(false)}><Feather name="x" size={24} color={colors.textSecondary} /></TouchableOpacity>
                </View>
                <View style={{ padding: 16 }}>
                  <TextInput style={globalStyles.input} placeholder="Tapez pour rechercher..." value={searchQuery} onChangeText={setSearchQuery} autoFocus />
                </View>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => `${item.type}-${item.id}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderAlt, flexDirection: 'row', alignItems: 'center' }} onPress={() => handleSearchResultPress(item)}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: item.color + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Feather name={item.icon as any} size={20} color={item.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.body, { fontWeight: '600' }]}>{item.name}</Text>
                        <Text style={[typography.caption, { color: colors.textSecondary }]}>{item.details}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </Modal>

          {/* Detail Modal */}
          <Modal visible={isDetailModalVisible} animationType="fade" transparent={true}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
              <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24, ...shadows.xl }}>
                <Text style={[typography.h2, { color: colors.primary, marginBottom: 8 }]}>{selectedItemDetails?.name || selectedItemDetails?.nom}</Text>
                
                {selectedItemDetails?.isIngredient ? (
                   <View>
                     <Text style={[typography.body, { marginBottom: 16 }]}>Utilisé dans {selectedItemDetails.products?.length} produits:</Text>
                     {selectedItemDetails.products?.map((p: any) => (
                       <View key={p.id} style={{ marginBottom: 12, padding: 12, backgroundColor: colors.backgroundAlt, borderRadius: 8 }}>
                         <Text style={{ fontWeight: 'bold', color: colors.primary }}>{p.nom}</Text>
                         <Text style={typography.small}>Stock: {p.stock_actuel} {p.unite_reference} • {formatCurrency(p.prix_moyen || 0)}/u</Text>
                         <TouchableOpacity onPress={() => { setIsDetailModalVisible(false); navigation.navigate('Order' as never, { prefilledProduct: p.nom } as any); }} style={{ marginTop: 8 }}>
                           <Text style={{ color: colors.gold, fontWeight: 'bold' }}>🛒 Commander</Text>
                         </TouchableOpacity>
                       </View>
                     ))}
                   </View>
                ) : (
                  <View>
                    <Text style={typography.body}>Type: {selectedItemDetails?.type_produit}</Text>
                    <Text style={typography.body}>MA: {selectedItemDetails?.matiere_active || 'N/A'}</Text>
                    <Text style={typography.body}>Stock: {selectedItemDetails?.stock_actuel} {selectedItemDetails?.unite_reference}</Text>
                    <Text style={[typography.h3, { color: colors.gold, marginVertical: 15 }]}>Dépenses: {formatCurrency(selectedItemDetails?.totalAmount || 0)}</Text>
                    <TouchableOpacity style={globalStyles.buttonGold} onPress={() => { setIsDetailModalVisible(false); navigation.navigate('Order' as never, { prefilledProduct: selectedItemDetails?.nom } as any); }}>
                      <Text style={globalStyles.buttonText}>🛒 Commander</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity onPress={() => setIsDetailModalVisible(false)} style={{ marginTop: 20, alignSelf: 'center' }}><Text style={{ color: colors.textSecondary }}>Fermer</Text></TouchableOpacity>
              </View>
            </View>
          </Modal>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isSmallScreen ? 16 : 20, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.gold]} />}>
            
            {/* Period Selection */}
            <View style={[globalStyles.card, { marginBottom: 20, padding: 16 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={[typography.h3, { color: colors.primary }]}>Période d'analyse</Text>
                {growthData && (
                  <Text style={{ color: growthData.isPositive ? colors.success : colors.danger, fontWeight: '600' }}>
                    {growthData.isPositive ? '▲' : '▼'} {Math.abs(growthData.value).toFixed(1)}% vs {selectedYear - 1}
                  </Text>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[currentYear, currentYear - 1, currentYear - 2].map(year => (
                  <TouchableOpacity key={year} onPress={() => setSelectedYear(year)} style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: selectedYear === year ? colors.primary : colors.backgroundAlt, borderRadius: 12, marginRight: 10, borderWidth: 2, borderColor: selectedYear === year ? colors.gold : colors.border }}>
                    <Text style={{ color: selectedYear === year ? 'white' : colors.text, fontWeight: '700' }}>{year}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Metrics */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 }}>
               {[
                 { key: 'spending', label: 'Dépenses', icon: 'dollar-sign', value: formatCurrency(totalSpent), color: colors.primary },
                 { key: 'orders', label: 'Commandes', icon: 'shopping-cart', value: totalOrders, color: colors.secondary },
                 { key: 'avg', label: 'Moyenne', icon: 'trending-up', value: formatCurrency(monthlyAvg), color: colors.gold }
               ].map(m => (
                 <View key={m.key} style={[globalStyles.metricCard, { flex: 0, width: isSmallScreen ? '48%' : '32%', marginHorizontal: 0, marginBottom: 10 }]}>
                    <Text style={[typography.small, { color: colors.textSecondary }]}>{m.label}</Text>
                    <Text style={{ color: m.color, fontWeight: '700', fontSize: 14 }}>{m.value}</Text>
                 </View>
               ))}
            </View>

            {/* Financial Trend Chart */}
            <View style={[globalStyles.card, { marginBottom: 20, padding: 16 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <Text style={[typography.h3, { color: colors.primary, marginBottom: isSmallScreen ? 8 : 0 }]}>📈 Évolution Mensuelle</Text>
                <View style={{ flexDirection: 'row', backgroundColor: colors.backgroundAlt, borderRadius: 12, padding: 4 }}>
                  {[
                    { key: 'spending', label: 'Dépenses' },
                    { key: 'orders', label: 'Commandes' },
                    { key: 'avg', label: 'Moy. cmd' }
                  ].map(metric => (
                    <TouchableOpacity
                      key={metric.key}
                      onPress={() => setSelectedMetric(metric.key as 'spending' | 'orders' | 'avg')}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: selectedMetric === metric.key ? colors.primary : 'transparent'
                      }}
                    >
                      <Text style={{ color: selectedMetric === metric.key ? 'white' : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                        {metric.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', height: 150, alignItems: 'flex-end', paddingBottom: 8 }}>
                  {monthlyData.map((m, i) => {
                    const value = chartValues[i] || 0
                    const barHeight = maxChartValue > 0 ? Math.max(8, (value / maxChartValue) * 110) : 8
                    const isSelected = selectedMonth === m.month
                    const monthIndex = parseInt(m.month.split('-')[1], 10) - 1
                    const label = monthLabels[monthIndex] || m.month.split('-')[1]

                    return (
                      <TouchableOpacity
                        key={m.month}
                        onPress={() => setSelectedMonth(m.month)}
                        activeOpacity={0.7}
                        style={{ width: isSmallScreen ? 34 : 40, marginHorizontal: 6, alignItems: 'center' }}
                      >
                        <View style={{
                          height: barHeight,
                          width: isSmallScreen ? 16 : 18,
                          borderRadius: 6,
                          backgroundColor: isSelected ? colors.gold : colors.primary,
                          opacity: value === 0 ? 0.3 : 1
                        }} />
                        <Text style={{ fontSize: 10, marginTop: 6, color: isSelected ? colors.primary : colors.textSecondary }}>{label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </ScrollView>

              {selectedMonthData ? (
                <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.backgroundAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={[typography.caption, { marginBottom: 6 }]}>{selectedMonthLabel}</Text>
                  <View style={{ flexDirection: isSmallScreen ? 'column' : 'row', justifyContent: 'space-between' }}>
                    <View style={{ marginBottom: isSmallScreen ? 8 : 0 }}>
                      <Text style={typography.small}>Dépenses</Text>
                      <Text style={[typography.h4, { color: colors.primary }]}>{formatCurrency(selectedMonthData.amount)}</Text>
                    </View>
                    <View style={{ alignItems: isSmallScreen ? 'flex-start' : 'flex-end' }}>
                      <Text style={typography.small}>Commandes</Text>
                      <Text style={[typography.h4, { color: colors.secondary }]}>{selectedMonthData.orders}</Text>
                    </View>
                  </View>
                  {selectedMetricValue !== null && (
                    <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={typography.small}>Indicateur sélectionné</Text>
                      <Text style={[typography.small, { color: colors.textSecondary }]}>{formatMetricValue(selectedMetricValue)}</Text>
                    </View>
                  )}
                  {selectedMonthData.previousYearAmount !== undefined && selectedMonthData.previousYearAmount > 0 && (
                    <View style={{ marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={typography.small}>Année précédente</Text>
                      <Text style={[typography.small, { color: colors.textSecondary }]}>{formatCurrency(selectedMonthData.previousYearAmount)}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={[typography.small, { textAlign: 'center', color: colors.textSecondary, marginTop: 8 }]}>
                  Appuyez sur un mois pour afficher le détail
                </Text>
              )}
            </View>

            {/* Top Expenses */}
            <View style={{ flexDirection: isSmallScreen ? 'column' : 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                <View style={[globalStyles.card, { flex: 1, marginRight: isSmallScreen ? 0 : 8, marginBottom: isSmallScreen ? 12 : 0, padding: 12 }]}>
                  <Text style={[typography.body, { fontWeight: '600', marginBottom: 8 }]}>Produits Top</Text>
                  {topProducts.slice(0, 3).map((p, i) => (
                    <Text key={i} style={typography.caption} numberOfLines={1}>• {p.name}: {formatCurrency(p.amount)}</Text>
                  ))}
                </View>
                <View style={[globalStyles.card, { flex: 1, marginLeft: isSmallScreen ? 0 : 8, padding: 12 }]}>
                  <Text style={[typography.body, { fontWeight: '600', marginBottom: 8 }]}>Fournisseurs Top</Text>
                  {topSuppliers.slice(0, 3).map((s, i) => (
                    <Text key={i} style={typography.caption} numberOfLines={1}>• {s.name}: {formatCurrency(s.amount)}</Text>
                  ))}
                </View>
            </View>

            {/* Product Distribution */}
            {productTypes.length > 0 && (
              <View style={[globalStyles.card, { marginBottom: 20, padding: 16 }]}>
                <Text style={[typography.h3, { color: colors.primary, marginBottom: 12 }]}>🏷️ Répartition par Type</Text>
                {productTypes.map((t, i) => (
                  <View key={i} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={typography.small}>{t.type}</Text>
                      <Text style={[typography.small, { fontWeight: 'bold' }]}>{formatCurrency(t.amount)}</Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: colors.borderAlt, borderRadius: 3, marginTop: 4 }}>
                      <View style={{ width: totalSpent > 0 ? `${(t.amount/totalSpent)*100}%` : '0%', height: '100%', backgroundColor: colors.gold, borderRadius: 3 }} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Parcel Costs Table */}
            <View style={[globalStyles.cardLuxury, { marginBottom: 32 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[typography.h2, { color: colors.primary }]}>🚜 Coût par Parcelle</Text>
                <TouchableOpacity onPress={() => navigation.navigate('History' as never)}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Voir l'historique →</Text>
                </TouchableOpacity>
              </View>
              {parcelStats.length > 0 ? (
                parcelStats.map((parcel, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => navigation.navigate('History' as never, { parcelle: parcel.name } as any)}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: index < parcelStats.length - 1 ? 1 : 0, borderBottomColor: colors.borderAlt }}
                  >
                    <View>
                      <Text style={{ fontWeight: '600' }}>{parcel.name}</Text>
                      <Text style={typography.small}>{parcel.surface.toFixed(2)} ha</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                       <Text style={{ color: colors.primary, fontWeight: '700' }}>{formatCurrency(parcel.cost)}</Text>
                       <Text style={{ color: colors.gold, fontSize: 11 }}>{formatCurrency(parcel.costPerHa)}/ha</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={{ textAlign: 'center', color: colors.textSecondary, padding: 20 }}>Aucune donnée disponible</Text>
              )}
            </View>

          </ScrollView>
      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  )

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {Platform.OS === 'web' ? (
        content
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          {content}
        </TouchableWithoutFeedback>
      )}
    </KeyboardAvoidingView>
  )
}