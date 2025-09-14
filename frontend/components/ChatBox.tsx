"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { ChatBoxProps, ChatMessage } from "../types"
import { formatRelativeTime } from "../utils/formatters"

const ChatBox: React.FC<ChatBoxProps> = ({ groupId, messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState("")
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true })
    }
  }, [messages])

  const handleSendMessage = () => {
    if (newMessage.trim().length === 0) return

    let messageText = newMessage.trim()
    if (replyingTo) {
      messageText = `@${replyingTo.user?.display_name}: ${messageText}`
    }

    onSendMessage(messageText)
    setNewMessage("")
    setReplyingTo(null)
  }

  const handleReply = (message: ChatMessage) => {
    setReplyingTo(message)
  }

  const cancelReply = () => {
    setReplyingTo(null)
  }

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isReply = item.reply_to !== null
    const isMyMessage = false

    return (
      <View style={[styles.messageContainer, isMyMessage && styles.myMessageContainer]}>
        <View style={[styles.messageBubble, isMyMessage && styles.myMessageBubble]}>
          {isReply && (
            <View style={styles.replyContext}>
              <Text style={styles.replyText}>Replying to a message</Text>
            </View>
          )}

          <View style={styles.messageHeader}>
            <Text style={styles.senderName}>{item.user?.display_name || "Unknown"}</Text>
            <Text style={styles.messageTime}>{formatRelativeTime(item.created_at)}</Text>
          </View>

          <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>{item.message}</Text>
        </View>

        <TouchableOpacity onPress={() => handleReply(item)} style={styles.replyButton}>
          <Ionicons name="arrow-undo" size={16} color="#8E8E93" />
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
      />

      {replyingTo && (
        <View style={styles.replyingToContainer}>
          <View style={styles.replyingToContent}>
            <Text style={styles.replyingToText}>Replying to {replyingTo.user?.display_name}</Text>
            <Text style={styles.replyingToMessage} numberOfLines={1}>
              {replyingTo.message}
            </Text>
          </View>
          <TouchableOpacity onPress={cancelReply} style={styles.cancelReplyButton}>
            <Ionicons name="close" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          onPress={handleSendMessage}
          disabled={newMessage.trim().length === 0}
          style={[styles.sendButton, newMessage.trim().length === 0 && styles.sendButtonDisabled]}
        >
          <Ionicons name="send" size={20} color={newMessage.trim().length > 0 ? "#007AFF" : "#8E8E93"} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-end",
  },
  myMessageContainer: {
    flexDirection: "row-reverse",
  },
  messageBubble: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    maxWidth: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  myMessageBubble: {
    backgroundColor: "#007AFF",
  },
  replyContext: {
    borderLeftWidth: 3,
    borderLeftColor: "#8E8E93",
    paddingLeft: 8,
    marginBottom: 8,
  },
  replyText: {
    fontSize: 12,
    color: "#8E8E93",
    fontStyle: "italic",
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
  },
  messageTime: {
    fontSize: 10,
    color: "#8E8E93",
  },
  messageText: {
    fontSize: 16,
    color: "#1C1C1E",
    lineHeight: 22,
  },
  myMessageText: {
    color: "#FFFFFF",
  },
  replyButton: {
    padding: 8,
    marginLeft: 8,
  },
  replyingToContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5E5EA",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#D1D1D6",
  },
  replyingToContent: {
    flex: 1,
  },
  replyingToText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF",
    marginBottom: 2,
  },
  replyingToMessage: {
    fontSize: 14,
    color: "#8E8E93",
  },
  cancelReplyButton: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#D1D1D6",
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D1D6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
    marginRight: 8,
  },
  sendButton: {
    padding: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
})

export default ChatBox
