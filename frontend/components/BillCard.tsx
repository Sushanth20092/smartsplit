import type React from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { formatCurrency, formatRelativeTime } from "../utils/formatters"
import type { Bill } from "../types"

interface BillCardProps {
  bill: Bill
  onPress: () => void
}

export const BillCard: React.FC<BillCardProps> = ({ bill, onPress }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "#007AFF"
      case "pending":
        return "#FF9500"
      case "approved":
        return "#34C759"
      case "settled":
        return "#8E8E93"
      case "cancelled":
        return "#FF3B30"
      default:
        return "#666"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "draft":
        return "DRAFT"
      case "pending":
        return "PENDING APPROVAL"
      case "approved":
        return "APPROVED - WAITING FOR PAYMENT"
      case "settled":
        return "SETTLED"
      case "cancelled":
        return "CANCELLED"
      default:
        return status.toUpperCase()
    }
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{bill.title}</Text>
          {bill.group?.name && (
            <Text style={styles.groupName}>{bill.group.name}</Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(bill.status) }]}>
          <Text style={styles.statusText}>{getStatusText(bill.status)}</Text>
        </View>
      </View>
      {bill.description && <Text style={styles.description}>{bill.description}</Text>}
      <View style={styles.footer}>
        <Text style={styles.amount}>{formatCurrency(bill.total_amount, bill.currency)}</Text>
        <Text style={styles.date}>{formatRelativeTime(bill.created_at)}</Text>
      </View>
      <Text style={styles.itemCount}>
        {bill.items.length} item{bill.items.length !== 1 ? "s" : ""}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  groupName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#007AFF",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  amount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#007AFF",
  },
  date: {
    fontSize: 14,
    color: "#666",
  },
  itemCount: {
    fontSize: 12,
    color: "#999",
  },
})
