import React, { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import { Button } from "../components/Button"
import { InputField } from "../components/InputField"
import { useAuth } from "../contexts/AuthProvider"
import { supabase } from "../services/supabase"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RootStackParamList, User } from "../types"

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, "Profile">

interface Props {
  navigation: ProfileScreenNavigationProp
}

export default function ProfileScreen({ navigation }: Props) {
  const { user, signOut, refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [displayName, setDisplayName] = useState(user?.name || "")
  const [currency, setCurrency] = useState("USD")
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || "")
  const [upiId, setUpiId] = useState(user?.upi_id || "")
  const [nameError, setNameError] = useState("")
  const [upiError, setUpiError] = useState("")

  useEffect(() => {
    if (user) {
      setDisplayName(user.name)
      setAvatarUrl(user.avatar || "")
      setUpiId(user.upi_id || "")
      // You can add currency fetching from user preferences here
    }
  }, [user])

  const validateName = (name: string): boolean => {
    if (!name.trim()) {
      setNameError("Display name is required")
      return false
    }
    if (name.trim().length < 2) {
      setNameError("Display name must be at least 2 characters")
      return false
    }
    setNameError("")
    return true
  }

  const validateUpiId = (upi: string): boolean => {
    // UPI ID is optional, so empty is valid
    if (!upi.trim()) {
      setUpiError("")
      return true
    }

    // If provided, must contain @ symbol (basic UPI format validation)
    if (!upi.includes("@")) {
      setUpiError("UPI ID must contain @ (e.g., name@bank)")
      return false
    }

    setUpiError("")
    return true
  }

  const handleUpdateProfile = async () => {
    if (!validateName(displayName)) return
    if (!validateUpiId(upiId)) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("users")
        .upsert({
          id: user?.id,
          email: user?.email,
          name: displayName.trim(),
          avatar: avatarUrl || null,
          upi_id: upiId.trim() || null,
        })
        .select()

      if (error) {
        console.error("Profile update error:", error)
        Alert.alert("Update Error", `Failed to update profile: ${error.message}`)
        return
      }

      if (!data || data.length === 0) {
        Alert.alert("Warning", "Update completed but no data returned.")
        return
      }

      Alert.alert("Success", "Profile updated successfully!")
      
      // Refresh user data in context to reflect changes immediately
      await refreshUser()

    } catch (error) {
      console.error("Error updating profile:", error)
      Alert.alert("Error", `Failed to update profile: ${(error as Error).message || 'Please try again.'}`)
    } finally {
      setLoading(false)
    }
  }

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera roll permissions to upload an avatar.")
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // Enable basic cropping for avatar upload (Profile only)
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri)
      }
    } catch (error) {
      console.error("Error picking image:", error)
      Alert.alert("Error", "Failed to pick image. Please try again.")
    }
  }

  const uploadAvatar = async (uri: string) => {
    setUploading(true)
    try {
      const fileExt = uri.split(".").pop()
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`
      const filePath = fileName

      console.log("Uploading to avatars bucket:", filePath)
      console.log("File URI:", uri)

      // Read the file as ArrayBuffer for React Native
      const response = await fetch(uri)
      if (!response.ok) {
        throw new Error(`Failed to read file: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const fileData = new Uint8Array(arrayBuffer)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, fileData, {
          contentType: `image/${fileExt}`,
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        console.error("Upload error:", uploadError)
        throw uploadError
      }

      console.log("Upload successful:", uploadData)

      // Get public URL
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath)

      console.log("Public URL:", data.publicUrl)

      // Update the avatar URL in the database
      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar: data.publicUrl })
        .eq("id", user?.id)

      if (updateError) {
        console.error("Error updating avatar in database:", updateError)
        Alert.alert("Warning", "Avatar uploaded but failed to save to profile. Please try updating your profile.")
        return
      }

      // Update local state
      setAvatarUrl(data.publicUrl)
      Alert.alert("Success", "Avatar uploaded and saved successfully!")
      
      // Refresh user data in context to reflect changes immediately
      await refreshUser()
    } catch (error) {
      console.error("Error uploading avatar:", error)
      Alert.alert("Error", "Failed to upload avatar. Please try again.")
    } finally {
      setUploading(false)
    }
  }



  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut()
              navigation.navigate("Onboarding")
            } catch (error) {
              console.error("Error signing out:", error)
              Alert.alert("Error", "Failed to logout. Please try again.")
            }
          },
        },
      ]
    )
  }

  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.profileContainer}>

            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <TouchableOpacity style={styles.avatarContainer} onPress={pickImage} disabled={uploading}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={40} color="#666" />
                  </View>
                )}
                <View style={styles.avatarEditIcon}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
              </TouchableOpacity>
              <Text style={styles.avatarText}>
                {uploading ? "Uploading..." : "Tap to change avatar"}
              </Text>
            </View>

            {/* Profile Form */}
            <View style={styles.formContainer}>
              <View style={styles.form}>
                <InputField
                  label="Display Name"
                  placeholder="Enter your display name"
                  value={displayName}
                  onChangeText={(text) => {
                    setDisplayName(text)
                    if (nameError) setNameError("")
                  }}
                  error={nameError}
                />

                <View style={styles.emailContainer}>
                  <Text style={styles.emailLabel}>Email</Text>
                  <View style={styles.emailField}>
                    <Text style={styles.emailText}>{user?.email || ""}</Text>
                    <Text style={styles.emailNote}>Email cannot be changed</Text>
                  </View>
                </View>

                <InputField
                  label="UPI ID (Optional)"
                  placeholder="Enter your UPI ID(e.g:name@bank)"
                  value={upiId}
                  onChangeText={(text) => {
                    setUpiId(text)
                    if (upiError) setUpiError("")
                  }}
                  error={upiError}
                />

                <View style={styles.currencySection}>
                  <Text style={styles.currencyLabel}>Preferred Currency</Text>
                  <View style={styles.currencyContainer}>
                    <Text style={styles.currencyValue}>INR (₹)</Text>
                    <Text style={styles.currencyNote}>Currency settings coming soon</Text>
                  </View>
                </View>

                <Button
                  title="Update Profile"
                  onPress={handleUpdateProfile}
                  loading={loading}
                  size="large"
                  style={styles.updateButton}
                />
              </View>
            </View>

            {/* Logout Section */}
            <View style={styles.logoutSection}>
              <Button
                title="Logout"
                onPress={handleLogout}
                variant="outline"
                size="large"
                style={styles.logoutButton}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 50,
  },
  content: {
    flex: 1,
  },
  profileContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  avatarEditIcon: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#007AFF",
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
  },
  formContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  form: {
    gap: 20,
  },
  emailContainer: {
    marginTop: 8,
  },
  emailLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emailField: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  emailText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 4,
  },
  emailNote: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  currencySection: {
    marginTop: 8,
  },
  currencyLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  currencyContainer: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e1e5e9",
  },
  currencyValue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  currencyNote: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  updateButton: {
    marginTop: 8,
  },
  logoutSection: {
    marginTop: 16,
  },
  logoutButton: {
    borderColor: "rgba(255, 255, 255, 0.8)",
  },

})
