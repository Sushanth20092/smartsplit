"use client"

import type React from "react"
import { useState, useCallback, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  BackHandler,
  TextInput,
} from "react-native"
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RouteProp } from "@react-navigation/native"
import type { RootStackParamList, Bill, User } from "../types"
import { useAuth } from "../contexts/AuthProvider"
import { supabase } from "../../backend/supabase/client"
import { paymentService, type PaymentCalculation } from "../services/paymentService"
import { billFilterService } from "../services/billFilterService"
import { Button } from "../components/Button"
import { InputField } from "../components/InputField"
import { Ionicons } from "@expo/vector-icons"

type BillSplitScreenNavigationProp = StackNavigationProp<RootStackParamList, "BillSplit">
type BillSplitScreenRouteProp = RouteProp<RootStackParamList, "BillSplit">

const BillSplitScreen: React.FC = () => {
  const navigation = useNavigation<BillSplitScreenNavigationProp>()
  const route = useRoute<BillSplitScreenRouteProp>()
  const { user } = useAuth()
  const { billId } = route.params

  const [bill, setBill] = useState<Bill | null>(null)
  const [billItems, setBillItems] = useState<any[]>([])
  const [groupMembers, setGroupMembers] = useState<User[]>([])
  const [splitMode, setSplitMode] = useState<"equal" | "by_item" | "custom">("equal")
  const [calculations, setCalculations] = useState<PaymentCalculation[]>([])
  const [customAmounts, setCustomAmounts] = useState<{ [userId: string]: string }>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  const [adjustmentTimeout, setAdjustmentTimeout] = useState<NodeJS.Timeout | null>(null)

  const fetchBillData = async () => {
    try {
      // Fetch bill details
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select(`
          *,
          creator:users!bills_created_by_fkey(name),
          group:groups(name)
        `)
        .eq("id", billId)
        .single()

      if (billError) throw billError
      setBill(billData)

      if (!user) {
        // User not authenticated
        Alert.alert("Authentication Required", "Please log in to access this bill.")
        navigateToDashboard()
        return
      }

      // Fetch bill items
      const { data: itemsData, error: itemsError } = await supabase
        .from("bill_items")
        .select("*")
        .eq("bill_id", billId)

      if (itemsError) throw itemsError
      setBillItems(itemsData || [])

      // Fetch group members who were present when the bill was created
      const eligibleMembers = await billFilterService.fetchEligibleMembersForBill(billId)
      setGroupMembers(eligibleMembers)

      // Initialize custom amounts with equal split
      const totalAmount = billData.total_amount + (billData.tip_amount || 0) + (billData.tax_amount || 0)
      const equalShare = totalAmount / eligibleMembers.length
      const initialAmounts: { [userId: string]: string } = {}
      eligibleMembers.forEach((member) => {
        initialAmounts[member.id] = equalShare.toFixed(2)
      })
      setCustomAmounts(initialAmounts)

      // Calculate equal split by default
      await calculateSplit("equal", billData, eligibleMembers)
    } catch (error) {
      console.error("Error fetching bill data:", error)
      Alert.alert("Error", "Failed to load bill details")
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchBillData()
    }, [billId]),
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (adjustmentTimeout) {
        clearTimeout(adjustmentTimeout)
      }
    }
  }, [adjustmentTimeout])

  // Re-initialize custom amounts when bill or members change (but not when user is editing)
  useEffect(() => {
    if (bill && groupMembers.length > 0 && splitMode === "custom" && !focusedInput) {
      // Only initialize if no input is currently focused (user not editing)
      const hasEmptyAmounts = Object.keys(customAmounts).length === 0
      if (hasEmptyAmounts) {
        initializeCustomAmounts()
      }
    }
  }, [bill, groupMembers, splitMode])

  // Handle hardware back button to navigate to Dashboard
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigateToDashboard()
        return true // Prevent default back behavior
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)
      return () => subscription.remove()
    }, [])
  )

  // Function to navigate to Dashboard
  const navigateToDashboard = () => {
    navigation.navigate("Dashboard")
  }

  // Helper functions for access control
  const isCreator = user?.id === bill?.created_by
  const isDraftOrPending = bill?.status === "draft" || bill?.status === "pending"
  const canEdit = isCreator || !isDraftOrPending

  const calculateSplit = async (mode: "equal" | "by_item" | "custom", billData?: Bill, members?: User[]) => {
    try {
      const currentBill = billData || bill
      const currentMembers = members || groupMembers

      if (!currentBill || currentMembers.length === 0) return

      let result
      switch (mode) {
        case "equal":
          result = await paymentService.calculateEqualSplit(
            currentBill,
            currentMembers.map((m) => m.id),
          )
          break
        case "by_item":
          result = await paymentService.calculateItemBasedSplit(billId)
          break
        case "custom":
          const amounts: { [userId: string]: number } = {}
          Object.entries(customAmounts).forEach(([userId, amount]) => {
            amounts[userId] = Number.parseFloat(amount) || 0
          })
          result = await paymentService.calculateCustomSplit(currentBill, amounts)
          break
      }

      setCalculations(result.calculations)
    } catch (error) {
      console.error("Error calculating split:", error)
      Alert.alert("Error", "Failed to calculate split")
    }
  }

  const initializeCustomAmounts = () => {
    if (bill && groupMembers.length > 0) {
      const totalAmount = grandTotal
      const equalShare = totalAmount / groupMembers.length
      const equalAmounts: { [userId: string]: string } = {}

      groupMembers.forEach((member) => {
        equalAmounts[member.id] = equalShare.toFixed(2)
      })

      setCustomAmounts(equalAmounts)
      return equalAmounts
    }
    return {}
  }

  const handleSplitModeChange = (mode: "equal" | "by_item" | "custom") => {
    setSplitMode(mode)

    if (mode === "custom") {
      // Initialize custom amounts with equal split when switching to custom mode
      const initialAmounts = initializeCustomAmounts()
      
      // Also calculate the split to update the calculations
      setTimeout(() => {
        calculateSplit("custom")
      }, 100)
    } else {
      calculateSplit(mode)
    }
  }

  const handleCustomAmountChange = (userId: string, amount: string) => {
    const totalBill = bill ? grandTotal : 0
    
    // Handle empty input - allow it for better UX
    if (amount === "" || amount === ".") {
      const newAmounts: { [userId: string]: string } = { ...customAmounts }
      newAmounts[userId] = amount
      setCustomAmounts(newAmounts)
      return
    }

    // Validate numeric input
    const numericAmount = Number.parseFloat(amount)
    
    // Handle invalid input
    if (isNaN(numericAmount)) {
      return // Don't update if input is invalid
    }

    // Handle negative values
    if (numericAmount < 0) {
      const newAmounts: { [userId: string]: string } = { ...customAmounts }
      newAmounts[userId] = "0.00"
      setCustomAmounts(newAmounts)
      return
    }

    // Handle amount exceeding total bill
    if (numericAmount > totalBill) {
      Alert.alert(
        "Amount Too High",
        `Amount cannot exceed the total bill of ₹${totalBill.toFixed(2)}. Setting to maximum allowed.`,
        [{ text: "OK" }]
      )
      const newAmounts: { [userId: string]: string } = { ...customAmounts }
      newAmounts[userId] = totalBill.toFixed(2)
      
      // Set all other members to 0
      const otherMembers = groupMembers.filter(member => member.id !== userId)
      otherMembers.forEach(member => {
        newAmounts[member.id] = "0.00"
      })
      
      setCustomAmounts(newAmounts)
      return
    }

    try {
      // Calculate remaining amount to distribute
      const remaining = totalBill - numericAmount
      const otherMembers = groupMembers.filter(member => member.id !== userId)

      // Create new amounts object
      const newAmounts: { [userId: string]: string } = { ...customAmounts }
      newAmounts[userId] = amount // Keep the user's input as-is for display

      if (otherMembers.length === 0) {
        // Edge case: Only one member - they get the full amount
        newAmounts[userId] = totalBill.toFixed(2)
      } else if (remaining < 0) {
        // Edge case: Current amount exceeds total - set others to 0
        otherMembers.forEach(member => {
          newAmounts[member.id] = "0.00"
        })
      } else if (remaining === 0) {
        // Edge case: Current amount equals total - set others to 0
        otherMembers.forEach(member => {
          newAmounts[member.id] = "0.00"
        })
      } else {
        // Normal case: Distribute remaining amount equally among other members
        const amountPerOther = remaining / otherMembers.length
        otherMembers.forEach(member => {
          newAmounts[member.id] = Math.max(0, amountPerOther).toFixed(2)
        })
      }

      setCustomAmounts(newAmounts)
      
      // Clear existing timeout
      if (adjustmentTimeout) {
        clearTimeout(adjustmentTimeout)
      }
      
      // Set new timeout for calculation update
      const newTimeout = setTimeout(() => {
        if (splitMode === "custom") {
          calculateSplit("custom")
        }
      }, 300)
      
      setAdjustmentTimeout(newTimeout)
      
    } catch (error) {
      console.error("Error in handleCustomAmountChange:", error)
    }
  }

  const resetToEqualSplit = () => {
    if (!bill) return

    const totalAmount = grandTotal
    const equalShare = totalAmount / groupMembers.length
    const equalAmounts: { [userId: string]: string } = {}

    groupMembers.forEach((member) => {
      equalAmounts[member.id] = equalShare.toFixed(2)
    })

    setCustomAmounts(equalAmounts)
    
    // Trigger calculation update
    setTimeout(() => {
      if (splitMode === "custom") {
        calculateSplit("custom")
      }
    }, 100)
    
    Alert.alert("Reset Complete", "All amounts have been reset to equal split")
  }



  const validateSplit = () => {
    if (splitMode === "custom") {
      const total = Object.values(customAmounts).reduce((sum, amount) => sum + (Number.parseFloat(amount) || 0), 0)
      const billTotal = bill ? grandTotal : 0

      if (Math.abs(total - billTotal) > 0.01) {
        Alert.alert(
          "Invalid Split",
          `Custom amounts must total ₹${billTotal.toFixed(2)}. Current total: ₹${total.toFixed(2)}`,
        )
        return false
      }
    }

    if (splitMode === "by_item") {
      // Validate that all items have at least one assigned member
      const unassignedItems = billItems.filter(item => !item.assigned_users || item.assigned_users.length === 0)

      if (unassignedItems.length > 0) {
        Alert.alert(
          "Assignment Required",
          `The following items need at least one member assigned: ${unassignedItems.map(item => item.name).join(", ")}`,
          [{ text: "OK" }]
        )
        return false
      }
    }

    return true
  }

  const saveSplit = async () => {
    if (!validateSplit()) return
    if (!bill) return

    setSaving(true)
    try {
      // Detect active split method and validate accordingly
      let finalCalculations = calculations

      // For custom split, recalculate to ensure we have the latest amounts
      if (splitMode === "custom") {
        const amounts: { [userId: string]: number } = {}
        Object.entries(customAmounts).forEach(([userId, amount]) => {
          amounts[userId] = Number.parseFloat(amount) || 0
        })
        const result = await paymentService.calculateCustomSplit(bill, amounts)
        finalCalculations = result.calculations
      }

      // Save payments with split method and bill items for by_item splits
      await paymentService.savePayments(
        billId,
        finalCalculations,
        splitMode,
        splitMode === "by_item" ? billItems : undefined
      )

      // Replace current screen with Approval screen to prevent going back to Bill Split
      navigation.replace("Approval", { billId })

    } catch (error) {
      console.error("Error saving split:", error)
      Alert.alert("Error", "Failed to save split. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const getMemberName = (userId: string) => {
    const member = groupMembers.find((m) => m.id === userId)
    return member?.name || "Unknown"
  }

  const handleItemAssignmentChange = async (itemId: string, assignedUserIds: string[]) => {
    try {
      // Update the item assignments in the database
      await paymentService.updateItemAssignments(itemId, assignedUserIds)

      // Update local state
      setBillItems(prev => prev.map(item =>
        item.id === itemId
          ? { ...item, assigned_users: assignedUserIds }
          : item
      ))

      // Recalculate splits if in by_item mode
      if (splitMode === "by_item") {
        await calculateSplit("by_item")
      }
    } catch (error) {
      console.error("Error updating item assignments:", error)
      Alert.alert("Error", "Failed to update item assignments")
    }
  }

  const openAssignmentModal = (item: any) => {
    setSelectedItem(item)
    setShowAssignmentModal(true)
  }

  const closeAssignmentModal = () => {
    setShowAssignmentModal(false)
    setSelectedItem(null)
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

  if (!bill) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Bill not found</Text>
          <Button title="Go to Dashboard" onPress={navigateToDashboard} variant="primary" />
        </View>
      </SafeAreaView>
    )
  }



  // Calculate amounts
  const itemsSubtotal = billItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const tipAmount = bill.tip_amount || 0
  const taxAmount = bill.tax_amount || 0
  // Use bill.total_amount as the primary source, fallback to calculated if needed
  const grandTotal = bill.total_amount + tipAmount + taxAmount
  


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigateToDashboard} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Split Bill</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Read-only notification for non-creators */}
        {!canEdit && (
          <View style={styles.readOnlyNotification}>
            <View style={styles.readOnlyNotificationContent}>
              <Ionicons name="information-circle" size={20} color="#FF9500" />
              <View style={styles.readOnlyNotificationText}>
                <Text style={styles.readOnlyNotificationTitle}>View Only Mode</Text>
                <Text style={styles.readOnlyNotificationMessage}>
                  Only {bill.creator?.name || 'the bill creator'} can edit this {bill.status} bill
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Enhanced Bill Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Summary</Text>

          {/* Bill Header */}
          <View style={styles.billHeader}>
            <Text style={styles.billTitle}>{bill.title}</Text>
            {bill.description && <Text style={styles.billDescription}>{bill.description}</Text>}
          </View>

          {/* Group Info */}
          <View style={styles.groupInfo}>
            <View style={styles.groupInfoRow}>
              <Ionicons name="people-outline" size={16} color="#666" />
              <Text style={styles.groupInfoText}>
                {bill.group?.name} • {groupMembers.length} member{groupMembers.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>

          {/* Cost Breakdown */}
          <View style={styles.costBreakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Items Subtotal</Text>
              <Text style={styles.breakdownValue}>₹{itemsSubtotal.toFixed(2)}</Text>
            </View>

            {tipAmount > 0 && (
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownLabelWithIcon}>
                  <Text style={styles.breakdownLabel}>Tip</Text>
                  <TouchableOpacity style={styles.infoIcon}>
                    <Ionicons name="information-circle-outline" size={14} color="#999" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.breakdownValue}>₹{tipAmount.toFixed(2)}</Text>
              </View>
            )}

            {taxAmount > 0 && (
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownLabelWithIcon}>
                  <Text style={styles.breakdownLabel}>Tax</Text>
                  <TouchableOpacity style={styles.infoIcon}>
                    <Ionicons name="information-circle-outline" size={14} color="#999" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.breakdownValue}>₹{taxAmount.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.breakdownDivider} />

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabelTotal}>Grand Total</Text>
              <Text style={styles.breakdownValueTotal}>₹{grandTotal.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Split Mode Selection - Only show for creators or finalized bills */}
        {canEdit && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Split Method</Text>
            <View style={styles.splitModeContainer}>
            <TouchableOpacity
              style={[styles.splitModeButton, splitMode === "equal" && styles.splitModeButtonActive]}
              onPress={() => handleSplitModeChange("equal")}
            >
              <Ionicons name="people-outline" size={20} color={splitMode === "equal" ? "#FFFFFF" : "#007AFF"} />
              <Text style={[styles.splitModeText, splitMode === "equal" && styles.splitModeTextActive]}>
                Equal Split
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.splitModeButton, splitMode === "by_item" && styles.splitModeButtonActive]}
              onPress={() => handleSplitModeChange("by_item")}
            >
              <Ionicons name="list-outline" size={20} color={splitMode === "by_item" ? "#FFFFFF" : "#007AFF"} />
              <Text style={[styles.splitModeText, splitMode === "by_item" && styles.splitModeTextActive]}>
                By Items
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.splitModeButton, splitMode === "custom" && styles.splitModeButtonActive]}
              onPress={() => handleSplitModeChange("custom")}
            >
              <Ionicons name="calculator-outline" size={20} color={splitMode === "custom" ? "#FFFFFF" : "#007AFF"} />
              <Text style={[styles.splitModeText, splitMode === "custom" && styles.splitModeTextActive]}>Custom</Text>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {/* Split Results */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Split Results</Text>
            {!canEdit && (
              <View style={styles.readOnlyBadge}>
                <Ionicons name="eye-outline" size={14} color="#666" />
                <Text style={styles.readOnlyText}>View Only</Text>
              </View>
            )}
          </View>

          {splitMode === "custom" ? (
            /* Enhanced Custom Split */
            <View>
              <View style={styles.customSplitHeader}>
                <Ionicons name="calculator" size={20} color="#007AFF" />
                <Text style={styles.customSplitTitle}>Custom Split</Text>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={resetToEqualSplit}
                >
                  <Ionicons name="refresh-outline" size={16} color="#007AFF" />
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.customSplitContainer}>
                {groupMembers.map((member) => {
                  const memberAmount = customAmounts[member.id] || "0.00"

                  return (
                    <View
                      key={member.id}
                      style={styles.customSplitRow}
                    >
                      <View style={styles.customMemberInfo}>
                        <Text style={styles.customMemberName}>{member.name}</Text>
                      </View>
                      <View style={styles.customAmountInput}>
                        <Text style={styles.currencySymbol}>₹</Text>
                        <TextInput
                          value={memberAmount}
                          onChangeText={(value) => handleCustomAmountChange(member.id, value)}
                          onFocus={() => setFocusedInput(member.id)}
                          onBlur={() => setFocusedInput(null)}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          selectTextOnFocus={false}
                          style={styles.customInput}
                        />
                      </View>
                    </View>
                  )
                })}

                {/* Total and Balance Display */}
                <View style={styles.customSplitSummary}>
                  <View style={styles.customSplitTotal}>
                    <Text style={styles.totalLabel}>Current Total:</Text>
                    <Text style={[
                      styles.totalValue,
                      Math.abs(Object.values(customAmounts).reduce((sum, amount) => sum + (Number.parseFloat(amount) || 0), 0) - grandTotal) > 0.01
                        ? styles.totalValueError
                        : styles.totalValueSuccess
                    ]}>
                      ₹{Object.values(customAmounts)
                        .reduce((sum, amount) => sum + (Number.parseFloat(amount) || 0), 0)
                        .toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.customSplitTarget}>
                    <Text style={styles.targetLabel}>Target Total:</Text>
                    <Text style={styles.targetValue}>₹{grandTotal.toFixed(2)}</Text>
                  </View>

                  {Math.abs(Object.values(customAmounts).reduce((sum, amount) => sum + (Number.parseFloat(amount) || 0), 0) - grandTotal) > 0.01 && (
                    <View style={styles.balanceWarning}>
                      <Ionicons name="warning-outline" size={16} color="#FF3B30" />
                      <Text style={styles.balanceWarningText}>
                        Difference: ₹{Math.abs(Object.values(customAmounts).reduce((sum, amount) => sum + (Number.parseFloat(amount) || 0), 0) - grandTotal).toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Info Note */}
              <View style={styles.customSplitInfo}>
                <Text style={styles.customSplitInfoText}>
                  💡 Edit any amount and others will adjust automatically to maintain the total balance.
                </Text>
              </View>
            </View>
          ) : splitMode === "equal" ? (
            /* Enhanced Equal Split Results */
            <View>
              <View style={styles.equalSplitHeader}>
                <Ionicons name="people" size={20} color="#007AFF" />
                <Text style={styles.equalSplitTitle}>Equal Split Results</Text>
              </View>

              <View style={styles.equalSplitContainer}>
                {calculations.map((calc, index) => (
                  <View
                    key={calc.userId}
                    style={[
                      styles.equalSplitRow,
                      index === calculations.length - 1 && styles.equalSplitRowLast
                    ]}
                  >
                    <Text style={styles.equalSplitMemberName}>{getMemberName(calc.userId)}</Text>
                    <Text style={styles.equalSplitAmount}>₹{calc.amount.toFixed(2)}</Text>
                  </View>
                ))}

                {/* Total Sum Row */}
                <View style={styles.equalSplitTotal}>
                  <Text style={styles.equalSplitTotalLabel}>Total Split</Text>
                  <Text style={styles.equalSplitTotalAmount}>
                    ₹{calculations.reduce((sum, calc) => sum + calc.amount, 0).toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Info Note */}
              <View style={styles.equalSplitInfo}>
                <Text style={styles.equalSplitInfoText}>
                  💡 Each member pays an equal share of the total bill including tip and tax
                </Text>
              </View>
            </View>
          ) : splitMode === "by_item" ? (
            /* By Items Split Results */
            <View>
              <View style={styles.byItemsHeader}>
                <Ionicons name="list" size={20} color="#007AFF" />
                <Text style={styles.byItemsTitle}>By Items Split</Text>
              </View>

              {/* Bill Items with Assignments */}
              <View style={styles.itemsSection}>
                <Text style={styles.itemsSectionTitle}>Items & Assignments</Text>
                {billItems.map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemDetails}>
                          Qty: {item.quantity} × ₹{item.price.toFixed(2)} = ₹{(item.quantity * item.price).toFixed(2)}
                        </Text>
                      </View>
                      {canEdit && (
                        <TouchableOpacity
                          style={styles.editAssignmentButton}
                          onPress={() => openAssignmentModal(item)}
                        >
                          <Ionicons name="people-outline" size={16} color="#007AFF" />
                          <Text style={styles.editAssignmentText}>Edit</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.assignedMembers}>
                      <Text style={styles.assignedLabel}>Assigned to:</Text>
                      <View style={styles.memberChips}>
                        {item.assigned_users && item.assigned_users.length > 0 ? (
                          item.assigned_users.map((userId: string) => (
                            <View key={userId} style={styles.memberChip}>
                              <Text style={styles.memberChipText}>{getMemberName(userId)}</Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.noAssignmentText}>No one assigned</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Member Split Results */}
              <View style={styles.memberSplitSection}>
                <Text style={styles.memberSplitTitle}>Member Split Results</Text>
                <View style={styles.memberSplitContainer}>
                  {calculations.map((calc, index) => (
                    <View
                      key={calc.userId}
                      style={[
                        styles.memberSplitRow,
                        index === calculations.length - 1 && styles.memberSplitRowLast
                      ]}
                    >
                      <View style={styles.memberSplitInfo}>
                        <Text style={styles.memberSplitName}>{getMemberName(calc.userId)}</Text>
                        <Text style={styles.memberSplitItems}>Items: {calc.items.join(", ")}</Text>
                      </View>
                      <Text style={styles.memberSplitAmount}>₹{calc.amount.toFixed(2)}</Text>
                    </View>
                  ))}

                  {/* Total Sum Row */}
                  <View style={styles.memberSplitTotal}>
                    <Text style={styles.memberSplitTotalLabel}>Total Split</Text>
                    <Text style={styles.memberSplitTotalAmount}>
                      ₹{calculations.reduce((sum, calc) => sum + calc.amount, 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Info Note */}
                <View style={styles.byItemsInfo}>
                  <Text style={styles.byItemsInfoText}>
                    💡 Each member pays for their assigned items. Tip and tax are split equally among all members.
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            /* Custom Split Results */
            <View style={styles.splitResults}>
              {calculations.map((calc) => (
                <View key={calc.userId} style={styles.splitResultRow}>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{getMemberName(calc.userId)}</Text>
                  </View>
                  <Text style={styles.memberAmount}>₹{calc.amount.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Actions - Only show for creators or finalized bills */}
        {canEdit && (
          <View style={styles.section}>
            {splitMode === "custom" && (
              <View style={styles.saveValidation}>
                {Math.abs(Object.values(customAmounts).reduce((sum, amount) => sum + (Number.parseFloat(amount) || 0), 0) - grandTotal) > 0.01 ? (
                  <View style={styles.validationError}>
                    <Ionicons name="warning" size={16} color="#FF3B30" />
                    <Text style={styles.validationErrorText}>
                      Amounts must total ₹{grandTotal.toFixed(2)} to save
                    </Text>
                  </View>
                ) : (
                  <View style={styles.validationSuccess}>
                    <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                    <Text style={styles.validationSuccessText}>
                      Split is balanced and ready to save
                    </Text>
                  </View>
                )}
              </View>
            )}
            <Button
              title="Save Split"
              onPress={saveSplit}
              loading={saving}
              disabled={saving || (splitMode === "custom" && Math.abs(Object.values(customAmounts).reduce((sum, amount) => sum + (Number.parseFloat(amount) || 0), 0) - grandTotal) > 0.01)}
              variant="primary"
              style={styles.actionButton}
            />
          </View>
        )}
      </ScrollView>

      {/* Assignment Modal - Only show for creators or finalized bills */}
      {canEdit && showAssignmentModal && selectedItem && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Members</Text>
              <TouchableOpacity onPress={closeAssignmentModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalItemName}>{selectedItem.name}</Text>
              <Text style={styles.modalItemDetails}>
                ₹{selectedItem.price.toFixed(2)} × {selectedItem.quantity} = ₹{(selectedItem.price * selectedItem.quantity).toFixed(2)}
              </Text>

              <Text style={styles.modalSectionTitle}>Select Members:</Text>

              {groupMembers.map((member) => {
                const isAssigned = selectedItem.assigned_users?.includes(member.id) || false
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.memberOption, isAssigned && styles.memberOptionSelected]}
                    onPress={() => {
                      const currentAssignments = selectedItem.assigned_users || []
                      const newAssignments = isAssigned
                        ? currentAssignments.filter((id: string) => id !== member.id)
                        : [...currentAssignments, member.id]

                      // Validate that at least one member remains assigned
                      if (isAssigned && newAssignments.length === 0) {
                        Alert.alert(
                          "Assignment Required",
                          "At least one member must be assigned to each item.",
                          [{ text: "OK" }]
                        )
                        return
                      }

                      handleItemAssignmentChange(selectedItem.id, newAssignments)
                      setSelectedItem({ ...selectedItem, assigned_users: newAssignments })
                    }}
                  >
                    <View style={styles.memberOptionContent}>
                      <Text style={[styles.memberOptionText, isAssigned && styles.memberOptionTextSelected]}>
                        {member.name}
                      </Text>
                      {isAssigned && (
                        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      )}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Done"
                onPress={closeAssignmentModal}
                variant="primary"
              />
            </View>
          </View>
        </View>
      )}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 16,
  },
  billSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  billTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  billTotal: {
    fontSize: 24,
    fontWeight: "700",
    color: "#007AFF",
  },
  billMeta: {
    fontSize: 14,
    color: "#8E8E93",
  },
  splitModeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  splitModeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#007AFF",
  },
  splitModeButtonActive: {
    backgroundColor: "#007AFF",
  },
  splitModeText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#007AFF",
    marginLeft: 4,
  },
  splitModeTextActive: {
    color: "#FFFFFF",
  },
  splitResults: {},
  splitResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  memberItems: {
    fontSize: 12,
    color: "#8E8E93",
  },
  memberAmount: {
    fontSize: 18,
    fontWeight: "600",
    color: "#007AFF",
  },
  customSplitContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  customSplitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  customAmountInput: {
    flexDirection: "row",
    alignItems: "center",
    width: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  currencySymbol: {
    fontSize: 18,
    color: "#1C1C1E",
    marginRight: 8,
    fontWeight: "600",
  },
  customSplitTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    paddingTop: 16,
    marginTop: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#007AFF",
  },
  actionButton: {
    marginBottom: 12,
  },
  // Enhanced Bill Summary Styles
  billHeader: {
    marginBottom: 16,
  },
  billDescription: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  groupInfo: {
    marginBottom: 20,
  },
  groupInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  groupInfoText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 6,
  },
  costBreakdown: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  breakdownLabelWithIcon: {
    flexDirection: "row",
    alignItems: "center",
  },
  breakdownLabel: {
    fontSize: 14,
    color: "#666",
  },
  breakdownValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  breakdownLabelTotal: {
    fontSize: 16,
    color: "#1C1C1E",
    fontWeight: "600",
  },
  breakdownValueTotal: {
    fontSize: 18,
    color: "#007AFF",
    fontWeight: "700",
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginVertical: 12,
  },
  infoIcon: {
    marginLeft: 4,
    padding: 2,
  },
  // Enhanced Equal Split Results Styles
  equalSplitHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  equalSplitTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginLeft: 8,
  },
  equalSplitContainer: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
  },
  equalSplitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  equalSplitRowLast: {
    borderBottomWidth: 0,
  },
  equalSplitMemberName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
  },
  equalSplitAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  equalSplitTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 2,
    borderTopColor: "#007AFF",
    paddingTop: 12,
    marginTop: 8,
  },
  equalSplitTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  equalSplitTotalAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#007AFF",
  },
  equalSplitInfo: {
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  equalSplitInfoText: {
    fontSize: 12,
    color: "#1976D2",
    textAlign: "center",
  },
  // By Items Split Styles
  byItemsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  byItemsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginLeft: 8,
  },
  itemsSection: {
    marginBottom: 24,
  },
  itemsSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: "#666",
  },
  editAssignmentButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  editAssignmentText: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "500",
    marginLeft: 4,
  },
  assignedMembers: {
    marginTop: 8,
  },
  assignedLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 6,
  },
  memberChips: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  memberChip: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  memberChipText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  noAssignmentText: {
    fontSize: 12,
    color: "#FF3B30",
    fontStyle: "italic",
  },
  memberSplitSection: {
    marginTop: 16,
  },
  memberSplitTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  memberSplitContainer: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
  },
  memberSplitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  memberSplitRowLast: {
    borderBottomWidth: 0,
  },
  memberSplitInfo: {
    flex: 1,
  },
  memberSplitName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  memberSplitItems: {
    fontSize: 12,
    color: "#666",
  },
  memberSplitAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  memberSplitTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 2,
    borderTopColor: "#007AFF",
    paddingTop: 12,
    marginTop: 8,
  },
  memberSplitTotalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  memberSplitTotalAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#007AFF",
  },
  byItemsInfo: {
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  byItemsInfoText: {
    fontSize: 12,
    color: "#1976D2",
    textAlign: "center",
  },
  // Assignment Modal Styles
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    margin: 20,
    maxHeight: "80%",
    width: "90%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    color: "#1C1C1E",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
    maxHeight: 400,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  modalItemDetails: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 12,
  },
  memberOption: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  memberOptionSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  memberOptionContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberOptionText: {
    fontSize: 16,
    color: "#1C1C1E",
  },
  memberOptionTextSelected: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  // Enhanced Custom Split Styles
  customSplitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  customSplitTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginLeft: 8,
    flex: 1,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  resetButtonText: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "500",
    marginLeft: 4,
  },

  customMemberInfo: {
    flex: 1,
    justifyContent: "center",
  },
  customMemberName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 2,
  },

  saveValidation: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F8F9FA",
  },
  validationError: {
    flexDirection: "row",
    alignItems: "center",
  },
  validationErrorText: {
    fontSize: 14,
    color: "#FF3B30",
    marginLeft: 8,
    fontWeight: "500",
  },
  validationSuccess: {
    flexDirection: "row",
    alignItems: "center",
  },
  validationSuccessText: {
    fontSize: 14,
    color: "#34C759",
    marginLeft: 8,
    fontWeight: "500",
  },

  customInput: {
    textAlign: "right",
    fontWeight: "600",
    fontSize: 18,
    color: "#1C1C1E",
    paddingVertical: 4,
    minHeight: 24,
  },

  customSplitSummary: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  customSplitTarget: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  targetLabel: {
    fontSize: 14,
    color: "#666",
  },
  targetValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  totalValueSuccess: {
    color: "#34C759",
  },
  totalValueError: {
    color: "#FF3B30",
  },
  balanceWarning: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 8,
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
  },
  balanceWarningText: {
    fontSize: 12,
    color: "#FF3B30",
    marginLeft: 6,
    fontWeight: "500",
  },
  customSplitInfo: {
    backgroundColor: "#E3F2FD",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  customSplitInfoText: {
    fontSize: 12,
    color: "#1976D2",
    textAlign: "center",
  },
  // Access denied styles
  accessDeniedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#F8F9FA",
  },
  accessDeniedContent: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: 400,
    width: "100%",
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  accessDeniedMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 12,
  },
  accessDeniedSubMessage: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  readOnlyBillSummary: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: "100%",
  },
  readOnlyBillTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  readOnlyBillDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  readOnlyBillAmount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  accessDeniedButton: {
    width: "100%",
  },
  // Read-only indicator styles
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  readOnlyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  readOnlyText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
    fontWeight: "500",
  },

  // Read-only notification banner styles
  readOnlyNotification: {
    backgroundColor: "#FFF8E1",
    borderLeftWidth: 4,
    borderLeftColor: "#FF9500",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  readOnlyNotificationContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  readOnlyNotificationText: {
    flex: 1,
    marginLeft: 12,
  },
  readOnlyNotificationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E65100",
    marginBottom: 2,
  },
  readOnlyNotificationMessage: {
    fontSize: 12,
    color: "#F57C00",
    lineHeight: 16,
  },
})

export default BillSplitScreen
