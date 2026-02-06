import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import Sidebar from '../../components/layout/Sidebar'
import DateInput from '../../components/common/DateInput'
import { globalStyles, typography, colors, shadows } from '../../utils/styles'
import { formatCurrency, formatDate } from '../../utils/helpers'

type HistoryScreenProps = {
  route?: { params?: { parcelle?: string; produit?: string } }
}

export default function HistoryScreen({ route }: HistoryScreenProps) {
  const { user } = useAuth()
  const { width } = useWindowDimensions()
  const [loading, setLoading] = useState(true)
  const [treatments, setTreatments] = useState<any[]>([])
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    parcelle: 'Tous',
    produit: 'Tous',
    typeProduit: '',
  })
  const [parcelles, setParcelles] = useState<string[]>([])
  const [produits, setProduits] = useState<string[]>([])
  const [productTypes, setProductTypes] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [showTypeSuggestions, setShowTypeSuggestions] = useState(false)

  const tableBaseWidth = 930
  const minScale = Math.min(1, width / tableBaseWidth)
  const maxScale = 1.4
  const [tableScale, setTableScale] = useState(minScale)

  useEffect(() => {
    setTableScale(minScale)
  }, [minScale])

  const typeQuery = filters.typeProduit.trim().toLowerCase()
  const filteredTypeSuggestions = typeQuery.length === 0
    ? productTypes.slice(0, 6)
    : productTypes
      .filter(type => type.toLowerCase().includes(typeQuery))
      .slice(0, 6)

  useEffect(() => {
    if (!user) return
    loadFiltersData()
  }, [user])

  useEffect(() => {
    const prefilledParcelle = route?.params?.parcelle
    const prefilledProduit = route?.params?.produit
    if (prefilledParcelle || prefilledProduit) {
      setFilters(prev => ({
        ...prev,
        parcelle: prefilledParcelle ?? prev.parcelle,
        produit: prefilledProduit ?? prev.produit,
      }))
    }
  }, [route?.params?.parcelle, route?.params?.produit])

  useEffect(() => {
    if (!user) return
    loadTreatments()
  }, [filters, user])

  const loadFiltersData = async () => {
    if (!user) return
    try {
      const [parcellesRes, produitsRes, typeRes] = await Promise.all([
        Database.obtenirParcelles(user.id),
        Database.obtenirProduits(user.id),
        Database.getProductTypes(user.id),
      ])
      const parcelleNames = parcellesRes.map(p => p.nom).filter(Boolean)
      const produitNames = produitsRes.map(p => p.nom).filter(Boolean)
      setParcelles(['Tous', ...parcelleNames])
      setProduits(['Tous', ...produitNames])
      setProductTypes(typeRes)
    } catch (error) {
      console.error('Error loading filters:', error)
    }
  }

  const loadTreatments = async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await Database.getTraitementsWithFilters(
        user.id,
        filters.startDate || undefined,
        filters.endDate || undefined,
        filters.parcelle !== 'Tous' ? filters.parcelle : undefined,
        filters.produit !== 'Tous' ? filters.produit : undefined,
        filters.typeProduit || undefined
      )
      setTreatments(data)
    } catch (error) {
      console.error('Error loading treatments:', error)
    } finally {
      setLoading(false)
    }
  }

  const ensureShareAvailable = async () => {
    const available = await Sharing.isAvailableAsync()
    if (!available) {
      Alert.alert('Erreur', 'Le partage de fichiers n\'est pas disponible sur cet appareil')
      return false
    }
    return true
  }

  const getExportFileUri = (fileName: string) => {
    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory
    if (!baseDir) {
      throw new Error('No file directory available')
    }
    return `${baseDir}${fileName}`
  }

  const toCsvValue = (value: string | number | null | undefined) => {
    const safe = value === null || value === undefined ? '' : String(value)
    return `"${safe.replace(/"/g, '""')}"`
  }

  const exportToCSV = async () => {
    if (treatments.length === 0) {
      Alert.alert('Aucune donnee', 'Il n\'y a pas de traitements a exporter')
      return
    }

    setExporting(true)
    try {
      const canShare = await ensureShareAvailable()
      if (!canShare) return

      const headers = [
        'Date',
        'Parcelle',
        'Produit',
        'Matiere Active',
        'Quantite',
        'Unite',
        'Cout Estime',
        'Cout par hectare'
      ]

      const csvRows = [
        headers.join(','),
        ...treatments.map(t => {
          const prod = t.produits || {}
          const costPerHaValue = t.cout_par_hectare !== undefined && t.cout_par_hectare !== null
            ? Number(t.cout_par_hectare)
            : null
          return [
            toCsvValue(formatDate(t.date_traitement || '')),
            toCsvValue(t.parcelle || ''),
            toCsvValue(prod.nom || ''),
            toCsvValue(prod.matiere_active || ''),
            toCsvValue(t.quantite_utilisee || 0),
            toCsvValue(prod.unite_reference || ''),
            toCsvValue((t.cout_estime || 0).toFixed(2)),
            toCsvValue(costPerHaValue !== null && Number.isFinite(costPerHaValue) ? costPerHaValue.toFixed(2) : '')
          ].join(',')
        })
      ]

      const csvContent = `\uFEFF${csvRows.join('\n')}`
      const fileName = `Traitements_${new Date().toISOString().split('T')[0]}.csv`
      const fileUri = getExportFileUri(fileName)

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      })

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Telecharger l\'historique des traitements',
        UTI: 'public.comma-separated-values-text',
      })

      Alert.alert('Succes', 'Fichier CSV exporte avec succes')
    } catch (error) {
      console.error('Error exporting CSV:', error)
      Alert.alert('Erreur', 'Impossible d\'exporter les donnees')
    } finally {
      setExporting(false)
    }
  }

  const exportToExcel = async () => {
    if (treatments.length === 0) {
      Alert.alert('Aucune donnee', 'Il n\'y a pas de traitements a exporter')
      return
    }

    setExporting(true)
    try {
      const canShare = await ensureShareAvailable()
      if (!canShare) return

      const headers = [
        'Date',
        'Parcelle',
        'Produit',
        'Matiere Active',
        'Quantite',
        'Unite',
        'Cout Estime',
        'Cout par hectare'
      ]

      let htmlTable = `
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
            th { background-color: #1a1a2e; color: #d4af37; padding: 12px; text-align: left; font-weight: bold; border: 1px solid #ddd; }
            td { padding: 10px; border: 1px solid #ddd; }
            tr:nth-child(even) { background-color: #f8f9fa; }
            .total-row { background-color: #f4e5c2; font-weight: bold; }
            .header-title { color: #1a1a2e; font-size: 24px; margin-bottom: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header-title">Historique des Traitements - ${new Date().toLocaleDateString('fr-FR')}</div>
          <table>
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
      `

      let totalCost = 0
      treatments.forEach(t => {
        const prod = t.produits || {}
        const costPerHaValue = t.cout_par_hectare !== undefined && t.cout_par_hectare !== null
          ? Number(t.cout_par_hectare)
          : null
        totalCost += t.cout_estime || 0
        htmlTable += `
          <tr>
            <td>${formatDate(t.date_traitement || '')}</td>
            <td>${t.parcelle || ''}</td>
            <td>${prod.nom || ''}</td>
            <td>${prod.matiere_active || ''}</td>
            <td>${t.quantite_utilisee || 0}</td>
            <td>${prod.unite_reference || ''}</td>
            <td>${formatCurrency(t.cout_estime || 0)}</td>
            <td>${costPerHaValue !== null && Number.isFinite(costPerHaValue) ? formatCurrency(costPerHaValue) : '-'}</td>
          </tr>
        `
      })

      htmlTable += `
              <tr class="total-row">
                <td colspan="6" style="text-align: right; padding-right: 20px;">TOTAL</td>
                <td>${formatCurrency(totalCost)}</td>
                <td>-</td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top: 30px; color: #64748b; font-size: 12px;">
            Document genere le ${new Date().toLocaleString('fr-FR')} par AgriManager Pro
          </div>
        </body>
        </html>
      `

      const fileName = `Traitements_${new Date().toISOString().split('T')[0]}.xls`
      const fileUri = getExportFileUri(fileName)

      await FileSystem.writeAsStringAsync(fileUri, htmlTable, {
        encoding: FileSystem.EncodingType.UTF8,
      })

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.ms-excel',
        dialogTitle: 'Telecharger l\'historique des traitements',
        UTI: 'com.microsoft.excel.xls',
      })

      Alert.alert('Succes', 'Fichier Excel exporte avec succes')
    } catch (error) {
      console.error('Error exporting Excel:', error)
      Alert.alert('Erreur', 'Impossible d\'exporter les donnees')
    } finally {
      setExporting(false)
    }
  }

  const totalCost = treatments.reduce((sum, t) => sum + (t.cout_estime || 0), 0)

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{
        backgroundColor: colors.primary,
        padding: 24,
        paddingTop: 60,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        ...shadows.xl,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setSidebarVisible(true)}
            style={{ marginRight: 12 }}
          >
            <Text style={{ color: 'white', fontSize: 24 }}>☰</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h1, { color: colors.gold, marginBottom: 4 }]}>
              Historique des Traitements
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
              Suivi detaille par parcelle et produit
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }} keyboardShouldPersistTaps="handled">
        {/* Filters Card */}
        <View style={[globalStyles.cardLuxury, { marginBottom: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 24, marginRight: 8 }}>🔍</Text>
            <Text style={[typography.h3, { color: colors.primary }]}>Filtres</Text>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                Date Debut
              </Text>
              <DateInput
                value={filters.startDate}
                onChange={(value) => setFilters({ ...filters, startDate: value })}
                placeholder="AAAA-MM-JJ"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                Date Fin
              </Text>
              <DateInput
                value={filters.endDate}
                onChange={(value) => setFilters({ ...filters, endDate: value })}
                placeholder="AAAA-MM-JJ"
              />
            </View>
          </View>

          <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
            Parcelle
          </Text>
          <View style={{
            backgroundColor: colors.backgroundAlt,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: colors.border,
            marginBottom: 16,
          }}>
            <Picker
              selectedValue={filters.parcelle}
              onValueChange={(value) => setFilters({ ...filters, parcelle: value })}
              style={{ color: colors.text }}
            >
              {parcelles.map(p => (
                <Picker.Item key={p} label={p} value={p} />
              ))}
            </Picker>
          </View>

          <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
            Produit
          </Text>
          <View style={{
            backgroundColor: colors.backgroundAlt,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: colors.border,
          }}>
            <Picker
              selectedValue={filters.produit}
              onValueChange={(value) => setFilters({ ...filters, produit: value })}
              style={{ color: colors.text }}
            >
              {produits.map(p => (
                <Picker.Item key={p} label={p} value={p} />
              ))}
            </Picker>
          </View>

          <Text style={[typography.caption, { marginBottom: 8, marginTop: 16, color: colors.text, fontWeight: '600' }]}>
            Type Produit
          </Text>
          <View style={{ position: 'relative', zIndex: 10 }}>
            <TextInput
              style={globalStyles.input}
              value={filters.typeProduit}
              onChangeText={(text) => setFilters({ ...filters, typeProduit: text })}
              onFocus={() => setShowTypeSuggestions(true)}
              onBlur={() => setTimeout(() => setShowTypeSuggestions(false), 120)}
              placeholder="Ex: Fongicide"
              placeholderTextColor={colors.textLight}
            />

            {showTypeSuggestions && filteredTypeSuggestions.length > 0 && (
              <View style={styles.suggestionList}>
                {filteredTypeSuggestions.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={styles.suggestionItem}
                    onPress={() => {
                      setFilters({ ...filters, typeProduit: type })
                      setShowTypeSuggestions(false)
                    }}
                  >
                    <Text style={styles.suggestionText}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Summary Card */}
        <View style={[globalStyles.metricCardGold, { marginBottom: 20, padding: 24 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <View>
              <Text style={[typography.caption, { color: colors.text, marginBottom: 4 }]}>
                Cout Total des Traitements
              </Text>
              <Text style={[typography.h2, { color: colors.primary, fontWeight: '700' }]}>
                {formatCurrency(totalCost)}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                {treatments.length} traitement{treatments.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={{ fontSize: 48 }}>💧</Text>
          </View>
        </View>

        {/* Export Buttons */}
        <View style={{ flexDirection: 'row', marginBottom: 20 }}>
          <TouchableOpacity
            style={[globalStyles.button, {
              flex: 1,
              marginRight: 8,
              backgroundColor: exporting ? colors.textLight : colors.success
            }]}
            onPress={exportToCSV}
            disabled={exporting || treatments.length === 0}
          >
            <Text style={globalStyles.buttonText}>
              {exporting ? 'Export...' : 'Export CSV'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[globalStyles.buttonGold, {
              flex: 1,
              marginLeft: 8,
              opacity: (exporting || treatments.length === 0) ? 0.5 : 1
            }]}
            onPress={exportToExcel}
            disabled={exporting || treatments.length === 0}
          >
            <Text style={globalStyles.buttonText}>
              {exporting ? 'Export...' : 'Export Excel'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Detailed Table */}
        {treatments.length > 0 ? (
          <View>
            <View style={styles.zoomControls}>
              <Text style={styles.zoomLabel}>Zoom</Text>
              <TouchableOpacity
                onPress={() => setTableScale(prev => Math.max(minScale, prev - 0.1))}
                style={styles.zoomButton}
              >
                <Text style={styles.zoomButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.zoomValue}>{Math.round(tableScale * 100)}%</Text>
              <TouchableOpacity
                onPress={() => setTableScale(prev => Math.min(maxScale, prev + 0.1))}
                style={styles.zoomButton}
              >
                <Text style={styles.zoomButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={[globalStyles.card, { padding: 0, overflow: 'hidden' }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={{ width: tableBaseWidth, transform: [{ scale: tableScale }], alignSelf: 'flex-start' }}>
                  <View style={{
                    flexDirection: 'row',
                    backgroundColor: colors.primary,
                    borderTopLeftRadius: 12,
                    borderTopRightRadius: 12,
                  }}>
                    <Text style={[styles.tableHeader, { width: 110 }]}>Date</Text>
                    <Text style={[styles.tableHeader, { width: 140 }]}>Parcelle</Text>
                    <Text style={[styles.tableHeader, { width: 160 }]}>Produit</Text>
                    <Text style={[styles.tableHeader, { width: 150 }]}>Mat. Active</Text>
                    <Text style={[styles.tableHeader, { width: 80 }]}>Qte</Text>
                    <Text style={[styles.tableHeader, { width: 70 }]}>Unite</Text>
                    <Text style={[styles.tableHeader, { width: 110 }]}>Cout</Text>
                    <Text style={[styles.tableHeader, { width: 110 }]}>Cout/ha</Text>
                  </View>

                  {treatments.map((t, index) => {
                    const prod = t.produits || {}
                    const costPerHaValue = t.cout_par_hectare !== undefined && t.cout_par_hectare !== null
                      ? Number(t.cout_par_hectare)
                      : null
                    return (
                      <View
                        key={t.id || index}
                        style={{
                          flexDirection: 'row',
                          borderBottomWidth: 1,
                          borderBottomColor: colors.borderLight,
                          backgroundColor: index % 2 === 0 ? 'white' : colors.backgroundAlt
                        }}
                      >
                        <Text style={[styles.tableCell, { width: 110 }]}>
                          {formatDate(t.date_traitement || '')}
                        </Text>
                        <Text style={[styles.tableCell, { width: 140, fontWeight: '600' }]}>
                          {t.parcelle || '-'}
                        </Text>
                        <Text style={[styles.tableCell, { width: 160 }]}>
                          {prod.nom || '-'}
                        </Text>
                        <Text style={[styles.tableCell, { width: 150, fontStyle: 'italic' }]}>
                          {prod.matiere_active || '-'}
                        </Text>
                        <Text style={[styles.tableCell, { width: 80, textAlign: 'right', fontWeight: '600' }]}>
                          {t.quantite_utilisee || 0}
                        </Text>
                        <Text style={[styles.tableCell, { width: 70 }]}>
                          {prod.unite_reference || '-'}
                        </Text>
                        <Text style={[styles.tableCell, { width: 110, color: colors.gold, fontWeight: '700', textAlign: 'right' }]}>
                          {formatCurrency(t.cout_estime || 0)}
                        </Text>
                        <Text style={[styles.tableCell, { width: 110, textAlign: 'right' }]}>
                          {costPerHaValue !== null && Number.isFinite(costPerHaValue) ? formatCurrency(costPerHaValue) : '-'}
                        </Text>
                      </View>
                    )
                  })}

                  <View style={{
                    flexDirection: 'row',
                    backgroundColor: colors.goldLight,
                    borderBottomLeftRadius: 12,
                    borderBottomRightRadius: 12,
                    borderTopWidth: 3,
                    borderTopColor: colors.gold,
                  }}>
                    <Text style={[styles.tableCell, {
                      width: 710,
                      fontWeight: '700',
                      color: colors.primary,
                      textAlign: 'right',
                      paddingRight: 20
                    }]}>
                      TOTAL
                    </Text>
                    <Text style={[styles.tableCell, {
                      width: 110,
                      color: colors.primary,
                      fontWeight: '700',
                      fontSize: 16,
                      textAlign: 'right'
                    }]}>
                      {formatCurrency(totalCost)}
                    </Text>
                    <Text style={[styles.tableCell, {
                      width: 110,
                      color: colors.primary,
                      fontWeight: '700',
                      fontSize: 16,
                      textAlign: 'right'
                    }]}>
                      -
                    </Text>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        ) : (
          <View style={[globalStyles.card, { alignItems: 'center', padding: 48 }]}>
            <Text style={{ fontSize: 64, marginBottom: 20 }}>🚜</Text>
            <Text style={[typography.h3, { textAlign: 'center', marginBottom: 8, color: colors.text }]}>
              Aucun traitement trouve
            </Text>
            <Text style={[typography.caption, { textAlign: 'center', color: colors.textSecondary }]}>
              Ajustez vos filtres ou enregistrez un traitement
            </Text>
          </View>
        )}
      </ScrollView>

      <Sidebar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
      />
    </View>
  )
}

const styles = {
  suggestionList: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
    maxHeight: 180,
    ...shadows.sm,
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionText: {
    color: colors.text,
    fontSize: 14,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  zoomLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginRight: 4,
  },
  zoomButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 4,
  },
  zoomButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  zoomValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    minWidth: 44,
    textAlign: 'center' as const,
    marginHorizontal: 4,
  },
  tableHeader: {
    padding: 14,
    fontWeight: '700',
    fontSize: 12,
    color: colors.gold,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(212, 175, 55, 0.3)',
  },
  tableCell: {
    padding: 14,
    fontSize: 13,
    color: colors.text,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
  }
}
