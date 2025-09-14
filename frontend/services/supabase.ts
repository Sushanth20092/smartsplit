import { createClient } from "@supabase/supabase-js"
import AsyncStorage from "@react-native-async-storage/async-storage"
import "react-native-url-polyfill/auto"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://iwmfgqbefohahylkhsrf.supabase.co"
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bWZncWJlZm9oYWh5bGtoc3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MTQzODEsImV4cCI6MjA2OTE5MDM4MX0.SzTGPDAEm6sBvTj6zPjkob-3WcGjMAVCwioip5LxLg8"

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})


