import type React from "react"
import { View, Text, StyleSheet } from "react-native"
import { formatRelativeTime } from "../utils/formatters"
import type { ChatMessage as ChatMessageType } from "../types"

interface ChatMessageProps {
  message: ChatMessageType
  isCurrentUser: boolean
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isCurrentUser }) => {
  return (
    <View style={[styles.container, isCurrentUser && styles.currentUserContainer]}>
      <View style={[styles.bubble, isCurrentUser && styles.currentUserBubble]}>
        {!isCurrentUser && <Text style={styles.senderName}>{message.user.name}</Text>}
        <Text style={[styles.messageText, isCurrentUser && styles.currentUserText]}>{message.message}</Text>
        <Text style={[styles.timestamp, isCurrentUser && styles.currentUserTimestamp]}>
          {formatRelativeTime(message.created_at)}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  currentUserContainer: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
    padding: 12,
  },
  currentUserBubble: {
    backgroundColor: "#007AFF",
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 4,
  },
  currentUserText: {
    color: "#fff",
  },
  timestamp: {
    fontSize: 11,
    color: "#999",
  },
  currentUserTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
  },
})
