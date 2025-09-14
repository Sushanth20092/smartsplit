"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RouteProp } from "@react-navigation/native"
import type { RootStackParamList } from "../types"
import { useAuth } from "../contexts/AuthProvider"
import { chatService, type ChatMessage } from "../services/chatService"
import { supabase } from "../../backend/supabase/client"
import { Ionicons } from "@expo/vector-icons"

type GroupChatScreenNavigationProp = StackNavigationProp<RootStackParamList, "GroupChat">
type GroupChatScreenRouteProp = RouteProp<RootStackParamList, "GroupChat">

const GroupChatScreen: React.FC = () => {
  const navigation = useNavigation<GroupChatScreenNavigationProp>()
  const route = useRoute<GroupChatScreenRouteProp>()
  const { user } = useAuth()
  const { groupId } = route.params

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [groupName, setGroupName] = useState("Group Chat")

  const flatListRef = useRef<FlatList>(null)
  const stopPollingRef = useRef<(() => void) | null>(null)

  // Fetch initial messages and group info
  const fetchInitialData = async () => {
    try {
      setLoading(true)
      console.log("GroupChatScreen: Starting to fetch initial data for group:", groupId)

      // Fetch group name
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single()

      console.log("GroupChatScreen: Group data result:", { groupData, groupError })

      if (groupData) {
        setGroupName(groupData.name)
      }

      // Test basic chat_messages table access first
      console.log("GroupChatScreen: Testing basic chat_messages access...")
      const { data: testData, error: testError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("group_id", groupId)
        .limit(1)

      console.log("GroupChatScreen: Basic chat_messages test:", { testData, testError })

      // Fetch messages using the service
      console.log("GroupChatScreen: Fetching messages via chatService...")
      const chatMessages = await chatService.fetchMessages(groupId)
      console.log("GroupChatScreen: Received messages:", chatMessages)
      setMessages(chatMessages)

      // Scroll to bottom after loading messages
      setTimeout(() => {
        scrollToBottom()
      }, 100)

    } catch (error) {
      console.error("Error fetching initial chat data:", error)
      Alert.alert("Error", `Failed to load chat messages: ${error.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  // Start polling for new messages
  const startPolling = useCallback(() => {
    if (messages.length === 0) return

    const lastMessageTime = messages[messages.length - 1]?.created_at || new Date().toISOString()
    
    stopPollingRef.current = chatService.startPolling(
      groupId,
      lastMessageTime,
      (newMessages) => {
        setMessages(prev => [...prev, ...newMessages])
        setTimeout(() => {
          scrollToBottom()
        }, 100)
      },
      3000 // Poll every 3 seconds
    )
  }, [groupId, messages])

  // Stop polling when component unmounts or loses focus
  const stopPolling = useCallback(() => {
    if (stopPollingRef.current) {
      stopPollingRef.current()
      stopPollingRef.current = null
    }
  }, [])

  // Handle screen focus/blur
  useFocusEffect(
    useCallback(() => {
      fetchInitialData()
      
      return () => {
        stopPolling()
      }
    }, [groupId])
  )

  // Start polling after messages are loaded
  useEffect(() => {
    if (!loading && messages.length > 0) {
      startPolling()
    }
    
    return () => {
      stopPolling()
    }
  }, [loading, messages.length, startPolling, stopPolling])

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true })
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || sending) return

    setSending(true)
    const messageText = newMessage.trim()
    setNewMessage("") // Clear input immediately for better UX

    try {
      console.log("GroupChatScreen: Sending message:", { groupId, userId: user.id, messageText })
      const sentMessage = await chatService.sendMessage(groupId, user.id, messageText)
      console.log("GroupChatScreen: Message sent successfully:", sentMessage)
      setMessages(prev => [...prev, sentMessage])

      setTimeout(() => {
        scrollToBottom()
      }, 100)

    } catch (error) {
      console.error("Error sending message:", error)
      Alert.alert("Error", `Failed to send message: ${error.message || 'Unknown error'}`)
      setNewMessage(messageText) // Restore message text on error
    } finally {
      setSending(false)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.user_id === user?.id
    
    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
        {!isOwnMessage && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.user?.name?.charAt(0).toUpperCase() || "?"}
            </Text>
          </View>
        )}
        
        <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>{item.user?.name || "Unknown"}</Text>
          )}
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
            {item.message}
          </Text>
          <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{groupName}</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Loading messages...</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color="#C7C7CC" />
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>Start the conversation!</Text>
              </View>
            )
          }
        />

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
          >
            <Ionicons 
              name={sending ? "hourglass" : "send"} 
              size={20} 
              color={(!newMessage.trim() || sending) ? "#C7C7CC" : "#007AFF"} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#8E8E93",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#C7C7CC",
    marginTop: 4,
    textAlign: "center",
  },
  messageContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: "flex-end",
  },
  ownMessageContainer: {
    justifyContent: "flex-end",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  messageBubble: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: "75%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ownMessageBubble: {
    backgroundColor: "#007AFF",
    marginLeft: 40,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF",
    marginBottom: 2,
  },
  messageText: {
    fontSize: 16,
    color: "#1C1C1E",
    lineHeight: 20,
  },
  ownMessageText: {
    color: "#FFFFFF",
  },
  messageTime: {
    fontSize: 11,
    color: "#8E8E93",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  ownMessageTime: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
})

export default GroupChatScreen
