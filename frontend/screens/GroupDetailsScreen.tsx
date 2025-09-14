"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView, RefreshControl } from "react-native"
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RouteProp } from "@react-navigation/native"
import type { RootStackParamList, Group, GroupMember, Bill } from "../types"
import { useAuth } from "../contexts/AuthProvider"
import { supabase } from "../services/supabase"
import { Button } from "../components/Button"
import { Ionicons } from "@expo/vector-icons"
import { formatDate } from "../utils/formatters"
import { billFilterService } from "../services/billFilterService"
import { notificationService } from "../services/notificationService"
import * as Clipboard from "expo-clipboard"

type GroupDetailsScreenNavigationProp = StackNavigationProp<RootStackParamList, "GroupDetails">
type GroupDetailsScreenRouteProp = RouteProp<RootStackParamList, "GroupDetails">

const GroupDetailsScreen: React.FC = () => {
  const navigation = useNavigation<GroupDetailsScreenNavigationProp>()
  const route = useRoute<GroupDetailsScreenRouteProp>()
  const { user } = useAuth()
  const { groupId } = route.params

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "member" | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const hasFetchedData = useRef(false)

  const fetchGroupDetails = async (forceRefresh = false) => {
    if (!user) {
      console.log("No user found, skipping fetch")
      return
    }

    // Skip fetch if we already have data and it's not a forced refresh
    if (!forceRefresh && hasFetchedData.current && !isInitialLoad) {
      console.log("GroupDetails: Skipping fetch - data already loaded")
      return
    }

    try {
      console.log("Fetching group details for groupId:", groupId)
      setError(null)

      // Only show loading on initial load or forced refresh
      if (isInitialLoad || forceRefresh) {
        setLoading(true)
      }

      // Initialize with empty arrays to prevent undefined errors
      if (isInitialLoad) {
        setMembers([])
        setBills([])
      }

      // Fetch group details
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single()

      if (groupError) {
        console.error("Group fetch error:", groupError)
        throw groupError
      }

      console.log("Group data received:", groupData)
      setGroup(groupData)

      // Fetch members with user details (separate queries to avoid foreign key issues)
      console.log("Fetching members for groupId:", groupId)
      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", groupId)
        .order("joined_at", { ascending: true })

      if (membersError) {
        console.error("Members fetch error:", membersError)
        throw membersError
      }

      console.log("Members data received:", membersData)

      // Fetch user details separately
      let membersWithUsers = []
      if (membersData && membersData.length > 0) {
        const userIds = membersData.map(member => member.user_id)
        console.log("Fetching user details for IDs:", userIds)

        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, name, email, avatar")
          .in("id", userIds)

        if (usersError) {
          console.error("Users fetch error:", usersError)
          // Use members without user details
          membersWithUsers = membersData.map(member => ({
            ...member,
            user: {
              id: member.user_id,
              name: "Unknown User",
              email: "",
              avatar: null
            }
          }))
        } else {
          console.log("Users data received:", usersData)
          // Combine members with user data
          membersWithUsers = membersData.map(member => {
            const foundUser = usersData?.find(user => user.id === member.user_id)
            console.log(`Looking for user_id ${member.user_id}, found:`, foundUser)

            return {
              ...member,
              user: foundUser || {
                id: member.user_id,
                name: "Unknown User",
                email: "",
                avatar: null
              }
            }
          })
        }
      }

      console.log("Final members with users:", membersWithUsers)
      setMembers(membersWithUsers || [])

      // Find current user's role
      const currentMember = membersWithUsers?.find((member) => member.user_id === user.id)
      setCurrentUserRole(currentMember?.role || null)

      // Fetch recent bills filtered by user's join date
      try {
        const filteredBills = await billFilterService.fetchGroupBillsForUser(groupId, user.id, 5)
        setBills(filteredBills)
      } catch (billsError) {
        console.log("GroupDetails: Error fetching filtered bills, setting empty array:", billsError)
        setBills([])
      }

      // Mark that we've successfully fetched data
      hasFetchedData.current = true
    } catch (error) {
      console.error("Error fetching group details:", error)
      setError("Failed to load group details. Please try again.")
      setMembers([])
      setBills([])
      Alert.alert("Error", "Failed to load group details")
    } finally {
      setLoading(false)
      setRefreshing(false)
      setIsInitialLoad(false)
    }
  }

  // Reset state when groupId changes
  useEffect(() => {
    hasFetchedData.current = false
    setIsInitialLoad(true)
    setLoading(true)
  }, [groupId])

  // Initial load when component mounts
  useEffect(() => {
    if (user && groupId) {
      fetchGroupDetails()
    }
  }, [user, groupId])

  // Only refresh data when coming back from certain screens that might have changed data
  useFocusEffect(
    useCallback(() => {
      // Only refresh if we're coming back and have already loaded data
      // This prevents unnecessary reloads when navigating to/from chat, etc.
      if (!isInitialLoad && hasFetchedData.current) {
        console.log("GroupDetails: Screen focused - data already loaded, skipping refresh")
        
        // Check if we need to refresh based on route params
        // This allows other screens to signal that data should be refreshed
        const shouldRefresh = route.params?.shouldRefresh
        if (shouldRefresh) {
          console.log("GroupDetails: Refresh requested via params")
          fetchGroupDetails(true)
          // Clear the refresh flag
          navigation.setParams({ shouldRefresh: false })
        }
      }
    }, [isInitialLoad, route.params?.shouldRefresh]),
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchGroupDetails(true) // Force refresh
  }

  // Helper: Check if current user has any unsettled (unpaid) bills in this group
  const hasUnsettledBills = async (gid: string, uid: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("bill_splits")
        .select(`id, paid, bills!inner(id, group_id, status)`) // inner join ensures bill context
        .eq("user_id", uid)
        .eq("paid", false)
        .eq("bills.group_id", gid)
        .in("bills.status", ["pending", "approved"]) // unsettled bills

      if (error) {
        console.error("GroupDetails: error checking unsettled bills:", error)
        return true // fail-safe: block leaving if we cannot verify
      }

      return (data || []).length > 0
    } catch (e) {
      console.error("GroupDetails: exception checking unsettled bills:", e)
      return true // fail-safe
    }
  }

  // Helper: Check if the group has any active (unsettled/pending) bills or outstanding unpaid splits
  const hasActiveGroupBills = async (gid: string): Promise<boolean> => {
    try {
      // 1) Any bills not settled/cancelled?
      const { count: activeBillsCount, error: billsErr } = await supabase
        .from("bills")
        .select("id", { count: "exact", head: true })
        .eq("group_id", gid)
        .in("status", ["draft", "pending", "approved"]) // treat draft/pending/approved as not fully settled

      if (billsErr) {
        console.error("GroupDetails: error checking active bills:", billsErr)
        return true // fail-safe: block deletion if we cannot verify
      }
      if ((activeBillsCount || 0) > 0) return true

      // 2) Any unpaid splits for bills in this group? (outstanding dues)
      const { count: unpaidSplitsCount, error: splitsErr } = await supabase
        .from("bill_splits")
        .select("id, bills!inner(id, group_id)", { count: "exact", head: true })
        .eq("paid", false)
        .eq("bills.group_id", gid)

      if (splitsErr) {
        console.error("GroupDetails: error checking unpaid splits:", splitsErr)
        return true
      }

      return (unpaidSplitsCount || 0) > 0
    } catch (e) {
      console.error("GroupDetails: exception during active bills check:", e)
      return true
    }
  }

  const handleLeaveGroup = () => {
    Alert.alert(
      "Leave Group",
      "Are you sure you want to leave this group? You will lose access to all bills and chat history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              if (!user) return

              // Check unsettled bills before allowing leave
              const unsettled = await hasUnsettledBills(groupId, user.id)
              if (unsettled) {
                Alert.alert(
                  "Cannot Leave Group",
                  "You cannot leave the group while you have unpaid or unsettled bills. Please settle your dues first.",
                )
                return
              }

              // Notify remaining group members before leaving
              if (group) {
                try {
                  await notificationService.notifyUserLeftGroup(
                    groupId,
                    group.name,
                    user.name || "Unknown User",
                    user.id
                  )
                  console.log("GroupDetails: Notifications sent to remaining members")
                } catch (notificationError) {
                  console.error("GroupDetails: Failed to send notifications:", notificationError)
                  // Don't fail the leave process if notifications fail
                }
              }

              const { error } = await supabase
                .from("group_members")
                .delete()
                .eq("group_id", groupId)
                .eq("user_id", user.id)

              if (error) throw error

              Alert.alert("Left Group", "You have successfully left the group.", [
                { text: "OK", onPress: () => navigation.replace("Dashboard") },
              ])
            } catch (error) {
              console.error("Error leaving group:", error)
              Alert.alert("Error", "Failed to leave group. Please try again.")
            }
          },
        },
      ],
    )
  }

  const handleDeleteGroup = () => {
    Alert.alert(
      "Delete Group",
      "Are you sure you want to delete this group? This action cannot be undone and will remove all bills, payments, and chat history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (!user || !group) return

              // Only creator can delete
              if (group.created_by !== user.id) {
                Alert.alert("Not Allowed", "Only the group creator can delete this group.")
                return
              }

              // Block deletion if there are any active/unsettled bills
              const active = await hasActiveGroupBills(groupId)
              if (active) {
                Alert.alert(
                  "Cannot Delete Group",
                  "You cannot delete this group while there are unsettled bills. Please settle or remove all bills first.",
                )
                return
              }

              // Optional: remove associations first (depends on backend cascade policies)
              // Clean up group_members, notifications, chats, etc., if not cascaded by DB
              await supabase.from("group_members").delete().eq("group_id", groupId)

              const { error } = await supabase.from("groups").delete().eq("id", groupId)
              if (error) throw error

              Alert.alert("Group Deleted", "The group has been successfully deleted.", [
                { text: "OK", onPress: () => navigation.replace("Dashboard") },
              ])
            } catch (error) {
              console.error("Error deleting group:", error)
              Alert.alert("Error", "Failed to delete group. Please try again.")
            }
          },
        },
      ],
    )
  }

  const copyInviteCode = async () => {
    try {
      const code = group?.invite_code?.toString().trim()
      if (!code) {
        Alert.alert("Error", "Invite code not available")
        return
      }
      await Clipboard.setStringAsync(code)
      Alert.alert("Copied", "Invite code copied to clipboard")
    } catch (e) {
      console.error('Copy to clipboard failed', e)
      Alert.alert("Error", "Failed to copy invite code")
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Group not found</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} variant="primary" />
        </View>
      </SafeAreaView>
    )
  }

  // Ensure arrays are always defined
  const safeMembers = Array.isArray(members) ? members : []
  const safeBills = Array.isArray(bills) ? bills : []

  // Additional safety check
  if (!Array.isArray(safeMembers) || !Array.isArray(safeBills)) {
    console.error("Arrays are not properly initialized:", { members, bills })
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Loading error. Please try again.</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} variant="primary" />
        </View>
      </SafeAreaView>
    )
  }

  // Simplified render to prevent crashes
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Details</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Group Info */}
        <View style={styles.section}>
          <View style={styles.groupHeader}>
            <View style={styles.groupIcon}>
              <Ionicons name="people" size={32} color="#007AFF" />
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupName}>{group?.name || 'Unknown Group'}</Text>
              {group?.description && <Text style={styles.groupDescription}>{group.description}</Text>}
              <Text style={styles.groupDate}>Created {group?.created_at ? formatDate(group.created_at) : 'Unknown date'}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.inviteContainer} onPress={copyInviteCode}>
            <View style={styles.inviteInfo}>
              <Text style={styles.inviteLabel}>Invite Code</Text>
              <Text style={styles.inviteCode}>{group?.invite_code || 'N/A'}</Text>
            </View>
            <Ionicons name="copy-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members ({safeMembers.length})</Text>
          </View>
          {safeMembers.map((member) => (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberInfo}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {member.user?.name?.charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={styles.memberDetails}>
                  <Text style={styles.memberName}>{member.user?.name || "Unknown"}</Text>
                  <Text style={styles.memberEmail}>{member.user?.email || ""}</Text>
                </View>
              </View>
              <View style={styles.memberRole}>
                <Text style={[styles.roleText, member.role === "admin" && styles.adminRoleText]}>{member.role}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Recent Bills */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Bills</Text>
            <TouchableOpacity onPress={() => navigation.navigate("GroupBills", { groupId, groupName: group?.name || "Group" })}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {safeBills.length > 0 ? (
            safeBills.map((bill) => (
              <TouchableOpacity
                key={bill.id}
                style={styles.billCard}
                onPress={() => {
                  // Navigate based on bill status
                  if (bill.status === "draft") {
                    navigation.navigate("BillSplit", { billId: bill.id })
                  } else if (bill.status === "pending") {
                    navigation.navigate("Approval", { billId: bill.id })
                  } else if (bill.status === "approved") {
                    navigation.navigate("Payment", { billId: bill.id })
                  } else if (bill.status === "settled") {
                    navigation.navigate("BillSummary", { billId: bill.id })
                  } else {
                    navigation.navigate("BillDetails", { billId: bill.id })
                  }
                }}
              >
                <View style={styles.billHeader}>
                  <Text style={styles.billTitle}>{bill.title}</Text>
                  <Text style={styles.billAmount}>₹{bill.total_amount?.toFixed(2) || "0.00"}</Text>
                </View>
                <View style={styles.billFooter}>
                  <Text style={styles.billCreator}>by {(bill as any).creator?.name || "Unknown"}</Text>
                  <Text style={[styles.billStatus, {
                    color: bill.status === "draft" ? "#007AFF" :
                           bill.status === "settled" ? "#34C759" :
                           bill.status === "cancelled" ? "#FF3B30" : "#FF9500"
                  }]}>
                    {bill.status.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No bills yet</Text>
              <Text style={styles.emptyStateSubtext}>Add a bill to start tracking expenses</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Button
            title="Add Bill"
            onPress={() => navigation.navigate("AddBill", { groupId })}
            variant="primary"
            style={styles.actionButton}
          />

          <Button
            title="View Chat"
            onPress={() => navigation.navigate("GroupChat", { groupId })}
            variant="secondary"
            style={styles.actionButton}
          />

          {currentUserRole === "admin" ? (
            group?.created_by === user?.id ? (
              <Button title="Delete Group" onPress={handleDeleteGroup} variant="outline" style={styles.actionButton} />
            ) : (
              <Button title="Leave Group" onPress={handleLeaveGroup} variant="outline" style={styles.actionButton} />
            )
          ) : (
            <Button title="Leave Group" onPress={handleLeaveGroup} variant="outline" style={styles.actionButton} />
          )}
        </View>
      </ScrollView>
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
  chatButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: "#FF3B30",
    marginBottom: 20,
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
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  seeAllText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  groupIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F0F8FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 4,
  },
  groupDate: {
    fontSize: 12,
    color: "#8E8E93",
  },
  inviteContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 8,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginBottom: 2,
  },
  inviteCode: {
    fontSize: 16,
    fontFamily: "monospace",
    fontWeight: "600",
    color: "#007AFF",
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 14,
    color: "#8E8E93",
  },
  memberRole: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#F2F2F7",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8E8E93",
    textTransform: "capitalize",
  },
  adminRoleText: {
    color: "#007AFF",
  },
  billCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  billHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
  },
  billAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  billFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  billCreator: {
    fontSize: 12,
    color: "#8E8E93",
  },
  billStatus: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#8E8E93",
  },
  actionButton: {
    marginBottom: 12,
  },
})

export default GroupDetailsScreen
