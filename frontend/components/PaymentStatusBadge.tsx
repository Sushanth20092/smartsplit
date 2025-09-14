"use client"

import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"

interface PaymentStatusBadgeProps {
  status: "pending" | "submitted" | "confirmed" | "rejected"
  size?: "small" | "medium" | "large"
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status,
  size = "medium",
}) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "confirmed":
        return {
          color: "#34C759",
          backgroundColor: "#E8F5E8",
          icon: "checkmark-circle",
          text: "Confirmed",
        }
      case "submitted":
        return {
          color: "#FF9500",
          backgroundColor: "#FFF3E0",
          icon: "time-outline",
          text: "Submitted",
        }
      case "rejected":
        return {
          color: "#FF3B30",
          backgroundColor: "#FFEBEE",
          icon: "close-circle",
          text: "Rejected",
        }
      default:
        return {
          color: "#8E8E93",
          backgroundColor: "#F2F2F7",
          icon: "ellipse-outline",
          text: "Pending",
        }
    }
  }

  const getSizeConfig = (size: string) => {
    switch (size) {
      case "small":
        return {
          paddingHorizontal: 8,
          paddingVertical: 4,
          fontSize: 12,
          iconSize: 14,
        }
      case "large":
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          fontSize: 16,
          iconSize: 20,
        }
      default:
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          fontSize: 14,
          iconSize: 16,
        }
    }
  }

  const statusConfig = getStatusConfig(status)
  const sizeConfig = getSizeConfig(size)

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: statusConfig.backgroundColor,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          paddingVertical: sizeConfig.paddingVertical,
        },
      ]}
    >
      <Ionicons
        name={statusConfig.icon as any}
        size={sizeConfig.iconSize}
        color={statusConfig.color}
      />
      <Text
        style={[
          styles.text,
          {
            color: statusConfig.color,
            fontSize: sizeConfig.fontSize,
          },
        ]}
      >
        {statusConfig.text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "600",
    marginLeft: 4,
  },
})