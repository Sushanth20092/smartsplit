import React from 'react'
import { TouchableOpacity, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { NotificationBadge } from './NotificationBadge'
import { useUnreadNotifications } from '../hooks/useUnreadNotifications'

interface NotificationBellProps {
  onPress: () => void
  iconSize?: number
  iconColor?: string
  badgeColor?: string
  style?: any
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onPress,
  iconSize = 24,
  iconColor = '#007AFF',
  badgeColor = '#FF3B30',
  style
}) => {
  const { unreadCount } = useUnreadNotifications()

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Ionicons 
          name="notifications-outline" 
          size={iconSize} 
          color={iconColor} 
        />
        <NotificationBadge 
          count={unreadCount} 
          size="small"
          color={badgeColor}
        />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  iconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  }
})