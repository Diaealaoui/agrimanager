import React, { useState, useEffect, useMemo } from 'react'
import { 
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal, FlatList, 
  Switch, StyleSheet, Platform
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { Feather } from '@expo/vector-icons'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import Header from '../../components/layout/Header'
import DateInput from '../../components/common/DateInput'
import { globalStyles, typography, colors, shadows } from '../../utils/styles'

export default function TreatmentsScreen() {
  const { user } = useAuth()
  
  // Data State
  const [parcelles, setParcelles] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [plannedList, setPlannedList] = useState<any[]>([])
  
  // Form State
  const [isPlanningMode, setIsPlanningMode] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [isProductModalVisible, setIsProductModalVisible] = useState(false)
  
  const [selectedParcelle, setSelectedParcelle] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedProductObj, setSelectedProductObj] = useState<any>(null)
  
  const [dose, setDose] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [waterVolume, setWaterVolume] = useState('') 
  
  const [treatmentBuffer, setTreatmentBuffer] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadData()
      loadPlanning()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return
    try {
      const [parcellesRes, productsRes] = await Promise.all([
        Database.obtenirParcelles(user.id),
        Database.obtenirProduits(user.id),
      ])
      setParcelles(parcellesRes || [])
      setProducts(productsRes || [])
    } catch (e) {
      console.error("Error loading data", e)
    }
  }

  const loadPlanning = async () => {
    if (!user) return
    // @ts-ignore
    const plans = await Database.getPlannedTreatments(user.id)
    setPlannedList(plans || [])
  }

  // --- GROUPING LOGIC ---
  const groupedPlans = useMemo(() => {
    const groups: any = {}
    plannedList.forEach(item => {
      // If it has a group_id, use it. If not, use ID as group (Solo)
      const key = item.group_id || `SOLO_${item.id}`
      if (!groups[key]) {
        groups[key] = {
          id: key,
          date: item.date_prevue,
          parcelle: item.parcelle,
          water: item.quantite_eau || 0,
          items: []
        }
      }
      groups[key].items.push(item)
    })
    return Object.values(groups).sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [plannedList])

  // --- FILTERING ---
  const getFilteredProducts = () => {
    if (!products) return []
    if (productSearch.trim().length === 0) return products
    return products.filter(p => p.nom && p.nom.toLowerCase().includes(productSearch.toLowerCase()))
  }

  const handleProductSelect = (product: any) => {
    if (!product) return
    setSelectedProduct(product.nom)
    setSelectedProductObj(product)
    setIsProductModalVisible(false)
    setProductSearch('')
  }

  // --- HELPER: Get Current Form Item ---
  const getCurrentItem = () => {
    if (!selectedParcelle || !selectedProduct || !dose || parseFloat(dose) <= 0) {
      return null
    }
    const product = selectedProductObj || products.find(p => p.nom === selectedProduct)
    const cost = parseFloat(dose) * (product?.prix_moyen || 0)
    
    return {
      parcelle: selectedParcelle,
      produit: selectedProduct,
      produit_id: product?.id,
      dose: parseFloat(dose),
      unit: product?.unite_reference || '',
      date,
      cost,
    }
  }

  // --- ADD TO MIX (Buffer) ---
  const addToBuffer = () => {
    const item = getCurrentItem()
    if (!item) { Alert.alert('Erreur', 'Remplissez Parcelle, Produit et Dose.'); return }
    
    setTreatmentBuffer([...treatmentBuffer, item])
    // Reset product fields only
    setSelectedProduct('')
    setSelectedProductObj(null)
    setDose('')
  }

  const removeFromBuffer = (index: number) => {
    setTreatmentBuffer(treatmentBuffer.filter((_, i) => i !== index))
  }

  // --- SAVE MIX (Group) ---
  const saveBuffer = async () => {
    if (treatmentBuffer.length === 0) return
    if (!waterVolume) { Alert.alert('Attention', 'Volume d\'eau requis pour un mélange.'); return }
    
    await performSave(treatmentBuffer, parseFloat(waterVolume))
    setTreatmentBuffer([])
    setWaterVolume('')
  }

  // --- SAVE SOLO (Direct) ---
  const saveSolo = async () => {
    const item = getCurrentItem()
    if (!item) { Alert.alert('Erreur', 'Remplissez les champs.'); return }
    
    // Water is optional for solo, but good to have
    const water = waterVolume ? parseFloat(waterVolume) : 0
    
    await performSave([item], water)
    
    // Clear form
    setSelectedProduct('')
    setSelectedProductObj(null)
    setDose('')
    setWaterVolume('')
  }

  // --- DATABASE SAVE ---
  const performSave = async (items: any[], water: number) => {
    setLoading(true)
    try {
      if (isPlanningMode) {
        // @ts-ignore
        const result = await Database.savePlannedBatch(user!.id, items, water)
        if (result.success) {
          Alert.alert("Planifié", "Traitement ajouté au planning.")
          loadPlanning()
        } else {
          Alert.alert("Erreur", result.error)
        }
      } else {
        const batch = items.map(t => ({
          user_id: user!.id,
          produit_id: t.produit_id,
          parcelle: t.parcelle,
          quantite_utilisee: t.dose,
          date_traitement: t.date,
        }))
        // @ts-ignore
        const result = await Database.enregistrerTraitementBatch(batch, water)
        if (result.success) {
          Alert.alert("Succès", "Traitement enregistré et stock débité.")
        } else {
          Alert.alert("Erreur", result.error)
        }
      }
    } catch (e) {
      Alert.alert("Erreur", "Une erreur est survenue")
    } finally {
      setLoading(false)
    }
  }

  // --- EXECUTE PLAN ---
  const executePlanGroup = async (group: any) => {
    const isMix = group.items.length > 1
    Alert.alert(
      isMix ? "Valider le Mélange ?" : "Valider le Traitement ?", 
      `Appliquer sur ${group.parcelle} ?\nStock sera débité.`,
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Valider", 
          onPress: async () => {
            // @ts-ignore
            const res = await Database.executePlanGroup(user!.id, group.items)
            if (res.success) {
              loadPlanning()
              Alert.alert("Succès", "Réalisé !")
            } else {
              Alert.alert("Erreur", res.error)
            }
          }
        }
      ]
    )
  }

  const deletePlanGroup = async (group: any) => {
    // @ts-ignore
    await Database.deletePlannedGroup(group.id)
    loadPlanning()
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Traitements" />
      
      <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
        
        {/* MODE TOGGLE */}
        <View style={styles.toggleContainer}>
           <Text style={{ fontWeight: 'bold', color: !isPlanningMode ? colors.primary : '#999', marginRight: 10 }}>⚡ Direct</Text>
           <Switch 
             value={isPlanningMode} 
             onValueChange={setIsPlanningMode} 
             trackColor={{ false: "#e2e8f0", true: "#bfdbfe" }}
             thumbColor={isPlanningMode ? colors.info : colors.primary}
           />
           <Text style={{ fontWeight: 'bold', color: isPlanningMode ? colors.info : '#999', marginLeft: 10 }}>📅 Planification</Text>
        </View>

        {/* FORM */}
        <View style={[globalStyles.card, { marginBottom: 16, borderColor: isPlanningMode ? colors.info : 'transparent', borderWidth: isPlanningMode ? 2 : 0 }]}>
          <Text style={[typography.h2, { marginBottom: 16, color: isPlanningMode ? colors.info : colors.text }]}>
            {isPlanningMode ? "📅 Planifier" : "➕ Nouveau Traitement"}
          </Text>
          
          {/* Parcelle */}
          <View style={styles.pickerContainer}>
            <Picker selectedValue={selectedParcelle} onValueChange={setSelectedParcelle} style={{ height: 50 }}>
              <Picker.Item label="Sélectionner une parcelle..." value="" color={colors.textSecondary} />
              {parcelles.map((p, i) => <Picker.Item key={p.id || i} label={p.nom} value={p.nom} />)}
            </Picker>
          </View>
          
          {/* Product Selector */}
          <TouchableOpacity onPress={() => setIsProductModalVisible(true)} style={styles.productSelectButton}>
            <Text style={{ color: selectedProduct ? colors.text : colors.textSecondary, fontSize: 16 }}>
                {selectedProduct || "Toucher pour sélectionner un produit..."}
            </Text>
            <Feather name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          
          {/* Dose & Date */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={typography.caption}>Dose</Text>
              <TextInput style={globalStyles.input} placeholder="0.00" value={dose} onChangeText={setDose} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={typography.caption}>Date</Text>
              <DateInput value={date} onChange={setDate} />
            </View>
          </View>

          {/* Water (Optional for solo, required for mix) */}
          <View style={{ marginBottom: 15 }}>
             <Text style={typography.caption}>Eau (L) {treatmentBuffer.length > 0 ? '*Requis pour Mix' : ''}</Text>
             <TextInput style={globalStyles.input} placeholder="ex: 400" value={waterVolume} onChangeText={setWaterVolume} keyboardType="numeric" />
          </View>

          {/* ACTION BUTTONS */}
          {treatmentBuffer.length === 0 ? (
             <View style={{ flexDirection: 'row', gap: 10 }}>
                {/* Button 1: Add to Mix */}
                <TouchableOpacity style={[globalStyles.button, { flex: 1, backgroundColor: '#64748b' }]} onPress={addToBuffer}>
                   <Feather name="list" size={18} color="white" style={{ marginRight: 8 }} />
                   <Text style={{ color: 'white', fontWeight: 'bold' }}>Créer Mix</Text>
                </TouchableOpacity>

                {/* Button 2: Save Solo */}
                <TouchableOpacity style={[globalStyles.button, { flex: 1, backgroundColor: isPlanningMode ? colors.info : colors.success }]} onPress={saveSolo}>
                   <Feather name={isPlanningMode ? "calendar" : "check"} size={18} color="white" style={{ marginRight: 8 }} />
                   <Text style={{ color: 'white', fontWeight: 'bold' }}>{isPlanningMode ? "Planifier Solo" : "Valider Solo"}</Text>
                </TouchableOpacity>
             </View>
          ) : (
             <TouchableOpacity style={[globalStyles.button, { backgroundColor: '#64748b' }]} onPress={addToBuffer}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Ajouter un autre produit au mélange (+)</Text>
             </TouchableOpacity>
          )}
        </View>
        
        {/* MIX BUFFER LIST */}
        {treatmentBuffer.length > 0 && (
          <View style={[globalStyles.card, { marginBottom: 30, backgroundColor: '#f8fafc', borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e1' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={typography.h3}>📋 Mélange en cours ({treatmentBuffer.length})</Text>
            </View>
            
            {treatmentBuffer.map((item, index) => (
              <View key={index} style={styles.bufferItem}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600' }}>{item.produit}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.dose} {item.unit}</Text>
                </View>
                <TouchableOpacity onPress={() => removeFromBuffer(index)}><Feather name="trash-2" size={18} color={colors.danger} /></TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={[globalStyles.button, { marginTop: 16, backgroundColor: isPlanningMode ? colors.info : colors.success }]} onPress={saveBuffer}>
              <Text style={globalStyles.buttonText}>
                {isPlanningMode ? `💾 TERMINER & PLANIFIER` : `🚀 TERMINER & DÉBITER`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PLANNING LIST */}
        {groupedPlans.length > 0 && (
          <View style={{ marginTop: 20, marginBottom: 50 }}>
            <Text style={[typography.h2, { marginBottom: 15, color: colors.textSecondary }]}>📌 Traitements Planifiés</Text>
            
            {(groupedPlans as any[]).map((group: any) => {
              const isMix = group.items.length > 1;
              return (
                <View key={group.id} style={styles.planCard}>
                   
                   <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                       {/* Date */}
                       <View style={styles.dateBox}>
                          <Text style={{ fontWeight: 'bold', fontSize: 14, color: colors.text }}>{group.date ? group.date.split('-')[2] : '--'}</Text>
                          <Text style={{ fontSize: 10, color: colors.textSecondary }}>{group.date ? group.date.split('-')[1] : '--'}</Text>
                       </View>
                       
                       {/* Details */}
                       <View style={{ flex: 1, paddingHorizontal: 10 }}>
                           <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{group.parcelle}</Text>
                              {group.water > 0 && <Text style={{ fontSize: 10, color: colors.info, marginTop: 2 }}>{group.water} L</Text>}
                           </View>

                           {isMix ? (
                             <View>
                               <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 12 }}>Mélange ({group.items.length} produits)</Text>
                               {group.items.map((it:any, idx:number) => (
                                 <Text key={idx} style={{ fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                                   • {it.nom_produit} ({it.quantite_prevue})
                                 </Text>
                               ))}
                             </View>
                           ) : (
                             <Text style={{ fontSize: 13, color: '#333' }}>
                               {group.items[0].nom_produit} <Text style={{color: colors.textSecondary}}>({group.items[0].quantite_prevue} {group.items[0].produits?.unite_reference})</Text>
                             </Text>
                           )}
                       </View>
                   </View>

                   {/* ACTIONS */}
                   <View style={{ flexDirection: 'column', gap: 6, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: '#f1f5f9' }}>
                       <TouchableOpacity onPress={() => executePlanGroup(group)} style={{ backgroundColor: '#dcfce7', padding: 8, borderRadius: 8 }}>
                          <Feather name="check" size={18} color={colors.success} />
                       </TouchableOpacity>
                       <TouchableOpacity onPress={() => deletePlanGroup(group)} style={{ backgroundColor: '#fee2e2', padding: 8, borderRadius: 8 }}>
                          <Feather name="trash-2" size={18} color={colors.danger} />
                       </TouchableOpacity>
                   </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* --- CRASH-PROOF MODAL --- */}
      <Modal 
        visible={isProductModalVisible} 
        animationType="slide" 
        transparent={false} // Full screen helps stability
        presentationStyle="pageSheet" // Nice look on iOS
        onRequestClose={() => setIsProductModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'white', paddingTop: 20 }}>
            
            <View style={styles.modalHeader}>
              <Text style={typography.h2}>Sélectionner un produit</Text>
              <TouchableOpacity onPress={() => setIsProductModalVisible(false)} style={{ padding: 10 }}>
                  <Feather name="x" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
               <View style={styles.searchBox}>
                   <Feather name="search" size={20} color={colors.textSecondary} />
                   <TextInput 
                     style={styles.modalSearchInput} 
                     placeholder="Rechercher..." 
                     value={productSearch} 
                     onChangeText={setProductSearch} 
                   />
               </View>
            </View>

            <FlatList
              data={getFilteredProducts()}
              keyExtractor={(item, index) => item.id ? String(item.id) : String(index)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 50 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.productItem} onPress={() => handleProductSelect(item)}>
                  <View>
                      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.nom}</Text>
                      <Text style={{ fontSize: 12, color: '#666' }}>
                         Stock: {item.stock_actuel ?? 0} {item.unite_reference}
                      </Text>
                  </View>
                  <Feather name="plus-circle" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20, color: '#999'}}>Aucun produit trouvé</Text>}
            />
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  toggleContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16, backgroundColor: 'white', padding: 10, borderRadius: 12, ...shadows.sm },
  pickerContainer: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginBottom: 16, backgroundColor: 'white' },
  productSelectButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 14, backgroundColor: 'white', marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' },
  bufferItem: { backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...shadows.sm },
  
  planCard: { 
      backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 10, ...shadows.sm,
      borderLeftWidth: 4, borderLeftColor: colors.info, flexDirection: 'row', alignItems: 'center'
  },
  
  dateBox: { backgroundColor: '#f1f5f9', padding: 6, borderRadius: 8, alignItems: 'center', minWidth: 45 },
  
  // Modal Styles
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, marginTop: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10 },
  modalSearchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  productItem: { paddingVertical: 15, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
})