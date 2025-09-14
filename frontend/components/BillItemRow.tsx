import type React from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { formatCurrency } from "../utils/formatters"
import type { BillItem } from "../types"

interface BillItemRowProps {
  item: BillItem
  onPress?: () => void
  editable?: boolean
  onDelete?: () => void
}

export const BillItemRow: React.FC<BillItemRowProps> = ({ item, onPress, editable = false, onDelete }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} disabled={!onPress}>
      <View style={styles.content}>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          {item.category && <Text style={styles.category}>{item.category}</Text>}
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.quantity}>×{item.quantity}</Text>
          <Text style={styles.price}>{formatCurrency(item.price * item.quantity)}</Text>
        </View>
      </View>
      {editable && onDelete && (
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteText}>×</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    color: "#666",
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  quantity: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  price: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  deleteButton: {
    marginLeft: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
})
