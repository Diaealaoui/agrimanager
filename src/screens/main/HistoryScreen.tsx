import React, { useEffect, useState, useMemo } from 'react'
import { 
  View, Text, ScrollView, TextInput, TouchableOpacity, 
  ActivityIndicator, Alert, useWindowDimensions, StyleSheet,
  KeyboardAvoidingView, Platform, Keyboard
} from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import Sidebar from '../../components/layout/Sidebar'
import DateInput from '../../components/common/DateInput'
import { globalStyles, typography, colors, shadows } from '../../utils/styles'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { Feather } from '@expo/vector-icons'

export default function HistoryScreen() {
  const { user } = useAuth()
  const { width } = useWindowDimensions()
  const [loading, setLoading] = useState(true)
  const [treatments, setTreatments] = useState<any[]>([]) 
  const [allTreatments, setAllTreatments] = useState<any[]>([]) 
  
  const [parcelleSearch, setParcelleSearch] = useState('')
  const [nameSearch, setNameSearch] = useState('')
  const [typeSearch, setTypeSearch] = useState('')
  const [maSearch, setMaSearch] = useState('')

  const [allProducts, setAllProducts] = useState<any[]>([])
  const [allParcelles, setAllParcelles] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [activeSearchField, setActiveSearchField] = useState<'parcelle' | 'nom' | 'type' | 'ma' | null>(null)

  const currentYear = new Date().getFullYear()
  const [filters, setFilters] = useState({
    startDate: `${currentYear}-01-01`,
    endDate: new Date().toISOString().split('T')[0],
  })

  const [exporting, setExporting] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(false)

  // --- UPDATED COLUMNS CONFIGURATION (Added 'fournisseur') ---
  const col = { 
    date: 90, 
    parcelle: 110, 
    water: 80, 
    prod: 130, 
    supplier: 100, // <--- NEW COLUMN WIDTH
    qtyParcelle: 90, 
    dosageHa: 90,
    cout: 90, 
  }

  const normalize = (str: string) => {
    if (!str) return ''
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim()
  }

  useEffect(() => {
    if (user) loadInitialMeta()
  }, [user])

  useEffect(() => {
    if (user) loadTreatments()
  }, [filters.startDate, filters.endDate, user])

  useEffect(() => {
    applyLocalFilters()
  }, [parcelleSearch, nameSearch, typeSearch, maSearch, allTreatments])

  const loadInitialMeta = async () => {
    if (!user) return
    try {
      const [parcellesRes, produitsRes] = await Promise.all([
        Database.obtenirParcelles(user.id),
        Database.obtenirProduits(user.id),
      ])
      setAllParcelles(parcellesRes)
      setAllProducts(produitsRes)
    } catch (error) {
      console.error('Error loading metadata:', error)
    }
  }

  const loadTreatments = async () => {
    if (!user) return
    setLoading(true)
    try {
      // This now fetches 'fournisseur' thanks to the database.ts update
      const data = await Database.getTraitementsWithFilters(
        user.id, filters.startDate, filters.endDate,
        undefined, undefined, undefined, undefined
      )
      setAllTreatments(data)
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les traitements')
    } finally {
      setLoading(false)
    }
  }

  const applyLocalFilters = () => {
    let filtered = [...allTreatments]
    if (parcelleSearch) filtered = filtered.filter(t => normalize(t.parcelle).includes(normalize(parcelleSearch)))
    if (nameSearch) filtered = filtered.filter(t => normalize(t.produits?.nom || t.name).includes(normalize(nameSearch)))
    if (typeSearch) filtered = filtered.filter(t => normalize(t.produits?.type_produit || '').includes(normalize(typeSearch)))
    if (maSearch) filtered = filtered.filter(t => normalize(t.produits?.matiere_active || '').includes(normalize(maSearch)))
    setTreatments(filtered)
  }

  // --- GROUPING LOGIC ---
  const groupedTreatments = useMemo(() => {
    const groups: any = {};
    
    treatments.forEach(item => {
      const key = item.groupe_id || `${item.date_traitement}_${item.parcelle}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          date: item.date_traitement,
          parcelle: item.parcelle,
          water: item.quantite_eau || 0,
          totalCost: 0,
          items: []
        };
      }
      groups[key].items.push(item);
      groups[key].totalCost += (item.cout_estime || 0);
    });

    return Object.values(groups).sort((a: any, b: any) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [treatments]);

  const totalFilteredCost = useMemo(() => {
    return treatments.reduce((sum, t) => sum + (t.cout_estime || 0), 0)
  }, [treatments])

  const handleFuzzySearch = (text: string, field: 'parcelle' | 'nom' | 'type' | 'ma') => {
    const query = normalize(text)
    if (field === 'parcelle') setParcelleSearch(text)
    if (field === 'nom') setNameSearch(text)
    if (field === 'type') setTypeSearch(text)
    if (field === 'ma') setMaSearch(text)

    if (query.length > 0) {
      let filteredSuggestions: any[] = []
      if (field === 'parcelle') {
        filteredSuggestions = allParcelles.filter(p => normalize(p.nom).includes(query)).map(p => ({ value: p.nom }))
      } else if (field === 'nom') {
        filteredSuggestions = allProducts.filter(p => normalize(p.nom).includes(query)).map(p => ({ value: p.nom }))
      } else if (field === 'type') {
        const types = Array.from(new Set(allProducts.map(p => p.type_produit).filter(Boolean)))
        filteredSuggestions = types.filter(t => normalize(t).includes(query)).map(t => ({ value: t }))
      } else if (field === 'ma') {
        const mas = Array.from(new Set(allProducts.map(p => p.matiere_active).filter(Boolean)))
        filteredSuggestions = mas.filter(m => normalize(m).includes(query)).map(m => ({ value: m }))
      }
      setSuggestions(filteredSuggestions.slice(0, 5))
      setActiveSearchField(field)
    } else {
      setSuggestions([])
      setActiveSearchField(null)
    }
  }

  const selectSuggestion = (value: string, field: 'parcelle' | 'nom' | 'type' | 'ma') => {
    if (field === 'parcelle') setParcelleSearch(value)
    if (field === 'nom') setNameSearch(value)
    if (field === 'type') setTypeSearch(value)
    if (field === 'ma') setMaSearch(value)
    setSuggestions([])
    setActiveSearchField(null)
    Keyboard.dismiss()
  }

  const exportToCSV = async () => {
    if (treatments.length === 0) return
    setExporting(true)
    try {
      // Added Fournisseur to CSV export
      const headers = ['Date', 'Parcelle', 'Produit', 'Fournisseur', 'Quantité/Parcelle', 'Dosage/Ha', 'Eau (L)', 'Coût']
      const rows = treatments.map(t => {
        const pInfo = allParcelles.find(p => p.nom === t.parcelle)
        const surf = pInfo?.surface_ha || 0
        const doseHa = surf > 0 ? (t.quantite_utilisee / surf).toFixed(2) : '0.00'
        return [
          formatDate(t.date_traitement),
          t.parcelle,
          t.produits?.nom || t.name,
          t.produits?.fournisseur || 'Inconnu', // Export Supplier
          `${t.quantite_utilisee} ${t.produits?.unite_reference || ''}`,
          `${doseHa} ${t.produits?.unite_reference || ''}/ha`,
          t.quantite_eau || 0,
          (t.cout_estime || 0).toFixed(2)
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
      })
      const csvString = `\uFEFF${[headers.join(','), ...rows].join('\n')}`
      const fileUri = `${FileSystem.cacheDirectory}Rapport_Phyto.csv`
      await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: 'utf8' })
      await Sharing.shareAsync(fileUri)
    } catch (e) { Alert.alert('Erreur', 'Export échoué') } finally { setExporting(false) }
  }

  const TotalBar = () => (
    <View style={styles.totalBar}>
       <View style={{flexDirection: 'row', alignItems: 'center'}}>
         <Text style={{color: 'rgba(255,255,255,0.8)', marginRight: 5}}>Total Filtré:</Text>
         <Text style={{color: colors.gold, fontWeight: 'bold', fontSize: 16}}>
           {formatCurrency(totalFilteredCost)}
         </Text>
       </View>
    </View>
  )

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSidebarVisible(true)}><Feather name="menu" size={24} color="white" /></TouchableOpacity>
        <Text style={[typography.h1, { color: colors.gold, marginLeft: 15 }]}>Analyse Phyto</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: 15 }} keyboardShouldPersistTaps="handled">
        
        {/* Filters */}
        <View style={[globalStyles.card, { marginBottom: 15, zIndex: 100 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={typography.h3}>🔍 Filtres</Text>
            <TouchableOpacity onPress={() => { setParcelleSearch(''); setNameSearch(''); setTypeSearch(''); setMaSearch(''); }}><Text style={{ color: colors.danger }}>Effacer</Text></TouchableOpacity>
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ width: '48%' }}><Text style={typography.caption}>Du</Text><DateInput value={filters.startDate} onChange={(v) => setFilters({...filters, startDate: v})} /></View>
            <View style={{ width: '48%' }}><Text style={typography.caption}>Au</Text><DateInput value={filters.endDate} onChange={(v) => setFilters({...filters, endDate: v})} /></View>
          </View>

          <Text style={typography.caption}>Parcelle</Text>
          <View style={{ zIndex: 2000, marginBottom: 10 }}>
            <TextInput style={styles.input} placeholder="Nom parcelle..." value={parcelleSearch} onChangeText={(t) => handleFuzzySearch(t, 'parcelle')} />
            {activeSearchField === 'parcelle' && suggestions.length > 0 && (
              <View style={styles.suggestionBox}>
                {suggestions.map((s, i) => (
                  <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => selectSuggestion(s.value, 'parcelle')}><Text>{s.value}</Text></TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <Text style={typography.caption}>Produit</Text>
          <View style={{ zIndex: 1000, marginBottom: 10 }}>
            <TextInput style={styles.input} placeholder="Nom produit..." value={nameSearch} onChangeText={(t) => handleFuzzySearch(t, 'nom')} />
            {activeSearchField === 'nom' && suggestions.length > 0 && (
              <View style={styles.suggestionBox}>
                {suggestions.map((s, i) => (
                  <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => selectSuggestion(s.value, 'nom')}><Text>{s.value}</Text></TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ width: '48%', zIndex: 500 }}>
               <Text style={typography.caption}>Type</Text>
               <TextInput style={styles.input} placeholder="Fongicide..." value={typeSearch} onChangeText={(t) => handleFuzzySearch(t, 'type')} />
            </View>
            <View style={{ width: '48%', zIndex: 400 }}>
               <Text style={typography.caption}>Mat. Active</Text>
               <TextInput style={styles.input} placeholder="Cuivre..." value={maSearch} onChangeText={(t) => handleFuzzySearch(t, 'ma')} />
            </View>
          </View>
        </View>

        <TouchableOpacity style={[globalStyles.button, { backgroundColor: colors.success, marginBottom: 15 }]} onPress={exportToCSV}>
          <Text style={globalStyles.buttonText}>📥 Exporter</Text>
        </TouchableOpacity>

        {/* --- TOP TOTAL --- */}
        <TotalBar />

        {/* --- TABLE WITH HORIZONTAL SCROLL --- */}
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableCard}>
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.hCell, { width: col.date }]}>Date</Text>
              <Text style={[styles.hCell, { width: col.parcelle }]}>Parcelle</Text>
              <Text style={[styles.hCell, { width: col.water }]}>Eau</Text>
              <Text style={[styles.hCell, { width: col.prod }]}>Produit</Text>
              {/* NEW COLUMN HEADER */}
              <Text style={[styles.hCell, { width: col.supplier }]}>Fourn.</Text>
              <Text style={[styles.hCell, { width: col.qtyParcelle }]}>Qté/Parc.</Text>
              <Text style={[styles.hCell, { width: col.dosageHa }]}>Dose/Ha</Text>
              <Text style={[styles.hCell, { width: col.cout }]}>Coût</Text>
            </View>

            {loading ? <ActivityIndicator style={{ margin: 30 }} color={colors.gold} /> : (
              <View>
                {(groupedTreatments as any[]).map((group, gIndex) => {
                  const pInfo = allParcelles.find(p => p.nom === group.parcelle)
                  const surface = pInfo?.surface_ha || 0

                  return (
                    <View key={group.id}>
                      {group.items.map((item: any, i: number) => {
                        const doseHa = surface > 0 ? (item.quantite_utilisee / surface).toFixed(2) : '0.00'
                        const isFirst = i === 0

                        return (
                          <View key={i} style={[
                            styles.tableRow, 
                            { 
                              backgroundColor: gIndex % 2 === 0 ? '#fff' : '#f8f9fa',
                              borderBottomWidth: i === group.items.length - 1 ? 1 : 0,
                              borderBottomColor: '#cbd5e1'
                            }
                          ]}>
                            {/* MERGED CELLS */}
                            <Text style={[styles.cell, { width: col.date, color: isFirst ? colors.text : 'transparent', fontWeight: '600' }]}>
                              {isFirst ? formatDate(group.date) : ''}
                            </Text>
                            
                            <Text style={[styles.cell, { width: col.parcelle, color: isFirst ? colors.text : 'transparent', fontWeight: '600' }]}>
                              {isFirst ? group.parcelle : ''}
                            </Text>

                            <View style={{ width: col.water, justifyContent: 'center', alignItems: 'center' }}>
                              {isFirst && group.water > 0 ? (
                                <View>
                                  <Text style={[styles.cell, { width: col.water, color: colors.primary, fontWeight: 'bold' }]}>
                                    {group.water} L
                                  </Text>
                                  {surface > 0 && (
                                     <Text style={{ fontSize: 9, color: colors.textSecondary, textAlign: 'center' }}>
                                       {(group.water / surface).toFixed(0)} L/Ha
                                     </Text>
                                  )}
                                </View>
                              ) : null}
                            </View>

                            {/* PRODUCT DETAILS */}
                            <View style={{ width: col.prod, paddingHorizontal: 10 }}>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>
                                {item.produits?.nom || item.name}
                              </Text>
                            </View>

                            {/* NEW SUPPLIER COLUMN */}
                            <View style={{ width: col.supplier, paddingHorizontal: 5 }}>
                               <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center' }} numberOfLines={1}>
                                 {item.produits?.fournisseur || '-'}
                               </Text>
                            </View>

                            <Text style={[styles.cell, { width: col.qtyParcelle }]}>
                              {item.quantite_utilisee} {item.produits?.unite_reference || ''}
                            </Text>

                            <Text style={[styles.cell, { width: col.dosageHa, color: colors.success }]}>
                              {doseHa}/ha
                            </Text>

                            <Text style={[styles.cell, { width: col.cout, fontWeight: 'bold', color: colors.gold }]}>
                              {formatCurrency(item.cout_estime)}
                            </Text>
                          </View>
                        )
                      })}
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        </ScrollView>
        
        {/* --- BOTTOM TOTAL --- */}
        <View style={{ marginBottom: 50 }}>
          <TotalBar />
        </View>

      </ScrollView>
      <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primary, padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', borderBottomRightRadius: 25 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginTop: 5, backgroundColor: 'white' },
  suggestionBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 2, position: 'absolute', top: 55, left: 0, right: 0, zIndex: 5000, maxHeight: 200, ...shadows.md },
  suggestionItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tableCard: { backgroundColor: 'white', borderRadius: 12, ...shadows.sm, marginBottom: 15 },
  tableHeader: { flexDirection: 'row', backgroundColor: colors.primary, paddingVertical: 14 },
  tableRow: { flexDirection: 'row', paddingVertical: 12, alignItems: 'center' },
  hCell: { color: 'white', fontSize: 11, fontWeight: 'bold', paddingHorizontal: 5, textAlign: 'center' },
  cell: { fontSize: 12, color: colors.text, paddingHorizontal: 5, textAlign: 'center' },
  totalBar: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.sm
  }
})