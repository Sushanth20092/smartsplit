import { supabase } from "../../backend/supabase/client"

export type NotificationType = 
  | 'bill_added'
  | 'bill_pending_approval'
  | 'payment_request'
  | 'payment_received'
  | 'payment_submitted'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'group_invite'
  | 'user_joined_group'
  | 'user_left_group'
  | 'bill_settled'

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  read: boolean
  data?: any
  created_at: string
}

export interface NotificationData {
  groupId?: string
  groupName?: string
  billId?: string
  billTitle?: string
  userId?: string
  userName?: string
  [key: string]: any
}

export class NotificationService {
  /**
   * Create a single notification for a user
   */
  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    data?: NotificationData
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          title,
          message,
          type,
          data: data || null,
          read: false
        })

      if (error) {
        console.error("Error creating notification:", error)
        throw error
      }

      console.log(`Notification created for user ${userId}: ${title}`)
    } catch (error) {
      console.error("NotificationService: createNotification error:", error)
      throw error
    }
  }

  /**
   * Create notifications for multiple users
   */
  async createBulkNotifications(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType,
    data?: NotificationData
  ): Promise<void> {
    try {
      const notifications = userIds.map(userId => ({
        user_id: userId,
        title,
        message,
        type,
        data: data || null,
        read: false
      }))

      const { error } = await supabase
        .from("notifications")
        .insert(notifications)

      if (error) {
        console.error("Error creating bulk notifications:", error)
        throw error
      }

      console.log(`Bulk notifications created for ${userIds.length} users: ${title}`)
    } catch (error) {
      console.error("NotificationService: createBulkNotifications error:", error)
      throw error
    }
  }

  /**
   * Notify all group members when a user joins
   */
  async notifyUserJoinedGroup(
    groupId: string,
    groupName: string,
    newUserName: string,
    newUserId: string
  ): Promise<void> {
    try {
      // Get all existing group members except the new user
      const { data: members, error } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .neq("user_id", newUserId)

      if (error) {
        console.error("Error fetching group members:", error)
        throw error
      }

      if (!members || members.length === 0) {
        console.log("No existing members to notify")
        return
      }

      const userIds = members.map(member => member.user_id)
      const title = "New Group Member"
      const message = `${newUserName} joined your group '${groupName}'.`

      await this.createBulkNotifications(
        userIds,
        title,
        message,
        'user_joined_group',
        {
          groupId,
          groupName,
          userId: newUserId,
          userName: newUserName
        }
      )
    } catch (error) {
      console.error("NotificationService: notifyUserJoinedGroup error:", error)
      throw error
    }
  }

  /**
   * Notify all remaining group members when a user leaves
   */
  async notifyUserLeftGroup(
    groupId: string,
    groupName: string,
    leftUserName: string,
    leftUserId: string
  ): Promise<void> {
    try {
      // Get all group members EXCEPT the one who is leaving
      const { data: members, error } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .neq("user_id", leftUserId) // Exclude the user who is leaving

      if (error) {
        console.error("Error fetching group members:", error)
        throw error
      }

      if (!members || members.length === 0) {
        console.log("No remaining members to notify")
        return
      }

      const userIds = members.map(member => member.user_id)
      console.log(`NotificationService: Notifying ${userIds.length} members about ${leftUserName} leaving group ${groupName}`)

      const title = "Member Left Group"
      const message = `${leftUserName} left the group '${groupName}'.`

      await this.createBulkNotifications(
        userIds,
        title,
        message,
        'user_left_group',
        {
          groupId,
          groupName,
          userId: leftUserId,
          userName: leftUserName
        }
      )

      console.log(`NotificationService: Successfully sent notifications to ${userIds.length} members`)
    } catch (error) {
      console.error("NotificationService: notifyUserLeftGroup error:", error)
      throw error
    }
  }

  /**
   * Notify eligible group members when a new bill is added
   */
  async notifyBillAdded(
    billId: string,
    billTitle: string,
    groupId: string,
    groupName: string,
    billCreatedAt: string,
    creatorId: string
  ): Promise<void> {
    try {
      // Get group members who joined before or at the time of bill creation
      const { data: eligibleMembers, error } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .lte("joined_at", billCreatedAt)
        .neq("user_id", creatorId) // Don't notify the creator

      if (error) {
        console.error("Error fetching eligible members:", error)
        throw error
      }

      if (!eligibleMembers || eligibleMembers.length === 0) {
        console.log("No eligible members to notify about bill")
        return
      }

      const userIds = eligibleMembers.map(member => member.user_id)
      const title = "New Bill Added"
      const message = `A new bill '${billTitle}' has been added to your group '${groupName}'.`

      await this.createBulkNotifications(
        userIds,
        title,
        message,
        'bill_added',
        {
          billId,
          billTitle,
          groupId,
          groupName
        }
      )
    } catch (error) {
      console.error("NotificationService: notifyBillAdded error:", error)
      throw error
    }
  }

  /**
   * Notify bill participants when a bill moves to pending approval
   * Only notifies participants with pending approval status (excludes creator who is auto-approved)
   */
  async notifyBillPendingApproval(
    billId: string,
    billTitle: string,
    groupId: string,
    groupName: string
  ): Promise<void> {
    try {
      // Get bill creator to exclude from notifications
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select("created_by")
        .eq("id", billId)
        .single()

      if (billError) {
        console.error("Error fetching bill creator:", billError)
        throw billError
      }

      // Get only participants who need to approve (pending status and not the creator)
      const { data: billSplits, error } = await supabase
        .from("bill_splits")
        .select("user_id")
        .eq("bill_id", billId)
        .eq("approval_status", "pending")
        .neq("user_id", billData.created_by)

      if (error) {
        console.error("Error fetching bill participants:", error)
        throw error
      }

      if (!billSplits || billSplits.length === 0) {
        console.log("No participants need approval notifications (creator auto-approved)")
        return
      }

      const userIds = billSplits.map(split => split.user_id)
      const title = "Bill Pending Approval"
      const message = `Bill '${billTitle}' is pending your approval.`

      console.log(`Sending approval notifications to ${userIds.length} participants (excluding creator)`)

      await this.createBulkNotifications(
        userIds,
        title,
        message,
        'bill_pending_approval',
        {
          billId,
          billTitle,
          groupId,
          groupName
        }
      )
    } catch (error) {
      console.error("NotificationService: notifyBillPendingApproval error:", error)
      throw error
    }
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (error) {
        console.error("Error fetching user notifications:", error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error("NotificationService: getUserNotifications error:", error)
      throw error
    }
  }

  /**
   * Get notifications for a user and automatically mark all as read
   * This is used when opening the Notifications page
   */
  async getUserNotificationsAndMarkAllRead(userId: string, limit: number = 50): Promise<Notification[]> {
    try {
      // First, mark all unread notifications as read
      const { error: updateError } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false)

      if (updateError) {
        console.error("Error marking notifications as read:", updateError)
        // Don't throw here, still try to fetch notifications
      } else {
        console.log("All unread notifications marked as read for user:", userId)
      }

      // Then fetch all notifications
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (error) {
        console.error("Error fetching user notifications:", error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error("NotificationService: getUserNotificationsAndMarkAllRead error:", error)
      throw error
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId)

      if (error) {
        console.error("Error marking notification as read:", error)
        throw error
      }
    } catch (error) {
      console.error("NotificationService: markAsRead error:", error)
      throw error
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false)

      if (error) {
        console.error("Error marking all notifications as read:", error)
        throw error
      }

      console.log("All notifications marked as read for user:", userId)
    } catch (error) {
      console.error("NotificationService: markAllAsRead error:", error)
      throw error
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false)

      if (error) {
        console.error("Error getting unread count:", error)
        throw error
      }

      return count || 0
    } catch (error) {
      console.error("NotificationService: getUnreadCount error:", error)
      throw error
    }
  }
}

export const notificationService = new NotificationService()
