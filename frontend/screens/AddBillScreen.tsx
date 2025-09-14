"use client"

import React from "react"
import { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RouteProp } from "@react-navigation/native"
import * as ImagePicker from "expo-image-picker"
import type { RootStackParamList, BillItem, User, ParsedItem } from "../types"
import { useAuth } from "../contexts/AuthProvider"
import { supabase } from "../services/supabase"
import { ocrService } from "../services/ocrService"
import { notificationService } from "../services/notificationService"
import { imageUploadService } from "../services/imageUploadService"
import { InputField } from "../components/InputField"
import { Button } from "../components/Button"
import BillItemParser from "../components/BillItemParser"
import { ImageCropper } from "../components/ImageCropper"
import { Ionicons } from "@expo/vector-icons"

type AddBillScreenNavigationProp = StackNavigationProp<RootStackParamList, "AddBill">
type AddBillScreenRouteProp = RouteProp<RootStackParamList, "AddBill">

const AddBillScreen: React.FC = () => {
  const navigation = useNavigation<AddBillScreenNavigationProp>()
  const route = useRoute<AddBillScreenRouteProp>()
  const { user } = useAuth()
  const { groupId } = route.params

  // Validate groupId parameter
  React.useEffect(() => {
    if (!groupId || groupId.trim() === "") {
      Alert.alert(
        "Group not selected",
        "Please pick a group to add a bill.",
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]
      )
      return
    }
  }, [groupId, navigation])

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tipAmount, setTipAmount] = useState("0")
  const [taxAmount, setTaxAmount] = useState("0")
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
  const [billItems, setBillItems] = useState<BillItem[]>([])
  const [groupMembers, setGroupMembers] = useState<User[]>([])
  const [groupInfo, setGroupInfo] = useState<{ name: string; description?: string } | null>(null)
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  React.useEffect(() => {
    fetchGroupInfo()
    fetchGroupMembers()
  }, [])

  const fetchGroupInfo = async () => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("name, description")
        .eq("id", groupId)
        .single()

      if (error) throw error
      setGroupInfo(data)
    } catch (error) {
      console.error("Error fetching group info:", error)
      // Don't show alert for this as it's not critical
    }
  }

  const fetchGroupMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("group_members")
        .select(`
          user_id,
          users (
            id,
            name,
            email,
            avatar
          )
        `)
        .eq("group_id", groupId)

      if (error) throw error

      const members = data?.map((member: any) => member.users).filter(Boolean) || []
      setGroupMembers(members)
    } catch (error) {
      console.error("Error fetching group members:", error)
      Alert.alert("Error", "Failed to load group members")
    }
  }

  const selectImage = async () => {
    Alert.alert("Select Image", "Choose how to add a receipt", [
      { text: "Camera", onPress: () => openCamera() },
      { text: "Gallery", onPress: () => openGallery() },
      { text: "Cancel", style: "cancel" },
    ])
  }

  // Handle back navigation with confirmation if user has entered data
  const handleBackPress = () => {
    const hasData = title.trim() !== "" || description.trim() !== "" || billItems.length > 0 || imageUri

    if (hasData) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to go back?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: () => navigation.goBack() },
        ]
      )
    } else {
      navigation.goBack()
    }
  }

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to scan receipts")
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    })

    if (!result.canceled) {
      setOriginalImageUri(result.assets[0].uri)
      setShowCropper(true)
    }
  }

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    })

    if (!result.canceled) {
      setOriginalImageUri(result.assets[0].uri)
      setShowCropper(true)
    }
  }

  const handleCropComplete = (croppedImageUri: string) => {
    setShowCropper(false)
    setImageUri(croppedImageUri)
    Alert.alert("Success", "Receipt image uploaded successfully!")
    processImage(croppedImageUri)
  }

  const handleCropCancel = () => {
    setShowCropper(false)
    setOriginalImageUri(null)
  }

  const handleRemoveImage = () => {
    Alert.alert(
      "Remove Image",
      "Are you sure you want to remove this receipt image?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setImageUri(null)
            setOriginalImageUri(null)
            setParsedItems([])
            setBillItems([])
            Alert.alert("Success", "Receipt image removed successfully!")
          },
        },
      ]
    )
  }

  const processImage = async (uri: string) => {
    setOcrLoading(true)
    try {
      console.log("Starting OCR processing for image:", uri)
      const result = await ocrService.processImage(uri)
      console.log("OCR result:", result)

      setParsedItems(result.items)

      if (result.items.length === 0) {
        Alert.alert(
          "No items found",
          "Unable to detect items in the receipt. You can add items manually using the + button below.",
          [{ text: "OK" }]
        )
      } else {
        Alert.alert(
          "Receipt processed!",
          `Found ${result.items.length} item${result.items.length !== 1 ? 's' : ''} from your receipt. Please review and edit the items and prices below.`,
          [{ text: "Got it!" }]
        )
      }
    } catch (error) {
      console.error("OCR processing error:", error)
      Alert.alert(
        "Receipt uploaded",
        "Your receipt image has been saved. Please add items manually using the + button below.",
        [{ text: "OK" }]
      )
    } finally {
      setOcrLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    // Validate bill title
    if (!title.trim()) {
      newErrors.title = "Bill title is required"
    }

    // Validate that at least one item exists
    if (billItems.length === 0) {
      newErrors.items = "At least one item is required"
      setErrors(newErrors)
      return false
    }

    // Validate each bill item
    const itemErrors: string[] = []
    let hasItemErrors = false

    billItems.forEach((item, index) => {
      const itemNumber = index + 1
      
      // Validate item name
      if (!item.name || !item.name.trim()) {
        itemErrors.push(`Item ${itemNumber}: Name cannot be empty`)
        hasItemErrors = true
      }

      // Validate rate/amount - must be ≥ 0
      const rate = item.rate ?? 0 // Use nullish coalescing to handle undefined/null
      
      // Check if rate is a valid number
      if (isNaN(rate)) {
        itemErrors.push(`Item ${itemNumber}: Rate must be a valid number`)
        hasItemErrors = true
      } else if (rate < 0) {
        // Rate must be greater than or equal to zero (≥ 0)
        itemErrors.push(`Item ${itemNumber}: Rate must be zero or positive (≥ 0)`)
        hasItemErrors = true
      }
    })

    // If there are item validation errors, show them
    if (hasItemErrors) {
      const errorMessage = itemErrors.join('\n')
      Alert.alert(
        "Item Validation Error",
        errorMessage,
        [{ text: "OK" }]
      )
      return false
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const saveBill = async () => {
    if (!validateForm()) return
    if (!user) return

    // Validate groupId one more time before saving
    if (!groupId || groupId.trim() === "") {
      Alert.alert("Error", "Invalid group. Please go back and select a group.")
      return
    }

    setLoading(true)
    try {
      let imageUrl = null

      if (imageUri) {
        console.log("Starting image upload process...")
        const uploadResult = await imageUploadService.uploadBillImage(imageUri)

        if (!uploadResult.success) {
          console.error("ERROR Image upload error:", uploadResult.error)
          Alert.alert(
            "Image Upload Failed", 
            `Failed to upload receipt image: ${uploadResult.error}. The bill will be saved without the image.`,
            [{ text: "Continue" }]
          )
          // Continue without image
        } else {
          console.log("Image upload successful:", uploadResult.url)
          imageUrl = uploadResult.url
          console.log("Image URL set to:", imageUrl)
        }
      }

      const totalAmount = billItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

      const { data: billData, error: billError } = await supabase
        .from("bills")
        .insert({
          group_id: groupId,
          created_by: user.id,
          title: title.trim(),
          description: description.trim() || null,
          image_url: imageUrl,
          total_amount: totalAmount,
          tip_amount: Number.parseFloat(tipAmount) || 0,
          tax_amount: Number.parseFloat(taxAmount) || 0,
          status: "draft",
        })
        .select()
        .single()

      if (billError) throw billError

      // Assign all items to all group members by default
      const allMemberIds = groupMembers.map(member => member.id)

      const itemsToInsert = billItems.map((item) => ({
        bill_id: billData.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        assigned_users: allMemberIds,
      }))

      const { error: itemsError } = await supabase.from("bill_items").insert(itemsToInsert)

      if (itemsError) throw itemsError

      // Notify eligible group members about the new bill
      try {
        // Get group name for notification
        const { data: groupData } = await supabase
          .from("groups")
          .select("name")
          .eq("id", groupId)
          .single()

        if (groupData) {
          await notificationService.notifyBillAdded(
            billData.id,
            billData.title,
            groupId,
            groupData.name,
            billData.created_at,
            user.id
          )
          console.log("AddBill: Notifications sent to eligible group members")
        }
      } catch (notificationError) {
        console.error("AddBill: Failed to send notifications:", notificationError)
        // Don't fail the bill creation if notifications fail
      }

      Alert.alert("Success", "Bill created successfully!", [
        {
          text: "OK",
          onPress: () => navigation.navigate("BillSplit", { billId: billData.id }),
        },
      ])
    } catch (error) {
      console.error("Error saving bill:", error)
      Alert.alert("Error", "Failed to save bill. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Bill</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {/* Group Information Display */}
          {groupInfo && (
            <View style={styles.groupInfoSection}>
              <View style={styles.groupInfoHeader}>
                <Ionicons name="people-outline" size={20} color="#007AFF" />
                <Text style={styles.groupInfoTitle}>Adding bill to:</Text>
              </View>
              <Text style={styles.groupName}>{groupInfo.name}</Text>
              {groupInfo.description && (
                <Text style={styles.groupDescription}>{groupInfo.description}</Text>
              )}
            </View>
          )}

          <View style={styles.section}>
            <InputField
              label="Bill Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Enter bill title"
              error={errors.title}
            />

            <InputField
              label="Description (Optional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description"
              multiline
              numberOfLines={3}
            />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <InputField
                  label="Tip Amount"
                  value={tipAmount}
                  onChangeText={setTipAmount}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfField}>
                <InputField
                  label="Tax Amount"
                  value={taxAmount}
                  onChangeText={setTaxAmount}
                  placeholder="0.00"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Receipt Image</Text>
              {!imageUri && (
                <TouchableOpacity onPress={selectImage} style={styles.addImageButton}>
                  <Ionicons name="camera-outline" size={20} color="#007AFF" />
                  <Text style={styles.addImageText}>Add Image</Text>
                </TouchableOpacity>
              )}
            </View>

            {imageUri && (
              <View style={styles.imageContainer}>
                <View style={styles.imageHeader}>
                  <Text style={styles.imageText}>Receipt Image Added</Text>
                  <TouchableOpacity 
                    onPress={handleRemoveImage} 
                    style={styles.removeImageButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.thumbnailContainer}>
                  <Image source={{ uri: imageUri }} style={styles.thumbnail} />
                  {ocrLoading && (
                    <View style={styles.ocrLoadingOverlay}>
                      <ActivityIndicator size="small" color="#007AFF" />
                      <Text style={styles.ocrLoadingText}>Processing...</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <BillItemParser items={parsedItems} onItemsChange={setBillItems} />
            {errors.items && <Text style={styles.errorText}>{errors.items}</Text>}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Save & Continue"
            onPress={saveBill}
            loading={loading}
            disabled={loading || ocrLoading}
            variant="primary"
          />
        </View>

        {/* Image Cropper Modal */}
        <ImageCropper
          visible={showCropper}
          imageUri={originalImageUri || ""}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: "#FFFFFF",
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  addImageButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  addImageText: {
    fontSize: 16,
    color: "#007AFF",
    marginLeft: 4,
  },
  imageContainer: {
    padding: 16,
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
  },
  imageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  imageText: {
    fontSize: 16,
    color: "#1C1C1E",
    fontWeight: "500",
  },
  removeImageButton: {
    padding: 4,
  },
  thumbnailContainer: {
    position: "relative",
    alignItems: "center",
  },
  thumbnail: {
    width: 120,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#E5E5EA",
    borderWidth: 1,
    borderColor: "#D1D1D6",
  },
  ocrLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  ocrLoadingText: {
    fontSize: 12,
    color: "#007AFF",
    marginTop: 4,
    fontWeight: "500",
  },
  row: {
    flexDirection: "row",
    marginHorizontal: -8,
  },
  halfField: {
    flex: 1,
    marginHorizontal: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#FF3B30",
    marginTop: 8,
  },
  footer: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  groupInfoSection: {
    backgroundColor: "#F8F9FA",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  groupInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  groupInfoTitle: {
    fontSize: 14,
    color: "#8E8E93",
    marginLeft: 8,
    fontWeight: "500",
  },
  groupName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: "#8E8E93",
    lineHeight: 18,
  },
})

export default AddBillScreen
