import React, { useState, useEffect } from 'react'
import { 
  View, 
  Text, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  Switch
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import CartItem from '../../components/common/CartItem'
import Sidebar from '../../components/layout/Sidebar'
import DateInput from '../../components/common/DateInput' 
import { globalStyles, typography, colors, shadows } from '../../utils/styles'
import { formatCurrency } from '../../utils/helpers'
import { Feather } from '@expo/vector-icons'

export default function PurchasesScreen() {
  const { user } = useAuth()
  const [cart, setCart] = useState<any[]>([])
  const [productTypes, setProductTypes] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Form Fields
  const [fournisseur, setFournisseur] = useState('')
  const [dateAchat, setDateAchat] = useState(new Date().toISOString().split('T')[0])
  const [nom, setNom] = useState('')
  const [type, setType] = useState('')
  
  // === INPUT STATES ===
  const [mode, setMode] = useState<'standard' | 'box'>('standard') // 'standard' = Kg/L, 'box' = Boîte
  
  // Standard Inputs
  const [stdQty, setStdQty] = useState('') // "10" (Kg)
  const [stdPrice, setStdPrice] = useState('') // "20" (DH/Kg)
  const [stdUnit, setStdUnit] = useState('L') // "L" or "Kg"

  // Box Inputs
  const [boxCount, setBoxCount] = useState('') // "5" (Boîtes)
  const [boxPrice, setBoxPrice] = useState('') // "10" (DH/Boîte)
  const [boxCap, setBoxCap] = useState('')     // "0.1" (L/Boîte)
  const [boxRefUnit, setBoxRefUnit] = useState('L') // "L" (Unit of the capacity)

  const [tva, setTva] = useState(20)
  const [matiereActive, setMatiereActive] = useState('')
  
  // UI Helpers
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(false)

  const filteredSuppliers = suppliers.filter(s => s.toLowerCase().includes(fournisseur.toLowerCase())).slice(0, 5)

  useEffect(() => {
    if (user) loadInitialData()
  }, [user])

  const loadInitialData = async () => {
    if (!user) return
    const [typesRes, suppliersRes] = await Promise.all([
      Database.getProductTypes(user.id),
      Database.getSuppliers(user.id),
    ])
    setProductTypes(typesRes || [])
    setSuppliers(suppliersRes || [])
    if (typesRes?.length > 0) setType(typesRes[0])
  }

  // --- CALCULATOR ---
  const getCalculation = () => {
    let totalHT = 0
    let stockAdd = 0
    let stockUnitDisplay = ''
    let pricePerRef = 0

    if (mode === 'standard') {
        const q = parseFloat(stdQty) || 0
        const p = parseFloat(stdPrice) || 0
        totalHT = q * p
        stockAdd = q
        stockUnitDisplay = stdUnit
        pricePerRef = p
    } else {
        const count = parseFloat(boxCount) || 0
        const price = parseFloat(boxPrice) || 0
        const cap = parseFloat(boxCap) || 0
        totalHT = count * price
        stockAdd = count * cap // 5 * 0.1 = 0.5
        stockUnitDisplay = boxRefUnit
        // Price per L = (5 * 10) / 0.5 = 100
        pricePerRef = stockAdd > 0 ? totalHT / stockAdd : 0
    }

    return {
        totalHT,
        totalTTC: totalHT * (1 + tva/100),
        stockAdd,
        stockUnitDisplay,
        pricePerRef
    }
  }

  const { totalTTC, stockAdd, stockUnitDisplay, pricePerRef } = getCalculation()

  const addToCart = () => {
    if (!nom.trim()) { Alert.alert('Erreur', 'Nom du produit manquant'); return }
    
    if (mode === 'standard') {
        if (!stdQty || !stdPrice) { Alert.alert('Erreur', 'Quantité ou Prix manquant'); return }
    } else {
        if (!boxCount || !boxPrice || !boxCap) { Alert.alert('Erreur', 'Remplissez: Nb Boîtes, Prix/Boîte et Contenance'); return }
    }

    const newItem = {
      produit: nom.trim(),
      type: type || 'Autre',
      matiere_active: matiereActive.trim(),
      tva,
      // Logic for saving
      is_box_unit: mode === 'box',
      
      // Standard Data
      quantite: mode === 'standard' ? parseFloat(stdQty) : parseFloat(boxCount), // Store "5" if box, "10" if std
      unite: mode === 'standard' ? stdUnit : 'Boîte', // Display Unit
      prix: mode === 'standard' ? parseFloat(stdPrice) : parseFloat(boxPrice), // Display Price
      
      // Box Specifics
      box_quantity: mode === 'box' ? parseFloat(boxCap) : null,
      
      // Pre-calculated for display/validation
      stock_preview: stockAdd,
      stock_unit_preview: mode === 'box' ? boxRefUnit : stdUnit,
      total_ttc: totalTTC
    }

    setCart([...cart, newItem])
    
    // Partial Reset
    setNom('')
    setStdQty(''); setStdPrice('')
    setBoxCount(''); setBoxPrice(''); setBoxCap('')
    setMatiereActive('')
  }

  const validateCart = async () => {
    if (!fournisseur.trim()) { Alert.alert('Erreur', 'Fournisseur manquant'); return }
    setLoading(true)
    
    for (const item of cart) {
      const payload = {
        nom: item.produit,
        type_produit: item.type,
        matiere_active: item.matiere_active,
        quantite: item.quantite,       // e.g. 5 (Boxes) OR 10 (kg)
        unite_achat: item.unite,       // e.g. "Boîte" OR "kg"
        unite_ref: item.stock_unit_preview, // e.g. "L" (The real stock unit)
        prix_u_ht: item.prix,          // e.g. 10 (Price per Box)
        taux_tva: item.tva,
        fournisseur: fournisseur.trim(),
        date: dateAchat,
        box_quantity: item.box_quantity, // e.g. 0.1
        is_box_unit: item.is_box_unit
      }
      
      await Database.enregistrerAchatComplet(payload, user!.id)
    }
    setLoading(false)
    setCart([])
    Alert.alert('Succès', 'Stock mis à jour avec succès !')
  }

  const totalCartValue = cart.reduce((sum, item) => sum + item.total_ttc, 0)

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        
        {/* Header */}
        <View style={{ backgroundColor: colors.primary, padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', borderBottomRightRadius: 25 }}>
          <TouchableOpacity onPress={() => setSidebarVisible(true)} style={{ marginRight: 15 }}>
            <Feather name="menu" size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={[typography.h1, { color: colors.gold, fontSize: 22 }]}>Nouvel Achat</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Entrée de stock intelligente</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          
          {/* 1. Supplier & Product */}
          <View style={[globalStyles.card, { padding: 16, marginBottom: 16 }]}>
            <Text style={[typography.h3, { color: colors.primary, marginBottom: 10 }]}>1. Informations Produit</Text>
            
            {/* Supplier / Date Row */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={typography.caption}>Fournisseur</Text>
                <TextInput 
                  style={globalStyles.input} 
                  value={fournisseur} 
                  onChangeText={setFournisseur} 
                  onFocus={() => setShowSupplierSuggestions(true)}
                  placeholder="Nom..."
                />
                {showSupplierSuggestions && filteredSuppliers.length > 0 && (
                  <View style={{ position: 'absolute', top: 65, left: 0, right: 0, backgroundColor: 'white', zIndex: 100, borderWidth: 1, borderColor: '#eee', borderRadius: 8 }}>
                    {filteredSuppliers.map(s => (
                      <TouchableOpacity key={s} onPress={() => { setFournisseur(s); setShowSupplierSuggestions(false)}} style={{ padding: 10 }}>
                        <Text>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={{ width: 130 }}>
                <Text style={typography.caption}>Date</Text>
                <DateInput value={dateAchat} onChange={setDateAchat} />
              </View>
            </View>

            {/* Product Name / Type */}
            <Text style={typography.caption}>Nom du Produit</Text>
            <TextInput style={globalStyles.input} value={nom} onChangeText={setNom} placeholder="Ex: Pesticide X" />

            <View style={{ flexDirection: 'row', gap: 10 }}>
               <View style={{ flex: 1 }}>
                 <Text style={typography.caption}>Catégorie</Text>
                 <View style={styles.pickerWrap}>
                   <Picker selectedValue={type} onValueChange={setType}>
                     {productTypes.map(t => <Picker.Item key={t} label={t} value={t} />)}
                   </Picker>
                 </View>
               </View>
               <View style={{ flex: 1 }}>
                 <Text style={typography.caption}>Matière Active</Text>
                 <TextInput style={globalStyles.input} value={matiereActive} onChangeText={setMatiereActive} placeholder="Optionnel" />
               </View>
            </View>
          </View>

          {/* 2. MODE SELECTION & QUANTITIES */}
          <View style={[globalStyles.cardLuxury, { padding: 16, marginBottom: 16 }]}>
            <View style={{ marginBottom: 16 }}>
              <Text style={[typography.h3, { color: colors.primary, marginBottom: 8 }]}>2. Mode de Saisie</Text>
              <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 4, borderRadius: 12 }}>
                <TouchableOpacity 
                  onPress={() => setMode('standard')}
                  style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: mode === 'standard' ? 'white' : 'transparent', borderRadius: 10, ... (mode === 'standard' ? shadows.sm : {}) }}
                >
                  <Text style={{ fontWeight: 'bold', color: mode === 'standard' ? colors.primary : '#64748b' }}>⚖️ Vrac (Kg/L)</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setMode('box')}
                  style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: mode === 'box' ? 'white' : 'transparent', borderRadius: 10, ... (mode === 'box' ? shadows.sm : {}) }}
                >
                  <Text style={{ fontWeight: 'bold', color: mode === 'box' ? colors.primary : '#64748b' }}>📦 Boîte / Bidon</Text>
                </TouchableOpacity>
              </View>
            </View>

            {mode === 'standard' ? (
              // STANDARD MODE
              <View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.caption}>Quantité Totale</Text>
                    <TextInput style={globalStyles.input} value={stdQty} onChangeText={setStdQty} keyboardType="numeric" placeholder="Ex: 10" />
                  </View>
                  <View style={{ width: 100 }}>
                    <Text style={typography.caption}>Unité</Text>
                    <View style={styles.pickerWrap}>
                      <Picker selectedValue={stdUnit} onValueChange={setStdUnit}>
                        <Picker.Item label="Kg" value="Kg" />
                        <Picker.Item label="L" value="L" />
                        <Picker.Item label="U" value="U" />
                      </Picker>
                    </View>
                  </View>
                </View>
                <Text style={typography.caption}>Prix Unitaire (par {stdUnit})</Text>
                <TextInput style={globalStyles.input} value={stdPrice} onChangeText={setStdPrice} keyboardType="numeric" placeholder="Ex: 200" />
              </View>
            ) : (
              // BOX MODE (FIXED LOGIC)
              <View style={{ backgroundColor: '#f0fdf4', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0' }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.caption}>Nombre de Boîtes</Text>
                    <TextInput style={[globalStyles.input, { backgroundColor: 'white' }]} value={boxCount} onChangeText={setBoxCount} keyboardType="numeric" placeholder="Ex: 5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.caption}>Prix par Boîte</Text>
                    <TextInput style={[globalStyles.input, { backgroundColor: 'white' }]} value={boxPrice} onChangeText={setBoxPrice} keyboardType="numeric" placeholder="Ex: 10" />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <View style={{ flex: 3 }}>
                    <Text style={typography.caption}>Contenance par Boîte</Text>
                    <TextInput style={[globalStyles.input, { backgroundColor: 'white' }]} value={boxCap} onChangeText={setBoxCap} keyboardType="numeric" placeholder="Ex: 0.1" />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={typography.caption}>Unité</Text>
                    <View style={[styles.pickerWrap, { backgroundColor: 'white' }]}>
                      <Picker selectedValue={boxRefUnit} onValueChange={setBoxRefUnit}>
                        <Picker.Item label="L" value="L" />
                        <Picker.Item label="Kg" value="Kg" />
                      </Picker>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* LIVE PREVIEW - THIS SHOWS THE USER EXACTLY WHAT WILL HAPPEN */}
            <View style={{ marginTop: 16, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: colors.gold }}>
               <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>Résumé de l'entrée en stock :</Text>
               
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                 <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>Stock ajouté :</Text>
                 <Text style={{ fontWeight: 'bold', fontSize: 16, color: colors.primary }}>
                   +{stockAdd.toFixed(2)} {stockUnitDisplay}
                 </Text>
               </View>
               
               {mode === 'box' && stockAdd > 0 && (
                 <Text style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
                   (Calcul: {boxCount} boîtes × {boxCap} {boxRefUnit} = {stockAdd} {boxRefUnit})
                 </Text>
               )}

               <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 }} />

               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                 <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>Total à payer :</Text>
                 <Text style={{ fontWeight: 'bold', fontSize: 18, color: colors.gold }}>
                   {formatCurrency(totalTTC)}
                 </Text>
               </View>
            </View>

            {/* VAT Selection */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, justifyContent: 'flex-end' }}>
               <Text style={[typography.caption, { marginRight: 8, marginBottom: 0 }]}>TVA:</Text>
               <View style={[styles.pickerWrap, { width: 90, height: 36, marginBottom: 0 }]}>
                 <Picker selectedValue={tva} onValueChange={setTva} style={{ height: 36 }}>
                   {[0,7,10,14,20].map(v => <Picker.Item key={v} label={`${v}%`} value={v} />)}
                 </Picker>
               </View>
            </View>

            <TouchableOpacity style={[globalStyles.button, { marginTop: 16 }]} onPress={addToCart}>
              <Text style={globalStyles.buttonText}>Ajouter au Panier</Text>
            </TouchableOpacity>
          </View>

          {/* 3. CART */}
          {cart.length > 0 && (
            <View style={[globalStyles.card, { padding: 16, marginBottom: 40 }]}>
              <Text style={[typography.h3, { marginBottom: 12 }]}>🛒 Panier ({cart.length})</Text>
              
              {cart.map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                   <View style={{ flex: 1 }}>
                     <Text style={{ fontWeight: 'bold' }}>{item.produit}</Text>
                     <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                       {item.quantite} {item.unite} 
                       {item.is_box_unit ? ` (soit ${item.stock_preview} ${item.stock_unit_preview} stock)` : ''}
                     </Text>
                   </View>
                   <View style={{ alignItems: 'flex-end' }}>
                     <Text style={{ fontWeight: 'bold', color: colors.primary }}>{formatCurrency(item.total_ttc)}</Text>
                     <TouchableOpacity onPress={() => { const n = [...cart]; n.splice(i,1); setCart(n) }}>
                        <Text style={{ fontSize: 11, color: colors.danger, marginTop: 4 }}>Retirer</Text>
                     </TouchableOpacity>
                   </View>
                </View>
              ))}
              
              <TouchableOpacity style={[globalStyles.button, { backgroundColor: colors.success, marginTop: 16 }]} onPress={validateCart} disabled={loading}>
                <Text style={globalStyles.buttonText}>{loading ? '...' : 'Valider Tout'}</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
        <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = {
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: '#fff',
    height: 50,
    justifyContent: 'center'
  }
}