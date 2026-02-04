import React, { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import Database from '../../lib/database'
import { useAuth } from '../../hooks/useAuth'
import { globalStyles, typography, colors } from '../../utils/styles'

interface FilterPanelProps {
  onFilterChange: (filters: any) => void
  filterType: 'achats' | 'traitements'
}

export default function FilterPanel({ onFilterChange, filterType }: FilterPanelProps) {
  const { user } = useAuth()
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    supplier: 'Tous',
    type: 'Tous',
    activeIngredient: 'Tous',
    parcelle: 'Tous',
    product: 'Tous',
    search: '',
  })
  
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [actives, setActives] = useState<string[]>([])
  const [parcelles, setParcelles] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      loadFilterData()
    }
  }, [user])

  useEffect(() => {
    onFilterChange(filters)
  }, [filters])

  const loadFilterData = async () => {
    if (!user) return
    
    const [
      suppliersRes,
      typesRes,
      activesRes,
      parcellesRes,
      productsRes
    ] = await Promise.all([
      Database.getSuppliers(user.id),
      Database.getProductTypes(user.id),
      Database.getActiveIngredients(user.id),
      Database.obtenirParcelles(user.id),
      Database.obtenirProduits(user.id),
    ])
    
    setSuppliers(['Tous', ...suppliersRes])
    setTypes(['Tous', ...typesRes])
    setActives(['Tous', ...activesRes])
    setParcelles([{ id: 'all', nom: 'Tous' }, ...parcellesRes])
    setProducts([{ id: 'all', nom: 'Tous' }, ...productsRes])
  }

  return (
    <View style={[globalStyles.card, { marginBottom: 16 }]}>
      <Text style={[typography.h3, { marginBottom: 12 }]}>🔍 Filtres</Text>
      
      {filterType === 'achats' ? (
        <>
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <TextInput
              style={[globalStyles.input, { flex: 1, marginRight: 8 }]}
              placeholder="Date de début"
              value={filters.startDate}
              onChangeText={(text) => setFilters({ ...filters, startDate: text })}
            />
            <TextInput
              style={[globalStyles.input, { flex: 1 }]}
              placeholder="Date de fin"
              value={filters.endDate}
              onChangeText={(text) => setFilters({ ...filters, endDate: text })}
            />
          </View>
          
          <View style={{ marginBottom: 12 }}>
            <Text style={typography.caption}>Fournisseur</Text>
            <Picker
              selectedValue={filters.supplier}
              onValueChange={(value) => setFilters({ ...filters, supplier: value })}
              style={{ backgroundColor: colors.card, borderRadius: 8 }}
            >
              {suppliers.map((sup) => (
                <Picker.Item key={sup} label={sup} value={sup} />
              ))}
            </Picker>
          </View>
          
          <View style={{ marginBottom: 12 }}>
            <Text style={typography.caption}>Matière Active</Text>
            <Picker
              selectedValue={filters.activeIngredient}
              onValueChange={(value) => setFilters({ ...filters, activeIngredient: value })}
              style={{ backgroundColor: colors.card, borderRadius: 8 }}
            >
              {actives.map((active) => (
                <Picker.Item key={active} label={active} value={active} />
              ))}
            </Picker>
          </View>
          
          <TextInput
            style={globalStyles.input}
            placeholder="Rechercher par nom..."
            value={filters.search}
            onChangeText={(text) => setFilters({ ...filters, search: text })}
          />
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
            <TextInput
              style={[globalStyles.input, { flex: 1, marginRight: 8 }]}
              placeholder="Date de début"
              value={filters.startDate}
              onChangeText={(text) => setFilters({ ...filters, startDate: text })}
            />
            <TextInput
              style={[globalStyles.input, { flex: 1 }]}
              placeholder="Date de fin"
              value={filters.endDate}
              onChangeText={(text) => setFilters({ ...filters, endDate: text })}
            />
          </View>
          
          <View style={{ marginBottom: 12 }}>
            <Text style={typography.caption}>Parcelle</Text>
            <Picker
              selectedValue={filters.parcelle}
              onValueChange={(value) => setFilters({ ...filters, parcelle: value })}
              style={{ backgroundColor: colors.card, borderRadius: 8 }}
            >
              {parcelles.map((parc) => (
                <Picker.Item key={parc.id} label={parc.nom} value={parc.nom} />
              ))}
            </Picker>
          </View>
          
          <View style={{ marginBottom: 12 }}>
            <Text style={typography.caption}>Produit</Text>
            <Picker
              selectedValue={filters.product}
              onValueChange={(value) => setFilters({ ...filters, product: value })}
              style={{ backgroundColor: colors.card, borderRadius: 8 }}
            >
              {products.map((prod) => (
                <Picker.Item key={prod.id} label={prod.nom} value={prod.nom} />
              ))}
            </Picker>
          </View>
        </>
      )}
      
      <TouchableOpacity
        style={[globalStyles.button, { marginTop: 8 }]}
        onPress={() => setFilters({
          startDate: '',
          endDate: '',
          supplier: 'Tous',
          type: 'Tous',
          activeIngredient: 'Tous',
          parcelle: 'Tous',
          product: 'Tous',
          search: '',
        })}
      >
        <Text style={globalStyles.buttonText}>Réinitialiser</Text>
      </TouchableOpacity>
    </View>
  )
}