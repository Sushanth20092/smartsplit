"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  RefreshControl,
  BackHandler,
} from "react-native"
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RouteProp } from "@react-navigation/native"
import type { RootStackParamList, Bill, User, BillSplit, BillItem } from "../types"
import { useAuth } from "../contexts/AuthProvider"
import { supabase } from "../../backend/supabase/client"
import { paymentService } from "../services/paymentService"
import { Button } from "../components/Button"
import { Ionicons } from "@expo/vector-icons"

type ApprovalScreenNavigationProp = StackNavigationProp<RootStackParamList, "Approval">
type ApprovalScreenRouteProp = RouteProp<RootStackParamList, "Approval">

const ApprovalScreen: React.FC = () => {
  const navigation = useNavigation<ApprovalScreenNavigationProp>()
  const route = useRoute<ApprovalScreenRouteProp>()
  const { user } = useAuth()
  const { billId } = route.params

  const [bill, setBill] = useState<Bill | null>(null)
  const [billItems, setBillItems] = useState<BillItem[]>([])
  const [billSplits, setBillSplits] = useState<BillSplit[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [statusChanged, setStatusChanged] = useState(false)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchBillData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      
      // Fetch bill details with creator and group info
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

      // Fetch bill items
      const { data: itemsData, error: itemsError } = await supabase
        .from("bill_items")
        .select("*")
        .eq("bill_id", billId)

      if (itemsError) throw itemsError

      // Fetch bill splits with user info and approval status
      const { data: splitsData, error: splitsError } = await supabase
        .from("bill_splits")
        .select(`
          *,
          users(id, name, email)
        `)
        .eq("bill_id", billId)

      if (splitsError) throw splitsError

      // Check if bill status changed from pending to draft while viewing
      if (bill && bill.status === 'pending' && billData.status === 'draft') {
        setStatusChanged(true)
      }

      // Check if bill status changed from pending to approved - redirect to payment
      if (bill && bill.status === 'pending' && billData.status === 'approved') {
        console.log('Bill approved! Redirecting to Payment screen...')
        // Update the bill state first to show approved UI
        setBill(billData)
        setBillItems(itemsData || [])
        setBillSplits(splitsData || [])
        
        // Show success message and redirect after delay
        Alert.alert(
          "🎉 Bill Approved!",
          "All members have approved this bill. Redirecting to payment screen...",
          [
            {
              text: "Go to Payment",
              onPress: () => navigation.replace("Payment", { billId })
            }
          ]
        )
        return
      }

      setBill(billData)
      setBillItems(itemsData || [])
      setBillSplits(splitsData || [])
    } catch (error) {
      console.error("Error fetching bill data:", error)
      Alert.alert("Error", "Failed to load bill details")
    } finally {
      setLoading(false)
      if (showRefreshing) setRefreshing(false)
    }
  }

  // Live status updates - poll every 5 seconds when bill is pending
  useEffect(() => {
    if (bill?.status === 'pending') {
      pollIntervalRef.current = setInterval(() => {
        fetchBillData()
      }, 5000)
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [bill?.status])

  useFocusEffect(
    useCallback(() => {
      fetchBillData()
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
      }
    }, [billId]),
  )

  // Handle hardware back button to navigate to Dashboard
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate("Dashboard")
        return true // Prevent default back behavior
      }

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)
      return () => subscription.remove()
    }, [])
  )

  // Helper functions
  const isCreator = user?.id === bill?.created_by
  const isDraft = bill?.status === 'draft'
  const isPending = bill?.status === 'pending'
  const isApproved = bill?.status === 'approved'
  const canViewOnly = isDraft && !isCreator

  // Get current user's split info
  const currentUserSplit = billSplits.find(split => split.user_id === user?.id)
  const canApprove = isPending && currentUserSplit && currentUserSplit.approval_status === 'pending' && !isCreator
  const hasRejections = billSplits.some(split => split.approval_status === 'rejected')

  // Calculate totals
  const itemsSubtotal = billItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const tipAmount = bill?.tip_amount || 0
  const taxAmount = bill?.tax_amount || 0
  const grandTotal = itemsSubtotal + tipAmount + taxAmount

  // Approval actions
  const handleApprove = async () => {
    if (!user || !bill) return
    
    setActionLoading(true)
    try {
      await paymentService.approveBillSplit(billId, user.id)
      await fetchBillData()
      Alert.alert("Success", "You have approved this bill split.")
    } catch (error) {
      console.error("Error approving bill:", error)
      Alert.alert("Error", "Failed to approve bill. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!user || !bill) return

    Alert.alert(
      "Reject Bill Split",
      "Are you sure you want to reject this bill split? The creator will be notified.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true)
            try {
              await paymentService.rejectBillSplit(billId, user.id)
              await fetchBillData()
              Alert.alert("Success", "You have rejected this bill split. The creator has been notified.")
            } catch (error) {
              console.error("Error rejecting bill:", error)
              Alert.alert("Error", "Failed to reject bill. Please try again.")
            } finally {
              setActionLoading(false)
            }
          }
        }
      ]
    )
  }

  const handleRevertToDraft = async () => {
    if (!user || !bill) return

    Alert.alert(
      "Revert to Draft",
      "This will revert the bill to draft status and reset all approval statuses. You can then edit and re-save the bill.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revert",
          onPress: async () => {
            setActionLoading(true)
            try {
              await paymentService.revertBillToDraft(billId, user.id)
              Alert.alert("Success", "Bill reverted to draft. You can now edit it.", [
                {
                  text: "Edit Bill",
                  onPress: () => navigation.navigate("BillSplit", { billId })
                },
                { text: "OK" }
              ])
            } catch (error) {
              console.error("Error reverting bill:", error)
              Alert.alert("Error", "Failed to revert bill. Please try again.")
            } finally {
              setActionLoading(false)
            }
          }
        }
      ]
    )
  }

  const onRefresh = () => {
    fetchBillData(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#FF9500'
      case 'pending': return '#007AFF'
      case 'approved': return '#34C759'
      case 'settled': return '#8E8E93'
      case 'cancelled': return '#FF3B30'
      default: return '#8E8E93'
    }
  }

  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FF9500'
      case 'approved': return '#34C759'
      case 'rejected': return '#FF3B30'
      default: return '#8E8E93'
    }
  }

  const getApprovalStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'time-outline'
      case 'approved': return 'checkmark-circle'
      case 'rejected': return 'close-circle'
      default: return 'help-circle-outline'
    }
  }

  const getSplitMethodDisplay = (method?: string) => {
    switch (method) {
      case 'equal': return 'Equal Split'
      case 'by_item': return 'By Items'
      case 'custom': return 'Custom Split'
      default: return 'Equal Split'
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

  if (!bill) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Bill not found</Text>
          <Button title="Go to Dashboard" onPress={() => navigation.navigate("Dashboard")} variant="primary" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Dashboard")} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bill Approval</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Status Change Alert */}
        {statusChanged && (
          <View style={styles.statusChangeAlert}>
            <View style={styles.statusChangeContent}>
              <Ionicons name="information-circle" size={20} color="#FF9500" />
              <Text style={styles.statusChangeText}>
                This bill has been reverted to Draft by the creator. Please wait for the updated split.
              </Text>
            </View>
          </View>
        )}

        {/* View Only Mode Alert */}
        {canViewOnly && (
          <View style={styles.viewOnlyAlert}>
            <View style={styles.viewOnlyContent}>
              <Ionicons name="eye-outline" size={20} color="#666" />
              <Text style={styles.viewOnlyText}>
                View only mode - Only the creator can edit draft bills
              </Text>
            </View>
          </View>
        )}

        {/* Bill Header */}
        <View style={styles.section}>
          <View style={styles.billHeaderCard}>
            <View style={styles.billHeaderTop}>
              <View style={styles.billTitleContainer}>
                <Text style={styles.billTitle}>{bill.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(bill.status) }]}>
                  <Text style={styles.statusBadgeText}>{bill.status.toUpperCase()}</Text>
                </View>
              </View>
              {bill.description && (
                <Text style={styles.billDescription}>{bill.description}</Text>
              )}
            </View>

            <View style={styles.billMetadata}>
              <View style={styles.metadataRow}>
                <Ionicons name="people-outline" size={16} color="#666" />
                <Text style={styles.metadataText}>{bill.group?.name}</Text>
              </View>
              <View style={styles.metadataRow}>
                <Ionicons name="person-outline" size={16} color="#666" />
                <Text style={styles.metadataText}>Created by {bill.creator?.name}</Text>
              </View>
              <View style={styles.metadataRow}>
                <Ionicons name="calendar-outline" size={16} color="#666" />
                <Text style={styles.metadataText}>
                  {new Date(bill.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bill Split Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Split Summary</Text>
          
          {/* Cost Breakdown */}
          <View style={styles.costBreakdownCard}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Items Subtotal</Text>
              <Text style={styles.breakdownValue}>₹{itemsSubtotal.toFixed(2)}</Text>
            </View>

            {tipAmount > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Tip</Text>
                <Text style={styles.breakdownValue}>₹{tipAmount.toFixed(2)}</Text>
              </View>
            )}

            {taxAmount > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Tax</Text>
                <Text style={styles.breakdownValue}>₹{taxAmount.toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.breakdownDivider} />

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabelTotal}>Grand Total</Text>
              <Text style={styles.breakdownValueTotal}>₹{grandTotal.toFixed(2)}</Text>
            </View>

            <View style={styles.splitMethodRow}>
              <Text style={styles.splitMethodLabel}>Split Method:</Text>
              <Text style={styles.splitMethodValue}>{getSplitMethodDisplay(bill.split_method)}</Text>
            </View>
          </View>
        </View>

        {/* Participants List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants ({billSplits.length})</Text>
          
          <View style={styles.participantsCard}>
            {billSplits.map((split, index) => (
              <View 
                key={split.id} 
                style={[
                  styles.participantRow,
                  index === billSplits.length - 1 && styles.participantRowLast
                ]}
              >
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>{split.users?.name || 'Unknown User'}</Text>
                  <Text style={styles.participantAmount}>₹{split.amount.toFixed(2)}</Text>
                </View>
                
                <View style={styles.approvalStatus}>
                  <Ionicons 
                    name={getApprovalStatusIcon(split.approval_status)} 
                    size={20} 
                    color={getApprovalStatusColor(split.approval_status)} 
                  />
                  <Text style={[
                    styles.approvalStatusText,
                    { color: getApprovalStatusColor(split.approval_status) }
                  ]}>
                    {split.approval_status.charAt(0).toUpperCase() + split.approval_status.slice(1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* By Items Details (if applicable) */}
        {bill.split_method === 'by_item' && billItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Item Assignments</Text>
            
            <View style={styles.itemsCard}>
              {billItems.map((item, index) => (
                <View 
                  key={item.id} 
                  style={[
                    styles.itemRow,
                    index === billItems.length - 1 && styles.itemRowLast
                  ]}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemDetails}>
                      Qty: {item.quantity} × ₹{item.price.toFixed(2)} = ₹{(item.quantity * item.price).toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.assignedUsers}>
                    <Text style={styles.assignedLabel}>Assigned to:</Text>
                    <View style={styles.assignedChips}>
                      {item.assigned_users && item.assigned_users.length > 0 ? (
                        item.assigned_users.map((userId: string) => {
                          const user = billSplits.find(split => split.user_id === userId)?.users
                          return (
                            <View key={userId} style={styles.assignedChip}>
                              <Text style={styles.assignedChipText}>{user?.name || 'Unknown'}</Text>
                            </View>
                          )
                        })
                      ) : (
                        <Text style={styles.noAssignmentText}>No one assigned</Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Approval Actions - Only for non-creator participants */}
        {canApprove && !statusChanged && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Action Required</Text>
            
            <View style={styles.actionsCard}>
              <Text style={styles.actionsMessage}>
                Please review the bill split above and approve or reject it.
              </Text>
              
              <View style={styles.actionButtons}>
                <Button
                  title="Approve"
                  onPress={handleApprove}
                  loading={actionLoading}
                  disabled={actionLoading}
                  variant="primary"
                  style={styles.approveButton}
                />
                
                <Button
                  title="Reject"
                  onPress={handleReject}
                  loading={actionLoading}
                  disabled={actionLoading}
                  variant="secondary"
                  style={styles.rejectButton}
                />
              </View>
            </View>
          </View>
        )}

        {/* Creator Info - Show why creator doesn't need to approve */}
        {isCreator && isPending && !hasRejections && (
          <View style={styles.section}>
            <View style={styles.creatorInfoCard}>
              <View style={styles.creatorInfoContent}>
                <Ionicons name="information-circle-outline" size={24} color="#007AFF" />
                <View style={styles.creatorInfoText}>
                  <Text style={styles.creatorInfoTitle}>You're the Bill Creator</Text>
                  <Text style={styles.creatorInfoMessage}>
                    As the creator, you're automatically approved. Waiting for other participants to approve or reject.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Creator Actions (for rejections) */}
        {isCreator && hasRejections && isPending && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Creator Actions</Text>
            
            <View style={styles.creatorActionsCard}>
              <View style={styles.rejectionNotice}>
                <Ionicons name="warning-outline" size={20} color="#FF3B30" />
                <Text style={styles.rejectionNoticeText}>
                  Some members have rejected this bill split. You can revert to draft and make changes.
                </Text>
              </View>
              
              <Button
                title="Revert to Draft & Edit"
                onPress={handleRevertToDraft}
                loading={actionLoading}
                disabled={actionLoading}
                variant="secondary"
                style={styles.revertButton}
              />
            </View>
          </View>
        )}

        {/* Success Message for Approved Bills */}
        {isApproved && (
          <View style={styles.section}>
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={48} color="#34C759" />
              <Text style={styles.successTitle}>Bill Approved!</Text>
              <Text style={styles.successMessage}>
                All members have approved this bill split. The bill is now ready for payment processing.
              </Text>
              
              <Button
                title={isCreator ? "Receive Payments" : "Make Payment"}
                onPress={() => navigation.replace("Payment", { billId })}
                variant="primary"
                style={styles.paymentButton}
              />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Back to Dashboard"
          onPress={() => navigation.navigate("Dashboard")}
          variant="primary"
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
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
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    color: "#FF3B30",
    marginBottom: 20,
    textAlign: "center",
  },
  
  // Alert styles
  statusChangeAlert: {
    backgroundColor: "#FFF3CD",
    borderColor: "#FFEAA7",
    borderWidth: 1,
    borderRadius: 8,
    margin: 16,
    padding: 12,
  },
  statusChangeContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusChangeText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#856404",
  },
  viewOnlyAlert: {
    backgroundColor: "#E3F2FD",
    borderColor: "#BBDEFB",
    borderWidth: 1,
    borderRadius: 8,
    margin: 16,
    padding: 12,
  },
  viewOnlyContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewOnlyText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#1565C0",
  },

  // Section styles
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 12,
    marginHorizontal: 16,
  },

  // Bill header card
  billHeaderCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  billHeaderTop: {
    marginBottom: 16,
  },
  billTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  billTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  billDescription: {
    fontSize: 16,
    color: "#666",
    lineHeight: 22,
  },
  billMetadata: {
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    paddingTop: 16,
  },
  metadataRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  metadataText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },

  // Cost breakdown card
  costBreakdownCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: "#666",
  },
  breakdownValue: {
    fontSize: 14,
    color: "#1C1C1E",
    fontWeight: "500",
  },
  breakdownLabelTotal: {
    fontSize: 16,
    color: "#1C1C1E",
    fontWeight: "600",
  },
  breakdownValueTotal: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "700",
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginVertical: 12,
  },
  splitMethodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  splitMethodLabel: {
    fontSize: 14,
    color: "#666",
  },
  splitMethodValue: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },

  // Participants card
  participantsCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  participantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  participantRowLast: {
    borderBottomWidth: 0,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  participantAmount: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  approvalStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  approvalStatusText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 6,
  },

  // Items card (for by_item splits)
  itemsCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemInfo: {
    marginBottom: 12,
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
  assignedUsers: {
    marginTop: 8,
  },
  assignedLabel: {
    fontSize: 12,
    color: "#8E8E93",
    marginBottom: 6,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  assignedChips: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  assignedChip: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  assignedChipText: {
    fontSize: 12,
    color: "#1565C0",
    fontWeight: "500",
  },
  noAssignmentText: {
    fontSize: 12,
    color: "#8E8E93",
    fontStyle: "italic",
  },

  // Actions card
  actionsCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionsMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  approveButton: {
    flex: 1,
  },
  rejectButton: {
    flex: 1,
  },

  // Creator info card
  creatorInfoCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  creatorInfoContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  creatorInfoText: {
    flex: 1,
    marginLeft: 12,
  },
  creatorInfoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  creatorInfoMessage: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },

  // Creator actions card
  creatorActionsCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rejectionNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF5F5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  rejectionNoticeText: {
    flex: 1,
    fontSize: 14,
    color: "#C53030",
    marginLeft: 8,
    lineHeight: 20,
  },
  revertButton: {
    width: "100%",
  },

  // Success card
  successCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  successMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  paymentButton: {
    minWidth: 200,
  },

  footer: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
})

export default ApprovalScreen
