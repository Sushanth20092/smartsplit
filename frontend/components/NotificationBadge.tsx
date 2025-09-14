import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

interface NotificationBadgeProps {
  count: number
  maxCount?: number
  size?: 'small' | 'medium' | 'large'
  color?: string
  textColor?: string
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  maxCount = 99,
  size = 'medium',
  color = '#FF3B30',
  textColor = '#FFFFFF'
}) => {
  if (count <= 0) {
    return null
  }

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString()
  
  const sizeStyles = {
    small: {
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      fontSize: 10,
      paddingHorizontal: 4
    },
    medium: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      fontSize: 12,
      paddingHorizontal: 6
    },
    large: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      fontSize: 14,
      paddingHorizontal: 8
    }
  }

  const currentSize = sizeStyles[size]

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: color,
          minWidth: currentSize.minWidth,
          height: currentSize.height,
          borderRadius: currentSize.borderRadius,
          paddingHorizontal: currentSize.paddingHorizontal
        }
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          {
            color: textColor,
            fontSize: currentSize.fontSize
          }
        ]}
        numberOfLines={1}
      >
        {displayCount}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 1
  },
  badgeText: {
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center'
  }
})