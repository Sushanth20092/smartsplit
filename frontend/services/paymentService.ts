import { supabase } from "../../backend/supabase/client"
import { notificationService } from "./notificationService"
import type { Bill, User } from "../types"

export interface PaymentMethod {
  id: string
  type: "stripe" | "paypal" | "venmo" | "cash"
  name: string
  details?: any
}

export interface PaymentRequest {
  amount: number
  currency: string
  description: string
  recipientId: string
  paymentMethod: string
}

export interface PaymentCalculation {
  userId: string
  amount: number
  items: string[]
}

export interface SplitResult {
  calculations: PaymentCalculation[]
  total: number
}

export class PaymentService {
  private stripeKey: string

  constructor() {
    this.stripeKey = process.env.STRIPE_PUBLISHABLE_KEY!
  }

  async processPayment(request: PaymentRequest): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      switch (request.paymentMethod) {
        case "stripe":
          return await this.processStripePayment(request)
        case "paypal":
          return await this.processPayPalPayment(request)
        case "venmo":
          return await this.processVenmoPayment(request)
        case "cash":
          return await this.processCashPayment(request)
        default:
          throw new Error("Unsupported payment method")
      }
    } catch (error) {
      console.error("Payment processing error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment failed",
      }
    }
  }

  private async processStripePayment(request: PaymentRequest) {
    // Stripe payment implementation
    // This would integrate with Stripe SDK
    return {
      success: true,
      transactionId: `stripe_${Date.now()}`,
    }
  }

  private async processPayPalPayment(request: PaymentRequest) {
    // PayPal payment implementation
    return {
      success: true,
      transactionId: `paypal_${Date.now()}`,
    }
  }

  private async processVenmoPayment(request: PaymentRequest) {
    // Venmo payment implementation
    return {
      success: true,
      transactionId: `venmo_${Date.now()}`,
    }
  }

  private async processCashPayment(request: PaymentRequest) {
    // Cash payment (just mark as completed)
    return {
      success: true,
      transactionId: `cash_${Date.now()}`,
    }
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return [
      { id: "stripe", type: "stripe", name: "Credit/Debit Card" },
      { id: "paypal", type: "paypal", name: "PayPal" },
      { id: "venmo", type: "venmo", name: "Venmo" },
      { id: "cash", type: "cash", name: "Cash" },
    ]
  }

  // Split calculation functions
  async calculateEqualSplit(bill: Bill, userIds: string[]): Promise<SplitResult> {
    const totalAmount = bill.total_amount + (bill.tip_amount || 0) + (bill.tax_amount || 0)
    const baseAmountPerPerson = Math.floor((totalAmount * 100) / userIds.length) / 100 // Round down to 2 decimal places
    const remainder = Math.round((totalAmount - (baseAmountPerPerson * userIds.length)) * 100) / 100

    const calculations: PaymentCalculation[] = userIds.map((userId, index) => ({
      userId,
      // Add the remainder to the first person to ensure total matches exactly
      amount: index === 0 ? baseAmountPerPerson + remainder : baseAmountPerPerson,
      items: ["Equal split of all items"]
    }))

    return {
      calculations,
      total: totalAmount
    }
  }

  async calculateItemBasedSplit(billId: string): Promise<SplitResult> {
    try {
      // Fetch bill and bill items with assignments
      const { data: bill, error: billError } = await supabase
        .from("bills")
        .select("total_amount, tip_amount, tax_amount")
        .eq("id", billId)
        .single()

      if (billError) throw billError

      const { data: billItems, error: itemsError } = await supabase
        .from("bill_items")
        .select("*")
        .eq("bill_id", billId)

      if (itemsError) throw itemsError

      const userAmounts: { [userId: string]: { itemsAmount: number; items: string[] } } = {}
      let totalItemsAmount = 0

      // Calculate amount per user based on item assignments
      billItems?.forEach(item => {
        const assignedUsers = item.assigned_users || []
        if (assignedUsers.length > 0) {
          const itemSubtotal = item.price * item.quantity
          const amountPerUser = itemSubtotal / assignedUsers.length
          totalItemsAmount += itemSubtotal

          assignedUsers.forEach((userId: string) => {
            if (!userAmounts[userId]) {
              userAmounts[userId] = { itemsAmount: 0, items: [] }
            }
            userAmounts[userId].itemsAmount += amountPerUser
            userAmounts[userId].items.push(item.name)
          })
        }
      })

      // Calculate equal tip and tax allocation among all assigned members
      const tipAmount = bill.tip_amount || 0
      const taxAmount = bill.tax_amount || 0
      const totalTipTax = tipAmount + taxAmount
      const assignedMemberCount = Object.keys(userAmounts).length
      const tipTaxPerMember = assignedMemberCount > 0 ? totalTipTax / assignedMemberCount : 0

      const calculations: PaymentCalculation[] = Object.entries(userAmounts).map(([userId, data]) => {
        // Each member gets equal share of tip and tax
        const totalAmount = data.itemsAmount + tipTaxPerMember

        return {
          userId,
          amount: Math.round(totalAmount * 100) / 100, // Round to 2 decimal places
          items: data.items
        }
      })

      const total = bill.total_amount + tipAmount + taxAmount

      return {
        calculations,
        total
      }
    } catch (error) {
      console.error("Error calculating item-based split:", error)
      throw error
    }
  }

  async calculateCustomSplit(bill: Bill, customAmounts: { [userId: string]: number }): Promise<SplitResult> {
    const calculations: PaymentCalculation[] = Object.entries(customAmounts).map(([userId, amount]) => ({
      userId,
      amount,
      items: ["Custom amount"]
    }))

    const total = calculations.reduce((sum, calc) => sum + calc.amount, 0)

    return {
      calculations,
      total
    }
  }

  async updateItemAssignments(itemId: string, assignedUserIds: string[]): Promise<void> {
    try {
      const { error } = await supabase
        .from("bill_items")
        .update({ assigned_users: assignedUserIds })
        .eq("id", itemId)

      if (error) throw error
    } catch (error) {
      console.error("Error updating item assignments:", error)
      throw error
    }
  }

  async savePayments(billId: string, calculations: PaymentCalculation[], splitMode?: "equal" | "by_item" | "custom", billItems?: any[]): Promise<void> {
    try {
      // First, delete any existing bill splits for this bill
      await supabase
        .from("bill_splits")
        .delete()
        .eq("bill_id", billId)

      // Get bill creator to auto-approve them
      const { data: billData, error: billDataError } = await supabase
        .from("bills")
        .select("created_by")
        .eq("id", billId)
        .single()

      if (billDataError) throw billDataError

      // Create new bill splits - auto-approve creator
      const billSplits = calculations.map(calc => ({
        bill_id: billId,
        user_id: calc.userId,
        amount: calc.amount,
        paid: false,
        approval_status: calc.userId === billData.created_by ? 'approved' : 'pending',
        approval_at: calc.userId === billData.created_by ? new Date().toISOString() : null,
        payment_status: 'pending'
      }))

      console.log(`PaymentService: Creating ${billSplits.length} bill splits for bill ${billId}:`, billSplits)

      const { data: insertedSplits, error } = await supabase
        .from("bill_splits")
        .insert(billSplits)
        .select()

      if (error) {
        console.error("PaymentService: Error inserting bill splits:", error)
        throw error
      }

      console.log(`PaymentService: Successfully created ${insertedSplits?.length || 0} bill splits`)

      // If this is a by_item split, ensure bill_items have the correct assigned_users
      if (splitMode === "by_item" && billItems && billItems.length > 0) {
        for (const item of billItems) {
          if (item.assigned_users && item.assigned_users.length > 0) {
            const { error: itemError } = await supabase
              .from("bill_items")
              .update({ assigned_users: item.assigned_users })
              .eq("id", item.id)

            if (itemError) {
              console.error("Error updating item assignments:", itemError)
              // Don't throw here, just log the error to avoid breaking the entire save
            }
          }
        }
      }

      // Update bill status to pending (from draft) and save split method
      console.log("Updating bill status to pending for billId:", billId)
      const { data: updateData, error: statusError } = await supabase
        .from("bills")
        .update({ 
          status: "pending",
          split_method: splitMode || "equal"
        })
        .eq("id", billId)
        .select()

      if (statusError) {
        console.error("Error updating bill status:", statusError)
        throw statusError
      }

      console.log("Bill status update result:", updateData)

      // Notify bill participants about pending approval
      if (updateData && updateData.length > 0) {
        try {
          const updatedBill = updateData[0]

          // Get group name for notification
          const { data: groupData } = await supabase
            .from("groups")
            .select("name")
            .eq("id", updatedBill.group_id)
            .single()

          if (groupData) {
            await notificationService.notifyBillPendingApproval(
              billId,
              updatedBill.title,
              updatedBill.group_id,
              groupData.name
            )
            console.log("PaymentService: Pending approval notifications sent")
          }
        } catch (notificationError) {
          console.error("PaymentService: Failed to send pending approval notifications:", notificationError)
          // Don't fail the save process if notifications fail
        }
      }

    } catch (error) {
      console.error("Error saving payments:", error)
      throw error
    }
  }

  // Approval-related methods
  async approveBillSplit(billId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("bill_splits")
        .update({ 
          approval_status: 'approved',
          approval_at: new Date().toISOString()
        })
        .eq("bill_id", billId)
        .eq("user_id", userId)

      if (error) throw error

      // Check if all participants have approved
      await this.checkAndUpdateBillApprovalStatus(billId)
    } catch (error) {
      console.error("Error approving bill split:", error)
      throw error
    }
  }

  async rejectBillSplit(billId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("bill_splits")
        .update({ 
          approval_status: 'rejected',
          approval_at: new Date().toISOString()
        })
        .eq("bill_id", billId)
        .eq("user_id", userId)

      if (error) throw error

      // Notify creator about rejection
      await this.notifyCreatorOfRejection(billId, userId)
    } catch (error) {
      console.error("Error rejecting bill split:", error)
      throw error
    }
  }

  async revertBillToDraft(billId: string, creatorId: string): Promise<void> {
    try {
      // Verify the user is the creator
      const { data: bill, error: billError } = await supabase
        .from("bills")
        .select("created_by")
        .eq("id", billId)
        .single()

      if (billError) throw billError
      if (bill.created_by !== creatorId) {
        throw new Error("Only the bill creator can revert to draft")
      }

      // Update bill status to draft
      const { error: statusError } = await supabase
        .from("bills")
        .update({ status: "draft" })
        .eq("id", billId)

      if (statusError) throw statusError

      // Reset all approval statuses to pending when reverting to draft
      const { error: resetError } = await supabase
        .from("bill_splits")
        .update({ 
          approval_status: 'pending',
          approval_at: null
        })
        .eq("bill_id", billId)

      if (resetError) throw resetError
    } catch (error) {
      console.error("Error reverting bill to draft:", error)
      throw error
    }
  }

  private async checkAndUpdateBillApprovalStatus(billId: string): Promise<void> {
    try {
      console.log(`PaymentService: Checking approval status for bill ${billId}`)
      
      // Get all bill splits for this bill
      const { data: splits, error } = await supabase
        .from("bill_splits")
        .select("approval_status, user_id")
        .eq("bill_id", billId)

      if (error) throw error

      console.log(`PaymentService: Found ${splits?.length || 0} splits:`, splits?.map(s => ({ user_id: s.user_id, status: s.approval_status })))

      // Check if all participants have approved
      const allApproved = splits?.every(split => split.approval_status === 'approved')
      
      console.log(`PaymentService: All approved? ${allApproved}`)
      
      if (allApproved && splits && splits.length > 0) {
        console.log(`PaymentService: Updating bill ${billId} status to approved`)
        
        // First check if we can read the bill (for RLS debugging)
        const { data: billCheck, error: billCheckError } = await supabase
          .from("bills")
          .select("id, status, created_by")
          .eq("id", billId)
          .single()

        if (billCheckError) {
          console.error("PaymentService: Cannot read bill for update:", billCheckError)
          throw billCheckError
        }

        console.log(`PaymentService: Bill check before update:`, billCheck)
        
        // Update bill status to approved with timestamp
        const { data: updateData, error: updateError } = await supabase
          .from("bills")
          .update({ 
            status: "approved",
            approved_at: new Date().toISOString()
          })
          .eq("id", billId)
          .select()

        if (updateError) {
          console.error("PaymentService: Error updating bill status:", updateError)
          console.error("PaymentService: Update error details:", JSON.stringify(updateError, null, 2))
          throw updateError
        }

        console.log(`PaymentService: Update result:`, updateData)
        console.log(`PaymentService: Bill ${billId} successfully updated to approved status`)

        // Verify the update worked by checking the database
        const { data: verifyData, error: verifyError } = await supabase
          .from("bills")
          .select("id, status, approved_at")
          .eq("id", billId)
          .single()

        if (verifyError) {
          console.error("PaymentService: Error verifying update:", verifyError)
        } else {
          console.log(`PaymentService: Verification - Bill status is now:`, verifyData)
        }

        // Automatically mark the bill creator as paid and confirmed
        console.log(`PaymentService: 🚀 CALLING markCreatorAsPaid for bill ${billId}`)
        await this.markCreatorAsPaid(billId)
        console.log(`PaymentService: ✅ COMPLETED markCreatorAsPaid for bill ${billId}`)

        // Notify all participants that bill is approved and ready for payment
        await this.notifyBillApproved(billId)
      }
    } catch (error) {
      console.error("Error checking bill approval status:", error)
      throw error
    }
  }

  private async markCreatorAsPaid(billId: string): Promise<void> {
    try {
      console.log(`PaymentService: Marking creator as paid for bill ${billId}`)
      
      // Get the bill creator ID
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select("created_by")
        .eq("id", billId)
        .single()

      if (billError) {
        console.error("PaymentService: Error fetching bill creator:", billError)
        console.error("PaymentService: Bill error details:", JSON.stringify(billError, null, 2))
        return // Don't throw, just return to avoid breaking approval flow
      }

      if (!billData?.created_by) {
        console.error("PaymentService: No creator found for bill:", billId)
        return
      }

      console.log(`PaymentService: Found bill creator: ${billData.created_by}`)

      // Check if the creator's split exists and current status
      const { data: existingSplit, error: checkError } = await supabase
        .from("bill_splits")
        .select("id, user_id, paid, payment_status")
        .eq("bill_id", billId)
        .eq("user_id", billData.created_by)
        .single()

      if (checkError) {
        console.error("PaymentService: Error checking existing creator split:", checkError)
        console.error("PaymentService: Check error details:", JSON.stringify(checkError, null, 2))
        return
      }

      console.log(`PaymentService: Found creator split:`, existingSplit)

      // Skip if already confirmed
      if (existingSplit.payment_status === 'confirmed' && existingSplit.paid === true) {
        console.log(`PaymentService: Creator payment already confirmed, skipping update`)
        return
      }

      // Try using RPC function first (if available), fallback to direct update
      console.log(`PaymentService: Attempting to mark creator as paid using RPC function`)
      
      try {
        const { data: rpcResult, error: rpcError } = await supabase
          .rpc('mark_creator_as_paid', { bill_id_param: billId })
        
        if (rpcError) {
          console.log(`PaymentService: RPC function not available, falling back to direct update:`, rpcError.message)
          throw rpcError
        }
        
        console.log(`PaymentService: RPC function result:`, rpcResult)
        
        if (rpcResult) {
          console.log(`PaymentService: Successfully marked creator as paid using RPC function`)
          return
        } else {
          console.log(`PaymentService: RPC function returned false, creator may already be confirmed`)
          return
        }
      } catch (rpcError) {
        console.log(`PaymentService: RPC approach failed, trying direct update with service account context`)
        
        // Fallback: Try direct update (this might still fail due to RLS)
        const { data: updateData, error: updateError } = await supabase
          .from("bill_splits")
          .update({
            paid: true,
            payment_status: 'confirmed',
            paid_at: new Date().toISOString()
          })
          .eq("bill_id", billId)
          .eq("user_id", billData.created_by)
          .select()

        if (updateError) {
          console.error("PaymentService: Direct update also failed:", updateError)
          console.log(`PaymentService: Trying confirmPaymentProof as final fallback`)
          
          // Final fallback: use confirmPaymentProof (might send extra notification)
          await this.confirmPaymentProof(billId, billData.created_by)
          console.log(`PaymentService: Successfully marked creator as paid using confirmPaymentProof fallback`)
        } else {
          console.log(`PaymentService: Direct update succeeded:`, updateData)
        }
      }
    } catch (error) {
      console.error("PaymentService: Unexpected error in markCreatorAsPaid:", error)
      // Don't throw - this shouldn't break the approval process
    }
  }

  private async notifyCreatorOfRejection(billId: string, rejectorUserId: string): Promise<void> {
    try {
      // Get bill and rejector details
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select(`
          title,
          created_by,
          group:groups(name)
        `)
        .eq("id", billId)
        .single()

      if (billError) throw billError

      const { data: rejectorData, error: rejectorError } = await supabase
        .from("users")
        .select("name")
        .eq("id", rejectorUserId)
        .single()

      if (rejectorError) throw rejectorError

      // Send notification to creator
      await notificationService.createNotification(
        billData.created_by,
        "Bill Rejected",
        `${rejectorData.name} rejected the bill "${billData.title}" in ${billData.group?.name}. You can revert to draft and edit.`,
        'bill_pending_approval',
        { billId, rejectorUserId }
      )
    } catch (error) {
      console.error("Error notifying creator of rejection:", error)
      // Don't throw - this is a non-critical operation
    }
  }

  private async notifyBillApproved(billId: string): Promise<void> {
    try {
      // Get bill details and all participants
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select(`
          title,
          created_by,
          group_id,
          group:groups(name),
          splits:bill_splits(user_id)
        `)
        .eq("id", billId)
        .single()

      if (billError) throw billError

      // Notify all participants
      const participantIds = billData.splits?.map(split => split.user_id) || []
      
      for (const userId of participantIds) {
        await notificationService.createNotification(
          userId,
          "Bill Approved - Ready for Payment",
          `Bill "${billData.title}" in ${billData.group?.name} has been approved by all members and is ready for payment.`,
          'bill_added',
          { billId }
        )
      }
    } catch (error) {
      console.error("Error notifying bill approved:", error)
      // Don't throw - this is a non-critical operation
    }
  }

  // Payment-related methods
  async markPaymentAsPaid(billId: string, userId: string, upiReference?: string, screenshotUrl?: string): Promise<void> {
    try {
      const updateData: any = {
        paid: true,
        paid_at: new Date().toISOString()
      }

      if (upiReference) updateData.upi_reference = upiReference
      if (screenshotUrl) updateData.upi_screenshot_url = screenshotUrl

      const { error } = await supabase
        .from("bill_splits")
        .update(updateData)
        .eq("bill_id", billId)
        .eq("user_id", userId)

      if (error) throw error

      // Check if all payments are completed
      await this.checkAndUpdateBillSettlementStatus(billId)
    } catch (error) {
      console.error("Error marking payment as paid:", error)
      throw error
    }
  }

  // New secure payment proof submission method
  async submitPaymentProof(billId: string, userId: string, proof: { screenshot?: string; referenceId?: string }): Promise<void> {
    try {
      // Validation: require at least one proof
      if (!proof.screenshot && !proof.referenceId) {
        throw new Error("At least one proof (screenshot or reference ID) is required")
      }

      const updateData: any = {
        payment_status: 'submitted',
        paid: false,
        paid_at: null,
      }

      if (proof.referenceId) updateData.upi_reference = proof.referenceId
      if (proof.screenshot) updateData.upi_screenshot_url = proof.screenshot

      const { error } = await supabase
        .from("bill_splits")
        .update(updateData)
        .eq("bill_id", billId)
        .eq("user_id", userId)

      if (error) throw error

      // Notify creator about proof submission
      await this.notifyCreatorOfProofSubmission(billId, userId)
    } catch (error) {
      console.error("Error submitting payment proof:", error)
      throw error
    }
  }

  // Confirm payment proof (creator action)
  async confirmPaymentProof(billId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("bill_splits")
        .update({
          payment_status: 'confirmed',
          paid: true,
          paid_at: new Date().toISOString()
        })
        .eq("bill_id", billId)
        .eq("user_id", userId)

      if (error) throw error

      // Notify member about confirmation
      await this.notifyMemberOfPaymentConfirmation(billId, userId)

      // Check if all payments are completed
      await this.checkAndUpdateBillSettlementStatus(billId)
    } catch (error) {
      console.error("Error confirming payment proof:", error)
      throw error
    }
  }

  // Reject payment proof (creator action)
  async rejectPaymentProof(billId: string, userId: string, reason: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("bill_splits")
        .update({
          payment_status: 'rejected',
          paid: false,
          rejection_reason: reason
        })
        .eq("bill_id", billId)
        .eq("user_id", userId)

      if (error) throw error

      // Notify member about rejection
      await this.notifyMemberOfPaymentRejection(billId, userId, reason)
    } catch (error) {
      console.error("Error rejecting payment proof:", error)
      throw error
    }
  }

  async markPaymentAsReceived(billId: string, payerUserId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("bill_splits")
        .update({
          paid: true,
          paid_at: new Date().toISOString()
        })
        .eq("bill_id", billId)
        .eq("user_id", payerUserId)

      if (error) throw error

      // Check if all payments are completed
      await this.checkAndUpdateBillSettlementStatus(billId)
    } catch (error) {
      console.error("Error marking payment as received:", error)
      throw error
    }
  }

  private async checkAndUpdateBillSettlementStatus(billId: string): Promise<void> {
    try {
      // Get all bill splits for this bill - now check payment_status instead of just paid
      const { data: splits, error } = await supabase
        .from("bill_splits")
        .select("payment_status")
        .eq("bill_id", billId)

      if (error) throw error

      // Check if all participants have confirmed payments
      const allConfirmed = splits?.every(split => split.payment_status === 'confirmed')
      
      if (allConfirmed && splits && splits.length > 0) {
        // Update bill status to settled with timestamp
        const { error: updateError } = await supabase
          .from("bills")
          .update({ 
            status: "settled",
            settled_at: new Date().toISOString()
          })
          .eq("id", billId)

        if (updateError) throw updateError

        // Notify all participants that bill is settled
        await this.notifyBillSettled(billId)
      }
    } catch (error) {
      console.error("Error checking bill settlement status:", error)
      throw error
    }
  }

  // New notification methods for payment proof workflow
  private async notifyCreatorOfProofSubmission(billId: string, submitterUserId: string): Promise<void> {
    try {
      // Get bill and submitter details
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select(`
          title,
          created_by,
          group:groups(name)
        `)
        .eq("id", billId)
        .single()

      if (billError) throw billError

      const { data: submitterData, error: submitterError } = await supabase
        .from("users")
        .select("name")
        .eq("id", submitterUserId)
        .single()

      if (submitterError) throw submitterError

      // Send notification to creator
      await notificationService.createNotification(
        billData.created_by,
        "Payment Proof Submitted",
        `${submitterData.name} submitted proof for "${billData.title}". Please review and confirm.`,
        'payment_submitted',
        { billId, submitterUserId }
      )
    } catch (error) {
      console.error("Error notifying creator of proof submission:", error)
      // Don't throw - this is a non-critical operation
    }
  }

  private async notifyMemberOfPaymentConfirmation(billId: string, memberUserId: string): Promise<void> {
    try {
      // Get bill details
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select(`
          title,
          group:groups(name)
        `)
        .eq("id", billId)
        .single()

      if (billError) throw billError

      // Send notification to member
      await notificationService.createNotification(
        memberUserId,
        "Payment Confirmed",
        `Your payment for "${billData.title}" has been confirmed.`,
        'payment_confirmed',
        { billId }
      )
    } catch (error) {
      console.error("Error notifying member of payment confirmation:", error)
      // Don't throw - this is a non-critical operation
    }
  }

  private async notifyMemberOfPaymentRejection(billId: string, memberUserId: string, reason: string): Promise<void> {
    try {
      // Get bill details
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select(`
          title,
          group:groups(name)
        `)
        .eq("id", billId)
        .single()

      if (billError) throw billError

      // Send notification to member
      await notificationService.createNotification(
        memberUserId,
        "Payment Proof Rejected",
        `Your payment proof for "${billData.title}" was rejected: ${reason}. Please resubmit.`,
        'payment_rejected',
        { billId, reason }
      )
    } catch (error) {
      console.error("Error notifying member of payment rejection:", error)
      // Don't throw - this is a non-critical operation
    }
  }

  private async notifyBillSettled(billId: string): Promise<void> {
    try {
      // Get bill details and all participants
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select(`
          title,
          created_by,
          group_id,
          group:groups(name),
          splits:bill_splits(user_id)
        `)
        .eq("id", billId)
        .single()

      if (billError) throw billError

      // Notify all participants
      const participantIds = billData.splits?.map(split => split.user_id) || []
      
      for (const userId of participantIds) {
        await notificationService.createNotification(
          userId,
          "Bill Settled",
          `Bill "${billData.title}" in ${billData.group?.name} has been fully settled. All payments completed!`,
          'bill_settled',
          { billId }
        )
      }
    } catch (error) {
      console.error("Error notifying bill settled:", error)
      // Don't throw - this is a non-critical operation
    }
  }

  generateUPIPaymentLink(upiId: string, payeeName: string, amount: number, billTitle: string): string {
    // Generate UPI payment link according to UPI specification
    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Payment for ${billTitle}`)}`
    return upiLink
  }

  async getBillPaymentData(billId: string, currentUserId: string): Promise<{
    bill: any,
    splits: any[],
    isCreator: boolean,
    creatorUpiId?: string,
    currentUserSplit?: any
  }> {
    try {
      // Get bill details with creator info
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select(`
          *,
          creator:users!bills_created_by_fkey(name, upi_id),
          group:groups(name)
        `)
        .eq("id", billId)
        .single()

      if (billError) throw billError

      // Get bill splits with user info
      const { data: splitsData, error: splitsError } = await supabase
        .from("bill_splits")
        .select(`
          *,
          users(id, name, email)
        `)
        .eq("bill_id", billId)

      if (splitsError) throw splitsError

      const isCreator = currentUserId === billData.created_by
      const currentUserSplit = splitsData?.find(split => split.user_id === currentUserId)

      return {
        bill: billData,
        splits: splitsData || [],
        isCreator,
        creatorUpiId: billData.creator?.upi_id,
        currentUserSplit
      }
    } catch (error) {
      console.error("Error fetching bill payment data:", error)
      throw error
    }
  }
}

export const paymentService = new PaymentService()
