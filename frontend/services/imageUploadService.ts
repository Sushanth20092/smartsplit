import { supabase } from '../services/supabase'

export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

export class ImageUploadService {
  private static instance: ImageUploadService
  
  public static getInstance(): ImageUploadService {
    if (!ImageUploadService.instance) {
      ImageUploadService.instance = new ImageUploadService()
    }
    return ImageUploadService.instance
  }

  async uploadBillImage(imageUri: string): Promise<UploadResult> {
    try {
      console.log('ImageUploadService: Starting upload for:', imageUri)
      
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('ImageUploadService: Authentication error:', authError)
        return { success: false, error: 'User not authenticated' }
      }

      console.log('ImageUploadService: User authenticated:', user.id)

      // Generate unique filename
      const timestamp = Date.now()
      const fileName = `bill_${user.id}_${timestamp}.jpg`
      
      console.log('ImageUploadService: Generated filename:', fileName)

      // Convert image URI to byte array (more reliable for RN/Expo uploads)
      let bytes: Uint8Array
      const contentType = 'image/jpeg'

      try {
        console.log('ImageUploadService: Fetching image data...')
        const response = await fetch(imageUri)
        
        if (!response.ok) {
          console.error('ImageUploadService: Fetch failed:', response.status, response.statusText)
          return { success: false, error: `Failed to fetch file: ${response.status} ${response.statusText}` }
        }
        
        const arrayBuffer = await response.arrayBuffer()
        bytes = new Uint8Array(arrayBuffer)
        console.log('ImageUploadService: File converted to bytes, size:', bytes.length, 'type:', contentType)
        
      } catch (fetchError: any) {
        console.error('ImageUploadService: Fetch error:', fetchError)
        return { success: false, error: `Failed to read image file: ${fetchError.message}` }
      }

      // Check file size (50MB limit)
      if (bytes.length > 52428800) {
        return { success: false, error: 'File size exceeds 50MB limit' }
      }

      // Check if file is empty
      if (bytes.length === 0) {
        return { success: false, error: 'File is empty' }
      }

      // Upload to Supabase Storage
      console.log('ImageUploadService: Uploading to Supabase storage...')
      const { data, error } = await supabase.storage
        .from('bills')
        .upload(fileName, bytes, {
          cacheControl: '3600',
          upsert: false,
          contentType: contentType
        })

      if (error) {
        console.error('ImageUploadService: Supabase storage error:', error)
        return { success: false, error: `Storage upload failed: ${error.message}` }
      }

      console.log('ImageUploadService: Upload successful:', data)

      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('bills')
        .getPublicUrl(fileName)

      if (!publicUrlData.publicUrl) {
        return { success: false, error: 'Failed to generate public URL' }
      }

      console.log('ImageUploadService: Public URL generated:', publicUrlData.publicUrl)

      return {
        success: true,
        url: publicUrlData.publicUrl
      }

    } catch (error: any) {
      console.error('ImageUploadService: Unexpected error:', error)
      return {
        success: false,
        error: error.message || 'Unknown upload error'
      }
    }
  }

  async deleteImage(fileName: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from('bills')
        .remove([fileName])

      if (error) {
        console.error('ImageUploadService: Delete error:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('ImageUploadService: Delete error:', error)
      return false
    }
  }
}

export const imageUploadService = ImageUploadService.getInstance()