import React, { useState, useEffect } from 'react'
import { 
  View, 
  Text, 
  ScrollView, 
  ActivityIndicator, 
  Dimensions, 
  TouchableOpacity, 
  TextInput, 
  StyleSheet, 
  StatusBar,
  Keyboard,
  Modal,
  Platform,
  useWindowDimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LineChart } from 'react-native-chart-kit'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import { colors, shadows } from '../../utils/styles'
import { formatCurrency, formatDate } from '../../utils/helpers'
import Sidebar from '../../components/layout/Sidebar'

const screenWidth = Dimensions.get('window').width

export default function StatisticsScreen() {
  const { user } = useAuth()
  const { width } = useWindowDimensions()
  const isSmallScreen = width < 380
  
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [stats, setStats] = useState<any>(null)
  const [yearlyPurchases, setYearlyPurchases] = useState<any[]>([])
  
  const [sidebarVisible, setSidebarVisible] = useState(false)
  
  // View Mode
  const [viewMode, setViewMode] = useState<'dashboard' | 'search'>('dashboard')
  
  // Search Data Sources
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [allParcelles, setAllParcelles] = useState<any[]>([])
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  
  // Selected Result State
  type ResultType = 'product' | 'parcel'
  const [resultType, setResultType] = useState<ResultType | null>(null)
  const [productResult, setProductResult] = useState<{product: any, purchases: any[], totalQty: number} | null>(null)
  const [parcelResult, setParcelResult] = useState<{info: any, traitements: any[], stats: any} | null>(null)

  // Global Detail Modal State
  const [globalModalVisible, setGlobalModalVisible] = useState(false)
  const [selectedGlobalItem, setSelectedGlobalItem] = useState<{
    title: string, 
    type: 'category' | 'ingredient', 
    total: number, 
    items: any[]
  } | null>(null)

  // State for expanding "See More" lists
  const [expandIngredients, setExpandIngredients] = useState(false)
  const [expandCategories, setExpandCategories] = useState(false)

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  useEffect(() => {
    if (user) loadData()
  }, [user, year])

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const result = await Database.getProductStatsByYear(user.id, year)
      setStats(result.success ? result.stats : null)

      const purchases = await Database.getAchatsWithFilters(user.id, `${year}-01-01`, `${year}-12-31`)
      setYearlyPurchases(purchases || [])

      const [prodRes, parcRes] = await Promise.all([
        Database.obtenirProduits(user.id),
        Database.obtenirParcelles(user.id)
      ])
      
      setAllProducts(prodRes || [])
      setAllParcelles(parcRes || [])
      
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // --- SEARCH LOGIC ---
  const handleSearch = (text: string) => {
    setSearchQuery(text)
    if (text.length === 0) {
      setSuggestions([])
      return
    }

    const query = text.toLowerCase()
    const results: any[] = []

    allParcelles.forEach(p => {
      if (p.nom.toLowerCase().includes(query)) {
        results.push({ type: 'parcel', data: p, match: 'Parcelle' })
      }
    })

    allProducts.forEach(p => {
      if (p.nom.toLowerCase().includes(query)) {
        results.push({ type: 'product', data: p, match: 'Produit' })
      } else if ((p.matiere_active || '').toLowerCase().includes(query)) {
        results.push({ type: 'product', data: p, match: `M.A: ${p.matiere_active}` })
      } else if ((p.type_produit || '').toLowerCase().includes(query)) {
        results.push({ type: 'product', data: p, match: `Type: ${p.type_produit}` })
      }
    })

    setSuggestions(results.slice(0, 10))
  }

  const selectSuggestion = async (item: any) => {
    setSearchQuery(item.data.nom)
    setSuggestions([])
    Keyboard.dismiss()
    setLoading(true)

    try {
      if (item.type === 'product') {
        const product = item.data
        const purchases = await Database.getAchatsWithFilters(
          user!.id, undefined, undefined, undefined, product.nom
        )
        purchases.sort((a: any, b: any) => new Date(b.date_commande).getTime() - new Date(a.date_commande).getTime())
        const totalQty = purchases.reduce((sum: number, a: any) => sum + (a.quantite_recue || 0), 0)
        
        setProductResult({ product, purchases, totalQty })
        setResultType('product')
        setParcelResult(null)

      } else if (item.type === 'parcel') {
        const parcel = item.data
        const result = await Database.getParcelDetails(user!.id, parcel.nom, year)
        
        if (result.success && result.data) {
          setParcelResult(result.data)
          setResultType('parcel')
          setProductResult(null)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleGlobalClick = (key: string, value: number, type: 'category' | 'ingredient') => {
    const contributors = yearlyPurchases.filter(p => {
      if (type === 'category') {
        return (p.produits?.type_produit || 'Autre') === key
      } else {
        return (p.produits?.matiere_active || '').includes(key)
      }
    })

    const grouped: any = {}
    contributors.forEach(p => {
      const name = p.nom || 'Inconnu'
      if (!grouped[name]) grouped[name] = { name, amount: 0, qty: 0, unit: p.unite_achat }
      grouped[name].amount += p.montant_ttc || 0
      grouped[name].qty += p.quantite_recue || 0
    })

    const items = Object.values(grouped).sort((a: any, b: any) => b.amount - a.amount)

    setSelectedGlobalItem({
      title: key,
      type,
      total: value,
      items
    })
    setGlobalModalVisible(true)
  }

  const YearSelector = () => (
    <View style={styles.yearSelectorContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 10}}>
        {years.map(y => (
          <TouchableOpacity 
            key={y} 
            onPress={() => setYear(y)} 
            style={[styles.yearPill, year === y && styles.yearPillActive]}
          >
            <Text style={[styles.yearText, year === y && styles.yearTextActive]}>{y}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )

  // --- TOP LIST COMPONENT WITH SEARCH ---
  const TopList = ({ 
    title, 
    data, 
    type,
    expanded,
    onToggle
  }: { 
    title: string, 
    data: any, 
    type: 'category' | 'ingredient',
    expanded: boolean,
    onToggle: () => void
  }) => {
    const [localSearch, setLocalSearch] = useState('')

    if (!data) return null;
    
    // Sort all items
    const allItems = Object.entries(data).sort(([, a]: any, [, b]: any) => b - a);
    
    // Filter based on local search
    const filteredItems = localSearch 
      ? allItems.filter(([label]) => label.toLowerCase().includes(localSearch.toLowerCase()))
      : allItems;

    // Determine what to show
    // If searching: show all matches. If not: follow expanded logic
    const visibleItems = localSearch ? filteredItems : (expanded ? filteredItems : filteredItems.slice(0, 5));
    const hasMore = allItems.length > 5;
    
    return (
      <View style={styles.chartCard}>
        <View style={{marginBottom: 12}}>
            <Text style={styles.cardTitle}>{title}</Text>
            
            {/* Embedded Search Bar */}
            <View style={{
                backgroundColor: '#F1F5F9', 
                borderRadius: 8, 
                paddingHorizontal: 10, 
                paddingVertical: 8, 
                flexDirection: 'row', 
                alignItems: 'center',
                marginTop: 4
            }}>
                <Feather name="search" size={14} color="#94A3B8" />
                <TextInput 
                    placeholder="Filtrer..."
                    value={localSearch}
                    onChangeText={setLocalSearch}
                    style={{flex: 1, marginLeft: 8, fontSize: 13, color: '#334155', padding: 0}}
                />
                {localSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setLocalSearch('')}>
                        <Feather name="x" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                )}
            </View>
        </View>

        {visibleItems.length === 0 ? (
            <Text style={{textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: 10}}>
                Aucun résultat trouvé
            </Text>
        ) : (
            visibleItems.map(([label, value]: any, index) => (
            <TouchableOpacity 
                key={label} 
                style={styles.rankItem} 
                onPress={() => handleGlobalClick(label, value, type)}
            >
                <View style={[styles.rankBadge, { backgroundColor: index === 0 && !localSearch ? colors.gold : '#f1f5f9' }]}>
                <Text style={{ fontWeight: 'bold', color: index === 0 && !localSearch ? 'white' : '#64748b' }}>
                    #{localSearch ? '-' : index + 1}
                </Text>
                </View>
                <View style={{flex: 1, paddingRight: 8}}>
                <Text style={styles.rankLabel} numberOfLines={1}>{label}</Text>
                </View>
                <View style={{alignItems: 'flex-end'}}>
                <Text style={styles.rankValue}>{formatCurrency(value)}</Text>
                <Text style={{fontSize: 10, color: colors.primary}}>Voir détails</Text>
                </View>
            </TouchableOpacity>
            ))
        )}

        {!localSearch && hasMore && (
          <TouchableOpacity 
            onPress={onToggle} 
            style={{
              paddingVertical: 12, 
              alignItems: 'center', 
              borderTopWidth: 1, 
              borderTopColor: '#f1f5f9',
              marginTop: 4
            }}
          >
            <Text style={{
              color: colors.primary, 
              fontWeight: '700', 
              fontSize: 13,
              flexDirection: 'row',
              alignItems: 'center'
            }}>
              {expanded ? 'Voir moins ▲' : 'Voir tout ▼'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      {/* HEADER WITH BURGER */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              onPress={() => setSidebarVisible(true)}
              style={{ padding: 8, marginRight: 8 }}
            >
              <Feather name="menu" size={26} color="white" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Analyses</Text>
              <Text style={styles.headerSubtitle}>Statistiques & Recherche</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.toggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleBtn, viewMode === 'dashboard' && styles.toggleBtnActive]}
            onPress={() => setViewMode('dashboard')}
          >
            <Text style={[styles.toggleText, viewMode === 'dashboard' && styles.toggleTextActive]}>📊 Global</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, viewMode === 'search' && styles.toggleBtnActive]}
            onPress={() => setViewMode('search')}
          >
            <Text style={[styles.toggleText, viewMode === 'search' && styles.toggleTextActive]}>🔎 Super Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && viewMode === 'dashboard' ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {viewMode === 'dashboard' ? (
            // --- DASHBOARD VIEW ---
            <>
              <YearSelector />
              
              <View style={styles.chartCard}>
                 <Text style={styles.cardTitle}>Dépenses par Mois ({year})</Text>
                 {stats?.par_mois && Object.keys(stats.par_mois).length > 0 ? (
                    <LineChart
                      data={{
                        labels: Object.keys(stats.par_mois).map(m => new Date(m).toLocaleDateString('fr-FR', {month:'short'})),
                        datasets: [{ data: Object.values(stats.par_mois) }]
                      }}
                      width={screenWidth - 48}
                      height={200}
                      chartConfig={{
                        backgroundColor: "#ffffff",
                        backgroundGradientFrom: "#ffffff",
                        backgroundGradientTo: "#ffffff",
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(212, 175, 55, ${opacity})`,
                        labelColor: () => colors.text,
                        propsForDots: { r: "4", strokeWidth: "2", stroke: colors.primary }
                      }}
                      bezier
                      style={{borderRadius: 16}}
                    />
                 ) : (
                   <Text style={{textAlign: 'center', padding: 20, color: '#ccc'}}>Aucune donnée pour {year}</Text>
                 )}
              </View>

              <TopList 
                title="🏆 Matières Actives" 
                data={stats?.par_matiere_active} 
                type="ingredient"
                expanded={expandIngredients}
                onToggle={() => setExpandIngredients(!expandIngredients)}
              />
              
              <TopList 
                title="🏷️ Catégories" 
                data={stats?.par_type} 
                type="category" 
                expanded={expandCategories}
                onToggle={() => setExpandCategories(!expandCategories)}
              />
              
              <View style={{height: 40}} />
            </>
          ) : (
            // --- SUPER SEARCH VIEW ---
            <View style={{ paddingBottom: 40 }}>
              <View style={styles.searchBoxContainer}>
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                  <Feather name="search" size={16} color={colors.gold} />
                  <Text style={styles.searchLabel}> RECHERCHE INTELLIGENTE</Text>
                </View>
                <TextInput 
                  style={styles.searchInput} 
                  placeholder="Produit, Matière Active, Parcelle..." 
                  placeholderTextColor="#94a3b8"
                  value={searchQuery} 
                  onChangeText={handleSearch} 
                />
                
                {suggestions.length > 0 && (
                  <View style={styles.suggestionsBox}>
                    {suggestions.map((item, i) => (
                      <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => selectSuggestion(item)}>
                        <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                          <Feather 
                            name={item.type === 'parcel' ? 'map' : 'package'} 
                            size={16} 
                            color={item.type === 'parcel' ? colors.secondary : colors.primary} 
                            style={{marginRight: 8}}
                          />
                          <View style={{flex: 1}}>
                            <Text style={styles.suggestionText} numberOfLines={1}>{item.data.nom}</Text>
                            <Text style={styles.suggestionSub} numberOfLines={1}>{item.match}</Text>
                          </View>
                        </View>
                        <Feather name="chevron-right" size={14} color="#ccc" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {loading ? (
                <ActivityIndicator style={{marginTop: 20}} size="small" color={colors.primary} />
              ) : (
                <>
                  {/* === PRODUCT RESULT === */}
                  {resultType === 'product' && productResult && (
                    <View style={styles.resultContainer}>
                      <View style={styles.headerCard}>
                        <View style={{flex: 1, paddingRight: 8}}>
                          <Text style={styles.headerCardTitle} numberOfLines={2}>{productResult.product.nom}</Text>
                          <Text style={styles.headerCardSub} numberOfLines={1}>{productResult.product.type_produit}</Text>
                        </View>
                        <View style={{alignItems: 'flex-end', minWidth: 80}}>
                           <Text style={styles.badgeLabel}>Matière Active</Text>
                           <Text style={[styles.headerCardSub, {textAlign: 'right', fontWeight: 'bold'}]} numberOfLines={2}>
                             {productResult.product.matiere_active || 'N/A'}
                           </Text>
                        </View>
                      </View>

                      <View style={styles.statsRow}>
                         <View style={styles.miniStat}>
                           <Text style={styles.miniStatLabel}>Stock</Text>
                           <Text style={styles.miniStatValue} numberOfLines={1}>
                             {productResult.product.stock_actuel} {productResult.product.unite_reference}
                           </Text>
                         </View>
                         <View style={styles.miniStat}>
                           <Text style={styles.miniStatLabel}>Prix Moyen</Text>
                           <Text style={styles.miniStatValue} numberOfLines={1}>
                             {formatCurrency(productResult.product.prix_moyen)}
                           </Text>
                         </View>
                      </View>

                      <Text style={styles.sectionHeader}>Historique des Achats</Text>
                      {productResult.purchases.length === 0 ? (
                         <Text style={styles.noData}>Aucun achat trouvé.</Text>
                      ) : (
                        productResult.purchases.map((p, i) => (
                          <View key={i} style={styles.timelineItem}>
                            <View style={styles.timelineLeft}>
                               <View style={styles.timelineDot} />
                               {i < productResult.purchases.length - 1 && <View style={styles.timelineLine} />}
                            </View>
                            <View style={styles.timelineContent}>
                              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4}}>
                                <Text style={{fontWeight: 'bold', color: '#334155', fontSize: 13}}>{formatDate(p.date_commande)}</Text>
                                <Text style={{fontWeight: 'bold', color: colors.gold, fontSize: 13}}>{formatCurrency(p.montant_ttc)}</Text>
                              </View>
                              <View style={{flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap'}}>
                                <Text style={{fontSize: 12, color: '#64748b', marginRight: 8}} numberOfLines={1}>Fourn: {p.fournisseur}</Text>
                                <Text style={{fontSize: 12, color: '#64748b'}}>Qté: {p.quantite_recue} {p.unite_achat}</Text>
                              </View>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  )}

                  {/* === PARCEL RESULT === */}
                  {resultType === 'parcel' && parcelResult && (
                    <View style={styles.resultContainer}>
                      <View style={[styles.headerCard, { backgroundColor: colors.secondary }]}>
                        <View style={{flex: 1}}>
                          <Text style={styles.headerCardTitle} numberOfLines={1}>Parcelle {parcelResult.info.nom}</Text>
                          <Text style={styles.headerCardSub} numberOfLines={1}>Culture: {parcelResult.info.culture_type || 'Non définie'}</Text>
                        </View>
                        <View style={{alignItems: 'flex-end', minWidth: 70}}>
                           <Text style={styles.badgeLabel}>Surface</Text>
                           <Text style={{color: 'white', fontSize: 18, fontWeight: 'bold'}}>
                             {parcelResult.info.surface_ha} ha
                           </Text>
                        </View>
                      </View>

                      <View style={styles.statsRow}>
                         <View style={styles.miniStat}>
                           <Text style={styles.miniStatLabel}>Coût ({year})</Text>
                           <Text style={[styles.miniStatValue, {color: colors.danger}]} numberOfLines={1}>
                             {formatCurrency(parcelResult.stats.totalCost)}
                           </Text>
                         </View>
                         <View style={styles.miniStat}>
                           <Text style={styles.miniStatLabel}>Coût / Ha</Text>
                           <Text style={[styles.miniStatValue, {color: colors.gold}]} numberOfLines={1}>
                             {formatCurrency(parcelResult.stats.costPerHa)}
                           </Text>
                         </View>
                      </View>

                      <Text style={styles.sectionHeader}>Traitements Réalisés ({year})</Text>
                      {parcelResult.traitements.length === 0 ? (
                         <Text style={styles.noData}>Aucun traitement enregistré cette année.</Text>
                      ) : (
                        parcelResult.traitements.map((t, i) => (
                          <View key={i} style={styles.timelineItem}>
                            <View style={styles.timelineLeft}>
                               <View style={[styles.timelineDot, {backgroundColor: colors.secondary}]} />
                               {i < parcelResult.traitements.length - 1 && <View style={styles.timelineLine} />}
                            </View>
                            <View style={styles.timelineContent}>
                              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4}}>
                                <Text style={{fontWeight: 'bold', color: '#334155', flex: 1, marginRight: 8}} numberOfLines={1}>
                                  {t.produits?.nom || 'Produit Inconnu'}
                                </Text>
                                <Text style={{fontWeight: 'bold', color: colors.secondary}}>{formatCurrency(t.cout_estime)}</Text>
                              </View>
                              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                <Text style={{fontSize: 12, color: '#64748b'}}>{formatDate(t.date_traitement)}</Text>
                                <Text style={{fontSize: 12, color: '#64748b'}}>Dose: {t.quantite_utilisee}</Text>
                              </View>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* GLOBAL DETAILS MODAL */}
      <Modal visible={globalModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedGlobalItem?.title}</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedGlobalItem?.type === 'category' ? 'Catégorie de produit' : 'Matière Active'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setGlobalModalVisible(false)}>
                <Feather name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalTotalBox}>
              <Text style={{color: colors.primary, fontWeight: 'bold'}}>Total Dépensé ({year})</Text>
              <Text style={{fontSize: 24, fontWeight: 'bold', color: colors.gold}}>
                {formatCurrency(selectedGlobalItem?.total || 0)}
              </Text>
            </View>

            <Text style={{fontWeight: 'bold', marginBottom: 10, color: '#64748b'}}>Produits Contribuants :</Text>

            <ScrollView style={{maxHeight: 300}}>
              {selectedGlobalItem?.items.map((item, index) => (
                <View key={index} style={styles.modalItem}>
                  <View style={{flex: 1}}>
                    <Text style={{fontWeight: '600', color: '#334155'}}>{item.name}</Text>
                    <Text style={{fontSize: 12, color: '#94a3b8'}}>Qté: {item.qty} {item.unit}</Text>
                  </View>
                  <Text style={{fontWeight: 'bold', color: colors.primary}}>{formatCurrency(item.amount)}</Text>
                </View>
              ))}
              {selectedGlobalItem?.items.length === 0 && (
                <Text style={styles.noData}>Aucun produit trouvé pour cette année.</Text>
              )}
            </ScrollView>

            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setGlobalModalVisible(false)}
            >
              <Text style={{color: 'white', fontWeight: 'bold'}}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </SafeAreaView>
  )
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...shadows.md,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    padding: 4,
    marginTop: 8
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 12,
  },
  toggleBtnActive: {
    backgroundColor: 'white',
    ...shadows.sm,
  },
  toggleText: {
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13
  },
  toggleTextActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Year Selector
  yearSelectorContainer: {
    marginBottom: 16,
    height: 44,
  },
  yearPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'white',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 36,
    justifyContent: 'center',
  },
  yearPillActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  yearText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 13
  },
  yearTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Charts & Cards
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    ...shadows.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 0, // Adjusted as title is now inside a View with the search bar
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  rankValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  // Search UI
  searchBoxContainer: {
    marginTop: 10,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    ...shadows.md,
    zIndex: 20, 
  },
  searchLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.gold,
    marginLeft: 4,
  },
  searchInput: {
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
    color: colors.text,
    marginTop: 8
  },
  suggestionsBox: {
    marginTop: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 5,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  suggestionText: {
    fontWeight: 'bold',
    color: '#334155',
    fontSize: 14
  },
  suggestionSub: {
    fontSize: 11,
    color: '#94a3b8',
  },
  // Result Views
  resultContainer: {
    marginTop: 16,
  },
  headerCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    ...shadows.sm,
  },
  headerCardTitle: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  headerCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  badgeLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  
  statsRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12
  },
  miniStat: {
    flex: 1,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    ...shadows.sm
  },
  miniStatLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' },
  miniStatValue: { fontSize: 15, fontWeight: 'bold', color: '#334155', marginTop: 4 },

  sectionHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 12,
    marginLeft: 8,
  },
  noData: { textAlign: 'center', color: '#94a3b8', marginTop: 20, fontStyle: 'italic', fontSize: 12 },
  
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    marginTop: 16,
    zIndex: 2,
  },
  timelineLine: {
    width: 2,
    backgroundColor: '#e2e8f0',
    flex: 1,
    position: 'absolute',
    top: 16,
    bottom: -16
  },
  timelineContent: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    marginLeft: 8,
    ...shadows.sm,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
    ...shadows.xl
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b'
  },
  modalTotalBox: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  }
})