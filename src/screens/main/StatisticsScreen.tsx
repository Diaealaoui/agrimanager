import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, ActivityIndicator, Dimensions, TouchableOpacity, TextInput, StyleSheet } from 'react-native'
import { LineChart, PieChart } from 'react-native-chart-kit'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import Header from '../../components/layout/Header'
import { globalStyles, typography, colors } from '../../utils/styles'
import { formatCurrency } from '../../utils/helpers'

const screenWidth = Dimensions.get('window').width

export default function StatisticsScreen() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [stats, setStats] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('monthly') // 'monthly', 'category', 'parcels', 'research'
  
  // Data for Research/Suggestions
  const [history, setHistory] = useState<any[]>([])
  const [allParcelles, setAllParcelles] = useState<any[]>([])
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [searchResult, setSearchResult] = useState<any>(null)

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

  useEffect(() => {
    if (user) {
      loadStats()
    }
  }, [user, year])

  const loadStats = async () => {
    if (!user) return
    setLoading(true)
    try {
      // 1. Load General Stats
      const result = await Database.getProductStatsByYear(user.id, year)
      if (result.success) {
        setStats(result.stats)
      } else {
        // Fallback if stats fail
        setStats({ par_mois: {}, par_type: {}, par_fournisseur: {} })
      }

      // 2. Load Data for Research & Parcel Stats
      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`
      const [histRes, parcRes, prodRes] = await Promise.all([
        Database.getTraitementsWithFilters(user.id, startDate, endDate),
        Database.obtenirParcelles(user.id),
        Database.obtenirProduits(user.id)
      ])
      
      setHistory(histRes)
      setAllParcelles(parcRes)
      setAllProducts(prodRes)

    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  // --- 🔍 Research Logic ---
  const handleSearch = (text: string) => {
    setSearchQuery(text)
    setSearchResult(null) 

    if (text.length < 1) {
      setSuggestions([])
      return
    }

    const lowerText = text.toLowerCase()
    
    // Filter Parcelles
    const parcelleMatches = allParcelles
      .filter(p => p.nom.toLowerCase().includes(lowerText))
      .map(p => ({ type: 'Parcelle', name: p.nom, id: p.id }))

    // Filter Products
    const productMatches = allProducts
      .filter(p => p.nom.toLowerCase().includes(lowerText))
      .map(p => ({ type: 'Produit', name: p.nom, id: p.id, unit: p.unite_reference }))

    setSuggestions([...parcelleMatches, ...productMatches])
  }

  const selectSuggestion = (item: any) => {
    setSearchQuery(item.name)
    setSuggestions([]) // Hide list
    
    // Calculate Stats for selected item
    let filtered = []
    if (item.type === 'Parcelle') {
      filtered = history.filter(t => t.parcelle === item.name)
    } else {
      filtered = history.filter(t => (t.produits?.nom || '') === item.name)
    }

    const totalCost = filtered.reduce((sum, t) => sum + (t.cout_estime || 0), 0)
    const totalQty = filtered.reduce((sum, t) => sum + (t.quantite_utilisee || 0), 0)

    setSearchResult({
      item,
      totalCost,
      totalQty,
      count: filtered.length
    })
  }

  // --- 📊 Render Helpers ---
  const renderTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
      {['monthly', 'category', 'parcels', 'research'].map(tab => (
        <TouchableOpacity
          key={tab}
          onPress={() => setActiveTab(tab)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 16,
            backgroundColor: activeTab === tab ? colors.primary : '#e2e8f0',
            borderRadius: 20,
            marginRight: 8,
          }}
        >
          <Text style={{ color: activeTab === tab ? 'white' : colors.text, fontWeight: '600', textTransform: 'capitalize' }}>
            {tab === 'monthly' ? '📅 Mensuel' : 
             tab === 'category' ? '📊 Catégories' : 
             tab === 'parcels' ? '🚜 Parcelles' : '🔍 Recherche'}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )

  const renderResearch = () => (
    <View style={globalStyles.card}>
      <Text style={[typography.h3, { marginBottom: 12 }]}>🔍 Recherche Avancée ({year})</Text>
      
      <View style={{ zIndex: 10 }}>
        <TextInput
          style={[globalStyles.input, { marginBottom: suggestions.length > 0 ? 0 : 16 }]}
          placeholder="Tapez un nom de parcelle ou produit..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
        
        {/* Autocomplete Dropdown */}
        {suggestions.length > 0 && (
          <View style={styles.dropdown}>
            {suggestions.map((item, index) => (
              <TouchableOpacity 
                key={`${item.type}-${index}`} 
                style={styles.suggestionItem}
                onPress={() => selectSuggestion(item)}
              >
                <Text style={{ fontWeight: 'bold', marginRight: 8 }}>
                  {item.type === 'Parcelle' ? '🚜' : '🧪'}
                </Text>
                <Text>{item.name}</Text>
                <Text style={{ marginLeft: 'auto', fontSize: 10, color: '#64748b' }}>{item.type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Result Display */}
      {searchResult && (
        <View style={{ marginTop: 16, padding: 16, backgroundColor: '#f0f9ff', borderRadius: 12 }}>
          <Text style={[typography.h2, { color: colors.primary, marginBottom: 4 }]}>
            {searchResult.item.name}
          </Text>
          <Text style={[typography.caption, { marginBottom: 16 }]}>
            Rapport Annuel {year} • {searchResult.item.type}
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={typography.caption}>Coût Total</Text>
              <Text style={[typography.h3, { color: colors.danger }]}>
                {formatCurrency(searchResult.totalCost)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={typography.caption}>
                {searchResult.item.type === 'Produit' ? 'Quantité Totale' : 'Traitements'}
              </Text>
              <Text style={[typography.h3, { color: colors.secondary }]}>
                {searchResult.item.type === 'Produit' 
                  ? `${searchResult.totalQty.toFixed(1)} ${searchResult.item.unit || ''}` 
                  : `${searchResult.count} interventions`}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )

  const renderParcels = () => {
    const parcelStats: Record<string, number> = {}
    history.forEach(t => {
      parcelStats[t.parcelle] = (parcelStats[t.parcelle] || 0) + (t.cout_estime || 0)
    })
    
    const sorted = Object.entries(parcelStats).sort(([,a], [,b]) => b - a)

    return (
      <View style={globalStyles.card}>
        <Text style={[typography.h3, { marginBottom: 16 }]}>💰 Coût par Parcelle ({year})</Text>
        {sorted.length > 0 ? (
          sorted.map(([name, cost], index) => (
            <View key={name} style={styles.rowItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ width: 20, fontWeight: 'bold', color: '#94a3b8' }}>{index + 1}</Text>
                <Text style={typography.body}>{name}</Text>
              </View>
              <Text style={{ fontWeight: 'bold', color: colors.text }}>
                {formatCurrency(cost)}
              </Text>
            </View>
          ))
        ) : (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>🚜</Text>
            <Text style={{ textAlign: 'center', color: '#64748b' }}>
              Aucune donnée de parcelle pour cette année.
            </Text>
          </View>
        )}
      </View>
    )
  }

  const renderMonthly = () => {
    // 🛡️ SECURITY Check: Prevent "L-Infinity" crash
    const monthlyData = stats?.par_mois ? Object.values(stats.par_mois) as number[] : []
    const labels = stats?.par_mois ? Object.keys(stats.par_mois).map(k => k.split('-')[1]) : []
    const hasData = monthlyData.length > 0 && monthlyData.some(val => val > 0)

    return (
      <View style={globalStyles.card}>
        <Text style={[typography.h3, { marginBottom: 16 }]}>Dépenses Mensuelles</Text>
        {hasData ? (
          <LineChart
            data={{
              labels: labels,
              datasets: [{ data: monthlyData }]
            }}
            width={screenWidth - 64}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              propsForDots: {
                r: "6",
                strokeWidth: "2",
                stroke: "#2563eb"
              }
            }}
            bezier
            style={{ borderRadius: 16 }}
            fromZero // 🛡️ Keeps chart grounded at 0
          />
        ) : (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>📉</Text>
            <Text style={{ color: colors.textSecondary }}>Pas assez de données pour le graphique.</Text>
          </View>
        )}
      </View>
    )
  }

  const renderCategory = () => {
    // 🛡️ SECURITY Check: Prevent Empty Pie Chart
    const rawData = stats?.par_type || {}
    const hasData = Object.values(rawData).some((val: any) => val > 0)

    const data = Object.entries(rawData).map(([name, amount], i) => ({
      name,
      population: amount as number,
      color: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'][i % 5],
      legendFontColor: '#7F7F7F',
      legendFontSize: 12
    }))

    return (
      <View style={globalStyles.card}>
        <Text style={[typography.h3, { marginBottom: 16 }]}>Répartition par Type</Text>
        {hasData ? (
          <PieChart
            data={data}
            width={screenWidth - 64}
            height={200}
            chartConfig={{ 
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              decimalPlaces: 0, 
            }}
            accessor={"population"}
            backgroundColor={"transparent"}
            paddingLeft={"15"}
            absolute
          />
        ) : (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>🥧</Text>
            <Text style={{ color: colors.textSecondary }}>Aucune donnée catégorisée.</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Statistiques" />
      <ScrollView style={{ flex: 1, padding: 16 }}>
        
        {/* Year Selector */}
        <View style={{ marginBottom: 16, backgroundColor: 'white', borderRadius: 12, padding: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {years.map(y => (
              <TouchableOpacity
                key={y}
                onPress={() => setYear(y)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: year === y ? colors.primary : 'transparent',
                  borderRadius: 8
                }}
              >
                <Text style={{ color: year === y ? 'white' : colors.text, fontWeight: 'bold' }}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <>
            {renderTabs()}
            {activeTab === 'monthly' && renderMonthly()}
            {activeTab === 'category' && renderCategory()}
            {activeTab === 'parcels' && renderParcels()}
            {activeTab === 'research' && renderResearch()}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  dropdown: {
    maxHeight: 200,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginTop: -10,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  }
})