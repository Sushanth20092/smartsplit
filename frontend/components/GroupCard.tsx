import type React from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { formatCurrency } from "../utils/formatters"
import type { Group } from "../types"

interface GroupCardProps {
  group: Group
  onPress: () => void
}

export const GroupCard: React.FC<GroupCardProps> = ({ group, onPress }) => {
  // Use memberCount from Dashboard query or fallback to members array
  const memberCount = (group as any).memberCount ?? (Array.isArray(group.members) ? group.members.length : 0)

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.name}>{group?.name || 'Unknown Group'}</Text>
        <Text style={styles.memberCount}>{memberCount} members</Text>
      </View>
      {group?.description && <Text style={styles.description}>{group.description}</Text>}
      <View style={styles.footer}>
        <Text style={styles.totalExpenses}>Total: {formatCurrency(group?.total_expenses || 0)}</Text>
      </View>
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
  name: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  memberCount: {
    fontSize: 14,
    color: "#666",
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
  },
  totalExpenses: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
})
