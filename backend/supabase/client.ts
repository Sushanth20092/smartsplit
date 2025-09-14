
import { createClient } from "@supabase/supabase-js"
import AsyncStorage from "@react-native-async-storage/async-storage"

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://iwmfgqbefohahylkhsrf.supabase.co"
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bWZncWJlZm9oYWh5bGtoc3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MTQzODEsImV4cCI6MjA2OTE5MDM4MX0.SzTGPDAEm6sBvTj6zPjkob-3WcGjMAVCwioip5LxLg8"

console.log("Supabase URL:", supabaseUrl)
console.log("Supabase Key:", supabaseAnonKey)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Upload image to Supabase Storage
export const uploadImage = async (uri: string, bucket: string, fileName: string) => {
  try {
    console.log('Starting image upload:', { uri, bucket, fileName })
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Authentication error:', authError)
      throw new Error('User not authenticated')
    }
    
    console.log('User authenticated:', user.id)

    // For React Native, we need to handle the file differently
    let fileData: any
    
    if (uri.startsWith('file://') || uri.startsWith('content://')) {
      // React Native local file
      const response = await fetch(uri)
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
      }
      fileData = await response.blob()
      console.log('File converted to blob, size:', fileData.size)
    } else {
      // Web or other platforms
      const response = await fetch(uri)
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
      }
      fileData = await response.blob()
      console.log('File converted to blob, size:', fileData.size)
    }

    // Check file size (50MB limit)
    if (fileData.size > 52428800) {
      throw new Error('File size exceeds 50MB limit')
    }

    console.log('Uploading to Supabase storage...')
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, fileData, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg'
      })

    if (error) {
      console.error('Supabase storage error:', error)
      throw error
    }

    console.log('Upload successful:', data)

    // Get the public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName)

    console.log('Public URL generated:', publicUrlData.publicUrl)

    return { 
      data: {
        ...data,
        publicUrl: publicUrlData.publicUrl
      }, 
      error: null 
    }
  } catch (error) {
    console.error('Upload error:', error)
    return { data: null, error }
  }
}




