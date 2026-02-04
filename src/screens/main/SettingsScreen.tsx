import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Switch } from 'react-native'
import { Picker } from '@react-native-picker/picker'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import Header from '../../components/layout/Header'
import { globalStyles, typography, colors } from '../../utils/styles'

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('farm')
  const [farmName, setFarmName] = useState('')
  const [newParcelleName, setNewParcelleName] = useState('')
  const [newParcelleSurface, setNewParcelleSurface] = useState('')
  const [newParcelleCulture, setNewParcelleCulture] = useState('Blé')
  const [newProductType, setNewProductType] = useState('')
  const [parcelles, setParcelles] = useState<any[]>([])
  const [productTypes, setProductTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [offlineMode, setOfflineMode] = useState(false)

  const cultureTypes = ['Blé', 'Maïs', 'Olivier', 'Vigne', 'Maraîchage', 'Autre']

  useEffect(() => {
    if (user) {
      loadSettingsData()
    }
  }, [user])

  const loadSettingsData = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const [name, parcellesRes, typesRes] = await Promise.all([
        Database.getFarmName(user.id),
        Database.obtenirParcelles(user.id),
        Database.getProductTypes(user.id),
      ])
      
      setFarmName(name)
      setParcelles(parcellesRes)
      setProductTypes(typesRes)
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveFarmName = async () => {
    if (!user || !farmName.trim()) return
    
    setLoading(true)
    const result = await Database.updateFarmName(user.id, farmName.trim())
    
    if (result.success) {
      Alert.alert('Succès', 'Nom de l\'exploitation mis à jour')
    } else {
      Alert.alert('Erreur', result.error || 'Impossible de mettre à jour')
    }
    setLoading(false)
  }

  const handleAddParcelle = async () => {
    if (!user || !newParcelleName.trim() || !newParcelleSurface) return
    
    const surface = parseFloat(newParcelleSurface)
    if (isNaN(surface) || surface <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une surface valide')
      return
    }
    
    setLoading(true)
    const result = await Database.ajouterParcelle(
      user.id,
      newParcelleName.trim(),
      surface,
      newParcelleCulture
    )
    
    if (result.success) {
      Alert.alert('Succès', 'Parcelle ajoutée')
      setNewParcelleName('')
      setNewParcelleSurface('')
      setNewParcelleCulture('Blé')
      loadSettingsData() // Reload data
    } else {
      Alert.alert('Erreur', result.error || 'Impossible d\'ajouter la parcelle')
    }
    setLoading(false)
  }

  const handleDeleteParcelle = async (parcelleId: string) => {
    if (!user) return
    
    Alert.alert(
      'Confirmation',
      'Êtes-vous sûr de vouloir supprimer cette parcelle ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            const result = await Database.deleteParcelle(user.id, parcelleId)
            
            if (result.success) {
              Alert.alert('Succès', 'Parcelle supprimée')
              loadSettingsData() // Reload data
            } else {
              Alert.alert('Erreur', result.error || 'Impossible de supprimer')
            }
            setLoading(false)
          }
        }
      ]
    )
  }

  const handleAddProductType = async () => {
    if (!user || !newProductType.trim()) return
    
    setLoading(true)
    const result = await Database.addProductType(user.id, newProductType.trim())
    
    if (result.success) {
      Alert.alert('Succès', 'Type de produit ajouté')
      setNewProductType('')
      loadSettingsData() // Reload data
    } else {
      Alert.alert('Erreur', result.error || 'Impossible d\'ajouter le type')
    }
    setLoading(false)
  }

  const handleDeleteProductType = async (typeName: string) => {
    if (!user) return
    
    Alert.alert(
      'Confirmation',
      `Supprimer le type "${typeName}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true)
            const result = await Database.deleteProductType(user.id, typeName)
            
            if (result.success) {
              Alert.alert('Succès', 'Type supprimé')
              loadSettingsData() // Reload data
            } else {
              Alert.alert('Erreur', result.error || 'Impossible de supprimer')
            }
            setLoading(false)
          }
        }
      ]
    )
  }

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Déconnexion', 
          style: 'destructive',
          onPress: signOut
        }
      ]
    )
  }

  const tabs = [
    { id: 'farm', label: '🏠 Exploitation', icon: '🏠' },
    { id: 'parcelles', label: '🌾 Parcelles', icon: '🌾' },
    { id: 'categories', label: '📦 Catégories', icon: '📦' },
    { id: 'app', label: '⚙️ Application', icon: '⚙️' },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Paramètres" />
      
      <ScrollView style={{ flex: 1 }}>
        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={{ paddingHorizontal: 16, marginVertical: 16 }}
        >
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                marginRight: 8,
                borderRadius: 8,
                backgroundColor: activeTab === tab.id ? colors.primary : colors.card,
                minWidth: 100,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 20, marginBottom: 4 }}>{tab.icon}</Text>
              <Text style={{
                color: activeTab === tab.id ? 'white' : colors.text,
                fontSize: 12,
                fontWeight: '600',
              }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ padding: 16 }}>
          {/* Farm Settings */}
          {activeTab === 'farm' && (
            <View style={globalStyles.card}>
              <Text style={[typography.h2, { marginBottom: 16 }]}>Nom de l'Exploitation</Text>
              
              <TextInput
                style={globalStyles.input}
                placeholder="Nom de votre exploitation"
                value={farmName}
                onChangeText={setFarmName}
              />
              
              <TouchableOpacity
                style={[globalStyles.button, { marginTop: 16 }]}
                onPress={handleSaveFarmName}
                disabled={loading}
              >
                <Text style={globalStyles.buttonText}>
                  {loading ? 'Enregistrement...' : 'Enregistrer'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Parcelles Settings */}
          {activeTab === 'parcelles' && (
            <View>
              {/* Add Parcelle Form */}
              <View style={[globalStyles.card, { marginBottom: 16 }]}>
                <Text style={[typography.h2, { marginBottom: 16 }]}>Ajouter une Parcelle</Text>
                
                <Text style={typography.caption}>Nom de la parcelle</Text>
                <TextInput
                  style={globalStyles.input}
                  placeholder="Ex: Champ Nord"
                  value={newParcelleName}
                  onChangeText={setNewParcelleName}
                />
                
                <Text style={[typography.caption, { marginTop: 12 }]}>Surface (hectares)</Text>
                <TextInput
                  style={globalStyles.input}
                  placeholder="Ex: 2.5"
                  value={newParcelleSurface}
                  onChangeText={setNewParcelleSurface}
                  keyboardType="numeric"
                />
                
                <Text style={[typography.caption, { marginTop: 12 }]}>Type de culture</Text>
                <Picker
                  selectedValue={newParcelleCulture}
                  onValueChange={setNewParcelleCulture}
                  style={{ backgroundColor: colors.card, marginBottom: 16 }}
                >
                  {cultureTypes.map(culture => (
                    <Picker.Item key={culture} label={culture} value={culture} />
                  ))}
                </Picker>
                
                <TouchableOpacity
                  style={[globalStyles.button, { backgroundColor: colors.success }]}
                  onPress={handleAddParcelle}
                  disabled={loading}
                >
                  <Text style={globalStyles.buttonText}>
                    {loading ? 'Ajout...' : 'Ajouter la Parcelle'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Existing Parcelles */}
              <View style={globalStyles.card}>
                <Text style={[typography.h2, { marginBottom: 16 }]}>
                  Parcelles ({parcelles.length})
                </Text>
                
                {parcelles.length > 0 ? (
                  parcelles.map(parcelle => (
                    <View 
                      key={parcelle.id}
                      style={{
                        padding: 16,
                        marginBottom: 12,
                        backgroundColor: '#f8fafc',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.body, { fontWeight: '600', marginBottom: 4 }]}>
                            {parcelle.nom}
                          </Text>
                          <Text style={[typography.small, { color: colors.textSecondary }]}>
                            Surface: {parcelle.surface_ha} ha • Culture: {parcelle.culture_type}
                          </Text>
                        </View>
                        
                        <TouchableOpacity onPress={() => handleDeleteParcelle(parcelle.id)}>
                          <Text style={{ color: colors.danger, fontSize: 18 }}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={{ alignItems: 'center', padding: 32 }}>
                    <Text style={{ fontSize: 48, marginBottom: 16 }}>🌱</Text>
                    <Text style={[typography.body, { textAlign: 'center' }]}>
                      Aucune parcelle configurée
                    </Text>
                    <Text style={[typography.caption, { textAlign: 'center', color: colors.textSecondary }]}>
                      Ajoutez votre première parcelle ci-dessus
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Product Categories */}
          {activeTab === 'categories' && (
            <View>
              {/* Add Category Form */}
              <View style={[globalStyles.card, { marginBottom: 16 }]}>
                <Text style={[typography.h2, { marginBottom: 16 }]}>Ajouter un Type de Produit</Text>
                
                <TextInput
                  style={globalStyles.input}
                  placeholder="Ex: Fongicide, Engrais foliaire..."
                  value={newProductType}
                  onChangeText={setNewProductType}
                />
                
                <TouchableOpacity
                  style={[globalStyles.button, { backgroundColor: colors.success }]}
                  onPress={handleAddProductType}
                  disabled={loading}
                >
                  <Text style={globalStyles.buttonText}>
                    {loading ? 'Ajout...' : 'Ajouter le Type'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Existing Categories */}
              <View style={globalStyles.card}>
                <Text style={[typography.h2, { marginBottom: 16 }]}>
                  Types de Produits ({productTypes.length})
                </Text>
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {productTypes.map(type => (
                    <View
                      key={type}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#f1f5f9',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        marginRight: 8,
                        marginBottom: 8,
                      }}
                    >
                      <Text style={{ marginRight: 8 }}>{type}</Text>
                      <TouchableOpacity onPress={() => handleDeleteProductType(type)}>
                        <Text style={{ color: colors.danger, fontSize: 16 }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* App Settings */}
          {activeTab === 'app' && (
            <View style={globalStyles.card}>
              <Text style={[typography.h2, { marginBottom: 24 }]}>Préférences</Text>
              
              {/* Notifications */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#f1f5f9',
              }}>
                <View>
                  <Text style={[typography.body, { fontWeight: '600' }]}>Notifications</Text>
                  <Text style={[typography.small, { color: colors.textSecondary }]}>
                    Alertes stock faible, rappels traitement
                  </Text>
                </View>
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: '#cbd5e1', true: colors.primaryLight }}
                />
              </View>
              
              {/* Offline Mode */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#f1f5f9',
              }}>
                <View>
                  <Text style={[typography.body, { fontWeight: '600' }]}>Mode Hors-ligne</Text>
                  <Text style={[typography.small, { color: colors.textSecondary }]}>
                    Travailler sans connexion internet
                  </Text>
                </View>
                <Switch
                  value={offlineMode}
                  onValueChange={setOfflineMode}
                  trackColor={{ false: '#cbd5e1', true: colors.primaryLight }}
                />
              </View>
              
              {/* User Info */}
              <View style={{ paddingVertical: 16 }}>
                <Text style={[typography.body, { fontWeight: '600', marginBottom: 8 }]}>
                  Compte
                </Text>
                <Text style={[typography.small, { color: colors.textSecondary, marginBottom: 4 }]}>
                  Email: {user?.email}
                </Text>
                <Text style={[typography.small, { color: colors.textSecondary }]}>
                  ID: {user?.id?.substring(0, 8)}...
                </Text>
              </View>
              
              {/* Logout Button */}
              <TouchableOpacity
                style={[globalStyles.button, { 
                  marginTop: 32,
                  backgroundColor: colors.danger 
                }]}
                onPress={handleLogout}
              >
                <Text style={globalStyles.buttonText}>Déconnexion</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}