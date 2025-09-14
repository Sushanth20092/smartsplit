"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView } from "react-native"
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native"
import type { StackNavigationProp, RouteProp } from "@react-navigation/stack"
import type { RootStackParamList, Bill, BillItem, User } from "../types"
import { useAuth } from "../contexts/AuthProvider"
import { supabase } from "../../backend/supabase/client"
import { billFilterService } from "../services/billFilterService"
import { InputField } from "../components/InputField"
import { Button } from "../components/Button"
import BillItemParser from "../components/BillItemParser"
import { Ionicons } from "@expo/vector-icons"
import { formatDate } from "../utils/formatters"

type BillEditScreenNavigationProp = StackNavigationProp<RootStackParamList, "BillEdit">
type BillEditScreenRouteProp = RouteProp<RootStackParamList, "BillEdit">

const BillEditScreen: React.FC = () => {
  const navigation = useNavigation<BillEditScreenNavigationProp>()
  const route = useRoute<BillEditScreenRouteProp>()
  const { user } = useAuth()
  const { billId } = route.params

  const [bill, setBill] = useState<Bill | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tipAmount, setTipAmount] = useState("0")
  const [taxAmount, setTaxAmount] = useState("0")
  const [billItems, setBillItems] = useState<BillItem[]>([])
  const [groupMembers, setGroupMembers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const fetchBillData = async () => {
    try {
      // Fetch bill details
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select(`
          *,
          creator:users!bills_created_by_fkey(name),
          group:groups(name)
        `)
        .eq("id", billId)
        .single()

      if (billError) throw billError

      setBill(billData)
      setTitle(billData.title)
      setDescription(billData.description || "")
      setTipAmount(billData.tip_amount.toString())
      setTaxAmount(billData.tax_amount.toString())

      // Fetch bill items
      const { data: itemsData, error: itemsError } = await supabase.from("bill_items").select("*").eq("bill_id", billId)

      if (itemsError) throw itemsError
      setBillItems(itemsData || [])

      // Fetch group members who were present when the bill was created
      const eligibleMembers = await billFilterService.fetchEligibleMembersForBill(billId)
      setGroupMembers(eligibleMembers)
    } catch (error) {
      console.error("Error fetching bill data:", error)
      Alert.alert("Error", "Failed to load bill details")
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchBillData()
    }, [billId]),
  )

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!title.trim()) {
      newErrors.title = "Bill title is required"
    }

    if (billItems.length === 0) {
      newErrors.items = "At least one item is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const saveBill = async () => {
    if (!validateForm() || !bill) return

    setSaving(true)
    try {
      const totalAmount = billItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

      // Update bill
      const { error: billError } = await supabase
        .from("bills")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          total_amount: totalAmount,
          tip_amount: Number.parseFloat(tipAmount) || 0,
          tax_amount: Number.parseFloat(taxAmount) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", billId)

      if (billError) throw billError

      // Delete existing items
      const { error: deleteError } = await supabase.from("bill_items").delete().eq("bill_id", billId)

      if (deleteError) throw deleteError

      // Insert updated items - assign all items to all group members
      const allMemberIds = groupMembers.map(member => member.id)
      const itemsToInsert = billItems.map((item) => ({
        bill_id: billId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        assigned_users: allMemberIds,
      }))

      const { error: itemsError } = await supabase.from("bill_items").insert(itemsToInsert)

      if (itemsError) throw itemsError

      Alert.alert("Success", "Bill updated successfully!", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ])
    } catch (error) {
      console.error("Error saving bill:", error)
      Alert.alert("Error", "Failed to save bill. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const deleteBill = () => {
    Alert.alert("Delete Bill", "Are you sure you want to delete this bill? This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase.from("bills").delete().eq("id", billId)

            if (error) throw error

            Alert.alert("Success", "Bill deleted successfully!", [{ text: "OK", onPress: () => navigation.goBack() }])
          } catch (error) {
            console.error("Error deleting bill:", error)
            Alert.alert("Error", "Failed to delete bill. Please try again.")
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!bill) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Bill not found</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} variant="primary" />
        </View>
      </SafeAreaView>
    )
  }

  const isCreator = user?.id === bill.created_by
  const canEdit = isCreator && bill.status === "draft"

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bill Details</Text>
        <TouchableOpacity onPress={() => navigation.navigate("BillSplit", { billId })} style={styles.splitButton}>
          <Ionicons name="pie-chart-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Bill Info */}
        <View style={styles.section}>
          <View style={styles.billHeader}>
            <View style={styles.billInfo}>
              <Text style={styles.billTitle}>{bill.title}</Text>
              <Text style={styles.billMeta}>
                {bill.group?.name} • {formatDate(bill.created_at)}
              </Text>
              <Text style={styles.billCreator}>Created by {bill.creator?.name}</Text>
            </View>
            <View style={styles.billStatus}>
              <Text style={[styles.statusText, {
                color: bill.status === "draft" ? "#007AFF" :
                       bill.status === "settled" ? "#34C759" :
                       bill.status === "cancelled" ? "#FF3B30" : "#FF9500"
              }]}>
                {bill.status.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.billAmounts}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Subtotal:</Text>
              <Text style={styles.amountValue}>₹{bill.total_amount.toFixed(2)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Tip:</Text>
              <Text style={styles.amountValue}>₹{bill.tip_amount.toFixed(2)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Tax:</Text>
              <Text style={styles.amountValue}>₹{bill.tax_amount.toFixed(2)}</Text>
            </View>
            <View style={[styles.amountRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>
                ₹{(bill.total_amount + bill.tip_amount + bill.tax_amount).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {canEdit ? (
          <>
            {/* Edit Form */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Edit Bill</Text>

              <InputField
                label="Bill Title"
                value={title}
                onChangeText={setTitle}
                placeholder="Enter bill title"
                error={errors.title}
              />

              <InputField
                label="Description (Optional)"
                value={description}
                onChangeText={setDescription}
                placeholder="Enter description"
                multiline
                numberOfLines={3}
              />

              <View style={styles.row}>
                <View style={styles.halfField}>
                  <InputField
                    label="Tip Amount"
                    value={tipAmount}
                    onChangeText={setTipAmount}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfField}>
                  <InputField
                    label="Tax Amount"
                    value={taxAmount}
                    onChangeText={setTaxAmount}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <BillItemParser
                items={billItems.map((item) => ({ name: item.name, rate: item.price / item.quantity, quantity: item.quantity, total: item.price }))}
                onItemsChange={setBillItems}
              />
              {errors.items && <Text style={styles.errorText}>{errors.items}</Text>}
            </View>
          </>
        ) : (
          /* View Only */
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bill Items</Text>
            {billItems.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>₹{(item.price * item.quantity).toFixed(2)}</Text>
                </View>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                  <Text style={styles.itemAssigned}>Assigned to: {item.assigned_users?.length || 0} member(s)</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <Button
            title="Split Bill"
            onPress={() => navigation.navigate("BillSplit", { billId })}
            variant="primary"
            style={styles.actionButton}
          />

          {canEdit && (
            <>
              <Button
                title="Save Changes"
                onPress={saveBill}
                loading={saving}
                disabled={saving}
                variant="secondary"
                style={styles.actionButton}
              />

              <Button title="Delete Bill" onPress={deleteBill} variant="danger" style={styles.actionButton} />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
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
  splitButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: "#FF3B30",
    marginBottom: 20,
  },
  section: {
    backgroundColor: "#FFFFFF",
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 16,
  },
  billHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  billInfo: {
    flex: 1,
  },
  billTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  billMeta: {
    fontSize: 14,
    color: "#8E8E93",
    marginBottom: 2,
  },
  billCreator: {
    fontSize: 14,
    color: "#8E8E93",
  },
  billStatus: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  billAmounts: {
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    paddingTop: 16,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 16,
    color: "#8E8E93",
  },
  amountValue: {
    fontSize: 16,
    color: "#1C1C1E",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#007AFF",
  },
  itemCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  itemDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemQuantity: {
    fontSize: 14,
    color: "#8E8E93",
  },
  itemAssigned: {
    fontSize: 14,
    color: "#8E8E93",
  },
  row: {
    flexDirection: "row",
    marginHorizontal: -8,
  },
  halfField: {
    flex: 1,
    marginHorizontal: 8,
  },
  actionButton: {
    marginBottom: 12,
  },
})

export default BillEditScreen
