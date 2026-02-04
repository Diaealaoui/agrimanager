import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import Header from '../../components/layout/Header'
import { globalStyles, typography, colors } from '../../utils/styles'
import { formatCurrency, formatDate } from '../../utils/helpers'

export default function TreatmentsScreen() {
  const { user } = useAuth()
  const [parcelles, setParcelles] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedParcelle, setSelectedParcelle] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [productSuggestions, setProductSuggestions] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [dose, setDose] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [treatmentBuffer, setTreatmentBuffer] = useState<any[]>([])
  const [treatmentHistory, setTreatmentHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [tableScale, setTableScale] = useState(0.85)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return
    
    setLoading(true)
    const [parcellesRes, productsRes, treatmentsRes] = await Promise.all([
      Database.obtenirParcelles(user.id),
      Database.obtenirProduits(user.id),
      Database.getTraitementsWithFilters(user.id),
    ])
    
    setParcelles(parcellesRes)
    setProducts(productsRes)

    const parcelleSurfaceMap = parcellesRes.reduce((acc: Record<string, number>, parcelle: any) => {
      acc[parcelle.nom] = parcelle.surface_ha || 0
      return acc
    }, {})

    const historyWithCosts = (treatmentsRes || []).map((t: any) => {
      const surface = parcelleSurfaceMap[t.parcelle] || 0
      const cout = t.cout_estime || 0
      const coutParHa = surface > 0 ? cout / surface : 0
      return { ...t, surface_ha: surface, cout_par_ha: coutParHa }
    })
    setTreatmentHistory(historyWithCosts)
    setLoading(false)
  }

  const handleProductSearch = (text: string) => {
    setProductQuery(text)
    setSelectedProductId(null)

    const query = text.trim().toLowerCase()
    if (query.length < 1) {
      setProductSuggestions([])
      return
    }

    const matches = products.filter(p => {
      const nameMatch = (p.nom || '').toLowerCase().includes(query)
      const typeMatch = (p.type_produit || '').toLowerCase().includes(query)
      return nameMatch || typeMatch
    })
    setProductSuggestions(matches.slice(0, 6))
  }

  const selectProductSuggestion = (product: any) => {
    setSelectedProductId(product.id)
    setProductQuery(product.nom)
    setProductSuggestions([])
  }

  const addToBuffer = () => {
    const resolvedProduct = selectedProductId
      ? products.find(p => p.id === selectedProductId)
      : products.find(p => (p.nom || '').toLowerCase() === productQuery.trim().toLowerCase())

    if (!selectedParcelle || !resolvedProduct || !dose || parseFloat(dose) <= 0) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs correctement')
      return
    }

    const cost = parseFloat(dose) * (resolvedProduct?.prix_moyen || 0)
    
    setTreatmentBuffer([...treatmentBuffer, {
      parcelle: selectedParcelle,
      produit: resolvedProduct.nom,
      produit_id: resolvedProduct.id,
      dose: parseFloat(dose),
      unit: resolvedProduct?.unite_reference || '',
      date,
      cost,
    }])
    
    // Reset form
    setSelectedParcelle('')
    setSelectedProductId(null)
    setProductQuery('')
    setProductSuggestions([])
    setDose('')
  }

  const removeFromBuffer = (index: number) => {
    setTreatmentBuffer(treatmentBuffer.filter((_, i) => i !== index))
  }

  const saveTreatments = async () => {
    if (!user || treatmentBuffer.length === 0) return
    
    const batch = treatmentBuffer.map(t => ({
      user_id: user.id,
      produit_id: t.produit_id,
      parcelle: t.parcelle,
      quantite_utilisee: t.dose,
      date_traitement: t.date,
    }))
    
    const result = await Database.enregistrerTraitementBatch(batch)
    
    if (result.success) {
      Alert.alert('Succès', `${result.count} traitement(s) enregistré(s)`)
      setTreatmentBuffer([])
      await loadData()
    } else {
      Alert.alert('Erreur', result.error || 'Erreur lors de l\'enregistrement')
    }
  }

  const totalBufferCost = treatmentBuffer.reduce((sum, t) => sum + t.cost, 0)
  const headerPadding = Math.max(8, 12 * tableScale)
  const cellPadding = Math.max(8, 12 * tableScale)
  const headerFontSize = Math.max(10, 12 * tableScale)
  const cellFontSize = Math.max(10, 12 * tableScale)
  const scaled = (value: number) => Math.round(value * tableScale)
  const zoomOutDisabled = tableScale <= 0.7
  const zoomInDisabled = tableScale >= 1.2

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Traitements" />
      
      <ScrollView style={{ flex: 1, padding: 16 }}>
        {/* Add Treatment Form */}
        <View style={[globalStyles.card, { marginBottom: 16 }]}>
          <Text style={[typography.h2, { marginBottom: 16 }]}>➕ Ajouter un Traitement</Text>
          
          <Text style={[typography.caption, { marginBottom: 4 }]}>Parcelle</Text>
          <Picker
            selectedValue={selectedParcelle}
            onValueChange={setSelectedParcelle}
            style={{ backgroundColor: colors.card, marginBottom: 12 }}
          >
            <Picker.Item label="Sélectionner une parcelle" value="" />
            {parcelles.map(p => (
              <Picker.Item key={p.id} label={p.nom} value={p.nom} />
            ))}
          </Picker>
          
          <Text style={[typography.caption, { marginBottom: 4 }]}>Produit</Text>
          <TextInput
            style={globalStyles.input}
            placeholder="Tapez un produit ou un type..."
            value={productQuery}
            onChangeText={handleProductSearch}
          />
          {productSuggestions.length > 0 && (
            <View style={styles.dropdown}>
              {productSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.suggestionItem}
                  onPress={() => selectProductSuggestion(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionTitle}>{item.nom}</Text>
                    <Text style={styles.suggestionSubtitle}>
                      {item.type_produit || 'Type non défini'} • {item.unite_reference || 'Unité'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          <Text style={[typography.caption, { marginBottom: 4 }]}>Dose</Text>
          <TextInput
            style={globalStyles.input}
            placeholder="Quantité utilisée"
            value={dose}
            onChangeText={setDose}
            keyboardType="numeric"
          />
          
          <Text style={[typography.caption, { marginBottom: 4, marginTop: 12 }]}>Date</Text>
          <TextInput
            style={globalStyles.input}
            value={date}
            onChangeText={setDate}
            placeholder="AAAA-MM-JJ"
          />
          
          <TouchableOpacity
            style={[globalStyles.button, { marginTop: 16 }]}
            onPress={addToBuffer}
          >
            <Text style={globalStyles.buttonText}>Ajouter au Buffer</Text>
          </TouchableOpacity>
        </View>
        
        {/* Treatment Buffer */}
        {treatmentBuffer.length > 0 && (
          <View style={[globalStyles.card, { marginBottom: 16 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={typography.h2}>📋 Buffer ({treatmentBuffer.length})</Text>
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
                
                <TouchableOpacity onPress={() => removeFromBuffer(index)}>
                  <Text style={{ color: colors.danger, fontSize: 20 }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            
            <TouchableOpacity
              style={[globalStyles.button, { marginTop: 16, backgroundColor: colors.success }]}
              onPress={saveTreatments}
            >
              <Text style={globalStyles.buttonText}>🚀 Valider Tout ({treatmentBuffer.length})</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[globalStyles.card, { marginBottom: 16 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={typography.h2}>🧾 Historique des Traitements</Text>
            <View style={styles.zoomControls}>
              <TouchableOpacity
                onPress={() => setTableScale(prev => Math.max(0.7, Number((prev - 0.1).toFixed(2))))}
                disabled={zoomOutDisabled}
                style={[styles.zoomButton, zoomOutDisabled && styles.zoomButtonDisabled]}
              >
                <Text style={styles.zoomButtonText}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTableScale(prev => Math.min(1.2, Number((prev + 0.1).toFixed(2))))}
                disabled={zoomInDisabled}
                style={[styles.zoomButton, zoomInDisabled && styles.zoomButtonDisabled]}
              >
                <Text style={styles.zoomButtonText}>＋</Text>
              </TouchableOpacity>
            </View>
          </View>

          {treatmentHistory.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={[styles.tableHeaderRow]}>
                  <Text style={[styles.tableHeader, { width: scaled(100), padding: headerPadding, fontSize: headerFontSize }]}>Date</Text>
                  <Text style={[styles.tableHeader, { width: scaled(130), padding: headerPadding, fontSize: headerFontSize }]}>Parcelle</Text>
                  <Text style={[styles.tableHeader, { width: scaled(160), padding: headerPadding, fontSize: headerFontSize }]}>Produit</Text>
                  <Text style={[styles.tableHeader, { width: scaled(80), padding: headerPadding, fontSize: headerFontSize }]}>Dose</Text>
                  <Text style={[styles.tableHeader, { width: scaled(70), padding: headerPadding, fontSize: headerFontSize }]}>Unité</Text>
                  <Text style={[styles.tableHeader, { width: scaled(100), padding: headerPadding, fontSize: headerFontSize }]}>Coût</Text>
                  <Text style={[styles.tableHeader, { width: scaled(100), padding: headerPadding, fontSize: headerFontSize }]}>Coût/ha</Text>
                </View>

                {treatmentHistory.map((t, index) => {
                  const productName = t.produits?.nom || t.produit || '-'
                  const unit = t.produits?.unite_reference || '-'
                  const cout = t.cout_estime || 0
                  const coutParHa = t.cout_par_ha || 0
                  return (
                    <View
                      key={t.id || `${t.parcelle}-${t.date_traitement}-${index}`}
                      style={{
                        flexDirection: 'row',
                        borderBottomWidth: 1,
                        borderBottomColor: colors.borderLight,
                        backgroundColor: index % 2 === 0 ? 'white' : colors.backgroundAlt
                      }}
                    >
                      <Text style={[styles.tableCell, { width: scaled(100), padding: cellPadding, fontSize: cellFontSize }]}>
                        {formatDate(t.date_traitement)}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(130), padding: cellPadding, fontSize: cellFontSize }]}>
                        {t.parcelle}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(160), padding: cellPadding, fontSize: cellFontSize }]}>
                        {productName}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(80), padding: cellPadding, fontSize: cellFontSize, textAlign: 'right' }]}>
                        {Number(t.quantite_utilisee || 0).toFixed(2)}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(70), padding: cellPadding, fontSize: cellFontSize }]}>
                        {unit}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(100), padding: cellPadding, fontSize: cellFontSize, textAlign: 'right' }]}>
                        {formatCurrency(cout)}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(100), padding: cellPadding, fontSize: cellFontSize, textAlign: 'right' }]}>
                        {coutParHa > 0 ? formatCurrency(coutParHa) : '-'}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </ScrollView>
          ) : (
            <View style={{ alignItems: 'center', padding: 24 }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🧪</Text>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                Aucun traitement enregistré pour le moment.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  dropdown: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  suggestionSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomButton: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  zoomButtonDisabled: {
    opacity: 0.5,
  },
  zoomButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  tableHeader: {
    fontWeight: '700',
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    borderRightWidth: 1,
    borderRightColor: 'rgba(212, 175, 55, 0.3)',
  },
  tableCell: {
    color: colors.text,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
  },
})