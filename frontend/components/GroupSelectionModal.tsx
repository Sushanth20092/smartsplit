"use client"

import React from "react"
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { Group } from "../types"
import { Button } from "./Button"

interface GroupSelectionModalProps {
  visible: boolean
  groups: Group[]
  onSelectGroup: (groupId: string) => void
  onCreateGroup: () => void
  onJoinGroup: () => void
  onClose: () => void
}

export const GroupSelectionModal: React.FC<GroupSelectionModalProps> = ({
  visible,
  groups,
  onSelectGroup,
  onCreateGroup,
  onJoinGroup,
  onClose,
}) => {
  const renderGroupItem = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={styles.groupItem}
      onPress={() => onSelectGroup(item.id)}
    >
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.groupDescription}>{item.description}</Text>
        )}
        <Text style={styles.memberCount}>
          {item.members?.length || 0} member{(item.members?.length || 0) !== 1 ? "s" : ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  )

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No Groups Yet</Text>
      <Text style={styles.emptyMessage}>
        You're not in any group yet. Create or join a group first to add and split bills.
      </Text>
      
      <View style={styles.actionButtons}>
        <Button
          title="Create Group"
          onPress={onCreateGroup}
          variant="primary"
          style={styles.actionButton}
        />
        <Button
          title="Join Group"
          onPress={onJoinGroup}
          variant="outline"
          style={styles.actionButton}
        />
      </View>
    </View>
  )

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Group</Text>
          <View style={styles.headerRight} />
        </View>

        {groups.length > 0 ? (
          <>
            <Text style={styles.subtitle}>
              Choose a group to add your bill to:
            </Text>
            <FlatList
              data={groups}
              renderItem={renderGroupItem}
              keyExtractor={(item) => item.id}
              style={styles.groupsList}
              showsVerticalScrollIndicator={false}
            />
          </>
        ) : (
          renderEmptyState()
        )}
      </SafeAreaView>
    </Modal>
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
  closeButton: {
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
  subtitle: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  groupsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  groupItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 12,
    color: "#8E8E93",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1C1C1E",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  actionButtons: {
    width: "100%",
    gap: 12,
  },
  actionButton: {
    width: "100%",
  },
})
