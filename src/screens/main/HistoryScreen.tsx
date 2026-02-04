import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import { Picker } from '@react-native-picker/picker'
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
          📜 Historique des Traitements
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
          Suivi détaillé par parcelle et produit
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
                Coût Total des Traitements
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

        {/* Treatments List */}
        {treatments.length > 0 ? (
          treatments.map((t, index) => {
            const product = t.produits || {}
            return (
              <View key={t.id || index} style={[globalStyles.card, { padding: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[typography.body, { fontWeight: '600', color: colors.text }]}>
                      {product.nom || 'Produit'}
                    </Text>
                    <Text style={[typography.caption, { marginTop: 4 }]}>
                      {t.parcelle || 'Parcelle'} • {formatDate(t.date_traitement)}
                    </Text>
                    {product.matiere_active ? (
                      <Text style={[typography.small, { marginTop: 4 }]}>
                        MA: {product.matiere_active}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>
                      {formatCurrency(t.cout_estime || 0)}
                    </Text>
                    <Text style={[typography.small, { color: colors.textSecondary, marginTop: 2 }]}>
                      {Number(t.quantite_utilisee || 0).toFixed(1)} {product.unite_reference || ''}
                    </Text>
                  </View>
                </View>
              </View>
            )
          })
        ) : (
          <View style={[globalStyles.card, { alignItems: 'center', padding: 48 }]}>
            <Text style={{ fontSize: 64, marginBottom: 20 }}>🚜</Text>
            <Text style={[typography.h3, { textAlign: 'center', marginBottom: 8, color: colors.text }]}>
              Aucun traitement trouvé
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
