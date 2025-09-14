"use client"

import React, { useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  Alert,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Button } from "./Button"

interface PaymentVerificationCardProps {
  split: {
    id: string
    user_id: string
    amount: number
    payment_status: "pending" | "submitted" | "confirmed" | "rejected"
    upi_reference?: string
    upi_screenshot_url?: string
    rejection_reason?: string
    users?: {
      name: string
      email: string
    }
  }
  onConfirm: (splitId: string) => Promise<void>
  onReject: (splitId: string, reason: string) => Promise<void>
  loading?: boolean
}

export const PaymentVerificationCard: React.FC<PaymentVerificationCardProps> = ({
  split,
  onConfirm,
  onReject,
  loading = false,
}) => {
  const [showImageModal, setShowImageModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const getStatusColor = (status: string) => {
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

  const getStatusIcon = (status: string) => {
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

  const getStatusText = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmed"
      case "submitted":
        return "Proof Submitted"
      case "rejected":
        return "Rejected"
      default:
        return "No Proof"
    }
  }

  const handleConfirm = async () => {
    setActionLoading(true)
    try {
      await onConfirm(split.id)
      // Don't show success alert here as parent will handle it
    } catch (error) {
      console.error("Error confirming payment:", error)
      Alert.alert("Error", "Failed to confirm payment")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert("Reason Required", "Please provide a reason for rejecting this payment proof.")
      return
    }

    setActionLoading(true)
    try {
      await onReject(split.id, rejectionReason.trim())
      setShowRejectModal(false)
      setRejectionReason("")
      // Don't show success alert here as parent will handle it
    } catch (error) {
      console.error("Error rejecting payment:", error)
      Alert.alert("Error", "Failed to reject payment")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{split.users?.name || "Unknown User"}</Text>
            <Text style={styles.userAmount}>₹{split.amount.toFixed(2)}</Text>
          </View>
          
          <View style={styles.statusContainer}>
            <Ionicons
              name={getStatusIcon(split.payment_status)}
              size={20}
              color={getStatusColor(split.payment_status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(split.payment_status) }]}>
              {getStatusText(split.payment_status)}
            </Text>
          </View>
        </View>

        {/* Show proof details if submitted */}
        {split.payment_status === "submitted" && (
          <View style={styles.proofSection}>
            <Text style={styles.proofTitle}>Payment Proof:</Text>
            
            {split.upi_screenshot_url && (
              <TouchableOpacity
                style={styles.screenshotContainer}
                onPress={() => setShowImageModal(true)}
              >
                <Image
                  source={{ uri: split.upi_screenshot_url }}
                  style={styles.screenshotThumbnail}
                />
                <View style={styles.screenshotOverlay}>
                  <Ionicons name="expand-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.screenshotText}>Tap to view</Text>
                </View>
              </TouchableOpacity>
            )}

            {split.upi_reference && (
              <View style={styles.referenceContainer}>
                <Text style={styles.referenceLabel}>Transaction ID:</Text>
                <Text style={styles.referenceValue}>{split.upi_reference}</Text>
              </View>
            )}

            <View style={styles.actionButtons}>
              <Button
                title="Confirm"
                onPress={handleConfirm}
                variant="primary"
                size="small"
                loading={actionLoading}
                disabled={loading || actionLoading}
                style={styles.confirmButton}
              />
              <Button
                title="Reject"
                onPress={() => setShowRejectModal(true)}
                variant="outline"
                size="small"
                disabled={loading || actionLoading}
                style={styles.rejectButton}
              />
            </View>
          </View>
        )}

        {/* Show rejection reason if rejected */}
        {split.payment_status === "rejected" && split.rejection_reason && (
          <View style={styles.rejectionSection}>
            <Text style={styles.rejectionTitle}>Rejection Reason:</Text>
            <Text style={styles.rejectionReason}>{split.rejection_reason}</Text>
          </View>
        )}
      </View>

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
            {split.upi_screenshot_url && (
              <Image
                source={{ uri: split.upi_screenshot_url }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.rejectModalOverlay}>
          <View style={styles.rejectModalContainer}>
            <View style={styles.rejectModalHeader}>
              <Text style={styles.rejectModalTitle}>Reject Payment Proof</Text>
              <TouchableOpacity
                onPress={() => setShowRejectModal(false)}
                style={styles.rejectModalClose}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.rejectModalContent}>
              <Text style={styles.rejectModalLabel}>
                Please provide a reason for rejecting this payment proof:
              </Text>
              <TextInput
                style={styles.rejectReasonInput}
                placeholder="e.g., Screenshot is unclear, wrong amount, etc."
                value={rejectionReason}
                onChangeText={setRejectionReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.rejectModalFooter}>
              <Button
                title="Cancel"
                onPress={() => setShowRejectModal(false)}
                variant="outline"
                style={styles.rejectModalButton}
              />
              <Button
                title="Reject"
                onPress={handleReject}
                variant="primary"
                loading={actionLoading}
                disabled={actionLoading}
                style={styles.rejectModalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 4,
  },
  userAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#007AFF",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  proofSection: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 12,
  },
  proofTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  screenshotContainer: {
    position: "relative",
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  screenshotThumbnail: {
    width: 120,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
  },
  screenshotOverlay: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  screenshotText: {
    fontSize: 10,
    color: "#FFFFFF",
    marginLeft: 2,
  },
  referenceContainer: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  referenceLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  referenceValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  confirmButton: {
    flex: 1,
  },
  rejectButton: {
    flex: 1,
  },
  rejectionSection: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    paddingTop: 12,
  },
  rejectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF3B30",
    marginBottom: 4,
  },
  rejectionReason: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  // Image Modal Styles
  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalContainer: {
    flex: 1,
    width: "100%",
  },
  imageModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
  },
  imageModalTitle: {
    fontSize: 18,
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
  // Reject Modal Styles
  rejectModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  rejectModalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    margin: 20,
    width: "90%",
    maxWidth: 400,
  },
  rejectModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  rejectModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  rejectModalClose: {
    padding: 4,
  },
  rejectModalContent: {
    padding: 20,
  },
  rejectModalLabel: {
    fontSize: 16,
    color: "#000",
    marginBottom: 12,
  },
  rejectReasonInput: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000",
    minHeight: 80,
  },
  rejectModalFooter: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
  },
  rejectModalButton: {
    flex: 1,
  },
})