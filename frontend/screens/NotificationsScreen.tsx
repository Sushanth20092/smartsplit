"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  RefreshControl,
  Alert,
} from "react-native"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RootStackParamList } from "../types"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "../contexts/AuthProvider"
import { notificationService, type Notification } from "../services/notificationService"
import { formatDate } from "../utils/formatters"
import { useUnreadNotifications } from "../hooks/useUnreadNotifications"

type NotificationsScreenNavigationProp = StackNavigationProp<RootStackParamList, "Notifications">

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NotificationsScreenNavigationProp>()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { refreshUnreadCount } = useUnreadNotifications()

  const fetchNotifications = async () => {
    if (!user) return

    try {
      // Use the new method that automatically marks all notifications as read
      const userNotifications = await notificationService.getUserNotificationsAndMarkAllRead(user.id)
      setNotifications(userNotifications)
      console.log(`Fetched ${userNotifications.length} notifications for user and marked all as read`)
      
      // Refresh the unread count since we marked all as read
      refreshUnreadCount()
    } catch (error) {
      console.error("Error fetching notifications:", error)
      Alert.alert("Error", "Failed to load notifications")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [user])

  // Refresh unread count when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshUnreadCount()
    }, [refreshUnreadCount])
  )

  const onRefresh = () => {
    setRefreshing(true)
    fetchNotifications()
  }

  // Removed handleNotificationPress - notifications are now purely informational

  const renderNotification = ({ item }: { item: Notification }) => {
    const getNotificationIcon = (type: string) => {
      switch (type) {
        case 'user_joined_group':
          return 'person-add'
        case 'user_left_group':
          return 'person-remove'
        case 'bill_added':
          return 'receipt'
        case 'bill_pending_approval':
          return 'time'
        default:
          return 'notifications'
      }
    }

    const getNotificationColor = (type: string) => {
      switch (type) {
        case 'user_joined_group':
          return '#4CAF50'
        case 'user_left_group':
          return '#FF9800'
        case 'bill_added':
          return '#2196F3'
        case 'bill_pending_approval':
          return '#FF5722'
        default:
          return '#9E9E9E'
      }
    }

    return (
      <View style={styles.notificationItem}>
        <View style={[styles.notificationIcon, { backgroundColor: getNotificationColor(item.type) }]}>
          <Ionicons name={getNotificationIcon(item.type) as any} size={20} color="#FFFFFF" />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>
            {item.title}
          </Text>
          <Text style={styles.notificationMessage}>
            {item.message}
          </Text>
          <Text style={styles.notificationTime}>
            {formatDate(item.created_at)}
          </Text>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight} />
      </View>

      {notifications.length === 0 ? (
        <View style={styles.content}>
          <View style={styles.placeholderContainer}>
            <Ionicons name="notifications-outline" size={80} color="#C7C7CC" />
            <Text style={styles.placeholderTitle}>No Notifications</Text>
            <Text style={styles.placeholderMessage}>
              You're all caught up!
            </Text>
            <Text style={styles.placeholderSubtext}>
              You'll receive updates about bill splits, payments, and group activities here.
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          style={styles.notificationsList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  placeholderContainer: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: 400,
    width: "100%",
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  placeholderMessage: {
    fontSize: 18,
    fontWeight: "600",
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 12,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: "#C7C7CC",
    textAlign: "center",
    lineHeight: 20,
  },
  notificationsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: "#3C3C43",
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: "#8E8E93",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#8E8E93",
  },
})

export default NotificationsScreen
