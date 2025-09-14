"use client"

import type React from "react"
import { useState } from "react"
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button } from "../components/Button"
import { InputField } from "../components/InputField"
import { useAuth } from "../contexts/AuthProvider"
import { supabase } from "../services/supabase"
import { notificationService } from "../services/notificationService"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RootStackParamList } from "../types"

type JoinGroupScreenNavigationProp = StackNavigationProp<RootStackParamList, "JoinGroup">

interface Props {
  navigation: JoinGroupScreenNavigationProp
}

const JoinGroupScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth()
  const [inviteCode, setInviteCode] = useState("")
  const [loading, setLoading] = useState(false)

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      Alert.alert("Error", "Please enter an invite code")
      return
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to join a group")
      return
    }

    setLoading(true)
    try {
      console.log("JoinGroup: Looking up invite code:", inviteCode.trim())

      // Find group by invite code
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("invite_code", inviteCode.trim().toLowerCase())
        .single()

      if (groupError) {
        console.log("JoinGroup: Group lookup error:", groupError)
        if (groupError.code === "PGRST116") {
          Alert.alert("Invalid Code", "This invite code doesn't exist. Please check the code and try again.")
        } else {
          Alert.alert("Error", "Failed to lookup group. Please try again.")
        }
        return
      }

      if (!groupData) {
        Alert.alert("Invalid Code", "This invite code doesn't exist. Please check the code and try again.")
        return
      }

      console.log("JoinGroup: Found group:", groupData.name)

      // Check if user is already a member
      const { data: existingMember, error: memberCheckError } = await supabase
        .from("group_members")
        .select("id, role")
        .eq("group_id", groupData.id)
        .eq("user_id", user.id)
        .single()

      if (memberCheckError && memberCheckError.code !== "PGRST116") {
        console.log("JoinGroup: Member check error:", memberCheckError)
        throw memberCheckError
      }

      if (existingMember) {
        console.log("JoinGroup: User already a member with role:", existingMember.role)
        Alert.alert(
          "Already a Member",
          `You are already a ${existingMember.role} of "${groupData.name}".`,
          [
            {
              text: "View Group",
              onPress: () => navigation.navigate("GroupDetails", { groupId: groupData.id }),
            },
            { text: "OK", style: "cancel" }
          ]
        )
        return
      }

      console.log("JoinGroup: Adding user as member to group")

      // Add user to group as member
      const { error: joinError } = await supabase.from("group_members").insert([
        {
          group_id: groupData.id,
          user_id: user.id,
          role: "member",
        },
      ])

      if (joinError) {
        console.log("JoinGroup: Insert error:", joinError)
        throw joinError
      }

      console.log("JoinGroup: Successfully joined group")

      // Notify existing group members about the new member
      try {
        await notificationService.notifyUserJoinedGroup(
          groupData.id,
          groupData.name,
          user.name || "Unknown User",
          user.id
        )
        console.log("JoinGroup: Notifications sent to existing members")
      } catch (notificationError) {
        console.error("JoinGroup: Failed to send notifications:", notificationError)
        // Don't fail the join process if notifications fail
      }

      // Clear the input field
      setInviteCode("")

      Alert.alert(
        "Welcome to the Group! 🎉",
        `You've successfully joined "${groupData.name}". You can now view bills, add expenses, and chat with other members.`,
        [
          {
            text: "View Group",
            onPress: () => navigation.navigate("GroupDetails", { groupId: groupData.id }),
          },
          {
            text: "Go to Dashboard",
            onPress: () => navigation.navigate("Dashboard"),
          }
        ]
      )
    } catch (error) {
      console.error("JoinGroup: Unexpected error:", error)
      Alert.alert("Error", "Failed to join group. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button title="Cancel" onPress={() => navigation.goBack()} variant="outline" size="small" />
        <Text style={styles.title}>Join Group</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.illustration}>
            <Text style={styles.emoji}>🎉</Text>
            <Text style={styles.illustrationTitle}>Join a Group</Text>
            <Text style={styles.illustrationText}>
              Enter the invite code shared by a group member to join their group
            </Text>
          </View>

          <InputField
            label="Invite Code"
            placeholder="e.g. abc123de"
            value={inviteCode}
            onChangeText={(text) => setInviteCode(text.toLowerCase().trim())}
          />

          <Button
            title={loading ? "Joining..." : "Join Group"}
            onPress={handleJoinGroup}
            loading={loading}
            size="large"
            disabled={!inviteCode.trim() || loading}
          />

          <View style={styles.info}>
            <Text style={styles.infoTitle}>💡 How to get an invite code:</Text>
            <Text style={styles.infoText}>• Ask a group member to share the invite code</Text>
            <Text style={styles.infoText}>• Group admins can find the code in Group Details</Text>
            <Text style={styles.infoText}>• Codes are 8 characters long (e.g. abc123de)</Text>
            <Text style={styles.infoText}>• Each group has a unique invite code</Text>
            <Text style={styles.infoText}>• You'll become a member (not admin) when joining</Text>
          </View>
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
  illustration: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  illustrationTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  illustrationText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  info: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
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
})

export default JoinGroupScreen
