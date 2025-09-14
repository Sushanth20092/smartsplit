"use client"

import type React from "react"
import { useState, useCallback, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  Linking,
  Dimensions,
  BackHandler,
} from "react-native"
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RouteProp } from "@react-navigation/native"
import type { RootStackParamList, BillSplit } from "../types"
import { useAuth } from "../contexts/AuthProvider"
import { paymentService } from "../services/paymentService"
import { Button } from "../components/Button"
import { ProofSubmissionModal } from "../components/ProofSubmissionModal"
import { PaymentVerificationCard } from "../components/PaymentVerificationCard"
import { Ionicons } from "@expo/vector-icons"
import QRCode from 'react-native-qrcode-svg'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from "../services/supabase"

type PaymentScreenNavigationProp = StackNavigationProp<RootStackParamList, "Payment">
type PaymentScreenRouteProp = RouteProp<RootStackParamList, "Payment">

interface PaymentData {
  bill: any
  splits: any[]
  isCreator: boolean
  creatorUpiId?: string
  currentUserSplit?: any
}

const PaymentScreen: React.FC = () => {
  const navigation = useNavigation<PaymentScreenNavigationProp>()
  const route = useRoute<PaymentScreenRouteProp>()
  const { user } = useAuth()
  const { billId } = route.params

  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [verificationLoading, setVerificationLoading] = useState<string | null>(null)
  const [proofSubmitting, setProofSubmitting] = useState(false)
  const [showUpiPrompt, setShowUpiPrompt] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [showProofModal, setShowProofModal] = useState(false)
  const [selectedSplit, setSelectedSplit] = useState<any>(null)
  const [upiReference, setUpiReference] = useState("")

  const fetchPaymentData = async (showRefreshing = false, forceRefresh = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      else if (!forceRefresh) setLoading(true)
      
      if (!user) return

      const data = await paymentService.getBillPaymentData(billId, user.id)
      setPaymentData(data)

      // Log the current payment status for debugging
      if (data.currentUserSplit) {
        console.log('Current user payment status:', data.currentUserSplit.payment_status)
      }

      // Check if creator needs UPI setup
      if (data.isCreator) {
        // If UPI ID exists now, clear skip flag for this bill so we'll prompt again if user clears UPI later
        if (data.creatorUpiId) {
          try { await AsyncStorage.removeItem(`upiSkip:${billId}`) } catch {}
        } else {
          // No UPI: show prompt only if not skipped for this bill
          try {
            const skipped = await AsyncStorage.getItem(`upiSkip:${billId}`)
            if (skipped !== 'true') setShowUpiPrompt(true)
          } catch {
            setShowUpiPrompt(true)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching payment data:", error)
      if (!forceRefresh) {
        Alert.alert("Error", "Failed to load payment details")
      }
    } finally {
      setLoading(false)
      if (showRefreshing) setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchPaymentData()
      
      // Set up real-time subscription for bill_splits changes
      const subscription = supabase
        .channel(`bill_splits_${billId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bill_splits',
            filter: `bill_id=eq.${billId}`,
          },
          (payload) => {
            console.log('Bill splits changed:', payload)
            // Add a small delay to ensure database consistency before fetching
            setTimeout(() => {
              fetchPaymentData(false, true)
            }, 300)
          }
        )
        .subscribe()

      // Also subscribe to notifications for immediate feedback
      const notificationSubscription = supabase
        .channel(`notifications_${user?.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user?.id}`,
          },
          (payload) => {
            console.log('New notification received:', payload)
            // Refresh data when payment-related notifications are received
            const notificationType = payload.new?.type
            if (notificationType && ['payment_submitted', 'payment_confirmed', 'payment_rejected'].includes(notificationType)) {
              setTimeout(() => {
                fetchPaymentData(false, true)
              }, 300)
            }
          }
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
        notificationSubscription.unsubscribe()
      }
    }, [billId, user])
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

  const handleAddUpiId = () => {
    setShowUpiPrompt(false)
    navigation.navigate("Profile")
  }

  const handleSkipUpiSetup = async () => {
    try {
      // Remember skip per bill
      await AsyncStorage.setItem(`upiSkip:${billId}`, 'true')
    } catch (e) {
      console.warn('Failed to persist UPI skip flag', e)
    } finally {
      setShowUpiPrompt(false)
    }
  }

  const handleShowQR = (split: any) => {
    setSelectedSplit(split)
    setShowQRModal(true)
  }

  const handlePayWithUPI = async (upiLink: string) => {
    try {
      const supported = await Linking.canOpenURL(upiLink)
      if (supported) {
        await Linking.openURL(upiLink)
      } else {
        Alert.alert("Error", "No UPI app found on your device")
      }
    } catch (error) {
      console.error("Error opening UPI link:", error)
      Alert.alert("Error", "Failed to open UPI payment")
    }
  }

  const handleSubmitProof = async (proof: { screenshot?: string; referenceId?: string }) => {
    if (!user) return

    setProofSubmitting(true)
    try {
      await paymentService.submitPaymentProof(billId, user.id, proof)
      
      // Immediately refresh the payment data to show updated status
      await fetchPaymentData(false, true)
      
      Alert.alert("Success", "Payment proof submitted! The creator will review and confirm.")
    } catch (error) {
      console.error("Error submitting proof:", error)
      Alert.alert("Error", "Failed to submit payment proof")
      throw error
    } finally {
      setProofSubmitting(false)
    }
  }

  const handleConfirmPayment = async (splitId: string) => {
    const split = paymentData?.splits.find(s => s.id === splitId)
    if (!split) return

    setVerificationLoading(splitId)
    try {
      await paymentService.confirmPaymentProof(billId, split.user_id)
      
      // Immediately refresh the payment data to show updated status
      await fetchPaymentData(false, true)
      
      Alert.alert("Success", "Payment confirmed!")
    } catch (error) {
      console.error("Error confirming payment:", error)
      Alert.alert("Error", "Failed to confirm payment")
      throw error
    } finally {
      setVerificationLoading(null)
    }
  }

  const handleRejectPayment = async (splitId: string, reason: string) => {
    const split = paymentData?.splits.find(s => s.id === splitId)
    if (!split) return

    setVerificationLoading(splitId)
    try {
      await paymentService.rejectPaymentProof(billId, split.user_id, reason)
      
      // Immediately refresh the payment data to show updated status
      await fetchPaymentData(false, true)
      
      Alert.alert("Success", "Payment proof rejected. The member has been notified.")
    } catch (error) {
      console.error("Error rejecting payment:", error)
      Alert.alert("Error", "Failed to reject payment")
      throw error
    } finally {
      setVerificationLoading(null)
    }
  }

  const handleMarkAsReceived = async (payerUserId: string) => {
    setActionLoading(true)
    try {
      await paymentService.markPaymentAsReceived(billId, payerUserId)
      await fetchPaymentData()
      Alert.alert("Success", "Payment marked as received!")
    } catch (error) {
      console.error("Error marking payment as received:", error)
      Alert.alert("Error", "Failed to mark payment as received")
    } finally {
      setActionLoading(false)
    }
  }

  const onRefresh = () => {
    fetchPaymentData(true)
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "#34C759"
      case "submitted":
        return "#FF9500"
      case "rejected":
        return "#FF3B30"
      default:
        return "#8E8E93"
    }
  }

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
        return "checkmark-circle"
      case "submitted":
        return "time-outline"
      case "rejected":
        return "close-circle"
      default:
        return "ellipse-outline"
    }
  }

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Payment Confirmed"
      case "submitted":
        return "Proof Submitted"
      case "rejected":
        return "Proof Rejected"
      default:
        return "Payment Pending"
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading payment details...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!paymentData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Payment data not found</Text>
          <Button title="Go to Dashboard" onPress={() => navigation.navigate("Dashboard")} variant="primary" />
        </View>
      </SafeAreaView>
    )
  }

  const { bill, splits, isCreator, creatorUpiId, currentUserSplit } = paymentData

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Dashboard")} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isCreator ? "Receive Payments" : "Make Payment"}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Bill Header */}
        <View style={styles.section}>
          <View style={styles.billHeaderCard}>
            <Text style={styles.billTitle}>{bill.title}</Text>
            <Text style={styles.billGroup}>{bill.group?.name}</Text>
            <Text style={styles.billAmount}>₹{bill.total_amount.toFixed(2)}</Text>
          </View>
        </View>

        {/* Creator Mode - Receive Payments */}
        {isCreator && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Verification</Text>
            
            {/* Only show other members' payment verification - creator's share is settled by definition */}
            {splits.filter(split => split.user_id !== user?.id).length > 0 ? (
              splits.filter(split => split.user_id !== user?.id).map((split) => (
                <PaymentVerificationCard
                  key={split.id}
                  split={split}
                  onConfirm={handleConfirmPayment}
                  onReject={handleRejectPayment}
                  loading={verificationLoading === split.id}
                />
              ))
            ) : (
              <View style={styles.noMembersCard}>
                <Ionicons name="checkmark-circle" size={48} color="#34C759" />
                <Text style={styles.noMembersTitle}>No Members to Verify</Text>
                <Text style={styles.noMembersText}>
                  You are the only participant in this bill. Your payment is automatically settled.
                </Text>
              </View>
            )}

            {/* QR Code and Manual Mode Instructions */}
            {creatorUpiId ? (
              <View style={styles.qrModeCard}>
                <Ionicons name="qr-code-outline" size={24} color="#007AFF" />
                <View style={styles.qrModeContent}>
                  <Text style={styles.qrModeTitle}>QR Payment Mode</Text>
                  <Text style={styles.qrModeText}>
                    Members can scan QR codes to pay instantly. All payments require proof submission and your verification.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.manualModeCard}>
                <Ionicons name="information-circle-outline" size={24} color="#FF9500" />
                <View style={styles.manualModeContent}>
                  <Text style={styles.manualModeTitle}>Manual Payment Mode</Text>
                  <Text style={styles.manualModeText}>
                    Members will pay you directly and submit payment proof. You can then verify and confirm each payment.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Payer Mode - Make Payment */}
        {!isCreator && currentUserSplit && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Payment</Text>
            
            <View style={styles.paymentCard}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentLabel}>Amount to Pay</Text>
                <Text style={styles.paymentAmount}>₹{currentUserSplit.amount.toFixed(2)}</Text>
              </View>

              <View style={styles.paymentStatus}>
                <Ionicons 
                  name={getPaymentStatusIcon(currentUserSplit.payment_status)} 
                  size={24} 
                  color={getPaymentStatusColor(currentUserSplit.payment_status)} 
                />
                <Text style={[
                  styles.paymentStatusText,
                  { color: getPaymentStatusColor(currentUserSplit.payment_status) }
                ]}>
                  {getPaymentStatusText(currentUserSplit.payment_status)}
                </Text>
              </View>

              {/* Show rejection reason if rejected */}
              {currentUserSplit.payment_status === 'rejected' && currentUserSplit.rejection_reason && (
                <View style={styles.rejectionCard}>
                  <Ionicons name="warning-outline" size={20} color="#FF3B30" />
                  <View style={styles.rejectionContent}>
                    <Text style={styles.rejectionTitle}>Payment Rejected</Text>
                    <Text style={styles.rejectionReason}>{currentUserSplit.rejection_reason}</Text>
                  </View>
                </View>
              )}

              {/* Payment Actions - Hide if confirmed */}
              {currentUserSplit.payment_status !== 'confirmed' && (
                <View style={styles.paymentActions}>
                  {creatorUpiId && (
                    <Button
                      title={
                        currentUserSplit.payment_status === 'submitted' 
                          ? "Payment Pending Verification" 
                          : "Pay with UPI"
                      }
                      onPress={() => handleShowQR(currentUserSplit)}
                      variant={currentUserSplit.payment_status === 'submitted' ? "outline" : "primary"}
                      style={styles.payButton}
                      disabled={currentUserSplit.payment_status === 'submitted' || proofSubmitting}
                    />
                  )}

                  <Button
                    title={
                      proofSubmitting
                        ? "Submitting..."
                        : currentUserSplit.payment_status === 'rejected' 
                        ? "Resubmit Proof" 
                        : currentUserSplit.payment_status === 'submitted'
                        ? "Proof Submitted"
                        : "Mark as Paid"
                    }
                    onPress={() => setShowProofModal(true)}
                    variant={currentUserSplit.payment_status === 'submitted' ? "outline" : "secondary"}
                    style={styles.markPaidButton}
                    disabled={currentUserSplit.payment_status === 'submitted' || proofSubmitting}
                    loading={proofSubmitting}
                  />
                </View>
              )}

              {/* Show submitted proof info */}
              {currentUserSplit.payment_status === 'submitted' && (
                <View style={styles.submittedProofCard}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FF9500" />
                  <View style={styles.submittedProofContent}>
                    <Text style={styles.submittedProofTitle}>Proof Submitted</Text>
                    <Text style={styles.submittedProofText}>
                      Your payment proof has been submitted. Waiting for creator verification.
                    </Text>
                  </View>
                </View>
              )}

              {/* Show confirmed payment info */}
              {currentUserSplit.payment_status === 'confirmed' && (
                <View style={styles.confirmedPaymentCard}>
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                  <View style={styles.confirmedPaymentContent}>
                    <Text style={styles.confirmedPaymentTitle}>Payment Confirmed</Text>
                    <Text style={styles.confirmedPaymentText}>
                      Your payment has been confirmed by the bill creator.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* UPI Setup Prompt Modal */}
      <Modal
        visible={showUpiPrompt}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUpiPrompt(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.upiPromptContainer}>
            <Text style={styles.upiPromptTitle}>Add UPI ID</Text>
            <Text style={styles.upiPromptMessage}>
              Add your UPI ID to receive payments instantly via QR Code.
            </Text>
            
            <View style={styles.upiPromptButtons}>
              <Button
                title="Add UPI ID"
                onPress={handleAddUpiId}
                variant="primary"
                style={styles.upiPromptButton}
              />
              <Button
                title="Skip for now"
                onPress={handleSkipUpiSetup}
                variant="secondary"
                style={styles.upiPromptButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContainer}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>
                {isCreator ? "Payment QR Code" : "Pay with UPI"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowQRModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedSplit && creatorUpiId && (
              <View style={styles.qrContent}>
                <View style={styles.qrCodeContainer}>
                  <QRCode
                    value={`upi://pay?pa=${encodeURIComponent(creatorUpiId)}&pn=${encodeURIComponent(bill.creator?.name || "Bill Creator")}&am=${selectedSplit.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Payment for ${bill.title}`)}`}
                    size={200}
                    backgroundColor="white"
                    color="black"
                  />
                </View>

                <View style={styles.qrDetails}>
                  <Text style={styles.qrPayeeName}>{bill.creator?.name}</Text>
                  <Text style={styles.qrAmount}>₹{selectedSplit.amount.toFixed(2)}</Text>
                  <Text style={styles.qrDescription}>Payment for {bill.title}</Text>
                </View>

                {!isCreator && (
                  <Button
                    title="Open UPI App"
                    onPress={() => {
                      const upiLink = `upi://pay?pa=${encodeURIComponent(creatorUpiId)}&pn=${encodeURIComponent(bill.creator?.name || "Bill Creator")}&am=${selectedSplit.amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Payment for ${bill.title}`)}`
                      handlePayWithUPI(upiLink)
                    }}
                    variant="primary"
                    style={styles.openUpiButton}
                  />
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Proof Submission Modal */}
      <ProofSubmissionModal
        visible={showProofModal}
        onClose={() => setShowProofModal(false)}
        onSubmit={handleSubmitProof}
        billTitle={paymentData?.bill.title || ""}
        amount={currentUserSplit?.amount || 0}
        isResubmission={currentUserSplit?.payment_status === 'rejected'}
        existingProof={{
          upi_reference: currentUserSplit?.upi_reference,
          upi_screenshot_url: currentUserSplit?.upi_screenshot_url,
        }}
        // Disable cropping only on Make Payment page
        disableCrop={true}
      />
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
    color: "#000",
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
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
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    marginBottom: 16,
  },
  billHeaderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  billTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  billGroup: {
    fontSize: 16,
    color: "#666",
    marginBottom: 12,
  },
  billAmount: {
    fontSize: 32,
    fontWeight: "700",
    color: "#007AFF",
  },
  participantsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
  },
  participantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  participantAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#007AFF",
  },
  paymentActions: {
    alignItems: "flex-end",
  },
  paymentStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  paymentStatusText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  qrButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  qrButtonText: {
    fontSize: 12,
    color: "#007AFF",
    marginLeft: 4,
  },
  markReceivedButton: {
    backgroundColor: "#34C759",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  markReceivedButtonText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  paymentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
  },
  paymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  paymentLabel: {
    fontSize: 16,
    color: "#666",
  },
  paymentAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#007AFF",
  },
  payButton: {
    marginBottom: 12,
  },
  markPaidButton: {
    marginTop: 12,
  },
  manualModeCard: {
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 16,
  },
  manualModeContent: {
    flex: 1,
    marginLeft: 12,
  },
  manualModeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#856404",
    marginBottom: 4,
  },
  manualModeText: {
    fontSize: 14,
    color: "#856404",
    lineHeight: 20,
  },
  manualPaymentCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  manualPaymentTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  manualPaymentText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  referenceInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  upiPromptContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    margin: 20,
    alignItems: "center",
  },
  upiPromptTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  upiPromptMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  upiPromptButtons: {
    flexDirection: "row",
    gap: 12,
  },
  upiPromptButton: {
    flex: 1,
  },
  qrModalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    margin: 20,
    maxHeight: "80%",
  },
  qrModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  closeButton: {
    padding: 4,
  },
  qrContent: {
    padding: 24,
    alignItems: "center",
  },
  qrCodeContainer: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  qrDetails: {
    alignItems: "center",
    marginBottom: 24,
  },
  qrPayeeName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  qrAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#007AFF",
    marginBottom: 8,
  },
  qrDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  openUpiButton: {
    minWidth: 200,
  },
  // New styles for secure payment system
  qrModeCard: {
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 16,
  },
  qrModeContent: {
    flex: 1,
    marginLeft: 12,
  },
  qrModeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1976D2",
    marginBottom: 4,
  },
  qrModeText: {
    fontSize: 14,
    color: "#1976D2",
    lineHeight: 20,
  },
  rejectionCard: {
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  rejectionContent: {
    flex: 1,
    marginLeft: 8,
  },
  rejectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF3B30",
    marginBottom: 4,
  },
  rejectionReason: {
    fontSize: 14,
    color: "#C62828",
    fontStyle: "italic",
  },
  submittedProofCard: {
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 16,
  },
  submittedProofContent: {
    flex: 1,
    marginLeft: 8,
  },
  submittedProofTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F57C00",
    marginBottom: 4,
  },
  submittedProofText: {
    fontSize: 14,
    color: "#F57C00",
    lineHeight: 18,
  },

  // No members to verify card styles
  noMembersCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  noMembersTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#34C759",
    marginTop: 12,
    marginBottom: 8,
  },
  noMembersText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  // Confirmed payment card styles
  confirmedPaymentCard: {
    backgroundColor: "#E8F5E8",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 16,
  },
  confirmedPaymentContent: {
    flex: 1,
    marginLeft: 8,
  },
  confirmedPaymentTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#34C759",
    marginBottom: 4,
  },
  confirmedPaymentText: {
    fontSize: 14,
    color: "#2E7D32",
    lineHeight: 18,
  },
})

export default PaymentScreen