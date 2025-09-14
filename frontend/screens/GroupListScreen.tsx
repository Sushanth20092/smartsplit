"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Share } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { Button } from "../components/Button"
import { GroupCard } from "../components/GroupCard"
import { useAuth } from "../contexts/AuthProvider"
import { supabase } from "../services/supabase"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RootStackParamList, Group } from "../types"
import { useRoute, type RouteProp } from "@react-navigation/native"

type GroupListScreenNavigationProp = StackNavigationProp<RootStackParamList, "GroupList">

interface Props {
  navigation: GroupListScreenNavigationProp
}

const GroupListScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth()
  const route = useRoute<RouteProp<RootStackParamList, 'GroupList'>>()
  const [groups, setGroups] = useState<Group[]>(() => (route.params?.initialGroups as Group[] | undefined) || [])
  const [loading, setLoading] = useState(groups.length === 0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    // If we already have initial groups, render instantly and refresh in background
    if (groups.length > 0) {
      // Background refresh to ensure latest data
      fetchGroups()
    } else {
      // No initial data passed, fetch normally
      fetchGroups()
    }
  }, [])

  const fetchGroups = async () => {
    if (!user) {
      console.log("GroupList: No user found, skipping group fetch")
      return
    }

    console.log("GroupList: Fetching groups for user:", user.id)

    try {
      // First, let's check if user has any group_members entries
      const { data: memberCheck, error: memberCheckError } = await supabase
        .from("group_members")
        .select("*")
        .eq("user_id", user.id)

      console.log("GroupList: User's group_members entries:", memberCheck)
      if (memberCheckError) {
        console.error("GroupList: Error checking group_members:", memberCheckError)
      }

      // Also check if user created any groups
      const { data: createdGroups, error: createdError } = await supabase
        .from("groups")
        .select("*")
        .eq("created_by", user.id)

      console.log("GroupList: Groups created by user:", createdGroups)
      if (createdError) {
        console.error("GroupList: Error checking created groups:", createdError)
      }

      const { data, error } = await supabase
        .from("group_members")
        .select(`
          groups (
            id,
            name,
            description,
            created_by,
            created_at,
            total_expenses,
            invite_code,
            group_members (
              id,
              user_id,
              role,
              users (
                id,
                name,
                email
              )
            )
          )
        `)
        .eq("user_id", user.id)

      if (error) {
        console.error("GroupList: Error fetching groups:", error)
        throw error
      }

      console.log("GroupList: Raw group_members data:", data)

      const groupsData =
        data
          ?.map((item: any) => {
            if (!item.groups) return null
            const group = item.groups
            return {
              id: group.id,
              name: group.name,
              description: group.description,
              created_by: group.created_by,
              created_at: group.created_at,
              total_expenses: group.total_expenses,
              invite_code: group.invite_code,
              members: group.group_members?.map((member: any) => ({
                ...member,
                user: member.users,
              })) || [],
            }
          })
          .filter(Boolean) || []

      setGroups(groupsData as Group[])
    } catch (error) {
      console.error("Error fetching groups:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchGroups()
  }

  const debugDatabaseState = async () => {
    if (!user) return

    console.log("=== DATABASE DEBUG START ===")
    console.log("Current user:", user.id)

    try {
      // Check all groups with error details
      const { data: allGroups, error: groupsError } = await supabase.from("groups").select("*")
      console.log("All groups in database:", allGroups)
      if (groupsError) console.error("Groups query error:", groupsError)

      // Check all group_members with error details
      const { data: allMembers, error: membersError } = await supabase.from("group_members").select("*")
      console.log("All group_members in database:", allMembers)
      if (membersError) console.error("Group_members query error:", membersError)

      // Check user's specific entries with error details
      const { data: userMembers, error: userMembersError } = await supabase
        .from("group_members")
        .select("*")
        .eq("user_id", user.id)
      console.log("User's group_members entries:", userMembers)
      if (userMembersError) console.error("User group_members query error:", userMembersError)

      // Check groups created by user
      const { data: userGroups, error: userGroupsError } = await supabase
        .from("groups")
        .select("*")
        .eq("created_by", user.id)
      console.log("Groups created by user:", userGroups)
      if (userGroupsError) console.error("User groups query error:", userGroupsError)

      // Test the exact query used by fetchGroups
      const { data: joinQuery, error: joinError } = await supabase
        .from("group_members")
        .select(`
          groups (
            id,
            name,
            description,
            created_by,
            created_at,
            total_expenses,
            invite_code
          )
        `)
        .eq("user_id", user.id)
      console.log("Join query result (used by fetchGroups):", joinQuery)
      if (joinError) console.error("Join query error:", joinError)

    } catch (error) {
      console.error("Debug error:", error)
    }
    console.log("=== DATABASE DEBUG END ===")
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Groups</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.actions}>
        <Button title="Create Group" onPress={() => navigation.navigate("CreateGroup")} size="medium" />
        <Button title="Join Group" onPress={() => navigation.navigate("JoinGroup")} variant="outline" size="medium" />
        {/* <Button title="Debug DB" onPress={debugDatabaseState} variant="outline" size="small" /> */}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {groups.length > 0 ? (
          groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onPress={() => navigation.navigate("GroupDetails", { groupId: group.id })}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyTitle}>No Groups Yet</Text>
            <Text style={styles.emptyText}>
              Create your first group or join an existing one to start splitting bills with friends!
            </Text>
            <View style={styles.emptyActions}>
              <Button title="Create Your First Group" onPress={() => navigation.navigate("CreateGroup")} size="large" />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    gap: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  emptyActions: {
    width: "100%",
    paddingHorizontal: 40,
  },
})

export default GroupListScreen
