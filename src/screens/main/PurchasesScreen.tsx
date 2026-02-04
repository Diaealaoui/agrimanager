import React, { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import CartItem from '../../components/common/CartItem'
import { globalStyles, typography, colors, shadows } from '../../utils/styles'
import { formatCurrency } from '../../utils/helpers'

export default function PurchasesScreen() {
  const { user } = useAuth()
  const [cart, setCart] = useState<any[]>([])
  const [productTypes, setProductTypes] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const [fournisseur, setFournisseur] = useState('')
  const [dateAchat, setDateAchat] = useState(new Date().toISOString().split('T')[0])
  const [nom, setNom] = useState('')
  const [type, setType] = useState('')
  const [quantite, setQuantite] = useState('')
  const [unite, setUnite] = useState('L')
  const [prix, setPrix] = useState('')
  const [tva, setTva] = useState(20)
  const [matiereActive, setMatiereActive] = useState('')
  
  // NEW: Box unit support
  const [boxQuantity, setBoxQuantity] = useState('')
  const [showBoxQuantity, setShowBoxQuantity] = useState(false)

  const supplierSuggestions = useMemo(() => {
    if (!suppliers.length) return []
    const query = fournisseur.trim().toLowerCase()
    const matches = query.length === 0
      ? suppliers
      : suppliers.filter(s => s.toLowerCase().includes(query) && s.toLowerCase() !== query)
    return matches.slice(0, 6)
  }, [fournisseur, suppliers])

  useEffect(() => {
    if (user) {
      loadInitialData()
    }
  }, [user])

  // Show/hide box quantity input based on unit selection
  useEffect(() => {
    setShowBoxQuantity(
      unite.toLowerCase().includes('box') || 
      unite.toLowerCase().includes('boîte') ||
      unite.toLowerCase().includes('carton')
    )
  }, [unite])

  const loadInitialData = async () => {
    if (!user) return
    
    setLoading(true)
    const [typesRes, suppliersRes] = await Promise.all([
      Database.getProductTypes(user.id),
      Database.getSuppliers(user.id),
    ])
    
    setProductTypes(typesRes)
    setSuppliers(suppliersRes)
    
    if (typesRes.length > 0 && !type) {
      setType(typesRes[0])
    }
    
    if (suppliersRes.length > 0 && !fournisseur) {
      setFournisseur(suppliersRes[0])
    }
    
    setLoading(false)
  }

  const addToCart = () => {
    if (!nom.trim() || !quantite || parseFloat(quantite) <= 0 || !prix || parseFloat(prix) <= 0) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires')
      return
    }

    // Validate box quantity if needed
    if (showBoxQuantity && (!boxQuantity || parseFloat(boxQuantity) <= 0)) {
      Alert.alert('Erreur', 'Veuillez indiquer la quantité par boîte/carton')
      return
    }

    const newItem = {
      produit: nom.trim(),
      type: type || 'Autre',
      quantite: parseFloat(quantite),
      unite,
      prix: parseFloat(prix),
      tva,
      matiere_active: matiereActive.trim(),
      box_quantity: showBoxQuantity ? parseFloat(boxQuantity) : null,
      is_box_unit: showBoxQuantity,
    }

    setCart([...cart, newItem])
    
    // Reset form
    setNom('')
    setQuantite('')
    setPrix('')
    setMatiereActive('')
    setBoxQuantity('')
  }

  const removeFromCart = (index: number) => {
    const newCart = [...cart]
    newCart.splice(index, 1)
    setCart(newCart)
  }

  const validateCart = async () => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté')
      return
    }

    if (cart.length === 0) {
      Alert.alert('Erreur', 'Le panier est vide')
      return
    }

    if (!fournisseur.trim()) {
      Alert.alert('Erreur', 'Veuillez spécifier un fournisseur')
      return
    }

    setLoading(true)

    try {
      let successCount = 0
      let errorCount = 0

      for (const item of cart) {
        // Determine base unit (Kg or L)
        let unite_ref = 'Kg'
        let facteur = 1.0
        
        if (item.unite === 'L' || item.unite === 'ml') {
          unite_ref = 'L'
          facteur = item.unite === 'ml' ? 0.001 : 1.0
        } else if (item.unite === 'Kg' || item.unite === 'g') {
          unite_ref = 'Kg'
          facteur = item.unite === 'g' ? 0.001 : 1.0
        } else {
          unite_ref = item.unite
        }

        const purchaseData = {
          nom: item.produit,
          type_produit: item.type,
          matiere_active: item.matiere_active || '',
          quantite: item.quantite * facteur,
          unite_ref,
          unite_achat: item.unite,
          prix_u_ht: item.prix,
          taux_tva: item.tva,
          fournisseur: fournisseur.trim(),
          date: dateAchat,
          box_quantity: item.box_quantity,
          is_box_unit: item.is_box_unit,
        }

        const result = await Database.enregistrerAchatComplet(purchaseData, user.id)
        
        if (result.success) {
          successCount++
        } else {
          errorCount++
          console.error('Error recording purchase:', result.error)
        }
      }

      if (errorCount === 0) {
        Alert.alert(
          'Succès',
          `${successCount} achat(s) enregistré(s) et stock mis à jour`,
          [{ text: 'OK', onPress: () => setCart([]) }]
        )
      } else if (successCount > 0) {
        Alert.alert(
          'Résultat partiel',
          `${successCount} achat(s) réussi(s), ${errorCount} échec(s)`,
          [{ text: 'OK', onPress: () => setCart([]) }]
        )
      } else {
        Alert.alert('Erreur', 'Aucun achat n\'a pu être enregistré')
      }
    } catch (error) {
      console.error('Error validating cart:', error)
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'enregistrement')
    } finally {
      setLoading(false)
    }
  }

  const totalCartValue = cart.reduce((sum, item) => {
    const ht = item.quantite * item.prix
    const ttc = ht * (1 + item.tva / 100)
    return sum + ttc
  }, 0)

  const unitOptions = ['L', 'ml', 'Kg', 'g', 'Box', 'Boîte', 'Carton', 'Sac', 'Bidon', 'Unité']

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Luxurious Header */}
        <View style={{
          backgroundColor: colors.primary,
          padding: 24,
          paddingTop: 60,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
          ...shadows.xl,
        }}>
          <Text style={[typography.h1, { color: colors.gold, marginBottom: 4 }]}>
            🛒 Achats & Stock
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
            Enregistrez vos acquisitions
          </Text>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ padding: 20 }}>
            
            {/* Purchase Header Info */}
            <View style={[globalStyles.cardLuxury, { marginBottom: 20 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 24, marginRight: 8 }}>📋</Text>
                <Text style={[typography.h3, { color: colors.primary }]}>Informations d'Achat</Text>
              </View>
              
              <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                <View style={{ flex: 2, marginRight: 12 }}>
                  <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                    Fournisseur *
                  </Text>
                  <TextInput
                    style={globalStyles.input}
                    placeholder="Nom du fournisseur"
                    value={fournisseur}
                    onChangeText={setFournisseur}
                    placeholderTextColor={colors.textLight}
                    autoCapitalize="words"
                  />
                  {supplierSuggestions.length > 0 && (
                    <View style={styles.suggestionContainer}>
                      <Text style={[typography.small, { color: colors.textSecondary, marginBottom: 6 }]}>
                        Suggestions
                      </Text>
                      <View style={styles.suggestionRow}>
                        {supplierSuggestions.map((supplier) => (
                          <TouchableOpacity
                            key={supplier}
                            onPress={() => setFournisseur(supplier)}
                            style={styles.suggestionChip}
                          >
                            <Text style={styles.suggestionText}>{supplier}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                    Date Facture *
                  </Text>
                  <TextInput
                    style={globalStyles.input}
                    value={dateAchat}
                    onChangeText={setDateAchat}
                    placeholder="AAAA-MM-JJ"
                    placeholderTextColor={colors.textLight}
                  />
                </View>
              </View>
            </View>

            {/* Add Product Form */}
            <View style={[globalStyles.card, { marginBottom: 20 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 24, marginRight: 8 }}>📦</Text>
                <Text style={[typography.h3, { color: colors.primary }]}>Ajouter un Produit</Text>
              </View>
              
              <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                <View style={{ flex: 2, marginRight: 12 }}>
                  <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                    Nom du Produit *
                  </Text>
                  <TextInput
                    style={globalStyles.input}
                    placeholder="Nom du produit"
                    value={nom}
                    onChangeText={setNom}
                    placeholderTextColor={colors.textLight}
                  />
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                    Catégorie *
                  </Text>
                  <View style={{ 
                    backgroundColor: colors.backgroundAlt, 
                    borderRadius: 12, 
                    borderWidth: 2, 
                    borderColor: colors.border,
                  }}>
                    <Picker
                      selectedValue={type}
                      onValueChange={setType}
                      style={{ color: colors.text }}
                    >
                      {productTypes.map(t => (
                        <Picker.Item key={t} label={t} value={t} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
              
              <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                    Quantité *
                  </Text>
                  <TextInput
                    style={globalStyles.input}
                    placeholder="0.00"
                    value={quantite}
                    onChangeText={setQuantite}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textLight}
                  />
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                    Unité *
                  </Text>
                  <View style={{ 
                    backgroundColor: colors.backgroundAlt, 
                    borderRadius: 12, 
                    borderWidth: 2, 
                    borderColor: colors.border,
                  }}>
                    <Picker
                      selectedValue={unite}
                      onValueChange={setUnite}
                      style={{ color: colors.text }}
                    >
                      {unitOptions.map(u => (
                        <Picker.Item key={u} label={u} value={u} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              {/* Box Quantity Input - NEW */}
              {showBoxQuantity && (
                <View style={{
                  backgroundColor: colors.goldLight,
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 16,
                  borderWidth: 2,
                  borderColor: colors.gold,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 20, marginRight: 8 }}>📦</Text>
                    <Text style={[typography.body, { color: colors.primary, fontWeight: '600' }]}>
                      Contenu par {unite}
                    </Text>
                  </View>
                  <Text style={[typography.caption, { marginBottom: 8, color: colors.text }]}>
                    Quantité d'unités par {unite.toLowerCase()} *
                  </Text>
                  <TextInput
                    style={[globalStyles.input, { backgroundColor: 'white' }]}
                    placeholder="Ex: 50 (pour 50 kg par carton)"
                    value={boxQuantity}
                    onChangeText={setBoxQuantity}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textLight}
                  />
                  <Text style={[typography.small, { color: colors.textSecondary, fontStyle: 'italic', marginTop: -8 }]}>
                    💡 Le stock sera calculé automatiquement: {quantite && boxQuantity ? 
                      `${parseFloat(quantite) * parseFloat(boxQuantity)} unités` : '0 unités'}
                  </Text>
                </View>
              )}
              
              <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                    Prix Unitaire HT *
                  </Text>
                  <TextInput
                    style={globalStyles.input}
                    placeholder="0.00"
                    value={prix}
                    onChangeText={setPrix}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textLight}
                  />
                </View>
                
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                    TVA % *
                  </Text>
                  <View style={{ 
                    backgroundColor: colors.backgroundAlt, 
                    borderRadius: 12, 
                    borderWidth: 2, 
                    borderColor: colors.border,
                  }}>
                    <Picker
                      selectedValue={tva.toString()}
                      onValueChange={(value) => setTva(parseInt(value))}
                      style={{ color: colors.text }}
                    >
                      {[0, 7, 10, 14, 20].map(v => (
                        <Picker.Item key={v} label={`${v}%`} value={v.toString()} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
              
              <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                Matière Active (Optionnel)
              </Text>
              <TextInput
                style={globalStyles.input}
                placeholder="Matière active"
                value={matiereActive}
                onChangeText={setMatiereActive}
                placeholderTextColor={colors.textLight}
              />
              
              <TouchableOpacity
                style={[globalStyles.buttonGold, { marginTop: 8 }]}
                onPress={addToCart}
              >
                <Text style={globalStyles.buttonText}>➕ Ajouter au Panier</Text>
              </TouchableOpacity>
            </View>

            {/* Cart */}
            {cart.length > 0 && (
              <View style={[globalStyles.cardLuxury, { marginBottom: 32 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <View>
                    <Text style={[typography.h2, { color: colors.primary }]}>
                      🛒 Panier ({cart.length})
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                      Articles à enregistrer
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: colors.goldLight,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: colors.gold,
                  }}>
                    <Text style={[typography.caption, { color: colors.text, marginBottom: 2 }]}>
                      Total
                    </Text>
                    <Text style={[typography.h3, { color: colors.primary, fontWeight: '700' }]}>
                      {formatCurrency(totalCartValue)}
                    </Text>
                  </View>
                </View>
                
                {cart.map((item, index) => (
                  <CartItem
                    key={index}
                    item={item}
                    index={index}
                    onRemove={removeFromCart}
                  />
                ))}
                
                <TouchableOpacity
                  style={[globalStyles.button, { 
                    marginTop: 20,
                    backgroundColor: loading ? colors.textLight : colors.success,
                    ...shadows.md,
                  }]}
                  onPress={validateCart}
                  disabled={loading}
                >
                  <Text style={globalStyles.buttonText}>
                    {loading ? 'Enregistrement...' : '💳 Valider & Mettre à jour Stock'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = {
  suggestionContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
  },
  suggestionChip: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  suggestionText: {
    fontSize: 12,
    color: colors.text,
  },
}