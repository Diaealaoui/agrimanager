import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { Picker } from '@react-native-picker/picker'
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
  const prefilledValue = route?.params?.prefilledProduct ?? prefilledProduct ?? ''

  useEffect(() => {
    if (user) {
      loadProducts()
    }
  }, [user])
  
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

  useEffect(() => {
    if (!prefilledValue || products.length === 0) return
    const product = products.find(p => p.nom === prefilledValue)
    if (!product) return
    setSelectedProduct(product.nom)
    setUnit(product.unite_reference || '')
  }, [prefilledValue, products])

  const addOrderItem = () => {
    if (!selectedProduct || !quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Erreur', 'Veuillez sélectionner un produit et saisir une quantité')
      return
    }

    const product = products.find(p => p.nom === selectedProduct)
    if (!product) return

    const newItem = {
      id: Date.now().toString(),
      nom: selectedProduct,
      qty: parseFloat(quantity),
      unit: unit || product.unite_reference || '',
      product_id: product.id,
    }

    setOrderItems([...orderItems, newItem])
    setSelectedProduct('')
    setQuantity('')
    setUnit('')
  }

  const removeOrderItem = (id: string) => {
    setOrderItems(orderItems.filter(item => item.id !== id))
  }

  const clearOrder = () => {
    setOrderItems([])
    setNotes('')
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
          <title>Bon de Commande - ${orderRef}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 40px;
              color: #1a1a2e;
              line-height: 1.6;
              background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            }
            .header { 
              text-align: center;
              margin-bottom: 40px;
              padding: 30px;
              background: linear-gradient(135deg, #1a1a2e 0%, #2d3561 100%);
              border-radius: 20px;
              box-shadow: 0 10px 30px rgba(26, 26, 46, 0.3);
            }
            .title { 
              color: #d4af37;
              font-size: 36px;
              font-weight: bold;
              margin-bottom: 12px;
              text-transform: uppercase;
              letter-spacing: 3px;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .subtitle { 
              color: rgba(255, 255, 255, 0.9);
              font-size: 18px;
              font-weight: 500;
              letter-spacing: 1px;
            }
            .logo-placeholder {
              width: 80px;
              height: 80px;
              margin: 0 auto 20px;
              background: linear-gradient(135deg, #d4af37 0%, #f4e5c2 100%);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 40px;
              box-shadow: 0 5px 15px rgba(212, 175, 55, 0.4);
            }
            .info-section {
              background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
              padding: 25px;
              border-radius: 15px;
              margin-bottom: 30px;
              border-left: 5px solid #d4af37;
              box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            }
            .info-row { 
              display: flex;
              margin-bottom: 12px;
              align-items: center;
            }
            .info-label { 
              font-weight: 700;
              width: 180px;
              color: #1a1a2e;
              letter-spacing: 0.5px;
            }
            .info-value {
              color: #2d3561;
              font-weight: 600;
            }
            .order-ref {
              background: linear-gradient(135deg, #f4e5c2 0%, #d4af37 100%);
              color: #1a1a2e;
              padding: 10px 20px;
              border-radius: 8px;
              font-weight: bold;
              display: inline-block;
              border: 2px solid #d4af37;
              box-shadow: 0 3px 10px rgba(212, 175, 55, 0.3);
              letter-spacing: 1px;
            }
            .table-container {
              margin: 30px 0;
              border-radius: 15px;
              overflow: hidden;
              box-shadow: 0 8px 25px rgba(0,0,0,0.1);
            }
            .table { 
              width: 100%;
              border-collapse: collapse;
            }
            .table thead {
              background: linear-gradient(135deg, #1a1a2e 0%, #2d3561 100%);
            }
            .table th { 
              padding: 18px;
              text-align: left;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 12px;
              letter-spacing: 1.2px;
              color: #d4af37;
              border-bottom: 3px solid #d4af37;
            }
            .table td { 
              padding: 16px 18px;
              border-bottom: 1px solid #e2e8f0;
              background: white;
            }
            .table tbody tr:nth-child(even) td {
              background: #f8fafc;
            }
            .table tbody tr:hover td {
              background: #f4e5c2;
            }
            .table tbody tr:last-child td {
              border-bottom: none;
            }
            .table .row-number {
              width: 60px;
              text-align: center;
              font-weight: 700;
              color: #d4af37;
              font-size: 16px;
            }
            .total-section { 
              text-align: right;
              margin-top: 30px;
              padding: 25px;
              background: linear-gradient(135deg, #f4e5c2 0%, #ffffff 100%);
              border-radius: 15px;
              border: 2px solid #d4af37;
              box-shadow: 0 5px 20px rgba(212, 175, 55, 0.2);
            }
            .total-label {
              font-size: 18px;
              font-weight: 700;
              color: #1a1a2e;
              letter-spacing: 1px;
            }
            .total-value {
              font-size: 28px;
              font-weight: bold;
              color: #d4af37;
              margin-top: 8px;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
            }
            .notes { 
              margin-top: 30px;
              padding: 25px;
              background: linear-gradient(135deg, #fff8e1 0%, #ffffff 100%);
              border-left: 5px solid #f59e0b;
              border-radius: 12px;
              box-shadow: 0 4px 15px rgba(245, 158, 11, 0.1);
            }
            .notes-title {
              font-weight: bold;
              color: #92400e;
              margin-bottom: 12px;
              font-size: 16px;
              letter-spacing: 0.5px;
            }
            .notes-content {
              color: #78350f;
              line-height: 1.8;
            }
            .signature-section {
              margin-top: 60px;
              display: flex;
              justify-content: space-between;
              gap: 40px;
            }
            .signature-box {
              flex: 1;
              border-top: 2px solid #1a1a2e;
              padding-top: 10px;
            }
            .signature-label {
              font-weight: 600;
              color: #1a1a2e;
              margin-bottom: 40px;
            }
            .footer { 
              margin-top: 60px;
              padding-top: 25px;
              border-top: 3px solid #d4af37;
              text-align: center;
              color: #64748b;
              font-size: 12px;
            }
            .footer p {
              margin: 5px 0;
            }
            .footer .company {
              font-weight: 700;
              color: #d4af37;
              font-size: 16px;
              letter-spacing: 1px;
            }
            .footer .tagline {
              color: #1a1a2e;
              font-style: italic;
              margin-top: 10px;
            }
            @media print {
              body {
                padding: 20px;
                background: white;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-placeholder">🌾</div>
            <div class="title">📋 BON DE COMMANDE</div>
            <div class="subtitle">${farmName}</div>
          </div>
          
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">Référence:</span>
              <span class="order-ref">${orderRef}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Fournisseur:</span>
              <span class="info-value">${fournisseur}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date de commande:</span>
              <span class="info-value">${new Date(dateCommande).toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
          </div>
          
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th class="row-number">N°</th>
                  <th>Produit</th>
                  <th style="text-align: right;">Quantité</th>
                  <th>Unité</th>
                </tr>
              </thead>
              <tbody>
                ${orderItems.map((item, index) => `
                  <tr>
                    <td class="row-number">${index + 1}</td>
                    <td style="font-weight: 600; color: #1a1a2e;">${item.nom}</td>
                    <td style="text-align: right; font-weight: 700; color: #d4af37; font-size: 16px;">${item.qty}</td>
                    <td style="color: #64748b;">${item.unit}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="total-section">
            <div class="total-label">Total Articles Commandés</div>
            <div class="total-value">${orderItems.length} produit${orderItems.length > 1 ? 's' : ''}</div>
          </div>
          
          ${notes ? `
            <div class="notes">
              <div class="notes-title">📝 Notes Complémentaires:</div>
              <div class="notes-content">${notes.replace(/\n/g, '<br>')}</div>
            </div>
          ` : ''}
          
          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-label">Signature du Client</div>
              <div style="height: 60px;"></div>
              <div style="font-size: 10px; color: #94a3b8;">Date: _______________</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">Signature du Fournisseur</div>
              <div style="height: 60px;"></div>
              <div style="font-size: 10px; color: #94a3b8;">Date: _______________</div>
            </div>
          </div>
          
          <div class="footer">
            <p style="font-size: 11px; color: #94a3b8;">
              Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
            </p>
            <p class="company">AgriManager Pro</p>
            <p class="tagline">Gestion d'exploitation simplifiée</p>
            <p style="margin-top: 20px; color: #64748b; font-size: 10px;">
              Ce bon de commande est à conserver pour vos archives.<br>
              Valable jusqu'au ${new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString('fr-FR')}
            </p>
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
        'Le bon de commande a été généré avec succès !',
        [
          {
            text: 'OK',
            onPress: () => clearOrder()
          }
        ]
      )
      
    } catch (error) {
      console.error('Error generating PDF:', error)
      Alert.alert('Erreur', 'Impossible de générer le PDF')
    } finally {
      setLoading(false)
    }
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setSidebarVisible(true)}
            style={{ marginRight: 12 }}
          >
            <Text style={{ color: 'white', fontSize: 24 }}>☰</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h1, { color: colors.gold, marginBottom: 4 }]}>
              📄 Bon de Commande
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
              Générez vos bons de commande professionnels
            </Text>
          </View>
        </View>
      </View>
      
      <ScrollView style={{ flex: 1, padding: 20 }}>
        {/* Order Header */}
        <View style={[globalStyles.cardLuxury, { marginBottom: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 24, marginRight: 8 }}>📋</Text>
            <Text style={[typography.h3, { color: colors.primary }]}>Informations de Commande</Text>
          </View>
          
          <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
            Fournisseur *
          </Text>
          <TextInput
            style={[globalStyles.input, { marginBottom: 16 }]}
            placeholder="Nom du fournisseur"
            value={fournisseur}
            onChangeText={setFournisseur}
            placeholderTextColor={colors.textLight}
          />
          
          <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
            Date de Commande *
          </Text>
          <TextInput
            style={[globalStyles.input, { marginBottom: 16 }]}
            value={dateCommande}
            onChangeText={setDateCommande}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={colors.textLight}
          />
          
          <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
            Notes (Optionnel)
          </Text>
          <TextInput
            style={[globalStyles.input, { minHeight: 100, textAlignVertical: 'top' }]}
            placeholder="Informations supplémentaires, conditions de livraison, etc..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholderTextColor={colors.textLight}
          />
        </View>

        {/* Add Product */}
        <View style={[globalStyles.card, { marginBottom: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 24, marginRight: 8 }}>📦</Text>
            <Text style={[typography.h3, { color: colors.primary }]}>Ajouter un Produit</Text>
          </View>
          
          <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
            Produit *
          </Text>
          <View style={{ 
            backgroundColor: colors.backgroundAlt, 
            borderRadius: 12, 
            borderWidth: 2, 
            borderColor: colors.border,
            marginBottom: 16,
          }}>
            <Picker
              selectedValue={selectedProduct}
              onValueChange={(value) => {
                setSelectedProduct(value)
                const product = products.find(p => p.nom === value)
                if (product) {
                  setUnit(product.unite_reference || '')
                }
              }}
              style={{ color: colors.text }}
            >
              <Picker.Item label="Sélectionner un produit" value="" />
              {products.map(p => (
                <Picker.Item key={p.id} label={p.nom} value={p.nom} />
              ))}
            </Picker>
          </View>
          
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                Quantité *
              </Text>
              <TextInput
                style={globalStyles.input}
                placeholder="Quantité"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholderTextColor={colors.textLight}
              />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { marginBottom: 8, color: colors.text, fontWeight: '600' }]}>
                Unité
              </Text>
              <TextInput
                style={globalStyles.input}
                placeholder="Unité"
                value={unit}
                onChangeText={setUnit}
                placeholderTextColor={colors.textLight}
              />
            </View>
          </View>
          
          <TouchableOpacity
            style={[globalStyles.buttonGold, { marginTop: 16 }]}
            onPress={addOrderItem}
          >
            <Text style={globalStyles.buttonText}>➕ Ajouter à la Commande</Text>
          </TouchableOpacity>
        </View>

        {/* Order Items */}
        {orderItems.length > 0 && (
          <View style={[globalStyles.cardLuxury, { marginBottom: 32 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[typography.h2, { color: colors.primary }]}>
                📋 Commande ({orderItems.length})
              </Text>
              <TouchableOpacity onPress={clearOrder}>
                <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '600' }}>Effacer tout</Text>
              </TouchableOpacity>
            </View>
            
            {orderItems.map((item) => (
              <View key={item.id} style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                marginBottom: 10,
                backgroundColor: colors.backgroundAlt,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { fontWeight: '600', color: colors.text }]}>
                    {item.nom}
                  </Text>
                  <Text style={[typography.small, { color: colors.textSecondary, marginTop: 2 }]}>
                    {item.qty} {item.unit}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  onPress={() => removeOrderItem(item.id)}
                  style={{
                    backgroundColor: colors.danger,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            
            <TouchableOpacity
              style={[globalStyles.button, { 
                marginTop: 16,
                backgroundColor: loading ? colors.textLight : colors.success,
                ...shadows.md,
              }]}
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

      <Sidebar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
      />
    </View>
  )
}