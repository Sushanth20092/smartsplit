"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Platform, Modal, Dimensions, Image } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button } from "../components/Button"
import { GroupCard } from "../components/GroupCard"
import { BillCard } from "../components/BillCard"
import { GroupSelectionModal } from "../components/GroupSelectionModal"
import { useAuth } from "../contexts/AuthProvider"
import { useGroupSelection } from "../hooks/useGroupSelection"
import { supabase } from "../../backend/supabase/client"
import { formatCurrency } from "../utils/formatters"
import { billFilterService } from "../services/billFilterService"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RootStackParamList, Group, Bill } from "../types"
import { useFocusEffect } from "@react-navigation/native"
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from "@expo/vector-icons"
import { NotificationBell } from "../components/NotificationBell"

type DashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, "Dashboard">

interface Props {
  navigation: DashboardScreenNavigationProp
}

const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [recentBills, setRecentBills] = useState<Bill[]>([])
  const [totalOwed, setTotalOwed] = useState(0)
  const [totalOwing, setTotalOwing] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Group selection logic
  const {
    userGroups,
    showGroupSelection,
    handleAddBillFromDashboard,
    handleGroupSelected,
    handleCreateGroup,
    handleJoinGroup,
    closeGroupSelection,
  } = useGroupSelection()

  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false)
  const [welcomeCountdown, setWelcomeCountdown] = useState(4)
  const [avatarLoadError, setAvatarLoadError] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [])



  // Debug user data and reset avatar error when user changes
  useEffect(() => {
    if (user) {
      console.log('Dashboard - User data:', user)
      console.log('Dashboard - User name:', user.name)
      console.log('Dashboard - User email:', user.email)
      console.log('Dashboard - User avatar:', user.avatar)
      // Reset avatar load error when user changes
      setAvatarLoadError(false)
    }
  }, [user])

  // Check if user just registered and show welcome message
  useEffect(() => {
    const checkRegistrationStatus = async () => {
      try {
        const justRegistered = await AsyncStorage.getItem('justRegistered')
        if (justRegistered === 'true') {
          setShowWelcomeMessage(true)
          setWelcomeCountdown(4)
          // Clear the flag
          await AsyncStorage.removeItem('justRegistered')
        }
      } catch (error) {
        console.error('Error checking registration status:', error)
      }
    }

    checkRegistrationStatus()
  }, [])

  // Handle welcome message countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (showWelcomeMessage && welcomeCountdown > 0) {
      interval = setInterval(() => {
        setWelcomeCountdown((prev) => prev - 1)
      }, 1000)
    } else if (showWelcomeMessage && welcomeCountdown === 0) {
      setShowWelcomeMessage(false)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [showWelcomeMessage, welcomeCountdown])

  const fetchDashboardData = async () => {
    if (!user) {
      console.log("Dashboard: No user found, skipping data fetch")
      setLoading(false)
      setRefreshing(false)
      return
    }

    try {
      console.log("Dashboard: Starting data fetch for user:", user.id)
      await Promise.all([fetchGroups(), fetchRecentBills(), fetchBalances()])
      console.log("Dashboard: Data fetch completed successfully")
    } catch (error) {
      console.error("Dashboard: Error fetching dashboard data:", error)
      // Set safe defaults on error
      setGroups([])
      setRecentBills([])
      setTotalOwed(0)
      setTotalOwing(0)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchGroups = async () => {
    if (!user) {
      console.log("Dashboard: No user found, skipping group fetch")
      return
    }

    console.log("Dashboard: Fetching groups for user:", user.id)

    try {
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
            group_members (
              id
            )
          )
        `)
        .eq("user_id", user.id)
        .limit(5)

      if (error) {
        console.error("Dashboard: Error fetching groups:", error)
        throw error
      }

      console.log("Dashboard: Raw group_members data:", data)
      const groupsData = Array.isArray(data)
        ? data.map((item) => {
            const group = item?.groups
            if (group) {
              // Add member count to group data
              return {
                ...group,
                memberCount: (group as any).group_members?.length || 0
              }
            }
            return null
          }).filter(Boolean)
        : []
      console.log("Dashboard: Processed groups data:", groupsData)
      setGroups(Array.isArray(groupsData) ? groupsData as any[] : [])
    } catch (error) {
      console.error("Dashboard: Failed to fetch groups:", error)
    }
  }

  const fetchRecentBills = async () => {
    if (!user) return

    try {
      console.log("Dashboard: Fetching recent bills...")
      // Use the bill filter service to get bills filtered by user's join dates
      const filteredBills = await billFilterService.fetchUserBills(user.id, 5)
      console.log("Dashboard: Recent bills fetched:", filteredBills.map(bill => ({ 
        id: bill.id, 
        title: bill.title, 
        status: bill.status,
        approved_at: bill.approved_at
      })))
      setRecentBills(filteredBills)
    } catch (error) {
      console.log("Dashboard: fetchRecentBills error, setting empty array:", error)
      setRecentBills([])
    }
  }

  const fetchBalances = async () => {
    if (!user) return

    try {
      console.log("Dashboard: Fetching user balances with eligibility filtering...")
      // Use the new filtered balance calculation that only considers bills
      // where the user is eligible to participate (joined group before bill creation)
      const { totalOwed, totalOwing } = await billFilterService.fetchUserBalances(user.id)
      
      console.log("Dashboard: Filtered balances - Owed:", totalOwed, "Owing:", totalOwing)
      setTotalOwed(totalOwed)
      setTotalOwing(totalOwing)
    } catch (error) {
      console.log("Dashboard: fetchBalances error, setting balances to 0:", error)
      setTotalOwed(0)
      setTotalOwing(0)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchDashboardData()
  }

  // Silent background refresh when returning to Dashboard
  useFocusEffect(
    useCallback(() => {
      // Do not show loading; just refresh data quickly in background
      fetchDashboardData()
    }, [])
  )

  const handleAddBillPress = async () => {
    const selectedGroupId = await handleAddBillFromDashboard()
    if (selectedGroupId) {
      // User has only one group or selected a group
      navigation.navigate("AddBill", { groupId: selectedGroupId })
    }
    // If selectedGroupId is null, the group selection modal will be shown
  }

  const onGroupSelected = (groupId: string) => {
    const finalGroupId = handleGroupSelected(groupId)
    navigation.navigate("AddBill", { groupId: finalGroupId })
  }

  const onCreateGroupPress = () => {
    handleCreateGroup()
    navigation.navigate("CreateGroup")
  }

  const onJoinGroupPress = () => {
    handleJoinGroup()
    navigation.navigate("JoinGroup")
  }

  // Additional safety checks to prevent length errors
  const safeGroups = Array.isArray(groups) ? groups : []
  const safeRecentBills = Array.isArray(recentBills) ? recentBills : []

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greeting}>Hello, {user?.name}!</Text>
            <Text style={styles.subtitle}>Here's your spending overview</Text>
          </View>
          <View style={styles.headerButtons}>
            <NotificationBell 
              onPress={() => navigation.navigate("Notifications")}
              style={styles.notificationButton}
            />
            <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate("Profile")}>
              {user?.avatar && !avatarLoadError ? (
                <Image 
                  source={{ uri: user.avatar }} 
                  style={styles.profileAvatar}
                  onError={() => {
                    console.log('Failed to load avatar image, falling back to default icon');
                    setAvatarLoadError(true);
                  }}
                />
              ) : (
                <Ionicons name="person" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.balanceCards}>
          <View style={[styles.balanceCard, styles.owedCard]}>
            <Text style={styles.balanceLabel}>You're owed</Text>
            <Text style={styles.balanceAmount}>{formatCurrency(totalOwed)}</Text>
          </View>
          <View style={[styles.balanceCard, styles.owingCard]}>
            <Text style={styles.balanceLabel}>You owe</Text>
            <Text style={styles.balanceAmount}>{formatCurrency(totalOwing)}</Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <Button title="Add Bill" onPress={handleAddBillPress} size="medium" />
          <Button
            title="Create Group"
            onPress={() => navigation.navigate("CreateGroup")}
            variant="outline"
            size="medium"
          />
          <Button
            title="Join Group"
            onPress={() => navigation.navigate("JoinGroup")}
            variant="outline"
            size="medium"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Groups</Text>
            <TouchableOpacity onPress={() => navigation.navigate("GroupList", { initialGroups: safeGroups as any })}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {safeGroups.length > 0 ? (
            safeGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onPress={() => navigation.navigate("GroupDetails", { groupId: group.id })}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No groups yet. Create your first group!</Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Bills</Text>
            <TouchableOpacity onPress={() => navigation.navigate("AllBills")}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {safeRecentBills.length > 0 ? (
            safeRecentBills.map((bill) => (
              <BillCard
                key={bill.id}
                bill={bill}
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
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No bills yet. Add your first bill!</Text>
          )}
        </View>
      </ScrollView>

      

      {/* Group Selection Modal */}
      <GroupSelectionModal
        visible={showGroupSelection}
        groups={userGroups}
        onSelectGroup={onGroupSelected}
        onCreateGroup={onCreateGroupPress}
        onJoinGroup={onJoinGroupPress}
        onClose={closeGroupSelection}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Platform.OS === 'web' ? 20 : 16,
    paddingVertical: Platform.OS === 'web' ? 16 : 12,
    minHeight: 60,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  greeting: {
    fontSize: Platform.OS === 'web' ? 24 : 20,
    fontWeight: "bold",
    color: "#333",
    flexShrink: 1,
  },
  subtitle: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: "#666",
    marginTop: 4,
    flexShrink: 1,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profileIcon: {
    fontSize: 20,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },

  balanceCards: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  balanceCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  owedCard: {
    backgroundColor: "#E8F5E8",
  },
  owingCard: {
    backgroundColor: "#FFF2E8",
  },
  balanceLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  quickActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  seeAll: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
    paddingVertical: 20,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },

  welcomeModalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  welcomeIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  welcomeCountdownText: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  welcomeCloseButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  welcomeCloseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})





















export default DashboardScreen
