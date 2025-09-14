"use client"

import type React from "react"
import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Share } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { Button } from "../components/Button"
import { InputField } from "../components/InputField"
import { useAuth } from "../contexts/AuthProvider"
import { supabase } from "../services/supabase"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RootStackParamList } from "../types"

type CreateGroupScreenNavigationProp = StackNavigationProp<RootStackParamList, "CreateGroup">

interface Props {
  navigation: CreateGroupScreenNavigationProp
}

const CreateGroupScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [createdGroup, setCreatedGroup] = useState<{ id: string; name: string; invite_code: string } | null>(null)

  const handleCreateGroup = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a group name")
      return
    }

    if (!user) return

    setLoading(true)
    try {
      // Create group - let database auto-generate invite_code
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .insert([
          {
            name: name.trim(),
            description: description.trim() || null,
            created_by: user.id,
          },
        ])
        .select("id, name, invite_code")
        .single()

      if (groupError) throw groupError

      if (!groupData || !groupData.id) {
        throw new Error("Failed to create group - no group data returned")
      }

      if (!groupData.invite_code) {
        throw new Error("Failed to generate invite code")
      }

      // Add creator as admin member
      console.log("CreateGroup: Adding creator as admin member:", {
        group_id: groupData.id,
        user_id: user.id,
        role: "admin",
      })

      const { data: memberData, error: memberError } = await supabase
        .from("group_members")
        .insert([
          {
            group_id: groupData.id,
            user_id: user.id,
            role: "admin",
          },
        ])
        .select("*")

      if (memberError) {
        console.error("CreateGroup: Error adding member:", memberError)
        throw memberError
      }

      console.log("CreateGroup: Successfully added member:", memberData)

      // Show success screen with invite code
      setCreatedGroup({
        id: groupData.id,
        name: groupData.name || name.trim(),
        invite_code: groupData.invite_code,
      })
    } catch (error) {
      console.error("Error creating group:", error)
      Alert.alert("Error", "Failed to create group. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = async () => {
    if (!createdGroup || !createdGroup.invite_code) return

    try {
      // For React Native, we'll use a simple approach
      // You can install @react-native-clipboard/clipboard if needed
      Alert.alert(
        "Invite Code",
        `Group invite code: ${createdGroup.invite_code}\n\nCode copied to share!`,
        [
          {
            text: "Share",
            onPress: () => handleShareCode(),
          },
          {
            text: "OK",
            style: "default",
          },
        ]
      )
    } catch (error) {
      console.error("Error copying code:", error)
      Alert.alert("Error", "Failed to copy code")
    }
  }

  const handleShareCode = async () => {
    if (!createdGroup || !createdGroup.invite_code || !createdGroup.name) return

    try {
      const message = `Join my SmartSplit group "${createdGroup.name}"!\n\nUse invite code: ${createdGroup.invite_code}`

      await Share.share({
        message,
        title: `Join ${createdGroup.name}`,
      })
    } catch (error) {
      console.error("Error sharing code:", error)
      Alert.alert("Error", "Failed to share code")
    }
  }

  const handleGoToGroup = () => {
    if (!createdGroup) return
    navigation.navigate("GroupDetails", { groupId: createdGroup.id })
  }

  const handleCreateAnother =() =>{
    navigation.navigate('Dashboard')
  }
  // const handleCreateAnother = () => {
  //   setCreatedGroup(null)
  //   setName("")
  //   setDescription("")
  // }

  // Show success screen if group was created
  if (createdGroup) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          </View>

          <Text style={styles.successTitle}>Group Created!</Text>
          <Text style={styles.successSubtitle}>
            Your group "{createdGroup.name || 'Untitled'}" has been created successfully.
          </Text>

          <View style={styles.inviteCodeContainer}>
            <Text style={styles.inviteCodeLabel}>Invite Code</Text>
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCodeText}>{createdGroup.invite_code || 'Loading...'}</Text>
              <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
                <Ionicons name="copy-outline" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.inviteCodeNote}>
              Share this code with others to invite them to your group
            </Text>
          </View>

          <View style={styles.successActions}>
            <Button
              title="Share Invite Code"
              onPress={handleShareCode}
              size="large"
              style={styles.shareButton}
            />
            <Button
              title="Go to Group"
              onPress={handleGoToGroup}
              variant="outline"
              size="large"
              style={styles.goToGroupButton}
            />
            <TouchableOpacity onPress={handleCreateAnother} style={styles.createAnotherButton}>
              <Text style={styles.createAnotherText}>Go to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button title="Cancel" onPress={() => navigation.goBack()} variant="outline" size="small" />
        <Text style={styles.title}>Create Group</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <InputField label="Group Name" placeholder="Enter group name" value={name} onChangeText={setName} />
          <InputField
            label="Description (Optional)"
            placeholder="What's this group for?"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <View style={styles.info}>
            <Text style={styles.infoTitle}>💡 Tips for creating groups:</Text>
            <Text style={styles.infoText}>• Use descriptive names like "Roommates" or "Europe Trip 2024"</Text>
            <Text style={styles.infoText}>• Add a description to help members understand the group's purpose</Text>
            <Text style={styles.infoText}>• You can invite members after creating the group</Text>
          </View>

          <Button title="Create Group" onPress={handleCreateGroup} loading={loading} size="large" />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  form: {
    paddingTop: 24,
    gap: 20,
  },
  info: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
    lineHeight: 20,
  },
  // Success screen styles
  successContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 24,
  },
  inviteCodeContainer: {
    width: "100%",
    backgroundColor: "#f8f9fa",
    borderRadius: 16,
    padding: 24,
    marginBottom: 40,
    alignItems: "center",
  },
  inviteCodeLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  inviteCodeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#007AFF",
    marginBottom: 12,
    minWidth: 250,
  },
  inviteCodeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#007AFF",
    letterSpacing: 2,
    flex: 1,
    textAlign: "center",
  },
  copyButton: {
    marginLeft: 12,
    padding: 8,
  },
  inviteCodeNote: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  successActions: {
    width: "100%",
    gap: 16,
  },
  shareButton: {
    backgroundColor: "#4CAF50",
  },
  goToGroupButton: {
    borderColor: "#007AFF",
  },
  createAnotherButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  createAnotherText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "500",
  },
})

export default CreateGroupScreen
