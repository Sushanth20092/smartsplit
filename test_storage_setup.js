const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://iwmfgqbefohahylkhsrf.supabase.co"
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bWZncWJlZm9oYWh5bGtoc3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MTQzODEsImV4cCI6MjA2OTE5MDM4MX0.SzTGPDAEm6sBvTj6zPjkob-3WcGjMAVCwioip5LxLg8"

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testStorageSetup() {
  console.log('Testing Supabase Storage Setup...')
  console.log('URL:', supabaseUrl)
  console.log('Key:', supabaseAnonKey.substring(0, 20) + '...')
  
  try {
    // Test 1: List buckets
    console.log('\n1. Testing bucket access...')
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('❌ Error listing buckets:', bucketsError)
    } else {
      console.log('✅ Buckets found:', buckets.map(b => b.name))
      
      // Check if bills bucket exists
      const billsBucket = buckets.find(b => b.name === 'bills')
      if (billsBucket) {
        console.log('✅ Bills bucket exists:', billsBucket)
      } else {
        console.log('❌ Bills bucket not found')
      }
    }
    
    // Test 2: Test authentication
    console.log('\n2. Testing authentication...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.log('❌ No authenticated user found')
      console.log('Note: This is expected if running without authentication')
    } else {
      console.log('✅ User authenticated:', user.id)
    }
    
    // Test 3: Test storage policies (this will fail without auth, but shows the error)
    console.log('\n3. Testing storage upload (without auth)...')
    const testBlob = new Blob(['test'], { type: 'text/plain' })
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('bills')
      .upload('test.txt', testBlob)
    
    if (uploadError) {
      console.log('❌ Upload error (expected without auth):', uploadError.message)
      
      // Check if it's a policy error vs other errors
      if (uploadError.message.includes('policy')) {
        console.log('✅ Storage policies are working (blocking unauthenticated access)')
      } else if (uploadError.message.includes('bucket')) {
        console.log('❌ Bucket configuration issue')
      } else {
        console.log('❌ Other storage error:', uploadError.message)
      }
    } else {
      console.log('✅ Upload successful (unexpected without auth):', uploadData)
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testStorageSetup()