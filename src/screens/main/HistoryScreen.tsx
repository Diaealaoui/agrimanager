import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import { globalStyles, typography, colors, shadows } from '../../utils/styles'
import { formatCurrency, formatDate } from '../../utils/helpers'

type HistoryScreenProps = {
  route?: { params?: { parcelle?: string; produit?: string } }
}

export default function HistoryScreen({ route }: HistoryScreenProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [treatments, setTreatments] = useState<any[]>([])
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    parcelle: 'Tous',
    produit: 'Tous',
  })
  const [parcelles, setParcelles] = useState<string[]>([])
  const [produits, setProduits] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)

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
      const [parcellesRes, produitsRes] = await Promise.all([
        Database.obtenirParcelles(user.id),
        Database.obtenirProduits(user.id),
      ])
      const parcelleNames = parcellesRes.map(p => p.nom).filter(Boolean)
      const produitNames = produitsRes.map(p => p.nom).filter(Boolean)
      setParcelles(['Tous', ...parcelleNames])
      setProduits(['Tous', ...produitNames])
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
        filters.produit !== 'Tous' ? filters.produit : undefined
      )
      setTreatments(data)
    } catch (error) {
      console.error('Error loading treatments:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = async () => {
    if (treatments.length === 0) {
      Alert.alert('Aucune donnee', 'Il n\'y a pas de traitements a exporter')
      return
    }

    setExporting(true)
    try {
      const headers = [
        'Date',
        'Parcelle',
        'Produit',
        'Matiere Active',
        'Quantite',
        'Unite',
        'Cout Estime'
      ]

      const csvRows = [
        headers.join(','),
        ...treatments.map(t => {
          const prod = t.produits || {}
          return [
            formatDate(t.date_traitement || ''),
            `"${t.parcelle || ''}"`,
            `"${prod.nom || ''}"`,
            `"${prod.matiere_active || ''}"`,
            t.quantite_utilisee || 0,
            `"${prod.unite_reference || ''}"`,
            (t.cout_estime || 0).toFixed(2)
          ].join(',')
        })
      ]

      const csvContent = csvRows.join('\n')
      const fileName = `Traitements_${new Date().toISOString().split('T')[0]}.csv`
      const fileUri = `${FileSystem.documentDirectory}${fileName}`

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
      const headers = [
        'Date',
        'Parcelle',
        'Produit',
        'Matiere Active',
        'Quantite',
        'Unite',
        'Cout Estime'
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
          </tr>
        `
      })

      htmlTable += `
              <tr class="total-row">
                <td colspan="6" style="text-align: right; padding-right: 20px;">TOTAL</td>
                <td>${formatCurrency(totalCost)}</td>
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
      const fileUri = `${FileSystem.documentDirectory}${fileName}`

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
        <Text style={[typography.h1, { color: colors.gold, marginBottom: 4 }]}>
          Historique des Traitements
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
          Suivi detaille par parcelle et produit
        </Text>
      </View>

      <ScrollView style={{ flex: 1, padding: 20 }}>
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
              <TextInput
                style={globalStyles.input}
                value={filters.startDate}
                onChangeText={(text) => setFilters({ ...filters, startDate: text })}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor={colors.textLight}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                Date Fin
              </Text>
              <TextInput
                style={globalStyles.input}
                value={filters.endDate}
                onChangeText={(text) => setFilters({ ...filters, endDate: text })}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor={colors.textLight}
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
          <View style={[globalStyles.card, { padding: 0, overflow: 'hidden' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
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
                </View>

                {treatments.map((t, index) => {
                  const prod = t.produits || {}
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
                </View>
              </View>
            </ScrollView>
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
    </View>
  )
}

const styles = {
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
