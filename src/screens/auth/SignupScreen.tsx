import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Database from '../../lib/database'
import { globalStyles, typography, colors } from '../../utils/styles'

export default function SignupScreen() {
  const navigation = useNavigation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      setError('Veuillez remplir tous les champs')
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    
    const result = await Database.createUser(email, password)
    
    if (result.success) {
      setSuccess('Compte créé avec succès ! Vous pouvez maintenant vous connecter.')
      setTimeout(() => {
        navigation.goBack()
      }, 2000)
    } else {
      setError(result.error || "Erreur lors de l'inscription")
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
              Créer un compte
            </Text>
          </View>

          <View style={globalStyles.card}>
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

            {success ? (
              <View style={{
                backgroundColor: '#e8f5e9',
                borderColor: '#c8e6c9',
                borderWidth: 1,
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}>
                <Text style={{ color: colors.success, textAlign: 'center' }}>{success}</Text>
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
              placeholder="Mot de passe (6 caractères minimum)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password-new"
            />

            <TextInput
              style={globalStyles.input}
              placeholder="Confirmer le mot de passe"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="password-new"
            />

            <TouchableOpacity
              style={[globalStyles.button, { marginTop: 8 }]}
              onPress={handleSignup}
              disabled={loading}
            >
              <Text style={globalStyles.buttonText}>
                {loading ? 'Création...' : "S'inscrire"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ marginTop: 24, padding: 12 }}
            >
              <Text style={{ color: colors.primary, textAlign: 'center', fontSize: 16 }}>
                ← Retour à la connexion
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}