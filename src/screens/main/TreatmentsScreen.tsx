import React, { useState, useEffect } from 'react'
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  Modal, 
  FlatList, 
  KeyboardAvoidingView,
  Platform
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Picker } from '@react-native-picker/picker'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import Header from '../../components/layout/Header'
import DateInput from '../../components/common/DateInput' // <--- IMPORTED CALENDAR COMPONENT
import { globalStyles, typography, colors, shadows } from '../../utils/styles'

export default function TreatmentsScreen() {
  const { user } = useAuth()
  const [parcelles, setParcelles] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [productTypes, setProductTypes] = useState<string[]>([])
  
  // Selection State
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [isProductModalVisible, setIsProductModalVisible] = useState(false)
  
  const [selectedParcelle, setSelectedParcelle] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedProductObj, setSelectedProductObj] = useState<any>(null)
  
  const [dose, setDose] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  
  // NEW: Water Volume State
  const [waterVolume, setWaterVolume] = useState('') 
  
  const [treatmentBuffer, setTreatmentBuffer] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Load Data
  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const [parcellesRes, productsRes, typesRes] = await Promise.all([
        Database.obtenirParcelles(user.id),
        Database.obtenirProduits(user.id),
        Database.getProductTypes(user.id),
      ])
      
      setParcelles(parcellesRes || [])
      setProducts(productsRes || [])
      setProductTypes(typesRes || [])
    } catch (e) {
      console.error("Error loading treatment data", e)
    } finally {
      setLoading(false)
    }
  }

  // Filter Logic
  const getFilteredProducts = () => {
    let filtered = products

    if (selectedType && selectedType !== 'Tous') {
      filtered = filtered.filter(p => 
        (p.type_produit || '').toLowerCase() === selectedType.toLowerCase()
      )
    }

    if (productSearch.trim().length > 0) {
      filtered = filtered.filter(p => 
        p.nom.toLowerCase().includes(productSearch.toLowerCase())
      )
    }

    return filtered
  }

  const handleProductSelect = (product: any) => {
    setSelectedProduct(product.nom)
    setSelectedProductObj(product)
    setIsProductModalVisible(false)
    setProductSearch('')
  }

  const addToBuffer = () => {
    if (!selectedParcelle || !selectedProduct || !dose || parseFloat(dose) <= 0) {
      Alert.alert('Erreur', 'Veuillez remplir la parcelle, le produit et une dose valide.')
      return
    }

    const product = selectedProductObj || products.find(p => p.nom === selectedProduct)
    
    // Calculate estimated cost
    const cost = parseFloat(dose) * (product?.prix_moyen || 0)
    
    setTreatmentBuffer([...treatmentBuffer, {
      parcelle: selectedParcelle,
      produit: selectedProduct,
      produit_id: product?.id,
      dose: parseFloat(dose),
      unit: product?.unite_reference || '',
      date, // Keeps the date selected for this specific line (usually same for all)
      cost,
    }])
    
    // Reset inputs but keep parcelle/date for convenience
    setSelectedProduct('')
    setSelectedProductObj(null)
    setDose('')
  }

  const removeFromBuffer = (index: number) => {
    setTreatmentBuffer(treatmentBuffer.filter((_, i) => i !== index))
  }

  // UPDATED: Save Logic with Water Volume
  const saveTreatments = async () => {
    if (!user || treatmentBuffer.length === 0) return

    // Logic to handle missing water volume
    if (!waterVolume) {
      Alert.alert(
        'Volume d\'eau manquant', 
        'Voulez-vous enregistrer ce traitement sans préciser le volume de bouillie ?', 
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Oui, enregistrer', onPress: () => processBatchSave(0) }
        ]
      )
      return
    }

    processBatchSave(parseFloat(waterVolume))
  }

  const processBatchSave = async (water: number) => {
    // Map buffer to the format expected by Database
    const batch = treatmentBuffer.map(t => ({
      user_id: user!.id,
      produit_id: t.produit_id,
      parcelle: t.parcelle,
      quantite_utilisee: t.dose,
      date_traitement: t.date,
    }))
    
    // Call the updated database function with water volume
    // @ts-ignore - Assuming you updated database.ts to accept the 2nd argument
    const result = await Database.enregistrerTraitementBatch(batch, water)
    
    if (result.success) {
      Alert.alert('Succès', `Traitement enregistré avec succès (${result.count} produits)`)
      setTreatmentBuffer([])
      setWaterVolume('')
    } else {
      Alert.alert('Erreur', result.error || 'Erreur lors de l\'enregistrement')
    }
  }

  const totalBufferCost = treatmentBuffer.reduce((sum, t) => sum + t.cost, 0)

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Traitements" />
      
      <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
        {/* --- ADD TREATMENT FORM --- */}
        <View style={[globalStyles.card, { marginBottom: 16 }]}>
          <Text style={[typography.h2, { marginBottom: 16 }]}>➕ Nouveau Traitement</Text>
          
          {/* 1. Parcelle Selection */}
          <Text style={[typography.caption, { marginBottom: 4 }]}>Parcelle</Text>
          <View style={{ 
            borderWidth: 1, 
            borderColor: colors.border, 
            borderRadius: 8, 
            marginBottom: 16,
            backgroundColor: 'white' 
          }}>
            <Picker
              selectedValue={selectedParcelle}
              onValueChange={setSelectedParcelle}
              style={{ height: 50 }}
            >
              <Picker.Item label="Sélectionner une parcelle..." value="" color={colors.textSecondary} />
              {parcelles.map(p => (
                <Picker.Item key={p.id} label={p.nom} value={p.nom} />
              ))}
            </Picker>
          </View>
          
          {/* 2. Product Type Filter (Chips) */}
          <Text style={[typography.caption, { marginBottom: 8 }]}>Filtrer par Type</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={{ marginBottom: 16 }}
            contentContainerStyle={{ paddingRight: 20 }}
          >
            <TouchableOpacity
              onPress={() => setSelectedType(null)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: selectedType === null ? colors.primary : colors.backgroundAlt,
                marginRight: 8,
                borderWidth: 1,
                borderColor: selectedType === null ? colors.primary : colors.border
              }}
            >
              <Text style={{ 
                color: selectedType === null ? 'white' : colors.text,
                fontWeight: '600',
                fontSize: 13
              }}>Tous</Text>
            </TouchableOpacity>
            
            {productTypes.map(type => (
              <TouchableOpacity
                key={type}
                onPress={() => setSelectedType(type === selectedType ? null : type)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: selectedType === type ? colors.primary : colors.backgroundAlt,
                  marginRight: 8,
                  borderWidth: 1,
                  borderColor: selectedType === type ? colors.primary : colors.border
                }}
              >
                <Text style={{ 
                  color: selectedType === type ? 'white' : colors.text,
                  fontWeight: '600',
                  fontSize: 13
                }}>{type}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 3. Product Selection Trigger */}
          <Text style={[typography.caption, { marginBottom: 4 }]}>Produit</Text>
          <TouchableOpacity
            onPress={() => setIsProductModalVisible(true)}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              padding: 14,
              backgroundColor: 'white',
              marginBottom: 16,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Text style={{ 
              color: selectedProduct ? colors.text : colors.textSecondary,
              fontSize: 16
            }}>
              {selectedProduct || "Toucher pour sélectionner un produit..."}
            </Text>
            <Feather name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          
          {/* 4. Details (Dose & Date) */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[typography.caption, { marginBottom: 4 }]}>Dose Utilitaire</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[globalStyles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="0.00"
                  value={dose}
                  onChangeText={setDose}
                  keyboardType="numeric"
                />
                {selectedProductObj && (
                  <Text style={{ marginLeft: 8, color: colors.textSecondary, fontWeight: '600' }}>
                    {selectedProductObj.unite_reference}
                  </Text>
                )}
              </View>
            </View>
            
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[typography.caption, { marginBottom: 4 }]}>Date</Text>
              {/* FIXED: Using DateInput for Calendar Picker */}
              <DateInput 
                value={date} 
                onChange={setDate} 
                placeholder="Date"
              />
            </View>
          </View>
          
          <TouchableOpacity
            style={[globalStyles.button, { marginTop: 24 }]}
            onPress={addToBuffer}
          >
            <Text style={globalStyles.buttonText}>Ajouter au mélange</Text>
          </TouchableOpacity>
        </View>
        
        {/* --- TREATMENT BUFFER LIST (THE MIX) --- */}
        {treatmentBuffer.length > 0 && (
          <View style={[globalStyles.card, { marginBottom: 30 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={typography.h2}>📋 Mélange en cours ({treatmentBuffer.length})</Text>
              <Text style={[typography.h3, { color: colors.primary }]}>
                {totalBufferCost.toFixed(2)} MAD
              </Text>
            </View>
            
            {treatmentBuffer.map((item, index) => (
              <View key={index} style={{
                backgroundColor: '#f8fafc',
                padding: 12,
                borderRadius: 8,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', marginBottom: 2 }}>
                    {item.parcelle} - {item.produit}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {item.dose} {item.unit} • {item.date} • {item.cost.toFixed(2)} MAD
                  </Text>
                </View>
                
                <TouchableOpacity 
                  onPress={() => removeFromBuffer(index)}
                  style={{ padding: 8 }}
                >
                  <Feather name="trash-2" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
            
            {/* NEW: Water Volume Input for the Batch */}
            <View style={{ 
              marginTop: 16, 
              borderTopWidth: 1, 
              borderTopColor: '#e2e8f0', 
              paddingTop: 16 
            }}>
              <Text style={[typography.h3, { marginBottom: 8, fontSize: 16, color: colors.primary }]}>
                💧 Volume de Bouillie (Eau)
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[globalStyles.input, { flex: 1, marginBottom: 0, textAlign: 'center', fontWeight: 'bold' }]}
                  placeholder="Ex: 400"
                  value={waterVolume}
                  onChangeText={setWaterVolume}
                  keyboardType="numeric"
                />
                <Text style={{ marginLeft: 12, fontWeight: 'bold', color: colors.textSecondary, fontSize: 16 }}>
                  Litres
                </Text>
              </View>
              {selectedParcelle && parcelles.find(p => p.nom === selectedParcelle)?.surface_ha ? (
                <Text style={{ textAlign: 'center', marginTop: 8, color: colors.info, fontSize: 12 }}>
                  Soit {(parseFloat(waterVolume || '0') / parcelles.find(p => p.nom === selectedParcelle).surface_ha).toFixed(0)} L/Ha
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={[globalStyles.button, { marginTop: 16, backgroundColor: colors.success }]}
              onPress={saveTreatments}
            >
              <Text style={globalStyles.buttonText}>🚀 Valider le Traitement</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* --- PRODUCT SELECTION MODAL --- */}
      <Modal 
        visible={isProductModalVisible} 
        animationType="slide" 
        transparent={true}
        onRequestClose={() => setIsProductModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, marginTop: 60 }}
          >
            <View style={{ 
              flex: 1, 
              backgroundColor: 'white', 
              borderTopLeftRadius: 20, 
              borderTopRightRadius: 20,
              padding: 16,
              ...shadows.xl
            }}>
              {/* Modal Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={typography.h2}>Sélectionner un produit</Text>
                <TouchableOpacity onPress={() => setIsProductModalVisible(false)}>
                  <Feather name="x" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Search Box */}
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: colors.backgroundAlt, 
                borderRadius: 10, 
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: 16
              }}>
                <Feather name="search" size={20} color={colors.textSecondary} />
                <TextInput 
                  style={{ flex: 1, marginLeft: 10, fontSize: 16, color: colors.text }}
                  placeholder="Rechercher un produit..."
                  value={productSearch}
                  onChangeText={setProductSearch}
                  autoFocus={true}
                />
              </View>

              {/* Filter Info */}
              {selectedType && (
                <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                   <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                     Filtre actif : <Text style={{ fontWeight: 'bold', color: colors.primary }}>{selectedType}</Text>
                   </Text>
                </View>
              )}

              {/* Product List */}
              <FlatList
                data={getFilteredProducts()}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={{ 
                      paddingVertical: 14, 
                      borderBottomWidth: 1, 
                      borderBottomColor: colors.borderLight,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onPress={() => handleProductSelect(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', fontSize: 15, color: colors.text }}>
                        {item.nom}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {item.type_produit || 'Autre'} • Stock: {item.stock_actuel} {item.unite_reference}
                      </Text>
                    </View>
                    <Feather name="plus-circle" size={20} color={colors.primary} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary }}>Aucun produit trouvé.</Text>
                  </View>
                }
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  )
}