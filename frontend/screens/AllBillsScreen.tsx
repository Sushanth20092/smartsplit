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
import { useNavigation } from "@react-navigation/native"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RootStackParamList } from "../types"
import { useAuth } from "../contexts/AuthProvider"
import { BillCard } from "../components/BillCard"
import { Button } from "../components/Button"
import { Ionicons } from "@expo/vector-icons"
import { billFilterService } from "../services/billFilterService"
import { supabase } from "../services/supabase"
import type { Group } from "../types"

type AllBillsScreenNavigationProp = StackNavigationProp<RootStackParamList, "AllBills">

interface FilteredBill {
  id: string
  title: string
  total_amount: number
  status: string
  created_at: string
  approved_at?: string
  settled_at?: string
  group_id: string
  group?: { name: string }
  creator?: { name: string }
}

const AllBillsScreen: React.FC = () => {
  const navigation = useNavigation<AllBillsScreenNavigationProp>()
  const { user } = useAuth()

  const [allBills, setAllBills] = useState<FilteredBill[]>([])
  const [filteredBills, setFilteredBills] = useState<FilteredBill[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [groupFilter, setGroupFilter] = useState<string>("all")
  const [userGroups, setUserGroups] = useState<Group[]>([])
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({})

  const statusOptions = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "settled", label: "Settled" },
    { key: "cancelled", label: "Cancelled" },
  ]

  useEffect(() => {
    fetchAllBills()
    fetchUserGroups()
    fetchGroupCounts()
  }, [])

  useEffect(() => {
    if (user) {
      fetchAllBills(groupFilter)
    }
  }, [groupFilter])

  useEffect(() => {
    applyFilters()
  }, [allBills, searchQuery, statusFilter])

  const fetchAllBills = async (filterGroupId?: string) => {
    if (!user) return
    try {
      setLoading(true)
      const bills = await billFilterService.fetchUserBills(
        user.id,
        undefined,
        filterGroupId === "all" ? undefined : filterGroupId
      )
      setAllBills(bills)
    } catch (error) {
      Alert.alert("Error", "Failed to load bills")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchUserGroups = async () => {
    if (!user) return
    try {
      const { data } = await supabase
        .from("group_members")
        .select(`
          groups (
            id,
            name,
            description,
            created_by,
            created_at
          )
        `)
        .eq("user_id", user.id)

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
              members: [],
              total_expenses: 0,
              invite_code: "",
            }
          })
          .filter(Boolean) || []

      setUserGroups(groupsData as Group[])
    } catch (error) {
      console.error("Error fetching groups:", error)
    }
  }

  const fetchGroupCounts = async () => {
    if (!user) return
    try {
      const allBills = await billFilterService.fetchUserBills(user.id)
      const counts: Record<string, number> = { all: allBills.length }
      allBills.forEach(bill => {
        if (bill.group_id) {
          counts[bill.group_id] = (counts[bill.group_id] || 0) + 1
        }
      })
      setGroupCounts(counts)
    } catch (error) {
      console.error("Error fetching group counts:", error)
    }
  }

  const applyFilters = () => {
    let filtered = [...allBills]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        bill =>
          bill.title.toLowerCase().includes(query) ||
          bill.group?.name.toLowerCase().includes(query) ||
          bill.creator?.name.toLowerCase().includes(query)
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(bill => bill.status === statusFilter)
    }

    setFilteredBills(filtered)
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchAllBills(groupFilter)
    fetchUserGroups()
    fetchGroupCounts()
  }

  const handleBillPress = (bill: FilteredBill) => {
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

  const clearSearch = () => setSearchQuery("")

  const getStatusCount = (status: string) => {
    if (status === "all") return allBills.length
    return allBills.filter(bill => bill.status === status).length
  }

  const getGroupCount = (groupId: string) => groupCounts[groupId] || 0

  const getGroupName = (groupId: string) => {
    if (groupId === "all") return "All Groups"
    const group = userGroups.find(g => g.id === groupId)
    return group?.name || "Unknown Group"
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>All Bills</Text>
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
        <Text style={styles.headerTitle}>All Bills</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search bills, groups, or creators..."
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
{/* Status Filter */}
<View style={styles.filterContainer}>
  <Text style={styles.filterLabel}>Status</Text>
  <ScrollView 
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.filterScrollContent}
  >
    {statusOptions.map((option, index) => (
      <TouchableOpacity
        key={option.key}
        style={[
          styles.filterChip,
          statusFilter === option.key && styles.filterChipActive,
          index === statusOptions.length - 1 && { marginRight: 20 },
        ]}
        onPress={() => setStatusFilter(option.key)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.filterChipText,
            statusFilter === option.key && styles.filterChipTextActive,
          ]}
        >
          {`${option.label} (${getStatusCount(option.key)})`}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
</View>

{/* Group Filter */}
<View style={styles.filterContainer}>
  <Text style={styles.filterLabel}>Group</Text>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.filterScrollContent}
  >
    <TouchableOpacity
      style={[
        styles.filterChip,
        groupFilter === "all" && styles.filterChipActive,
      ]}
      onPress={() => setGroupFilter("all")}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterChipText,
          groupFilter === "all" && styles.filterChipTextActive,
        ]}
      >
        {`All Groups (${getGroupCount("all")})`}
      </Text>
    </TouchableOpacity>

    {userGroups.map((group, index) => (
      <TouchableOpacity
        key={group.id}
        style={[
          styles.filterChip,
          groupFilter === group.id && styles.filterChipActive,
          index === userGroups.length - 1 && { marginRight: 20 },
        ]}
        onPress={() => setGroupFilter(group.id)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.filterChipText,
            groupFilter === group.id && styles.filterChipTextActive,
          ]}
        >
          {`${group.name} (${getGroupCount(group.id)})`}
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
            {filteredBills.map(bill => (
              <BillCard key={bill.id} bill={bill} onPress={() => handleBillPress(bill)} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            {searchQuery || statusFilter !== "all" || groupFilter !== "all" ? (
              <>
                <Ionicons name="search" size={64} color="#ccc" />
                <Text style={styles.emptyTitle}>No bills found</Text>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? `No bills match "${searchQuery}"`
                    : statusFilter !== "all" && groupFilter !== "all"
                    ? `No ${statusFilter} bills found in ${getGroupName(groupFilter)}`
                    : statusFilter !== "all"
                    ? `No ${statusFilter} bills found`
                    : groupFilter !== "all"
                    ? `No bills found in ${getGroupName(groupFilter)}`
                    : "No bills found"}
                </Text>
                <Button
                  title="Clear Filters"
                  onPress={() => {
                    setSearchQuery("")
                    setStatusFilter("all")
                    setGroupFilter("all")
                  }}
                  variant="outline"
                  size="medium"
                />
              </>
            ) : (
              <>
                <Ionicons name="receipt-outline" size={64} color="#ccc" />
                <Text style={styles.emptyTitle}>No bills yet</Text>
                <Text style={styles.emptyText}>Add your first bill to get started!</Text>
                <Button
                  title="Add Bill"
                  onPress={() => navigation.navigate("GroupList")}
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
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  filterScrollContent: {
     paddingLeft: 20,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    backgroundColor: "#f8f9fa",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
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
  filterScroll: {
    flexGrow: 0, // Add this
    flexShrink: 0, // Add this
  },
    scrollWrapper: {
    flex: 1,  // Add this
    width: '100%',  // Add this
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

export default AllBillsScreen
