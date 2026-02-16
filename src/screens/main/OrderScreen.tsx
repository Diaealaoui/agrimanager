import React, { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, Keyboard, TouchableWithoutFeedback, Platform } from 'react-native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { useAuth } from '../../hooks/useAuth'
import Database from '../../lib/database'
import Sidebar from '../../components/layout/Sidebar'
import { globalStyles, typography, colors, shadows } from '../../utils/styles'

type OrderScreenProps = {
  route?: { params?: { prefilledProduct?: string } }
  prefilledProduct?: string
}

export default function OrderScreen({ route, prefilledProduct }: OrderScreenProps) {
  const { user } = useAuth()
  const [products, setProducts] = useState<any[]>([])
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [fournisseur, setFournisseur] = useState('')
  const [dateCommande, setDateCommande] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  
  const quantityInputRef = useRef<TextInput>(null)
  const unitInputRef = useRef<TextInput>(null)
  const scrollViewRef = useRef<ScrollView>(null)
  const prefilledValue = route?.params?.prefilledProduct ?? prefilledProduct ?? ''

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (user) { loadProducts() }
  }, [user])
  
  useEffect(() => {
    if (prefilledValue) {
      setSelectedProduct(prefilledValue)
    }
  }, [prefilledValue])

  const loadProducts = async () => {
    if (!user) return
    setLoading(true)
    try {
      const prods = await Database.obtenirProduits(user.id)
      setProducts(prods)
      const farmName = await Database.getFarmName(user.id)
      setFournisseur(farmName)
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProductSearch = (text: string) => {
    setSelectedProduct(text)
    if (text.length > 0) {
      const filtered = products.filter(p => 
        p.nom.toLowerCase().includes(text.toLowerCase()) ||
        (p.matiere_active && p.matiere_active.toLowerCase().includes(text.toLowerCase())) ||
        (p.type_produit && p.type_produit.toLowerCase().includes(text.toLowerCase()))
      )
      setSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }

  const selectProduct = (product: any) => {
    setSelectedProduct(product.nom)
    setUnit(product.unite_reference || '')
    setShowSuggestions(false)
    Keyboard.dismiss()
    setTimeout(() => quantityInputRef.current?.focus(), 100)
  }

  const addOrderItem = () => {
    if (!selectedProduct.trim() || !quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Erreur', 'Veuillez saisir un produit et une quantité valide')
      return
    }

    const product = products.find(p => p.nom.toLowerCase() === selectedProduct.toLowerCase())
    const newItem = {
      id: Date.now().toString(),
      nom: selectedProduct, 
      qty: parseFloat(quantity),
      unit: unit || (product?.unite_reference || ''),
      product_id: product?.id || null,
    }

    setOrderItems([...orderItems, newItem])
    setSelectedProduct('')
    setQuantity('')
    setUnit('')
    setShowSuggestions(false)
    Keyboard.dismiss()
    
    // Scroll to bottom to show added item
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }

  const clearOrder = () => {
    setOrderItems([])
    setFournisseur('')
    setNotes('')
    setDateCommande(new Date().toISOString().split('T')[0])
  }

  const removeOrderItem = (id: string) => {
    setOrderItems(orderItems.filter(i => i.id !== id))
  }

  const generatePDF = async () => {
    if (!fournisseur.trim()) {
      Alert.alert('Erreur', 'Veuillez spécifier un fournisseur')
      return
    }

    if (orderItems.length === 0) {
      Alert.alert('Erreur', 'Ajoutez au moins un produit à la commande')
      return
    }

    setLoading(true)
    
    try {
      const farmName = user ? await Database.getFarmName(user.id) : 'Ma Ferme'
      const orderRef = `BC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page { margin: 20mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Helvetica', 'Arial', sans-serif;
              color: #2d3436;
              line-height: 1.3;
              font-size: 11px;
              height: 100%;
            }
            /* Header Section */
            .header { 
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 2px solid #2e7d32;
            }
            .title { 
              color: #1b5e20;
              font-size: 20px;
              font-weight: bold;
            }
            .subtitle { 
              color: #4caf50;
              font-size: 13px;
              font-weight: 600;
            }
            
            /* Info Bar */
            .info-grid {
              display: flex;
              justify-content: space-between;
              margin-bottom: 15px;
              background: #f1f8e9;
              padding: 10px 15px;
              border-radius: 4px;
            }
            .info-label { font-weight: bold; color: #33691e; }
            
            /* Table Styling */
            .table { 
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
            }
            .table th { 
              background-color: #2e7d32;
              color: white;
              padding: 8px;
              text-align: left;
              font-size: 10px;
              text-transform: uppercase;
            }
            .table td { 
              padding: 6px 8px;
              border-bottom: 1px solid #c8e6c9;
            }
            .table tr:nth-child(even) { background-color: #fafafa; }
            
            .total-row {
              text-align: right;
              padding: 10px;
              font-weight: bold;
              color: #1b5e20;
              border-top: 1px solid #2e7d32;
            }
            
            .notes { 
              margin-top: 10px;
              padding: 8px;
              border: 1px solid #e0e0e0;
              border-left: 3px solid #81c784;
              background-color: #fff;
            }

            /* Push Signatures to bottom */
            .bottom-container {
              position: absolute;
              bottom: 40px;
              left: 0;
              right: 0;
              width: 100%;
            }
            .signature-section {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
            }
            .signature-box {
              width: 40%;
              border-top: 1.5px solid #2e7d32;
              padding-top: 5px;
              text-align: center;
              font-size: 10px;
              color: #1b5e20;
              font-weight: bold;
            }
            .footer { 
              text-align: center;
              font-size: 8px;
              color: #9e9e9e;
              border-top: 1px solid #eee;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">🌿 BON DE COMMANDE</div>
              <div class="subtitle">${farmName}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; color: #1b5e20;">N° ${orderRef}</div>
              <div>Le: ${new Date(dateCommande).toLocaleDateString('fr-FR')}</div>
            </div>
          </div>
          
          <div class="info-grid">
            <div><span class="info-label">Fournisseur:</span> ${fournisseur}</div>
            <div><span class="info-label">Destination:</span> Exploitation Agricole</div>
          </div>
          
          <table class="table">
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Désignation</th>
                <th style="text-align: center; width: 80px;">Qté</th>
                <th style="width: 70px;">Unité</th>
              </tr>
            </thead>
            <tbody>
              ${orderItems.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td style="font-weight: 500;">${item.nom}</td>
                  <td style="text-align: center; font-weight: bold; color: #2e7d32;">${item.qty}</td>
                  <td>${item.unit}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total-row">
            Nombre d'articles: ${orderItems.length}
          </div>
          
          ${notes ? `
            <div class="notes">
              <div style="font-weight: bold; font-size: 9px; margin-bottom: 3px;">Note livraison:</div>
              <div style="font-size: 10px; color: #555;">${notes.replace(/\n/g, '<br>')}</div>
            </div>
          ` : ''}

          <div class="bottom-container">
            <div class="signature-section">
              <div class="signature-box">Signature Client</div>
              <div class="signature-box">Signature Fournisseur</div>
            </div>
            
            <div class="footer">
              AgriManager Pro - Logiciel de Gestion d'Exploitation<br>
              Généré le ${new Date().toLocaleDateString('fr-FR')} - Document Officiel
            </div>
          </div>
        </body>
        </html>
      `

      const { uri } = await Print.printToFileAsync({ 
        html,
        base64: false 
      })
      
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Bon de Commande ${orderRef}`,
        UTI: 'com.adobe.pdf'
      })
      
      Alert.alert(
        'Succès',
        'Le bon de commande a été généré.',
        [{ text: 'OK', onPress: () => clearOrder() }]
      )
      
    } catch (error) {
      console.error('Error generating PDF:', error)
      Alert.alert('Erreur', 'Impossible de générer le PDF')
    } finally {
      setLoading(false)
    }
  }

  const handleDismissKeyboard = () => {
    Keyboard.dismiss()
    setShowSuggestions(false)
  }

  return (
    <TouchableWithoutFeedback onPress={handleDismissKeyboard}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        
        {/* Header */}
        <View style={{
          backgroundColor: colors.primary,
          padding: 24, paddingBottom: 32, paddingTop: 60,
          borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
          ...shadows.xl, zIndex: 10,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setSidebarVisible(true)} style={{ marginRight: 12 }}>
              <Text style={{ color: 'white', fontSize: 24 }}>☰</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h1, { color: colors.gold, marginBottom: 4 }]}>📄 Bon de Commande</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>Générez vos bons de commande professionnels</Text>
            </View>
          </View>
        </View>
        
        <ScrollView 
          ref={scrollViewRef}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ 
            padding: 20, 
            paddingBottom: keyboardVisible ? 300 : 100,
            minHeight: '100%'
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Information Card */}
          <View style={[globalStyles.cardLuxury, { marginBottom: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 24, marginRight: 8 }}>📋</Text>
              <Text style={[typography.h3, { color: colors.primary }]}>Informations de Commande</Text>
            </View>
            
            <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>Fournisseur *</Text>
            <TextInput
              style={[globalStyles.input, { marginBottom: 16 }]}
              placeholder="Nom du fournisseur"
              value={fournisseur}
              onChangeText={setFournisseur}
              placeholderTextColor={colors.textLight}
            />
            
            <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>Date de Commande *</Text>
            <TextInput
              style={[globalStyles.input, { marginBottom: 16 }]}
              value={dateCommande}
              onChangeText={setDateCommande}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor={colors.textLight}
            />
            
            <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>Notes (Optionnel)</Text>
            <TextInput
              style={[globalStyles.input, { minHeight: 100, textAlignVertical: 'top' }]}
              placeholder="Informations supplémentaires..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              placeholderTextColor={colors.textLight}
            />
          </View>

          {/* Add Product Section */}
          <View style={{ marginBottom: 20, zIndex: 1 }}>
            <View style={[globalStyles.card]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 24, marginRight: 8 }}>📦</Text>
                <Text style={[typography.h3, { color: colors.primary }]}>Ajouter un Produit</Text>
              </View>
              
              <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>Produit *</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={globalStyles.input}
                  placeholder="Rechercher ou saisir..."
                  value={selectedProduct}
                  onChangeText={handleProductSearch}
                  onFocus={() => selectedProduct.length > 0 && setShowSuggestions(true)}
                  onSubmitEditing={addOrderItem}
                />
              </View>
              
              <View style={{ flexDirection: 'row', marginTop: 16 }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>Quantité *</Text>
                  <TextInput 
                    ref={quantityInputRef} 
                    style={globalStyles.input} 
                    placeholder="0.00" 
                    value={quantity} 
                    onChangeText={setQuantity} 
                    keyboardType="numeric"
                    onSubmitEditing={addOrderItem}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>Unité</Text>
                  <TextInput 
                    ref={unitInputRef} 
                    style={globalStyles.input} 
                    placeholder="L, kg..." 
                    value={unit} 
                    onChangeText={setUnit}
                    onSubmitEditing={addOrderItem}
                  />
                </View>
              </View>
              
              <TouchableOpacity style={[globalStyles.buttonGold, { marginTop: 16 }]} onPress={addOrderItem}>
                <Text style={globalStyles.buttonText}>➕ Ajouter à la Commande</Text>
              </TouchableOpacity>
            </View>

            {/* Suggestions Dropdown - Positioned absolutely to avoid scroll issues */}
            {showSuggestions && suggestions.length > 0 && (
              <View style={{
                position: 'absolute',
                top: 130, // Adjust based on your layout
                left: 0,
                right: 0,
                backgroundColor: 'white',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                maxHeight: 250,
                ...shadows.lg,
                zIndex: 1000,
                marginTop: 5,
              }}>
                <ScrollView 
                  nestedScrollEnabled={true} 
                  style={{ maxHeight: 250 }}
                  keyboardShouldPersistTaps="always"
                >
                  {suggestions.map((item) => (
                    <TouchableOpacity
                      key={item.id.toString()}
                      style={{ 
                        padding: 15, 
                        borderBottomWidth: 1, 
                        borderBottomColor: colors.borderLight 
                      }}
                      onPress={() => selectProduct(item)}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontWeight: '600', color: colors.text }}>{item.nom}</Text>
                        <Text style={{ color: colors.primary, fontSize: 10 }}>{item.type_produit?.toUpperCase()}</Text>
                      </View>
                      {item.matiere_active && (
                        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>🧪 {item.matiere_active}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* List Section */}
          {orderItems.length > 0 && (
            <View style={[globalStyles.cardLuxury, { marginBottom: 32 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[typography.h2, { color: colors.primary }]}>📋 Commande ({orderItems.length})</Text>
                <TouchableOpacity onPress={() => setOrderItems([])}>
                  <Text style={{ color: colors.danger, fontWeight: '600' }}>Effacer tout</Text>
                </TouchableOpacity>
              </View>
              
              {orderItems.map((item) => (
                <View key={item.id} style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 14,
                  backgroundColor: colors.backgroundAlt,
                  borderRadius: 12,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: colors.text }}>{item.nom}</Text>
                    <Text style={{ color: colors.textSecondary }}>{item.qty} {item.unit}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => removeOrderItem(item.id)}
                    style={{ 
                      backgroundColor: colors.danger, 
                      width: 28, 
                      height: 28, 
                      borderRadius: 14, 
                      justifyContent: 'center', 
                      alignItems: 'center' 
                    }}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              
              <TouchableOpacity 
                style={[globalStyles.button, { marginTop: 16, backgroundColor: colors.success }]} 
                onPress={generatePDF}
                disabled={loading}
              >
                <Text style={globalStyles.buttonText}>
                  {loading ? 'Génération...' : '📄 Générer et Télécharger PDF'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        <Sidebar isVisible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
      </View>
    </TouchableWithoutFeedback>
  )
}