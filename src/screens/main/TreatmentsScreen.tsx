import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import Header from '../../components/layout/Header'
import { globalStyles, typography, colors } from '../../utils/styles'

export default function TreatmentsScreen() {
  const { user } = useAuth()
  const [parcelles, setParcelles] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedParcelle, setSelectedParcelle] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [dose, setDose] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [treatmentBuffer, setTreatmentBuffer] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    if (!user) return
    
    setLoading(true)
    const [parcellesRes, productsRes] = await Promise.all([
      Database.obtenirParcelles(user.id),
      Database.obtenirProduits(user.id),
    ])
    
    setParcelles(parcellesRes)
    setProducts(productsRes)
    setLoading(false)
  }

  const addToBuffer = () => {
    if (!selectedParcelle || !selectedProduct || !dose || parseFloat(dose) <= 0) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs correctement')
      return
    }

    const product = products.find(p => p.nom === selectedProduct)
    const cost = parseFloat(dose) * (product?.prix_moyen || 0)
    
    setTreatmentBuffer([...treatmentBuffer, {
      parcelle: selectedParcelle,
      produit: selectedProduct,
      produit_id: product?.id,
      dose: parseFloat(dose),
      unit: product?.unite_reference || '',
      date,
      cost,
    }])
    
    // Reset form
    setSelectedParcelle('')
    setSelectedProduct('')
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
    } else {
      Alert.alert('Erreur', result.error || 'Erreur lors de l\'enregistrement')
    }
  }

  const totalBufferCost = treatmentBuffer.reduce((sum, t) => sum + t.cost, 0)

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
          <Picker
            selectedValue={selectedProduct}
            onValueChange={setSelectedProduct}
            style={{ backgroundColor: colors.card, marginBottom: 12 }}
          >
            <Picker.Item label="Sélectionner un produit" value="" />
            {products.map(p => (
              <Picker.Item key={p.id} label={p.nom} value={p.nom} />
            ))}
          </Picker>
          
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
      </ScrollView>
    </View>
  )
}