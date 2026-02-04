import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Database from '../../lib/database'
import { globalStyles, typography, colors } from '../../utils/styles'

export default function LoginScreen() {
  const navigation = useNavigation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Veuillez remplir tous les champs')
      return
    }

    setLoading(true)
    setError('')
    
    const result = await Database.loginUser(email, password)
    
    if (result.success) {
      // Navigation will be handled by App.tsx based on auth state
    } else {
      setError(result.error || 'Identifiants incorrects')
    }
    
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🌾</Text>
            <Text style={[typography.h1, { color: colors.primary, textAlign: 'center' }]}>
              AgriManager Pro
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
              Gestion d'exploitation simplifiée
            </Text>
          </View>

          <View style={globalStyles.card}>
            <Text style={[typography.h2, { marginBottom: 24, textAlign: 'center' }]}>
              Connexion
            </Text>

            {error ? (
              <View style={{
                backgroundColor: '#ffebee',
                borderColor: '#ffcdd2',
                borderWidth: 1,
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}>
                <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text>
              </View>
            ) : null}

            <TextInput
              style={globalStyles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <TextInput
              style={globalStyles.input}
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            <TouchableOpacity
              style={[globalStyles.button, { marginTop: 8 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={globalStyles.buttonText}>
                {loading ? 'Connexion...' : 'Se connecter'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Signup' as never)}
              style={{ marginTop: 24, padding: 12 }}
            >
              <Text style={{ color: colors.primary, textAlign: 'center', fontSize: 16 }}>
                Pas de compte ? S'inscrire
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}