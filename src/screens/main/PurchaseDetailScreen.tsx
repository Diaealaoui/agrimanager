import React, { useState, useEffect } from 'react'
import { 
  View, Text, ScrollView, TextInput, TouchableOpacity, Alert, 
  ActivityIndicator, useWindowDimensions, StyleSheet, KeyboardAvoidingView, 
  Platform, Keyboard, Modal 
} from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { useAuth } from '../../hooks/useAuth'
import { useRoute } from '@react-navigation/native'
import Database from '../../lib/database'
import Sidebar from '../../components/layout/Sidebar'
import DateInput from '../../components/common/DateInput'
import { globalStyles, typography, colors, shadows } from '../../utils/styles'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { Feather } from '@expo/vector-icons'

export default function PurchaseDetailScreen() {
  const { user } = useAuth()
  const route = useRoute<any>()
  const { width } = useWindowDimensions()
  const [loading, setLoading] = useState(true)
  const [achats, setAchats] = useState<any[]>([])
  const [allAchats, setAllAchats] = useState<any[]>([]) 

  // --- Search & Filter States ---
  const [supplierSearch, setSupplierSearch] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [typeSearch, setTypeSearch] = useState('')
  const [maSearch, setMaSearch] = useState('')
  
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [activeSearchField, setActiveSearchField] = useState<'supplier' | 'name' | 'type' | 'ma' | null>(null)

  const currentYear = new Date().getFullYear()
  const [filters, setFilters] = useState({
    startDate: `${currentYear}-01-01`,
    endDate: new Date().toISOString().split('T')[0],
    supplier: undefined as string | undefined,
    name: undefined as string | undefined,
    type: undefined as string | undefined,
    ma: undefined as string | undefined,
  })
  
  const [exporting, setExporting] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(false)

  // --- EDIT MODAL STATE ---
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    nom: '',
    fournisseur: '',
    quantite: '',
    prix: '',
    date: ''
  })

  const col = { date: 90, prod: 160, type: 100, ma: 120, fourn: 130, qte: 80, puht: 90, tva: 60, puttc: 90, total: 110 }

  useEffect(() => {
    if (route.params?.prefilledSupplier) {
      setSupplierSearch(route.params.prefilledSupplier)
      setFilters(prev => ({ ...prev, supplier: route.params.prefilledSupplier }))
    }
  }, [route.params])

  useEffect(() => {
    if (user) {
      loadAllData()
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadAchats()
    }
  }, [filters, user])

  const normalize = (str: string) => {
    if (!str) return ''
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim()
  }

  const loadAllData = async () => {
    if (!user) return
    try {
      const data = await Database.getAchatsWithFilters(user.id, filters.startDate, filters.endDate, undefined, undefined, undefined, undefined)
      setAllAchats(data)
    } catch (error) { console.error(error) }
  }

  const loadAchats = async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await Database.getAchatsWithFilters(user.id, filters.startDate, filters.endDate, undefined, undefined, undefined, undefined)
      
      let filtered = data
      if (filters.supplier) filtered = filtered.filter(a => normalize(a.fournisseur).includes(normalize(filters.supplier!)))
      if (filters.name) filtered = filtered.filter(a => normalize(a.produits?.nom || a.nom).includes(normalize(filters.name!)))
      if (filters.type) filtered = filtered.filter(a => normalize(a.produits?.type_produit || '').includes(normalize(filters.type!)))
      if (filters.ma) filtered = filtered.filter(a => normalize(a.produits?.matiere_active || '').includes(normalize(filters.ma!)))
      
      setAchats(filtered)
      setAllAchats(data)
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les achats')
    } finally {
      setLoading(false)
    }
  }

  // --- DELETE FUNCTION ---
  const handleDelete = (item: any) => {
    Alert.alert(
      "Supprimer l'achat ?",
      `Cela retirera ${item.quantite_recue} ${item.unite_achat} du stock actuel.`,
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive", 
          onPress: async () => {
            if (!user) return
            setLoading(true)
            // @ts-ignore
            const res = await Database.deleteAchatSmart(user.id, item.id)
            setLoading(false)
            if (res.success) {
              Alert.alert("Succès", "Achat supprimé et stock mis à jour.")
              loadAchats()
            } else {
              Alert.alert("Erreur", res.error)
            }
          }
        }
      ]
    )
  }

  // --- EDIT FUNCTIONS ---
  const handleEditPress = (item: any) => {
    setEditingItem(item)
    setEditForm({
      nom: item.produits?.nom || item.nom,
      fournisseur: item.fournisseur || '',
      quantite: item.quantite_recue?.toString() || '0',
      prix: item.prix_unitaire_ht?.toString() || '0',
      date: item.date_commande
    })
    setEditModalVisible(true)
  }

  const saveEdit = async () => {
    if (!user || !editingItem) return

    if (!editForm.nom.trim()) { Alert.alert("Erreur", "Le nom est obligatoire"); return; }
    if (isNaN(parseFloat(editForm.quantite)) || parseFloat(editForm.quantite) <= 0) { Alert.alert("Erreur", "Quantité invalide"); return; }

    setLoading(true)
    try {
      // @ts-ignore 
      const result = await Database.updateAchatSmart(user.id, editingItem.id, {
        nom: editForm.nom.trim(),
        fournisseur: editForm.fournisseur.trim(),
        quantite: editForm.quantite,
        prix_u_ht: editForm.prix,
        taux_tva: editingItem.taux_tva, 
        date: editForm.date,
        type_produit: editingItem.produits?.type_produit 
      })

      if (result.success) {
        Alert.alert("Succès", "Achat corrigé et stock mis à jour.")
        setEditModalVisible(false)
        loadAchats() 
      } else {
        Alert.alert("Erreur", result.error || "Impossible de modifier")
      }
    } catch (e) {
      Alert.alert("Erreur", "Une erreur est survenue")
    } finally {
      setLoading(false)
    }
  }

  // --- SEARCH FUNCTIONS ---
  const handleFuzzySearch = (text: string, field: 'supplier' | 'name' | 'type' | 'ma') => {
    const query = normalize(text)
    if (field === 'supplier') setSupplierSearch(text)
    if (field === 'name') setNameSearch(text)
    if (field === 'type') setTypeSearch(text)
    if (field === 'ma') setMaSearch(text)
    setFilters(prev => ({ ...prev, [field]: text || undefined }))

    if (query.length > 0) {
      let sourceData = allAchats.length > 0 ? allAchats : achats
      let filtered: string[] = []
      
      if (field === 'supplier') filtered = Array.from(new Set(sourceData.filter(a => normalize(a.fournisseur).includes(query)).map(a => a.fournisseur)))
      else if (field === 'name') filtered = Array.from(new Set(sourceData.filter(a => normalize(a.produits?.nom || a.nom).includes(query)).map(a => a.produits?.nom || a.nom)))
      else if (field === 'type') filtered = Array.from(new Set(sourceData.filter(a => a.produits?.type_produit && normalize(a.produits.type_produit).includes(query)).map(a => a.produits?.type_produit)))
      else if (field === 'ma') filtered = Array.from(new Set(sourceData.filter(a => a.produits?.matiere_active && normalize(a.produits.matiere_active).includes(query)).map(a => a.produits?.matiere_active)))
      
      setSuggestions(filtered.filter(Boolean).slice(0, 5))
      setActiveSearchField(field)
    } else {
      setSuggestions([])
      setActiveSearchField(null)
    }
  }

  const selectSuggestion = (value: string, field: 'supplier' | 'name' | 'type' | 'ma') => {
    if (field === 'supplier') setSupplierSearch(value)
    if (field === 'name') setNameSearch(value)
    if (field === 'type') setTypeSearch(value)
    if (field === 'ma') setMaSearch(value)
    setFilters(prev => ({ ...prev, [field]: value }))
    setSuggestions([])
    setActiveSearchField(null)
    Keyboard.dismiss()
  }

  const exportToCSV = async () => {
    if (achats.length === 0) return
    setExporting(true)
    try {
      const headers = ['Date', 'Produit', 'Type', 'Mat. Active', 'Fournisseur', 'Qté', 'Unité', 'Prix HT', 'TVA', 'Prix TTC', 'Total TTC']
      const rows = achats.map(a => {
        const p = a.produits || {}
        const tva = a.prix_unitaire_ht > 0 ? (((a.prix_unitaire_ttc - a.prix_unitaire_ht) / a.prix_unitaire_ht) * 100).toFixed(0) : '0'
        return [
          formatDate(a.date_commande),
          p.nom || a.nom,
          p.type_produit || '-',
          p.matiere_active || '-',
          a.fournisseur,
          a.quantite_recue,
          a.unite_achat,
          (a.prix_unitaire_ht || 0).toFixed(2),
          `${tva}%`,
          (a.prix_unitaire_ttc || 0).toFixed(2),
          (a.montant_ttc || 0).toFixed(2)
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      })
      const csvString = `\uFEFF${[headers.join(','), ...rows].join('\n')}`
      const fileUri = `${FileSystem.cacheDirectory}Rapport_Achats_${new Date().getTime()}.csv`
      await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: 'utf8' })
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' })
    } catch (e) { Alert.alert('Erreur', 'Échec de l\'export') } 
    finally { setExporting(false) }
  }

  const totalFilteredAmount = achats.reduce((sum, item) => sum + (item.montant_ttc || 0), 0)

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSidebarVisible(true)}>
          <Feather name="menu" size={24} color="white" />
        </TouchableOpacity>
        <Text style={[typography.h1, { color: colors.gold, marginLeft: 15 }]}>Registre Détaillé</Text>
      </View>
      
      <ScrollView 
        style={{ flex: 1, padding: 15 }} 
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View style={[globalStyles.card, { marginBottom: 15, zIndex: 100 }]}>
          <Text style={[typography.h3, { marginBottom: 10 }]}>🔍 Filtres Avancés</Text>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ width: '48%' }}><Text style={typography.caption}>Du</Text><DateInput value={filters.startDate} onChange={(v) => setFilters({...filters, startDate: v})} /></View>
            <View style={{ width: '48%' }}><Text style={typography.caption}>Au</Text><DateInput value={filters.endDate} onChange={(v) => setFilters({...filters, endDate: v})} /></View>
          </View>

          {/* Supplier Search with Suggestions */}
          <Text style={typography.caption}>Fournisseur</Text>
          <View style={{ zIndex: 2000, marginBottom: 10 }}>
            <TextInput 
              style={styles.input} 
              placeholder="Nom du fournisseur..." 
              value={supplierSearch} 
              onChangeText={(t) => handleFuzzySearch(t, 'supplier')}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {activeSearchField === 'supplier' && suggestions.length > 0 && (
              <View style={styles.suggestionBox}>
                {suggestions.map((s, idx) => (
                  <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => selectSuggestion(s, 'supplier')}>
                    <Text>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Product Search with Suggestions */}
          <Text style={typography.caption}>Produit (Nom)</Text>
          <View style={{ zIndex: 1000, marginBottom: 10 }}>
            <TextInput 
              style={styles.input} 
              placeholder="Nom du produit..." 
              value={nameSearch} 
              onChangeText={(t) => handleFuzzySearch(t, 'name')}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {activeSearchField === 'name' && suggestions.length > 0 && (
              <View style={styles.suggestionBox}>
                {suggestions.map((s, idx) => (
                  <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => selectSuggestion(s, 'name')}>
                    <Text>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Type and MA Search with Suggestions */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ width: '48%', zIndex: 500 }}>
              <Text style={typography.caption}>Type</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Fongicide..." 
                value={typeSearch} 
                onChangeText={(t) => handleFuzzySearch(t, 'type')}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {activeSearchField === 'type' && suggestions.length > 0 && (
                <View style={styles.suggestionBox}>
                  {suggestions.map((s, idx) => (
                    <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => selectSuggestion(s, 'type')}>
                      <Text>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={{ width: '48%', zIndex: 400 }}>
              <Text style={typography.caption}>Mat. Active</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Soufre..." 
                value={maSearch} 
                onChangeText={(t) => handleFuzzySearch(t, 'ma')}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {activeSearchField === 'ma' && suggestions.length > 0 && (
                <View style={styles.suggestionBox}>
                  {suggestions.map((s, idx) => (
                    <TouchableOpacity key={idx} style={styles.suggestionItem} onPress={() => selectSuggestion(s, 'ma')}>
                      <Text>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity style={[globalStyles.button, { backgroundColor: colors.success, marginBottom: 15 }]} onPress={exportToCSV} disabled={exporting}>
          {exporting ? <ActivityIndicator color="white" /> : <Text style={globalStyles.buttonText}>📥 Exporter Excel (CSV)</Text>}
        </TouchableOpacity>

        {/* Summary Bar */}
        <View style={styles.summaryBar}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>{achats.length} Résultat(s)</Text>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Total: {formatCurrency(totalFilteredAmount)}</Text>
        </View>

        {/* DATA TABLE */}
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableCard}>
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.hCell, { width: col.date }]}>Date</Text>
              <Text style={[styles.hCell, { width: col.prod }]}>Produit</Text>
              <Text style={[styles.hCell, { width: col.type }]}>Type</Text>
              <Text style={[styles.hCell, { width: col.ma }]}>M. Active</Text>
              <Text style={[styles.hCell, { width: col.fourn }]}>Fournisseur</Text>
              <Text style={[styles.hCell, { width: col.qte }]}>Qté</Text>
              <Text style={[styles.hCell, { width: col.puht }]}>P.U. HT</Text>
              <Text style={[styles.hCell, { width: col.tva }]}>TVA</Text>
              <Text style={[styles.hCell, { width: col.puttc }]}>P.U. TTC</Text>
              <Text style={[styles.hCell, { width: col.total }]}>Total TTC</Text>
            </View>

            {loading ? <ActivityIndicator style={{ margin: 30 }} color={colors.gold} /> : (
              <>
                {achats.map((a, i) => {
                  const tvaP = a.prix_unitaire_ht > 0 ? Math.round(((a.prix_unitaire_ttc - a.prix_unitaire_ht) / a.prix_unitaire_ht) * 100) : 0
                  return (
                    <View key={i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? '#fff' : '#f8f9fa' }]}>
                      <Text style={[styles.cell, { width: col.date }]}>{formatDate(a.date_commande)}</Text>
                      
                      {/* EDIT & DELETE BUTTONS */}
                      <View style={{ width: col.prod, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
                        <TouchableOpacity onPress={() => handleEditPress(a)} style={{marginRight: 8}}>
                          <Feather name="edit-2" size={16} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(a)} style={{marginRight: 8}}>
                          <Feather name="trash-2" size={16} color={colors.danger} />
                        </TouchableOpacity>
                        <Text style={[styles.cell, { paddingHorizontal: 0, fontWeight: 'bold', color: colors.text, flex: 1 }]} numberOfLines={1}>
                          {a.produits?.nom || a.nom}
                        </Text>
                      </View>

                      <Text style={[styles.cell, { width: col.type }]}>{a.produits?.type_produit || '-'}</Text>
                      <Text style={[styles.cell, { width: col.ma, fontStyle: 'italic' }]}>{a.produits?.matiere_active || '-'}</Text>
                      <Text style={[styles.cell, { width: col.fourn }]}>{a.fournisseur}</Text>
                      <Text style={[styles.cell, { width: col.qte }]}>{a.quantite_recue} {a.unite_achat}</Text>
                      <Text style={[styles.cell, { width: col.puht }]}>{a.prix_unitaire_ht?.toFixed(2)}</Text>
                      <Text style={[styles.cell, { width: col.tva }]}>{tvaP}%</Text>
                      <Text style={[styles.cell, { width: col.puttc }]}>{a.prix_unitaire_ttc?.toFixed(2)}</Text>
                      <Text style={[styles.cell, { width: col.total, fontWeight: 'bold', color: colors.gold }]}>{formatCurrency(a.montant_ttc)}</Text>
                    </View>
                  )
                })}

                {/* --- TOTAL ROW AT BOTTOM --- */}
                {achats.length > 0 && (
                  <View style={[styles.tableRow, { backgroundColor: colors.primary + '10', borderTopWidth: 2, borderTopColor: colors.primary }]}>
                    <View style={{ width: col.date + col.prod + col.type + col.ma + col.fourn + col.qte + col.puht + col.tva + col.puttc, alignItems: 'flex-end', paddingRight: 15, justifyContent: 'center' }}>
                      <Text style={{ fontWeight: 'bold', color: colors.primary }}>TOTAL FILTRÉ :</Text>
                    </View>
                    <Text style={[styles.cell, { width: col.total, fontWeight: 'bold', color: colors.gold, fontSize: 13 }]}>
                      {formatCurrency(totalFilteredAmount)}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
        <View style={{height: 50}} />
      </ScrollView>

      {/* --- EDIT MODAL --- */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, ...shadows.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
               <Text style={typography.h2}>Corriger l'achat</Text>
               <TouchableOpacity onPress={() => setEditModalVisible(false)}><Feather name="x" size={24} color="#999"/></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: colors.info, marginBottom: 15, fontStyle: 'italic' }}>
              ⚠️ Modifier le nom déplacera le stock vers le bon produit. Modifier la quantité recalculera le stock actuel.
            </Text>

            <ScrollView>
              <Text style={typography.caption}>Date</Text>
              <DateInput value={editForm.date} onChange={d => setEditForm({...editForm, date: d})} />

              <Text style={typography.caption}>Nom Produit (Correction orthographe)</Text>
              <TextInput style={globalStyles.input} value={editForm.nom} onChangeText={t => setEditForm({...editForm, nom: t})} />

              <Text style={typography.caption}>Fournisseur</Text>
              <TextInput style={globalStyles.input} value={editForm.fournisseur} onChangeText={t => setEditForm({...editForm, fournisseur: t})} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.caption}>Quantité</Text>
                  <TextInput style={globalStyles.input} value={editForm.quantite} onChangeText={t => setEditForm({...editForm, quantite: t})} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.caption}>Prix Unitaire HT</Text>
                  <TextInput style={globalStyles.input} value={editForm.prix} onChangeText={t => setEditForm({...editForm, prix: t})} keyboardType="numeric" />
                </View>
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15, gap: 10 }}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={[globalStyles.button, { backgroundColor: '#eee', width: 100 }]}>
                <Text style={{ color: '#333' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit} style={[globalStyles.button, { width: 140 }]}>
                <Text style={globalStyles.buttonText}>Sauvegarder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primary, padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', borderBottomRightRadius: 25 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginTop: 5, backgroundColor: 'white' },
  suggestionBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 2, position: 'absolute', top: 55, left: 0, right: 0, zIndex: 5000, maxHeight: 200, ...shadows.md },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: 'white' },
  tableCard: { backgroundColor: 'white', borderRadius: 12, ...shadows.sm, marginBottom: 50 },
  tableHeader: { flexDirection: 'row', backgroundColor: colors.primary, paddingVertical: 14 },
  tableRow: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  hCell: { color: 'white', fontSize: 11, fontWeight: 'bold', paddingHorizontal: 10 },
  cell: { fontSize: 12, color: colors.text, paddingHorizontal: 10 },
  summaryBar: { backgroundColor: colors.primary, padding: 12, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...shadows.sm }
})