import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import { globalStyles, typography, colors, shadows } from '../../utils/styles'
import { formatCurrency, formatDate } from '../../utils/helpers'

export default function StockBoxScreen() {
  const { user } = useAuth()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [newStock, setNewStock] = useState('')

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

  const getStockColor = (stock: number, type: string) => {
    const level = Database.getStockLevel(stock, type).level
    switch (level) {
      case 'Faible': return colors.danger
      case 'Moyen': return colors.warning
      default: return colors.success
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.primary,
        padding: 24,
        paddingTop: 60,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        ...shadows.xl,
      }}>
        <Text style={[typography.h1, { color: colors.gold, marginBottom: 4 }]}>
          📦 Inventaire
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
          {products.length} produit{products.length !== 1 ? 's' : ''} en stock
        </Text>
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }}>
        <View style={{ 
          flexDirection: 'row', 
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}>
          {products.map((product) => {
            const stockColor = getStockColor(product.stock_actuel || 0, product.type_produit || '')
            const unitPrice = product.prix_moyen || 0
            const stockValue = (product.stock_actuel || 0) * unitPrice
            
            return (
              <TouchableOpacity
                key={product.id}
                onPress={() => handleProductPress(product)}
                style={{
                  width: '48%',
                  backgroundColor: 'white',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                  ...shadows.md,
                  borderWidth: 2,
                  borderColor: colors.borderLight,
                }}
              >
                {/* Delete Button */}
                <TouchableOpacity
                  onPress={() => handleDeleteProduct(product)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    backgroundColor: colors.dangerLight,
                    padding: 8,
                    borderRadius: 8,
                    zIndex: 10,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🗑️</Text>
                </TouchableOpacity>

                {/* Icon */}
                <View style={{ 
                  width: 50, 
                  height: 50, 
                  backgroundColor: stockColor + '20', 
                  borderRadius: 25,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 12,
                  borderWidth: 2,
                  borderColor: stockColor,
                }}>
                  <Text style={{ fontSize: 22 }}>
                    {product.type_produit === 'Fongicide' ? '🦠' : 
                     product.type_produit === 'Insecticide' ? '🐛' : 
                     product.type_produit === 'Engrais' ? '🌱' : '📦'}
                  </Text>
                </View>
                
                <Text 
                  style={[typography.h4, { marginBottom: 8 }]}
                  numberOfLines={2}
                >
                  {product.nom}
                </Text>
                
                {/* Stock Info */}
                <View style={{
                  backgroundColor: colors.backgroundAlt,
                  padding: 10,
                  borderRadius: 10,
                  marginBottom: 8,
                }}>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>
                    Stock actuel
                  </Text>
                  <Text style={[typography.h3, { color: colors.primary }]}>
                    {product.stock_actuel?.toFixed(2)} {product.unite_reference}
                  </Text>
                  
                  {product.is_box_unit && product.box_quantity && (
                    <Text style={[typography.small, { color: colors.textLight, marginTop: 4 }]}>
                      ({product.box_quantity} unités/box)
                    </Text>
                  )}
                </View>
                
                {/* Price Info */}
                <View style={{ marginBottom: 8 }}>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 2 }]}>
                    Prix unitaire
                  </Text>
                  <Text style={[typography.body, { color: colors.gold, fontWeight: '700' }]}>
                    {formatCurrency(unitPrice)}
                  </Text>
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 2 }]}>
                    Valeur totale
                  </Text>
                  <Text style={[typography.body, { color: colors.secondary, fontWeight: '600' }]}>
                    {formatCurrency(stockValue)}
                  </Text>
                </View>
                
                {/* Active Ingredient */}
                {product.matiere_active && (
                  <Text 
                    style={[typography.small, { 
                      color: colors.textSecondary,
                      marginBottom: 12,
                      fontStyle: 'italic'
                    }]}
                    numberOfLines={1}
                  >
                    MA: {product.matiere_active}
                  </Text>
                )}
                
                {/* Stock Level Badge */}
                <View style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: stockColor + '15',
                  borderRadius: 8,
                  alignSelf: 'flex-start',
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: stockColor,
                }}>
                  <Text style={{
                    fontSize: 11,
                    color: stockColor,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    {Database.getStockLevel(product.stock_actuel || 0, product.type_produit || '').level}
                  </Text>
                </View>

                {/* Edit Stock Button */}
                <TouchableOpacity
                  onPress={() => handleEditStock(product)}
                  style={{
                    backgroundColor: colors.info,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    alignItems: 'center',
                    ...shadows.sm,
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>
                    ✏️ Modifier Stock
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      {/* Product Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: 'white',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            maxHeight: '85%',
            paddingBottom: 32,
            ...shadows.xl,
          }}>
            {/* Modal Header */}
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 24,
              borderBottomWidth: 2,
              borderBottomColor: colors.gold,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.h2, { marginBottom: 4, color: colors.primary }]}>
                  {selectedProduct?.nom}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {selectedProduct?.type_produit} • MA: {selectedProduct?.matiere_active || 'N/A'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={{
                  backgroundColor: colors.dangerLight,
                  padding: 10,
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontSize: 24, color: colors.danger }}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Stock Summary */}
            <View style={{ padding: 24 }}>
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between',
                marginBottom: 20,
              }}>
                <View style={{
                  flex: 1,
                  backgroundColor: colors.goldLight,
                  padding: 16,
                  borderRadius: 12,
                  marginRight: 8,
                  borderWidth: 2,
                  borderColor: colors.gold,
                }}>
                  <Text style={[typography.caption, { color: colors.text, marginBottom: 4 }]}>
                    Stock Actuel
                  </Text>
                  <Text style={[typography.h2, { color: colors.primary, fontWeight: '700' }]}>
                    {selectedProduct?.stock_actuel?.toFixed(2)} {selectedProduct?.unite_reference}
                  </Text>
                </View>
                <View style={{
                  flex: 1,
                  backgroundColor: colors.successLight,
                  padding: 16,
                  borderRadius: 12,
                  marginLeft: 8,
                  borderWidth: 1,
                  borderColor: colors.success,
                }}>
                  <Text style={[typography.caption, { color: colors.text, marginBottom: 4 }]}>
                    Valeur Stock
                  </Text>
                  <Text style={[typography.h2, { color: colors.success, fontWeight: '700' }]}>
                    {formatCurrency((selectedProduct?.stock_actuel || 0) * (selectedProduct?.prix_moyen || 0))}
                  </Text>
                </View>
              </View>
            </View>

            {/* Purchase History */}
            <ScrollView style={{ paddingHorizontal: 24 }}>
              <Text style={[typography.h3, { marginBottom: 16, color: colors.primary }]}>
                📋 Historique d'Achat
              </Text>
              
              {purchaseHistory.length > 0 ? (
                purchaseHistory.map((purchase, index) => (
                  <View 
                    key={index}
                    style={[globalStyles.card, { marginBottom: 12 }]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={[typography.body, { fontWeight: '700' }]}>
                        {formatDate(purchase.date_commande)}
                      </Text>
                      <Text style={[typography.body, { color: colors.gold, fontWeight: '700' }]}>
                        {formatCurrency(purchase.montant_ttc || 0)}
                      </Text>
                    </View>
                    
                    <View style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between',
                      marginTop: 4,
                    }}>
                      <Text style={[typography.small, { color: colors.textSecondary }]}>
                        🏢 {purchase.fournisseur}
                      </Text>
                      <Text style={[typography.small, { color: colors.textSecondary }]}>
                        {purchase.quantite_recue || 0} {purchase.unite_achat} × {purchase.prix_unitaire_ht?.toFixed(2)} MAD
                      </Text>
                    </View>
                    
                    <Text style={[typography.small, { 
                      color: colors.textLight,
                      marginTop: 4,
                      fontStyle: 'italic'
                    }]}>
                      TVA {purchase.taux_tva || 0}%
                    </Text>
                  </View>
                ))
              ) : (
                <View style={{ 
                  alignItems: 'center', 
                  padding: 48,
                  backgroundColor: colors.backgroundAlt,
                  borderRadius: 16,
                }}>
                  <Text style={{ fontSize: 64, marginBottom: 16 }}>📭</Text>
                  <Text style={[typography.body, { textAlign: 'center', color: colors.textSecondary }]}>
                    Aucun historique d'achat
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Stock Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 28,
            width: '100%',
            maxWidth: 400,
            ...shadows.xl,
          }}>
            <Text style={[typography.h2, { marginBottom: 8, color: colors.primary }]}>
              Modifier le Stock
            </Text>
            <Text style={[typography.caption, { marginBottom: 24, color: colors.textSecondary }]}>
              {selectedProduct?.nom}
            </Text>

            <Text style={[typography.caption, { marginBottom: 8, color: colors.text }]}>
              Nouvelle quantité ({selectedProduct?.unite_reference})
            </Text>
            <TextInput
              style={[globalStyles.input, { marginBottom: 24 }]}
              placeholder="0.00"
              value={newStock}
              onChangeText={setNewStock}
              keyboardType="numeric"
            />

            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={[globalStyles.buttonOutline, { flex: 1, marginRight: 8 }]}
              >
                <Text style={globalStyles.buttonTextOutline}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={saveStockUpdate}
                style={[globalStyles.buttonGold, { flex: 1, marginLeft: 8 }]}
              >
                <Text style={globalStyles.buttonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}