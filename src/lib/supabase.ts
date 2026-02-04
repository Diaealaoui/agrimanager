import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Your existing Supabase credentials
const supabaseUrl = 'https://hbflvodxpaobqvivqgln.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiZmx2b2R4cGFvYnF2aXZxZ2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MjIwMDQsImV4cCI6MjA4MzI5ODAwNH0.qMAoVL9-RQCr56uvbCuNMKJJ3fRyYzaL4S75pNRHvoo'

// Create Supabase client with AsyncStorage for mobile
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})