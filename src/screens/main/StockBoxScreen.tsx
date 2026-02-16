import React, { useState, useEffect, useMemo } from 'react'
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Modal, 
  TextInput, 
  Alert, 
  useWindowDimensions, 
  StatusBar,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import Sidebar from '../../components/layout/Sidebar'
import { typography, colors, shadows } from '../../utils/styles'
import { formatCurrency, formatDate } from '../../utils/helpers'

export default function StockBoxScreen() {
  const { user } = useAuth()
  const { width } = useWindowDimensions()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([])
  
  // Modals
  const [modalVisible, setModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [addProductModalVisible, setAddProductModalVisible] = useState(false) // <--- NEW
  
  const [newStock, setNewStock] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarVisible, setSidebarVisible] = useState(false)

  // --- NEW PRODUCT STATE ---
  const [newProduct, setNewProduct] = useState({
    nom: '',
    type: 'Fongicide',
    ma: '',
    unite: 'L',
    stock: '',
    price: '',
    fournisseur: ''
  })

  // --- FILTER STATES ---
  const [showZeroStock, setShowZeroStock] = useState(false)
  const [selectedType, setSelectedType] = useState('Tous')
  const [selectedMA, setSelectedMA] = useState('Tous')

  const isSmallScreen = width < 340

  // --- DERIVED DATA ---
  const uniqueTypes = useMemo(() => {
    const types = new Set(products.map(p => p.type_produit).filter(Boolean))
    return ['Tous', ...Array.from(types).sort()]
  }, [products])

  const uniqueMAs = useMemo(() => {
    const mas = new Set<string>()
    products.forEach(p => {
      if (p.matiere_active) {
        p.matiere_active.split(',').forEach((ma: string) => mas.add(ma.trim()))
      }
    })
    return ['Tous', ...Array.from(mas).sort()]
  }, [products])

  // --- FILTER LOGIC ---
  const filteredProducts = products.filter(product => {
    const stock = product.stock_actuel || 0
    const isZeroStock = stock <= 0.001
    
    if (showZeroStock) {
      if (!isZeroStock) return false
    } else {
      if (isZeroStock) return false
    }

    if (selectedType !== 'Tous' && product.type_produit !== selectedType) {
      return false
    }

    if (selectedMA !== 'Tous') {
      const pMas = product.matiere_active ? product.matiere_active.toLowerCase() : ''
      if (!pMas.includes(selectedMA.toLowerCase())) return false
    }

    const query = searchQuery.trim().toLowerCase()
    if (!query) return true
    
    return (
      (product.nom || '').toLowerCase().includes(query) ||
      (product.type_produit || '').toLowerCase().includes(query) ||
      (product.matiere_active || '').toLowerCase().includes(query)
    )
  })

  useEffect(() => {
    if (user) {
      loadProducts()
    }
  }, [user])

  const loadProducts = async () => {
    if (!user) return
    setLoading(true)
    try {
      const prods = await Database.obtenirProduits(user.id)
      prods.sort((a, b) => (a.stock_actuel || 0) - (b.stock_actuel || 0))
      setProducts(prods)
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPurchaseHistory = async (productId: string) => {
    if (!user) return
    try {
      const purchases = await Database.getProductPurchaseHistory(user.id, productId)
      setPurchaseHistory(purchases)
    } catch (error) {
      console.error('Error loading purchase history:', error)
    }
  }

  const handleProductPress = async (product: any) => {
    setSelectedProduct(product)
    await loadPurchaseHistory(product.id)
    setModalVisible(true)
  }

  const handleDeleteProduct = async (product: any) => {
    Alert.alert(
      'Confirmer la suppression',
      `Êtes-vous sûr de vouloir supprimer "${product.nom}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!user) return
            const result = await Database.deleteProduct(user.id, product.id)
            if (result.success) {
              Alert.alert('Succès', 'Produit supprimé')
              loadProducts()
            } else {
              Alert.alert('Erreur', result.error || 'Impossible de supprimer le produit')
            }
          }
        }
      ]
    )
  }

  const handleEditStock = (product: any) => {
    setSelectedProduct(product)
    setNewStock(product.stock_actuel?.toString() || '0')
    setEditModalVisible(true)
  }

  const saveStockUpdate = async () => {
    if (!user || !selectedProduct) return
    const stock = parseFloat(newStock)
    if (isNaN(stock) || stock < 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantité valide')
      return
    }

    const result = await Database.updateProductStock(user.id, selectedProduct.id, stock)
    if (result.success) {
      Alert.alert('Succès', 'Stock mis à jour')
      setEditModalVisible(false)
      loadProducts()
    } else {
      Alert.alert('Erreur', result.error || 'Impossible de mettre à jour le stock')
    }
  }

  // --- NEW: SAVE NEW PRODUCT ---
  const handleAddProduct = async () => {
    if (!user) return
    if (!newProduct.nom) {
      Alert.alert('Erreur', 'Le nom du produit est obligatoire')
      return
    }

    const result = await Database.addProduct(user.id, newProduct)
    
    if (result.success) {
      Alert.alert('Succès', 'Produit ajouté avec succès')
      setAddProductModalVisible(false)
      setNewProduct({
        nom: '',
        type: 'Fongicide',
        ma: '',
        unite: 'L',
        stock: '',
        price: '',
        fournisseur: ''
      })
      loadProducts()
    } else {
      Alert.alert('Erreur', result.error || 'Impossible d\'ajouter le produit')
    }
  }

  const getStockColor = (stock: number, type: string) => {
    if (stock <= 0) return colors.textSecondary
    const level = Database.getStockLevel(stock, type).level
    switch (level) {
      case 'Faible': return colors.danger
      case 'Moyen': return colors.warning
      default: return colors.success
    }
  }

  const formatStockNumber = (num: number) => {
    if (num === undefined || num === null) return '0'
    return parseFloat(num.toFixed(2)).toString()
  }

  // --- RENDER ---

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      {/* Header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => setSidebarVisible(true)} style={styles.menuButton}>
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
            <View style={styles.burgerLine} />
          </TouchableOpacity>
          <View style={styles.headerTexts}>
            <Text style={styles.headerTitle}>Inventaire</Text>
            <Text style={styles.headerSubtitle}>
              {filteredProducts.length} référence{filteredProducts.length !== 1 ? 's' : ''}
            </Text>
          </View>
          
          {/* NEW: ADD BUTTON */}
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setAddProductModalVisible(true)}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Main Body */}
      <View style={styles.bodyContainer}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="Rechercher (Nom, Type, MA)..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textLight}
            style={styles.searchInput}
          />
        </View>

        {/* Filters Section */}
        <View style={{ marginBottom: 10 }}>
          <View style={styles.filterRow}>
            <TouchableOpacity 
              style={[
                styles.filterChip, 
                showZeroStock ? { backgroundColor: colors.danger, borderColor: colors.danger } : {}
              ]}
              onPress={() => setShowZeroStock(!showZeroStock)}
            >
              <Text style={[
                styles.filterChipText, 
                showZeroStock ? { color: 'white' } : {}
              ]}>
                {showZeroStock ? '⚠️ Stock Épuisé (0)' : '📦 Stock Disponible'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{paddingHorizontal: 16}}>
            {uniqueTypes.map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterChip,
                  selectedType === type ? { backgroundColor: colors.primary, borderColor: colors.primary } : {}
                ]}
                onPress={() => setSelectedType(type)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedType === type ? { color: 'white' } : {}
                ]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{paddingHorizontal: 16}}>
            {uniqueMAs.slice(0, 15).map(ma => (
              <TouchableOpacity
                key={ma}
                style={[
                  styles.filterChip,
                  selectedMA === ma ? { backgroundColor: colors.secondary, borderColor: colors.secondary } : {}
                ]}
                onPress={() => setSelectedMA(ma)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedMA === ma ? { color: 'white' } : {}
                ]}>{ma}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Grid Layout */}
          <View style={styles.gridContainer}>
            {filteredProducts.map((product) => {
              const stockColor = getStockColor(product.stock_actuel || 0, product.type_produit || '')
              
              return (
                <TouchableOpacity
                  key={product.id}
                  onPress={() => handleProductPress(product)}
                  style={styles.card}
                  activeOpacity={0.8}
                >
                  <View style={[styles.cardStatusStrip, { backgroundColor: stockColor }]} />

                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {product.nom}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteProduct(product)}
                        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                      >
                         <Text style={{color: colors.danger, fontSize: 16, fontWeight: 'bold'}}>×</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.stockRow}>
                      <Text style={[styles.stockValue, { color: stockColor }]}>
                        {formatStockNumber(product.stock_actuel)}
                      </Text>
                      <Text style={styles.stockUnit}>
                        {product.unite_reference}
                      </Text>
                    </View>

                    <View style={styles.cardFooter}>
                      <View style={{flex: 1}}>
                        <Text style={styles.cardType} numberOfLines={1}>
                          {product.type_produit}
                        </Text>
                        {product.matiere_active ? (
                          <Text style={{fontSize: 9, color: '#999'}} numberOfLines={1}>
                            {product.matiere_active}
                          </Text>
                        ) : null}
                      </View>
                      
                      <TouchableOpacity
                        onPress={() => handleEditStock(product)}
                        style={styles.editButtonSmall}
                      >
                        <Text style={styles.editButtonText}>✎</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>

          {filteredProducts.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>📦</Text>
              <Text style={styles.emptyStateText}>Aucun produit trouvé</Text>
              <TouchableOpacity onPress={() => {
                setSearchQuery('')
                setSelectedType('Tous')
                setSelectedMA('Tous')
                setShowZeroStock(false)
              }}>
                <Text style={{color: colors.primary, marginTop: 10}}>Réinitialiser les filtres</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>

      {/* --- ADD PRODUCT MODAL --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addProductModalVisible}
        onRequestClose={() => setAddProductModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
             <View style={styles.modalHandle} />
             <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>Nouveau Produit</Text>
               <TouchableOpacity onPress={() => setAddProductModalVisible(false)} style={styles.closeButton}>
                 <Text style={styles.closeButtonText}>×</Text>
               </TouchableOpacity>
             </View>

             <ScrollView showsVerticalScrollIndicator={false}>
               <Text style={styles.inputLabel}>Nom du Produit *</Text>
               <TextInput 
                 style={styles.input}
                 placeholder="Ex: Syngenta Amistar"
                 value={newProduct.nom}
                 onChangeText={(t) => setNewProduct({...newProduct, nom: t})}
               />

               <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                 <View style={{flex: 1, marginRight: 8}}>
                   <Text style={styles.inputLabel}>Type</Text>
                   <TextInput 
                     style={styles.input}
                     placeholder="Ex: Fongicide"
                     value={newProduct.type}
                     onChangeText={(t) => setNewProduct({...newProduct, type: t})}
                   />
                 </View>
                 <View style={{flex: 1, marginLeft: 8}}>
                   <Text style={styles.inputLabel}>Unité (L/Kg/U)</Text>
                   <TextInput 
                     style={styles.input}
                     placeholder="L"
                     value={newProduct.unite}
                     onChangeText={(t) => setNewProduct({...newProduct, unite: t})}
                   />
                 </View>
               </View>

               <Text style={styles.inputLabel}>Matière Active</Text>
               <TextInput 
                 style={styles.input}
                 placeholder="Ex: Azoxystrobine"
                 value={newProduct.ma}
                 onChangeText={(t) => setNewProduct({...newProduct, ma: t})}
               />

               <Text style={styles.inputLabel}>Fournisseur (Optionnel)</Text>
               <TextInput 
                 style={styles.input}
                 placeholder="Ex: AgriPharma"
                 value={newProduct.fournisseur}
                 onChangeText={(t) => setNewProduct({...newProduct, fournisseur: t})}
               />

               <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                 <View style={{flex: 1, marginRight: 8}}>
                   <Text style={styles.inputLabel}>Stock Initial</Text>
                   <TextInput 
                     style={styles.input}
                     placeholder="0"
                     keyboardType="numeric"
                     value={newProduct.stock}
                     onChangeText={(t) => setNewProduct({...newProduct, stock: t})}
                   />
                 </View>
                 <View style={{flex: 1, marginLeft: 8}}>
                   <Text style={styles.inputLabel}>Prix Moyen (DH)</Text>
                   <TextInput 
                     style={styles.input}
                     placeholder="0.00"
                     keyboardType="numeric"
                     value={newProduct.price}
                     onChangeText={(t) => setNewProduct({...newProduct, price: t})}
                   />
                 </View>
               </View>

               <TouchableOpacity 
                 style={[styles.btnConfirm, { marginTop: 20, backgroundColor: colors.primary }]}
                 onPress={handleAddProduct}
               >
                 <Text style={styles.btnConfirmText}>Ajouter le produit</Text>
               </TouchableOpacity>
               <View style={{height: 20}} />
             </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- EXISTING MODALS (UNCHANGED) --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedProduct?.nom}</Text>
                <Text style={styles.modalSubtitle}>{selectedProduct?.type_produit}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={[styles.statCard, { borderColor: colors.gold }]}>
                <Text style={styles.statLabel}>Stock</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {formatStockNumber(selectedProduct?.stock_actuel)} {selectedProduct?.unite_reference}
                </Text>
              </View>
              <View style={[styles.statCard, { borderColor: colors.success }]}>
                <Text style={styles.statLabel}>Valeur</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {formatCurrency((selectedProduct?.stock_actuel || 0) * (selectedProduct?.prix_moyen || 0))}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Historique</Text>
            <ScrollView style={styles.historyList}>
              {purchaseHistory.length > 0 ? (
                purchaseHistory.map((purchase, index) => (
                  <View key={index} style={styles.historyItem}>
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyDate}>{formatDate(purchase.date_commande)}</Text>
                      <Text style={styles.historyDetail}>
                        {purchase.quantite_recue} {purchase.unite_achat} × {purchase.prix_unitaire_ht?.toFixed(2)}
                      </Text>
                    </View>
                    <Text style={styles.historyPrice}>{formatCurrency(purchase.montant_ttc || 0)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyHistoryText}>Aucun historique</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlayCentered}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Modifier le Stock</Text>
            <TextInput
              style={styles.inputLarge}
              value={newStock}
              onChangeText={setNewStock}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.alertButtons}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.btnCancel}>
                <Text style={styles.btnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveStockUpdate} style={styles.btnConfirm}>
                <Text style={styles.btnConfirmText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerSafeArea: { backgroundColor: colors.primary, zIndex: 10, ...shadows.md },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  menuButton: { width: 32, height: 32, justifyContent: 'center', marginRight: 12 },
  burgerLine: { width: 20, height: 2, backgroundColor: 'white', marginVertical: 2, borderRadius: 2 },
  headerTexts: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.gold },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  
  // ADD BUTTON
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  addButtonText: { fontSize: 24, color: 'white', lineHeight: 26 },

  bodyContainer: { flex: 1, paddingTop: 16 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', marginHorizontal: 16, paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#EAEAEA', marginBottom: 12 },
  searchIcon: { fontSize: 14, marginRight: 8, opacity: 0.5 },
  searchInput: { flex: 1, height: '100%', color: colors.text, fontSize: 14 },
  
  // FILTER STYLES
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
  filterScroll: { marginBottom: 8, flexGrow: 0 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd', marginRight: 8 },
  filterChipText: { fontSize: 12, color: colors.text, fontWeight: '600' },

  scrollView: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { paddingBottom: 20 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: 'white', borderRadius: 12, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#EFEFEF', elevation: 2 },
  cardStatusStrip: { height: 3, width: '100%' },
  cardContent: { padding: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary, marginRight: 4 },
  stockRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  stockValue: { fontSize: 22, fontWeight: '800' },
  stockUnit: { fontSize: 10, color: colors.textLight, fontWeight: '600', marginLeft: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardType: { fontSize: 10, color: colors.textSecondary },
  editButtonSmall: { backgroundColor: '#F5F5F5', width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  editButtonText: { fontSize: 12, color: colors.text },
  emptyState: { alignItems: 'center', marginTop: 20 },
  emptyStateEmoji: { fontSize: 32 },
  emptyStateText: { color: colors.textSecondary, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', paddingHorizontal: 20, paddingBottom: 20 },
  modalHandle: { width: 30, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.primary },
  modalSubtitle: { fontSize: 12, color: colors.textSecondary },
  closeButton: { backgroundColor: '#F0F0F0', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { fontSize: 16, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#FAFAFA', padding: 12, borderRadius: 10, borderWidth: 1 },
  statLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: colors.primary },
  historyList: { flex: 1 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  historyLeft: { flex: 1 },
  historyDate: { fontSize: 12, fontWeight: '600' },
  historyDetail: { fontSize: 11, color: colors.textSecondary },
  historyPrice: { fontSize: 14, fontWeight: 'bold', color: colors.gold },
  emptyHistoryText: { textAlign: 'center', color: '#999', marginTop: 20, fontStyle: 'italic' },
  modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  alertBox: { backgroundColor: 'white', borderRadius: 16, padding: 20, alignItems: 'center' },
  alertTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: colors.primary },
  inputLarge: { fontSize: 24, fontWeight: 'bold', borderBottomWidth: 1, borderColor: colors.gold, width: '50%', textAlign: 'center', marginBottom: 24 },
  alertButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  btnCancel: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  btnCancelText: { fontWeight: '600' },
  btnConfirm: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: colors.gold, alignItems: 'center' },
  btnConfirmText: { color: 'white', fontWeight: 'bold' },
  
  // FORM STYLES
  inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, color: colors.textSecondary, marginTop: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#f8fafc' },
})