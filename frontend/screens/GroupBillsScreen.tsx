"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RouteProp } from "@react-navigation/native"
import type { RootStackParamList } from "../types"
import { useAuth } from "../contexts/AuthProvider"
import { BillCard } from "../components/BillCard"
import { Button } from "../components/Button"
import { Ionicons } from "@expo/vector-icons"
import { billFilterService } from "../services/billFilterService"
import type { FilteredBill } from "../services/billFilterService"

type GroupBillsScreenNavigationProp = StackNavigationProp<RootStackParamList, "GroupBills">
type GroupBillsScreenRouteProp = RouteProp<RootStackParamList, "GroupBills">

const GroupBillsScreen: React.FC = () => {
  const navigation = useNavigation<GroupBillsScreenNavigationProp>()
  const route = useRoute<GroupBillsScreenRouteProp>()
  const { user } = useAuth()
  const { groupId, groupName } = route.params

  const [allBills, setAllBills] = useState<FilteredBill[]>([])
  const [filteredBills, setFilteredBills] = useState<FilteredBill[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const statusOptions = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "settled", label: "Settled" },
    { key: "cancelled", label: "Cancelled" },
  ]

  useEffect(() => {
    fetchGroupBills()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allBills, searchQuery, statusFilter])

  const fetchGroupBills = async () => {
    if (!user) {
      console.log("GroupBills: No user found, skipping bills fetch")
      return
    }

    try {
      setLoading(true)
      console.log("GroupBills: Fetching all bills for group:", groupId, "user:", user.id)
      
      // Fetch all bills for this group
      const bills = await billFilterService.fetchAllGroupBillsForUser(groupId, user.id)
      console.log("GroupBills: Fetched bills:", bills.length)
      
      setAllBills(bills)
    } catch (error) {
      console.error("GroupBills: Error fetching bills:", error)
      Alert.alert("Error", "Failed to load group bills")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...allBills]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(bill =>
        bill.title.toLowerCase().includes(query) ||
        bill.creator?.name.toLowerCase().includes(query)
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(bill => bill.status === statusFilter)
    }

    setFilteredBills(filtered)
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchGroupBills()
  }

  const handleBillPress = (bill: FilteredBill) => {
    // Same navigation logic as AllBillsScreen and GroupDetailsScreen
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
  }

  const clearSearch = () => {
    setSearchQuery("")
  }

  const getStatusCount = (status: string) => {
    if (status === "all") return allBills.length
    return allBills.filter(bill => bill.status === status).length
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{groupName} Bills</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading bills...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{groupName} Bills</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Group Info */}
      <View style={styles.groupInfoContainer}>
        <View style={styles.groupIcon}>
          <Ionicons name="people" size={20} color="#007AFF" />
        </View>
        <Text style={styles.groupInfoText}>All bills from {groupName}</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search bills or creators..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter */}
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
          scrollEventThrottle={16}
          directionalLockEnabled={true}
          alwaysBounceHorizontal={false}
          alwaysBounceVertical={false}
          nestedScrollEnabled={true}
        >
          {statusOptions.map((option, index) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.filterChip,
                statusFilter === option.key && styles.filterChipActive,
                index === statusOptions.length - 1 && styles.filterChipLast
              ]}
              onPress={() => setStatusFilter(option.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterChipText,
                statusFilter === option.key && styles.filterChipTextActive
              ]}>
                {option.label} ({getStatusCount(option.key)})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Bills List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredBills.length > 0 ? (
          <View style={styles.billsList}>
            {filteredBills.map((bill) => (
              <BillCard
                key={bill.id}
                bill={bill}
                onPress={() => handleBillPress(bill)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            {searchQuery || statusFilter !== "all" ? (
              // Filtered empty state
              <>
                <Ionicons name="search" size={64} color="#ccc" />
                <Text style={styles.emptyTitle}>No bills found</Text>
                <Text style={styles.emptyText}>
                  {searchQuery 
                    ? `No bills match "${searchQuery}"`
                    : `No ${statusFilter} bills found in this group`
                  }
                </Text>
                <Button
                  title="Clear Filters"
                  onPress={() => {
                    setSearchQuery("")
                    setStatusFilter("all")
                  }}
                  variant="outline"
                  size="medium"
                />
              </>
            ) : (
              // No bills at all empty state
              <>
                <Ionicons name="receipt-outline" size={64} color="#ccc" />
                <Text style={styles.emptyTitle}>No bills yet</Text>
                <Text style={styles.emptyText}>
                  This group doesn't have any bills yet.
                </Text>
                <Button
                  title="Add Bill"
                  onPress={() => navigation.navigate("AddBill", { groupId })}
                  variant="primary"
                  size="medium"
                />
              </>
            )}
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  headerRight: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },

  // Group Info
  groupInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  groupIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f8ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  groupInfoText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  
  // Search
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
  },

  // Filter
  filterContainer: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 20,
  },
  filterScrollContent: {
    alignItems: 'center',
    paddingRight: 20, // Extra padding at the end for better scrolling experience
  },
  filterChip: {
    backgroundColor: "#f8f9fa",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minWidth: 60, // Ensure minimum width for touch targets
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipLast: {
    marginRight: 0, // Remove margin from last chip
  },
  filterChipActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  filterChipTextActive: {
    color: "#fff",
  },

  // Content
  content: {
    flex: 1,
  },
  billsList: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
})

export default GroupBillsScreen