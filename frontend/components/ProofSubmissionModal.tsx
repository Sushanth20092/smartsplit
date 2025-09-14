"use client"

import React, { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import { Button } from "./Button"
import { supabase } from "../services/supabase"

interface ProofSubmissionModalProps {
  visible: boolean
  onClose: () => void
  onSubmit: (proof: { screenshot?: string; referenceId?: string }) => Promise<void>
  billTitle: string
  amount: number
  isResubmission?: boolean
  existingProof?: {
    upi_reference?: string
    upi_screenshot_url?: string
  }
  // When true, disable cropping/editing in the image picker
  disableCrop?: boolean
}

export const ProofSubmissionModal: React.FC<ProofSubmissionModalProps> = ({
  visible,
  onClose,
  onSubmit,
  billTitle,
  amount,
  isResubmission = false,
  existingProof,
  disableCrop = false,
}) => {
  const [referenceId, setReferenceId] = useState(existingProof?.upi_reference || "")
  const [screenshot, setScreenshot] = useState<string | null>(existingProof?.upi_screenshot_url || null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleImagePicker = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant camera roll permissions to upload payment proof.")
        return
      }

      const supportsNewMediaType = (ImagePicker as any).MediaType && typeof (ImagePicker as any).MediaType.Images !== 'undefined'
      const pickerOptions: any = {
        // Use prop to control cropping/editing
        allowsEditing: !disableCrop ? true : false,
        // Only pass aspect if editing is enabled (Expo ignores when false, but keep explicit)
        aspect: !disableCrop ? [4, 3] : undefined,
        quality: 0.8,
      }
      if (supportsNewMediaType) {
        pickerOptions.mediaTypes = [(ImagePicker as any).MediaType.Images]
      } else {
        pickerOptions.mediaTypes = (ImagePicker as any).MediaTypeOptions?.Images ?? ImagePicker.MediaTypeOptions.Images
      }

      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions)

      if (!result.canceled && result.assets[0]) {
        setUploading(true)
        const asset = result.assets[0]
        const localUri = asset.uri
        try {
          // Ensure user session
          const { data: { user }, error: authError } = await supabase.auth.getUser()
          if (authError || !user) {
            throw new Error('User not authenticated')
          }

          // Determine extension and content-type
          const uriLower = localUri.toLowerCase()
          let ext = 'jpg'
          if (uriLower.endsWith('.png')) ext = 'png'
          else if (uriLower.endsWith('.jpeg') || uriLower.endsWith('.jpg')) ext = 'jpg'
          else if (uriLower.endsWith('.webp')) ext = 'webp'
          const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

          // Unique filename in "proof" bucket
          const unique = Math.random().toString(36).slice(2, 8)
          const fileName = `proof_${user.id}_${Date.now()}_${unique}.${ext}`

          // Read file to bytes
          const res = await fetch(localUri)
          if (!res.ok) throw new Error(`Failed to read file: ${res.status}`)
          const arrayBuffer = await res.arrayBuffer()
          const bytes = new Uint8Array(arrayBuffer)
          if (bytes.length === 0) throw new Error('File is empty')
          if (bytes.length > 50 * 1024 * 1024) throw new Error('File size exceeds 50MB limit')

          // Upload
          const { error: uploadError } = await supabase.storage
            .from('proof')
            .upload(fileName, bytes, { contentType, cacheControl: '3600', upsert: false })
          if (uploadError) throw new Error(uploadError.message)

          // Public URL
          const { data: publicUrlData } = supabase.storage.from('proof').getPublicUrl(fileName)
          if (!publicUrlData.publicUrl) throw new Error('Failed to generate public URL')

          // Save the public URL to state (will be persisted to DB on submit)
          setScreenshot(publicUrlData.publicUrl)
        } catch (e: any) {
          console.error('Upload error:', e)
          Alert.alert('Upload failed', e?.message || 'Could not upload image')
        } finally {
          setUploading(false)
        }
      }
    } catch (error) {
      console.error("Error picking image:", error)
      Alert.alert("Error", "Failed to pick image")
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    // Validation: require at least one proof
    if (!screenshot && !referenceId.trim()) {
      Alert.alert(
        "Proof Required",
        "Please provide either a payment screenshot or transaction reference ID to submit proof."
      )
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        screenshot: screenshot || undefined,
        referenceId: referenceId.trim() || undefined,
      })
      
      // Reset form
      setReferenceId("")
      setScreenshot(null)
      onClose()
    } catch (error) {
      console.error("Error submitting proof:", error)
      Alert.alert("Error", "Failed to submit payment proof. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      onClose()
    }
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isResubmission ? "Resubmit Payment Proof" : "Submit Payment Proof"}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              disabled={submitting}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Bill Info */}
            <View style={styles.billInfo}>
              <Text style={styles.billTitle}>{billTitle}</Text>
              <Text style={styles.billAmount}>₹{amount.toFixed(2)}</Text>
            </View>

            {/* Instructions */}
            <View style={styles.instructionsCard}>
              <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
              <Text style={styles.instructionsText}>
                Provide proof of payment by uploading a screenshot or entering the transaction reference ID. 
                At least one is required.
              </Text>
            </View>

            {/* Screenshot Upload */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Screenshot</Text>
              <Text style={styles.sectionSubtitle}>Upload a screenshot of your payment confirmation</Text>
              
              {screenshot ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: screenshot }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setScreenshot(null)}
                    disabled={submitting}
                  >
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleImagePicker}
                  disabled={uploading || submitting}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={24} color="#007AFF" />
                      <Text style={styles.uploadButtonText}>Upload Screenshot</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Reference ID */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transaction Reference ID</Text>
              <Text style={styles.sectionSubtitle}>Enter UPI transaction ID or reference number</Text>
              
              <TextInput
                style={styles.referenceInput}
                placeholder="e.g., 123456789012"
                value={referenceId}
                onChangeText={setReferenceId}
                editable={!submitting}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Validation Message */}
            {!screenshot && !referenceId.trim() && (
              <View style={styles.validationMessage}>
                <Ionicons name="warning-outline" size={16} color="#FF9500" />
                <Text style={styles.validationText}>
                  Please provide either a screenshot or reference ID
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.modalFooter}>
            <Button
              title={isResubmission ? "Resubmit Proof" : "Submit Proof"}
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting || uploading}
              variant="primary"
              style={styles.submitButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  billInfo: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  billAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#007AFF",
  },
  instructionsCard: {
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: "#1976D2",
    marginLeft: 8,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: "#007AFF",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  uploadButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "500",
    marginTop: 8,
  },
  imageContainer: {
    position: "relative",
    alignSelf: "flex-start",
  },
  previewImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
  },
  referenceInput: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
  },
  validationMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3CD",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  validationText: {
    fontSize: 14,
    color: "#856404",
    marginLeft: 8,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  submitButton: {
    width: "100%",
  },
})