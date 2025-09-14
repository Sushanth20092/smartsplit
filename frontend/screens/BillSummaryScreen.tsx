"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
  Modal,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RouteProp } from "@react-navigation/native"
import type { RootStackParamList } from "../types"
import { useAuth } from "../contexts/AuthProvider"
import { supabase } from "../services/supabase"
import { Button } from "../components/Button"
import { Ionicons } from "@expo/vector-icons"
import { formatCurrency, formatRelativeTime } from "../utils/formatters"

type BillSummaryScreenNavigationProp = StackNavigationProp<RootStackParamList, "BillSummary">
type BillSummaryScreenRouteProp = RouteProp<RootStackParamList, "BillSummary">

interface BillSummaryData {
  bill: any
  splits: any[]
  group: any
}

const BillSummaryScreen: React.FC = () => {
  const navigation = useNavigation<BillSummaryScreenNavigationProp>()
  const route = useRoute<BillSummaryScreenRouteProp>()
  const { user } = useAuth()
  const { billId } = route.params

  const [summaryData, setSummaryData] = useState<BillSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  useEffect(() => {
    fetchBillSummary()
  }, [billId])

  const fetchBillSummary = async () => {
    try {
      setLoading(true)
      
      // Get bill details with creator and group info
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select(`
          *,
          creator:users!bills_created_by_fkey(id, name, email),
          group:groups(id, name)
        `)
        .eq("id", billId)
        .single()

      if (billError) throw billError

      // Get bill splits with user info and payment details
      const { data: splitsData, error: splitsError } = await supabase
        .from("bill_splits")
        .select(`
          *,
          users(id, name, email)
        `)
        .eq("bill_id", billId)
        .order("users(name)")

      if (splitsError) throw splitsError

      setSummaryData({
        bill: billData,
        splits: splitsData || [],
        group: billData.group
      })
    } catch (error) {
      console.error("Error fetching bill summary:", error)
      Alert.alert("Error", "Failed to load bill summary")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: '2-digit'
    })
  }

  const getPaymentStatusIcon = (status: string, isCreatorRow: boolean = false) => {
    if (isCreatorRow) {
      return "checkmark-circle"
    }
    switch (status) {
      case "confirmed":
        return "checkmark-circle"
      default:
        return "ellipse-outline"
    }
  }

  const getPaymentStatusColor = (status: string, isCreatorRow: boolean = false) => {
    if (isCreatorRow) {
      return "#34C759"
    }
    switch (status) {
      case "confirmed":
        return "#34C759"
      default:
        return "#8E8E93"
    }
  }

  const getPaymentStatusText = (status: string, isCreatorRow: boolean = false) => {
    if (isCreatorRow) {
      return "Paid (Up Front)"
    }
    switch (status) {
      case "confirmed":
        return "Confirmed"
      case "pending":
        return "Pending"
      case "submitted":
        return "Submitted"
      default:
        return "Not Paid"
    }
  }

  const handleViewProof = (split: any) => {
    if (split.upi_screenshot_url) {
      setSelectedImage(split.upi_screenshot_url)
      setShowImageModal(true)
    } else if (split.upi_reference) {
      Alert.alert(
        "Transaction Reference",
        `Transaction ID: ${split.upi_reference}`,
        [{ text: "OK" }]
      )
    }
  }

  const isCreator = (userId: string) => {
    return userId === summaryData?.bill.created_by
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading bill summary...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!summaryData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Bill summary not found</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} variant="primary" />
        </View>
      </SafeAreaView>
    )
  }

  const { bill, splits, group } = summaryData

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bill Summary</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Header Section */}
        <View style={styles.section}>
          <View style={styles.billHeaderCard}>
            <View style={styles.billTitleRow}>
              <Text style={styles.billTitle}>{bill.title}</Text>
              <View style={styles.settledBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text style={styles.settledBadgeText}>Settled</Text>
              </View>
            </View>
            
            <Text style={styles.billGroup}>{group?.name}</Text>
            <Text style={styles.billAmount}>{formatCurrency(bill.total_amount)}</Text>
            
            <View style={styles.billDates}>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Created</Text>
                <Text style={styles.dateValue}>{formatDate(bill.created_at)}</Text>
              </View>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Settled</Text>
                <Text style={styles.dateValue}>{formatDate(bill.settled_at)}</Text>
              </View>
            </View>
            
            <View style={styles.creatorInfo}>
              <Text style={styles.creatorLabel}>Created by</Text>
              <Text style={styles.creatorName}>{bill.creator?.name}</Text>
            </View>
          </View>
        </View>

        {/* Creator Payment Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Creator</Text>
          <View style={styles.creatorPaymentCard}>
            <View style={styles.creatorPaymentHeader}>
              <View style={styles.creatorPaymentInfo}>
                <Text style={styles.creatorPaymentName}>{bill.creator?.name}</Text>
                <Text style={styles.creatorPaymentLabel}>Paid the full amount upfront</Text>
              </View>
              <View style={styles.creatorPaymentAmount}>
                <Text style={styles.creatorAmountText}>{formatCurrency(bill.total_amount)}</Text>
                <Text style={styles.creatorStatusText}>Settled</Text>
              </View>
            </View>
            <View style={styles.creatorPaymentNote}>
              <Ionicons name="information-circle-outline" size={16} color="#007AFF" />
              <Text style={styles.creatorPaymentNoteText}>
                Creator paid upfront on {formatDate(bill.created_at)} and received reimbursements from other members.
              </Text>
            </View>
          </View>
        </View>

        {/* Participants Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Member Reimbursements</Text>
          
          {splits.filter(split => !isCreator(split.user_id)).length > 0 ? (
            <View style={styles.participantsTable}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.nameColumn]}>Member</Text>
                <Text style={[styles.tableHeaderText, styles.amountColumn]}>Amount</Text>
                <Text style={[styles.tableHeaderText, styles.statusColumn]}>Status</Text>
                <Text style={[styles.tableHeaderText, styles.proofColumn]}>Proof</Text>
              </View>

              {/* Table Rows - Only Non-Creator Participants */}
              {splits
                .filter(split => !isCreator(split.user_id))
                .map((split) => (
                  <View key={split.id} style={styles.tableRow}>
                    <View style={styles.nameColumn}>
                      <Text style={styles.memberName}>
                        {split.users?.name}
                      </Text>
                    </View>
                    
                    <View style={styles.amountColumn}>
                      <Text style={styles.memberAmount}>
                        {formatCurrency(split.amount)}
                      </Text>
                    </View>
                    
                    <View style={styles.statusColumn}>
                      <View style={styles.statusContainer}>
                        <Ionicons
                          name={getPaymentStatusIcon(split.payment_status)}
                          size={16}
                          color={getPaymentStatusColor(split.payment_status)}
                        />
                        <Text style={[
                          styles.statusText,
                          { color: getPaymentStatusColor(split.payment_status) }
                        ]}>
                          {getPaymentStatusText(split.payment_status)}
                        </Text>
                      </View>
                      <Text style={styles.paidDate}>
                        {split.paid_at ? formatDate(split.paid_at) : 'N/A'}
                      </Text>
                    </View>
                    
                    <View style={styles.proofColumn}>
                      <TouchableOpacity
                        style={styles.viewProofButton}
                        onPress={() => handleViewProof(split)}
                        disabled={!split.upi_screenshot_url && !split.upi_reference}
                      >
                        <Text style={[
                          styles.viewProofText,
                          (!split.upi_screenshot_url && !split.upi_reference) && styles.disabledText
                        ]}>
                          {split.upi_screenshot_url ? 'View Screenshot' : 
                           split.upi_reference ? 'View Txn ID' : 'No Proof'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
            </View>
          ) : (
            <View style={styles.noParticipantsCard}>
              <Text style={styles.noParticipantsText}>
                No other members participated in this bill.
              </Text>
            </View>
          )}
        </View>

        {/* Settlement Note */}
        <View style={styles.section}>
          <View style={styles.settlementNote}>
            <Ionicons name="information-circle-outline" size={20} color="#34C759" />
            <Text style={styles.settlementNoteText}>
              This bill was settled on {formatDate(bill.settled_at)}. All payments have been received and confirmed by the creator.
            </Text>
          </View>
        </View>

        {/* Back to Group Button */}
        <View style={styles.section}>
          <Button
            title="Back to Group"
            onPress={() => navigation.navigate("GroupDetails", { groupId: group.id })}
            variant="outline"
            style={styles.backToGroupButton}
          />
        </View>
      </ScrollView>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.imageModalOverlay}>
          <View style={styles.imageModalContainer}>
            <View style={styles.imageModalHeader}>
              <Text style={styles.imageModalTitle}>Payment Screenshot</Text>
              <TouchableOpacity
                onPress={() => setShowImageModal(false)}
                style={styles.imageModalClose}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
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
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  
  // Bill Header Card
  billHeaderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  billTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  billTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
    flex: 1,
  },
  settledBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#34C759",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  settledBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 4,
  },
  billGroup: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  billAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#007AFF",
    marginBottom: 16,
  },
  billDates: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  dateItem: {
    alignItems: "center",
  },
  dateLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  creatorInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  creatorLabel: {
    fontSize: 14,
    color: "#666",
  },
  creatorName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },

  // Creator Payment Card
  creatorPaymentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    overflow: "hidden",
  },
  creatorPaymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F8F9FA",
  },
  creatorPaymentInfo: {
    flex: 1,
  },
  creatorPaymentName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#007AFF",
    marginBottom: 4,
  },
  creatorPaymentLabel: {
    fontSize: 14,
    color: "#666",
  },
  creatorPaymentAmount: {
    alignItems: "flex-end",
  },
  creatorAmountText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 2,
  },
  creatorStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#34C759",
  },
  creatorPaymentNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  creatorPaymentNoteText: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
    marginLeft: 8,
    flex: 1,
  },

  // No Participants Card
  noParticipantsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    padding: 20,
    alignItems: "center",
  },
  noParticipantsText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
  },

  // Participants Table
  participantsTable: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  creatorRow: {
    backgroundColor: "#F8F9FA",
    borderLeftWidth: 3,
    borderLeftColor: "#007AFF",
  },
  nameColumn: {
    flex: 2,
    justifyContent: "center",
  },
  amountColumn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  statusColumn: {
    flex: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  proofColumn: {
    flex: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  creatorRowText: {
    color: "#007AFF",
    fontWeight: "700",
  },
  creatorTag: {
    fontSize: 12,
    color: "#007AFF",
    fontWeight: "normal",
  },
  memberAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  paidDate: {
    fontSize: 10,
    color: "#666",
  },
  viewProofButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewProofText: {
    fontSize: 12,
    color: "#007AFF",
    textAlign: "center",
  },
  autoProofText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
  },
  disabledText: {
    color: "#999",
  },

  // Settlement Note
  settlementNote: {
    backgroundColor: "#E8F5E8",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  settlementNoteText: {
    fontSize: 14,
    color: "#2E7D32",
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },

  // Back to Group Button
  backToGroupButton: {
    marginBottom: 20,
  },

  // Image Modal
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalContainer: {
    width: "90%",
    height: "80%",
    backgroundColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
  },
  imageModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  imageModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  imageModalClose: {
    padding: 4,
  },
  fullScreenImage: {
    flex: 1,
    width: "100%",
  },
})

export default BillSummaryScreen