import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import { globalStyles, typography, colors, shadows } from '../../utils/styles'
import { formatCurrency, formatDate } from '../../utils/helpers'

export default function PurchaseDetailScreen() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [achats, setAchats] = useState<any[]>([])
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    supplier: 'Tous',
    activeIngredient: 'Tous',
    search: '',
  })
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [activeIngredients, setActiveIngredients] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [tableScale, setTableScale] = useState(0.85)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const [suppliersRes, activeIngredientsRes] = await Promise.all([
        Database.getSuppliers(user.id),
        Database.getActiveIngredients(user.id),
      ])
      
      setSuppliers(['Tous', ...suppliersRes])
      setActiveIngredients(['Tous', ...activeIngredientsRes])
      
      await loadAchats()
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAchats = async () => {
    if (!user) return
    
    try {
      const data = await Database.getAchatsWithFilters(
        user.id,
        filters.startDate || undefined,
        filters.endDate || undefined,
        filters.supplier !== 'Tous' ? filters.supplier : undefined,
        filters.search || undefined,
        filters.activeIngredient !== 'Tous' ? filters.activeIngredient : undefined
      )
      
      setAchats(data)
    } catch (error) {
      console.error('Error loading purchases:', error)
      Alert.alert('Erreur', 'Impossible de charger les achats')
    }
  }

  useEffect(() => {
    if (user) loadAchats()
  }, [filters])

  const exportToCSV = async () => {
    if (achats.length === 0) {
      Alert.alert('Aucune donnée', 'Il n\'y a pas de données à exporter')
      return
    }

    setExporting(true)
    try {
      const escapeCsvValue = (value: string | number | null | undefined) => {
        const safe = value === null || value === undefined ? '' : String(value)
        return `"${safe.replace(/"/g, '""')}"`
      }
      const delimiter = ';'
      const headers = [
        'Date',
        'Produit',
        'Type',
        'Matière Active',
        'Fournisseur',
        'Quantité',
        'Unité',
        'Prix HT',
        'TVA %',
        'Prix TTC',
        'Total TTC'
      ]
      
      const csvRows = [
        headers.join(delimiter),
        ...achats.map(a => {
          const prod = a.produits || {}
          return [
            escapeCsvValue(formatDate(a.date_commande)),
            escapeCsvValue(a.nom || ''),
            escapeCsvValue(prod.type_produit || ''),
            escapeCsvValue(prod.matiere_active || ''),
            escapeCsvValue(a.fournisseur || ''),
            escapeCsvValue(a.quantite_recue || 0),
            escapeCsvValue(a.unite_achat || ''),
            escapeCsvValue((a.prix_unitaire_ht || 0).toFixed(2)),
            escapeCsvValue(a.taux_tva || 0),
            escapeCsvValue((a.prix_unitaire_ttc || 0).toFixed(2)),
            escapeCsvValue((a.montant_ttc || 0).toFixed(2))
          ].join(delimiter)
        })
      ]

      const csvContent = '\ufeff' + csvRows.join('\n')
      const fileName = `Achats_${new Date().toISOString().split('T')[0]}.csv`
      const baseDirectory = FileSystem.documentDirectory || FileSystem.cacheDirectory
      if (!baseDirectory) {
        throw new Error('Stockage local indisponible')
      }
      const fileUri = `${baseDirectory}${fileName}`

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      })

      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Télécharger le registre des achats',
          UTI: 'public.comma-separated-values-text',
        })
      }
      
      Alert.alert('Succès', 'Fichier CSV exporté avec succès')
    } catch (error) {
      console.error('Error exporting CSV:', error)
      Alert.alert('Erreur', 'Impossible d\'exporter les données')
    } finally {
      setExporting(false)
    }
  }

  const exportToExcel = async () => {
    if (achats.length === 0) {
      Alert.alert('Aucune donnée', 'Il n\'y a pas de données à exporter')
      return
    }

    setExporting(true)
    try {
      // Create HTML table for Excel
      const headers = [
        'Date',
        'Produit',
        'Type',
        'Matière Active',
        'Fournisseur',
        'Quantité',
        'Unité',
        'Prix HT',
        'TVA %',
        'Prix TTC',
        'Total TTC'
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
          <div class="header-title">📋 Registre des Achats - ${new Date().toLocaleDateString('fr-FR')}</div>
          <table>
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
      `
      
      let totalTTC = 0
      achats.forEach(a => {
        const prod = a.produits || {}
        totalTTC += a.montant_ttc || 0
        
        htmlTable += `
          <tr>
            <td>${formatDate(a.date_commande)}</td>
            <td>${a.nom || ''}</td>
            <td>${prod.type_produit || ''}</td>
            <td>${prod.matiere_active || ''}</td>
            <td>${a.fournisseur || ''}</td>
            <td>${a.quantite_recue || 0}</td>
            <td>${a.unite_achat || ''}</td>
            <td>${(a.prix_unitaire_ht || 0).toFixed(2)} MAD</td>
            <td>${a.taux_tva || 0}%</td>
            <td>${(a.prix_unitaire_ttc || 0).toFixed(2)} MAD</td>
            <td>${formatCurrency(a.montant_ttc || 0)}</td>
          </tr>
        `
      })
      
      htmlTable += `
              <tr class="total-row">
                <td colspan="10" style="text-align: right; padding-right: 20px;">TOTAL GÉNÉRAL</td>
                <td>${formatCurrency(totalTTC)}</td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top: 30px; color: #64748b; font-size: 12px;">
            Document généré le ${new Date().toLocaleString('fr-FR')} par AgriManager Pro
          </div>
        </body>
        </html>
      `

      const fileName = `Achats_${new Date().toISOString().split('T')[0]}.xls`
      const fileUri = `${FileSystem.documentDirectory}${fileName}`

      await FileSystem.writeAsStringAsync(fileUri, htmlTable, {
        encoding: FileSystem.EncodingType.UTF8,
      })

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.ms-excel',
        dialogTitle: 'Télécharger le registre des achats',
        UTI: 'com.microsoft.excel.xls',
      })
      
      Alert.alert('Succès', 'Fichier Excel exporté avec succès')
    } catch (error) {
      console.error('Error exporting Excel:', error)
      Alert.alert('Erreur', 'Impossible d\'exporter les données')
    } finally {
      setExporting(false)
    }
  }

  const totalValue = achats.reduce((sum, a) => sum + (a.montant_ttc || 0), 0)
  const headerPadding = Math.max(8, 12 * tableScale)
  const cellPadding = Math.max(8, 12 * tableScale)
  const headerFontSize = Math.max(10, 12 * tableScale)
  const cellFontSize = Math.max(10, 13 * tableScale)
  const scaled = (value: number) => Math.round(value * tableScale)
  const zoomOutDisabled = tableScale <= 0.7
  const zoomInDisabled = tableScale >= 1.2

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    )
  }

  return (
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
          📋 Détail des Achats
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
          Registre complet de vos acquisitions
        </Text>
      </View>
      
      <ScrollView style={{ flex: 1, padding: 20 }}>
        {/* Filters Card */}
        <View style={[globalStyles.cardLuxury, { marginBottom: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 24, marginRight: 8 }}>🔍</Text>
            <Text style={[typography.h3, { color: colors.primary }]}>Filtres</Text>
          </View>
          
          <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
            Recherche
          </Text>
          <TextInput
            style={[globalStyles.input, { marginBottom: 16 }]}
            placeholder="Rechercher un produit..."
            value={filters.search}
            onChangeText={(text) => setFilters({ ...filters, search: text })}
            placeholderTextColor={colors.textLight}
          />
          
          <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                Date Début
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
            Fournisseur
          </Text>
          <View style={{ 
            backgroundColor: colors.backgroundAlt, 
            borderRadius: 12, 
            borderWidth: 2, 
            borderColor: colors.border,
            marginBottom: 16,
          }}>
            <Picker
              selectedValue={filters.supplier}
              onValueChange={(value) => setFilters({ ...filters, supplier: value })}
              style={{ color: colors.text }}
            >
              {suppliers.map(s => (
                <Picker.Item key={s} label={s} value={s} />
              ))}
            </Picker>
          </View>
          
          <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
            Matière Active
          </Text>
          <View style={{ 
            backgroundColor: colors.backgroundAlt, 
            borderRadius: 12, 
            borderWidth: 2, 
            borderColor: colors.border,
          }}>
            <Picker
              selectedValue={filters.activeIngredient}
              onValueChange={(value) => setFilters({ ...filters, activeIngredient: value })}
              style={{ color: colors.text }}
            >
              {activeIngredients.map(a => (
                <Picker.Item key={a} label={a} value={a} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Summary Card */}
        <View style={[globalStyles.metricCardGold, { marginBottom: 20, padding: 24 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <View>
              <Text style={[typography.caption, { color: colors.text, marginBottom: 4 }]}>
                Total des Achats
              </Text>
              <Text style={[typography.h2, { color: colors.primary, fontWeight: '700' }]}>
                {formatCurrency(totalValue)}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                {achats.length} achat{achats.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={{ fontSize: 48 }}>💰</Text>
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
            disabled={exporting || achats.length === 0}
          >
            <Text style={globalStyles.buttonText}>
              {exporting ? 'Export...' : '📄 Export CSV'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[globalStyles.buttonGold, { 
              flex: 1,
              marginLeft: 8,
              opacity: (exporting || achats.length === 0) ? 0.5 : 1
            }]}
            onPress={exportToExcel}
            disabled={exporting || achats.length === 0}
          >
            <Text style={globalStyles.buttonText}>
              {exporting ? 'Export...' : '📊 Export Excel'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Detailed Table */}
        {achats.length > 0 ? (
          <View style={[globalStyles.card, { padding: 0, overflow: 'hidden' }]}>
            <View style={styles.tableControls}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Zoom tableau</Text>
              <View style={styles.tableControlButtons}>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
              <View>
                {/* Table Header */}
                <View style={{ 
                  flexDirection: 'row', 
                  backgroundColor: colors.primary,
                  borderTopLeftRadius: 12,
                  borderTopRightRadius: 12,
                }}>
                  <Text style={[styles.tableHeader, { width: scaled(110), padding: headerPadding, fontSize: headerFontSize }]}>Date</Text>
                  <Text style={[styles.tableHeader, { width: scaled(160), padding: headerPadding, fontSize: headerFontSize }]}>Produit</Text>
                  <Text style={[styles.tableHeader, { width: scaled(120), padding: headerPadding, fontSize: headerFontSize }]}>Type</Text>
                  <Text style={[styles.tableHeader, { width: scaled(140), padding: headerPadding, fontSize: headerFontSize }]}>Mat. Active</Text>
                  <Text style={[styles.tableHeader, { width: scaled(140), padding: headerPadding, fontSize: headerFontSize }]}>Fournisseur</Text>
                  <Text style={[styles.tableHeader, { width: scaled(80), padding: headerPadding, fontSize: headerFontSize }]}>Qté</Text>
                  <Text style={[styles.tableHeader, { width: scaled(70), padding: headerPadding, fontSize: headerFontSize }]}>Unité</Text>
                  <Text style={[styles.tableHeader, { width: scaled(90), padding: headerPadding, fontSize: headerFontSize }]}>Prix HT</Text>
                  <Text style={[styles.tableHeader, { width: scaled(70), padding: headerPadding, fontSize: headerFontSize }]}>TVA</Text>
                  <Text style={[styles.tableHeader, { width: scaled(90), padding: headerPadding, fontSize: headerFontSize }]}>Prix TTC</Text>
                  <Text style={[styles.tableHeader, { width: scaled(110), padding: headerPadding, fontSize: headerFontSize }]}>Total TTC</Text>
                </View>
                
                {/* Table Rows */}
                {achats.map((a, index) => {
                  const prod = a.produits || {}
                  return (
                    <View 
                      key={a.id || index} 
                      style={{ 
                        flexDirection: 'row',
                        borderBottomWidth: 1,
                        borderBottomColor: colors.borderLight,
                        backgroundColor: index % 2 === 0 ? 'white' : colors.backgroundAlt
                      }}
                    >
                      <Text style={[styles.tableCell, { width: scaled(110), padding: cellPadding, fontSize: cellFontSize }]}>
                        {formatDate(a.date_commande)}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(160), padding: cellPadding, fontSize: cellFontSize, fontWeight: '600' }]}>
                        {a.nom}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(120), padding: cellPadding, fontSize: cellFontSize }]}>
                        {prod.type_produit || '-'}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(140), padding: cellPadding, fontSize: cellFontSize, fontStyle: 'italic' }]}>
                        {prod.matiere_active || '-'}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(140), padding: cellPadding, fontSize: cellFontSize }]}>
                        {a.fournisseur}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(80), padding: cellPadding, fontSize: cellFontSize, textAlign: 'right', fontWeight: '600' }]}>
                        {a.quantite_recue}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(70), padding: cellPadding, fontSize: cellFontSize }]}>
                        {a.unite_achat}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(90), padding: cellPadding, fontSize: cellFontSize, textAlign: 'right' }]}>
                        {(a.prix_unitaire_ht || 0).toFixed(2)}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(70), padding: cellPadding, fontSize: cellFontSize, textAlign: 'center' }]}>
                        {a.taux_tva}%
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(90), padding: cellPadding, fontSize: cellFontSize, textAlign: 'right' }]}>
                        {(a.prix_unitaire_ttc || 0).toFixed(2)}
                      </Text>
                      <Text style={[styles.tableCell, { width: scaled(110), padding: cellPadding, fontSize: cellFontSize, color: colors.gold, fontWeight: '700', textAlign: 'right' }]}>
                        {formatCurrency(a.montant_ttc || 0)}
                      </Text>
                    </View>
                  )
                })}

                {/* Total Row */}
                <View style={{
                  flexDirection: 'row',
                  backgroundColor: colors.goldLight,
                  borderBottomLeftRadius: 12,
                  borderBottomRightRadius: 12,
                  borderTopWidth: 3,
                  borderTopColor: colors.gold,
                }}>
                  <Text style={[styles.tableCell, { 
                    width: scaled(1060), 
                    fontWeight: '700', 
                    color: colors.primary,
                    textAlign: 'right',
                    paddingRight: 20,
                    padding: cellPadding,
                    fontSize: cellFontSize,
                  }]}>
                    TOTAL GÉNÉRAL
                  </Text>
                  <Text style={[styles.tableCell, { 
                    width: scaled(110), 
                    color: colors.primary, 
                    fontWeight: '700',
                    fontSize: Math.max(12, 16 * tableScale),
                    padding: cellPadding,
                    textAlign: 'right' 
                  }]}>
                    {formatCurrency(totalValue)}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        ) : (
          <View style={[globalStyles.card, { alignItems: 'center', padding: 48 }]}>
            <Text style={{ fontSize: 64, marginBottom: 20 }}>📭</Text>
            <Text style={[typography.h3, { textAlign: 'center', marginBottom: 8, color: colors.text }]}>
              Aucun achat trouvé
            </Text>
            <Text style={[typography.caption, { textAlign: 'center', color: colors.textSecondary }]}>
              Ajustez vos filtres de recherche ou ajoutez de nouveaux achats
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = {
  tableControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.backgroundAlt,
  },
  tableControlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomButton: {
    backgroundColor: 'white',
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
  tableHeader: {
    fontWeight: '700',
    color: colors.gold,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(212, 175, 55, 0.3)',
  },
  tableCell: {
    color: colors.text,
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
  }
}