import { supabase } from "../../backend/supabase/client"
import type { User } from "../types"

export interface ChatMessage {
  id: string
  group_id: string
  user_id: string
  message: string
  created_at: string
  user: User
}

export class ChatService {
  /**
   * Fetch all chat messages for a specific group
   * @param groupId - The ID of the group
   * @returns Promise with array of chat messages
   */
  async fetchMessages(groupId: string): Promise<ChatMessage[]> {
    try {
      console.log("ChatService: Fetching messages for group:", groupId)

      // First, fetch the messages - using very simple query
      const { data: messagesData, error: messagesError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })

      console.log("ChatService: Messages query result:", { messagesData, messagesError })

      if (messagesError) {
        console.error("Error fetching chat messages:", messagesError)
        throw messagesError
      }

      if (!messagesData || messagesData.length === 0) {
        console.log("ChatService: No messages found")
        return []
      }

      // Get unique user IDs
      const userIds = [...new Set(messagesData.map(msg => msg.user_id))]
      console.log("ChatService: Fetching user data for IDs:", userIds)

      // Fetch user data separately
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .in("id", userIds)

      console.log("ChatService: Users query result:", { usersData, usersError })

      if (usersError) {
        console.error("Error fetching users data:", usersError)
        // Don't throw here, continue with fallback user data
      }

      // Create a map of users for quick lookup
      const usersMap = new Map(usersData?.map(user => [user.id, user]) || [])

      // Combine messages with user data
      const messagesWithUsers: ChatMessage[] = messagesData.map(message => ({
        id: message.id,
        group_id: message.group_id,
        user_id: message.user_id,
        message: message.message,
        created_at: message.created_at,
        user: usersMap.get(message.user_id) || {
          id: message.user_id,
          name: "Unknown User",
          email: "",
          avatar: null,
          created_at: ""
        }
      }))

      console.log("ChatService: Final messages with users:", messagesWithUsers)
      return messagesWithUsers
    } catch (error) {
      console.error("ChatService: fetchMessages error:", error)
      throw error
    }
  }

  /**
   * Send a new chat message
   * @param groupId - The ID of the group
   * @param userId - The ID of the user sending the message
   * @param message - The message text
   * @returns Promise with the created message
   */
  async sendMessage(groupId: string, userId: string, message: string): Promise<ChatMessage> {
    try {
      console.log("ChatService: Sending message:", { groupId, userId, message })

      if (!message.trim()) {
        throw new Error("Message cannot be empty")
      }

      // Insert the message - using simple insert
      const { data: messageData, error: messageError } = await supabase
        .from("chat_messages")
        .insert({
          group_id: groupId,
          user_id: userId,
          message: message.trim()
        })
        .select("*")
        .single()

      console.log("ChatService: Message insert result:", { messageData, messageError })

      if (messageError) {
        console.error("Error sending chat message:", messageError)
        throw messageError
      }

      // Fetch the user data separately
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single()

      console.log("ChatService: User fetch result:", { userData, userError })

      if (userError) {
        console.error("Error fetching user data:", userError)
        // Don't throw here, just use fallback user data
      }

      // Combine message with user data
      const messageWithUser: ChatMessage = {
        id: messageData.id,
        group_id: messageData.group_id,
        user_id: messageData.user_id,
        message: messageData.message,
        created_at: messageData.created_at,
        user: userData || {
          id: userId,
          name: "Unknown User",
          email: "",
          avatar: null,
          created_at: ""
        }
      }

      console.log("ChatService: Final message with user:", messageWithUser)
      return messageWithUser
    } catch (error) {
      console.error("ChatService: sendMessage error:", error)
      throw error
    }
  }

  /**
   * Fetch messages newer than a specific timestamp (for polling)
   * @param groupId - The ID of the group
   * @param lastMessageTime - ISO timestamp of the last message received
   * @returns Promise with array of new chat messages
   */
  async fetchNewMessages(groupId: string, lastMessageTime: string): Promise<ChatMessage[]> {
    try {
      console.log("ChatService: Fetching new messages since:", lastMessageTime)

      // Fetch new messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("group_id", groupId)
        .gt("created_at", lastMessageTime)
        .order("created_at", { ascending: true })

      if (messagesError) {
        console.error("Error fetching new chat messages:", messagesError)
        throw messagesError
      }

      if (!messagesData || messagesData.length === 0) {
        return []
      }

      // Get unique user IDs
      const userIds = [...new Set(messagesData.map(msg => msg.user_id))]

      // Fetch user data separately
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .in("id", userIds)

      if (usersError) {
        console.error("Error fetching users data for new messages:", usersError)
        // Don't throw here, continue with fallback user data
      }

      // Create a map of users for quick lookup
      const usersMap = new Map(usersData?.map(user => [user.id, user]) || [])

      // Combine messages with user data
      const messagesWithUsers: ChatMessage[] = messagesData.map(message => ({
        id: message.id,
        group_id: message.group_id,
        user_id: message.user_id,
        message: message.message,
        created_at: message.created_at,
        user: usersMap.get(message.user_id) || {
          id: message.user_id,
          name: "Unknown User",
          email: "",
          avatar: null,
          created_at: ""
        }
      }))

      return messagesWithUsers
    } catch (error) {
      console.error("ChatService: fetchNewMessages error:", error)
      throw error
    }
  }

  /**
   * Start polling for new messages
   * @param groupId - The ID of the group
   * @param lastMessageTime - ISO timestamp of the last message received
   * @param onNewMessages - Callback function to handle new messages
   * @param intervalMs - Polling interval in milliseconds (default: 3000)
   * @returns Function to stop polling
   */
  startPolling(
    groupId: string,
    lastMessageTime: string,
    onNewMessages: (messages: ChatMessage[]) => void,
    intervalMs: number = 3000
  ): () => void {
    let currentLastMessageTime = lastMessageTime
    
    const pollForMessages = async () => {
      try {
        const newMessages = await this.fetchNewMessages(groupId, currentLastMessageTime)
        
        if (newMessages.length > 0) {
          onNewMessages(newMessages)
          // Update the last message time to the newest message
          currentLastMessageTime = newMessages[newMessages.length - 1].created_at
        }
      } catch (error) {
        console.error("Error polling for new messages:", error)
        // Continue polling even if there's an error
      }
    }

    // Start polling immediately, then at intervals
    pollForMessages()
    const intervalId = setInterval(pollForMessages, intervalMs)

    // Return cleanup function
    return () => {
      clearInterval(intervalId)
    }
  }
}

export const chatService = new ChatService()
