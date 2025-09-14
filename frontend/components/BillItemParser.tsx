"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { BillItemParserProps, BillItem } from "../types"

const BillItemParser: React.FC<BillItemParserProps> = ({ items, onItemsChange }) => {
  const [billItems, setBillItems] = useState<BillItem[]>([])
  const [itemErrors, setItemErrors] = useState<{ [key: string]: { name?: string; rate?: string } }>({})

  useEffect(() => {
    const convertedItems: BillItem[] = items.map((item, index) => ({
      id: `temp_${index}`,
      bill_id: "",
      name: item.name,
      price: item.rate, // Use rate (unit price) as the price field
      quantity: item.quantity,
      rate: item.rate,
      assigned_users: [],
      created_at: new Date().toISOString(),
    }))
    setBillItems(convertedItems)
  }, [items])

  useEffect(() => {
    onItemsChange(billItems)
  }, [billItems, onItemsChange])

  const validateItemName = (name: string, itemId: string): string | undefined => {
    if (!name || !name.trim()) {
      return "Item name cannot be empty"
    }
    return undefined
  }

  const validateItemRate = (rate: number, itemId: string): string | undefined => {
    if (isNaN(rate)) {
      return "Rate must be a valid number"
    }
    // Rate must be greater than or equal to zero (≥ 0)
    if (rate < 0) {
      return "Rate must be zero or positive (≥ 0)"
    }
    return undefined
  }

  const updateItem = (index: number, updates: Partial<BillItem>) => {
    setBillItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)))
    
    // Clear errors for the updated item
    const item = billItems[index]
    if (item) {
      setItemErrors(prev => {
        const newErrors = { ...prev }
        if (updates.name !== undefined) {
          const nameError = validateItemName(updates.name, item.id)
          if (nameError) {
            newErrors[item.id] = { ...newErrors[item.id], name: nameError }
          } else {
            if (newErrors[item.id]) {
              delete newErrors[item.id].name
              if (Object.keys(newErrors[item.id]).length === 0) {
                delete newErrors[item.id]
              }
            }
          }
        }
        if (updates.rate !== undefined) {
          const rateError = validateItemRate(updates.rate, item.id)
          if (rateError) {
            newErrors[item.id] = { ...newErrors[item.id], rate: rateError }
          } else {
            if (newErrors[item.id]) {
              delete newErrors[item.id].rate
              if (Object.keys(newErrors[item.id]).length === 0) {
                delete newErrors[item.id]
              }
            }
          }
        }
        return newErrors
      })
    }
  }

  const removeItem = (index: number) => {
    const itemToRemove = billItems[index]
    setBillItems((prev) => prev.filter((_, i) => i !== index))
    
    // Clear errors for the removed item
    if (itemToRemove) {
      setItemErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[itemToRemove.id]
        return newErrors
      })
    }
  }

  const addItem = () => {
    const newItem: BillItem = {
      id: `temp_${Date.now()}`,
      bill_id: "",
      name: "",
      price: 0,
      quantity: 1,
      rate: 0,
      assigned_users: [],
      created_at: new Date().toISOString(),
    }
    setBillItems((prev) => [...prev, newItem])
  }



  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 16 }}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Bill Items</Text>
        <TouchableOpacity onPress={addItem} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {billItems.map((item, index) => (
        <View key={item.id} style={styles.itemContainer}>
          <View style={styles.itemHeader}>
            <View style={styles.nameInputContainer}>
              {/* Add a label so the Item input aligns vertically with Qty and Rate */}
              <Text style={styles.fieldLabel}>Item</Text>
              <TextInput
                style={[
                  styles.nameInput,
                  itemErrors[item.id]?.name && styles.inputError
                ]}
                value={item.name}
                onChangeText={(text) => updateItem(index, { name: text })}
                placeholder="Item name"
              />
              {itemErrors[item.id]?.name && (
                <Text style={styles.errorText}>{itemErrors[item.id].name}</Text>
              )}
            </View>
            <View style={styles.priceQuantityContainer}>
              <View style={styles.quantitySection}>
                <Text style={styles.fieldLabel}>Qty</Text>
                <TextInput
                  style={styles.quantityInput}
                  value={item.quantity.toString()}
                  onChangeText={(text) => {
                    const quantity = Number.parseInt(text) || 1
                    const rate = item.rate || 0
                    updateItem(index, {
                      quantity,
                      price: quantity * rate // Update total when quantity changes
                    })
                  }}
                  keyboardType="numeric"
                  placeholder="1"
                />
              </View>

              <View style={styles.rateSection}>
                <Text style={styles.fieldLabel}>Rate</Text>
                <TextInput
                  style={[
                    styles.rateInput,
                    itemErrors[item.id]?.rate && styles.inputError
                  ]}
                  value={(item.rate || 0).toString()}
                  onChangeText={(text) => {
                    // Handle empty string as 0, but preserve actual negative numbers for validation
                    const rate = text.trim() === '' ? 0 : Number.parseFloat(text)
                    const quantity = item.quantity || 1
                    updateItem(index, {
                      rate: isNaN(rate) ? 0 : rate,
                      price: quantity * (isNaN(rate) ? 0 : Math.max(0, rate)) // Only use positive rates for price calculation
                    })
                  }}
                  keyboardType="numeric"
                  placeholder="0.00"
                />
                {itemErrors[item.id]?.rate && (
                  <Text style={styles.rateErrorText}>{itemErrors[item.id].rate}</Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeButton}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>

          <View style={styles.itemFooter}>
            <Text style={styles.itemTotal}>Total: ₹{((item.quantity || 1) * (item.rate || 0)).toFixed(2)}</Text>
          </View>
        </View>
      ))}

      {billItems.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No items found</Text>
          <Text style={styles.emptyStateSubtext}>Add items manually or scan a receipt</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  addButton: {
    padding: 8,
  },
  itemContainer: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  nameInputContainer: {
    flex: 1,
    marginRight: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: "#D1D1D6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  inputError: {
    borderColor: "#FF3B30",
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: "#FF3B30",
    marginTop: 4,
    marginLeft: 4,
  },
  priceQuantityContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  quantitySection: {
    alignItems: "center",
  },
  rateSection: {
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 4,
  },
  quantityInput: {
    width: 50,
    borderWidth: 1,
    borderColor: "#D1D1D6",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: "center",
  },
  rateInput: {
    width: 80,
    borderWidth: 1,
    borderColor: "#D1D1D6",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: "right",
  },
  rateErrorText: {
    fontSize: 10,
    color: "#FF3B30",
    marginTop: 2,
    textAlign: "center",
    width: 80,
  },
  multiplySymbol: {
    marginHorizontal: 8,
    fontSize: 16,
    color: "#8E8E93",
  },
  priceInput: {
    width: 80,
    borderWidth: 1,
    borderColor: "#D1D1D6",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: "right",
  },
  removeButton: {
    padding: 8,
    marginLeft: 8,
  },

  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    paddingTop: 12,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
  },
})

export default BillItemParser
