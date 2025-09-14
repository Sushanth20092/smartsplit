import { supabase } from "../../backend/supabase/client"
import type { Bill, User } from "../types"

export interface FilteredBill extends Bill {
  userJoinedAt?: string
}

export interface GroupMemberWithJoinDate {
  user_id: string
  joined_at: string
  role: string
  users: User
}

export class BillFilterService {
  /**
   * Fetch bills for a user, filtered by their join date in each group
   * Only returns bills created after the user joined the group
   */
  async fetchUserBills(userId: string, limit?: number, groupId?: string): Promise<FilteredBill[]> {
    try {
      // First, get all groups the user is a member of with their join dates
      let membershipQuery = supabase
        .from("group_members")
        .select("group_id, joined_at")
        .eq("user_id", userId)
      
      // If groupId is specified, filter to only that group
      if (groupId) {
        membershipQuery = membershipQuery.eq("group_id", groupId)
      }
      
      const { data: membershipData, error: membershipError } = await membershipQuery

      if (membershipError) {
        console.error("Error fetching user memberships:", membershipError)
        throw membershipError
      }

      if (!membershipData || membershipData.length === 0) {
        return []
      }

      // Get all group IDs
      const groupIds = membershipData.map(membership => membership.group_id)

      // Fetch bills from all user's groups
      const { data: billsData, error: billsError } = await supabase
        .from("bills")
        .select(`
          *,
          items:bill_items(*),
          splits:bill_splits(*),
          group:groups(name),
          creator:users!bills_created_by_fkey(name)
        `)
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(limit || 50)

      if (billsError) {
        console.error("Error fetching bills:", billsError)
        throw billsError
      }

      // Create a map of group_id to join_date for quick lookup
      const joinDateMap = new Map(
        membershipData.map(membership => [membership.group_id, membership.joined_at])
      )

      // Filter bills where bill.created_at >= user.joined_at for that group
      const filteredBills = (billsData || []).filter(bill => {
        const userJoinedAt = joinDateMap.get(bill.group_id)
        if (!userJoinedAt) return false

        const billCreated = new Date(bill.created_at)
        const userJoined = new Date(userJoinedAt)
        const isEligible = billCreated >= userJoined

        console.log(`Bill filtering: ${bill.title} - Created: ${billCreated.toISOString()}, User joined: ${userJoined.toISOString()}, Eligible: ${isEligible}`)

        return isEligible
      })

      // Add join date info to bills for reference
      const billsWithJoinDate = filteredBills.map(bill => ({
        ...bill,
        userJoinedAt: joinDateMap.get(bill.group_id)
      }))

      return billsWithJoinDate
    } catch (error) {
      console.error("BillFilterService: fetchUserBills error:", error)
      throw error
    }
  }

  /**
   * Fetch bills for a specific group, filtered by user's join date
   * Only returns bills created after the user joined the group
   */
  async fetchGroupBillsForUser(groupId: string, userId: string, limit?: number): Promise<FilteredBill[]> {
    try {
      // First get the user's join date for this group
      const { data: memberData, error: memberError } = await supabase
        .from("group_members")
        .select("joined_at")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .single()

      if (memberError) {
        console.error("Error fetching user membership:", memberError)
        throw memberError
      }

      if (!memberData) {
        // User is not a member of this group
        return []
      }

      // Fetch bills created after user joined
      const { data: billsData, error: billsError } = await supabase
        .from("bills")
        .select(`
          *,
          items:bill_items(*),
          splits:bill_splits(*),
          group:groups(name),
          creator:users!bills_created_by_fkey(name)
        `)
        .eq("group_id", groupId)
        .gte("created_at", memberData.joined_at)
        .order("created_at", { ascending: false })
        .limit(limit || 50)

      if (billsError) {
        console.error("Error fetching group bills:", billsError)
        throw billsError
      }

      return (billsData || []).map(bill => ({
        ...bill,
        userJoinedAt: memberData.joined_at
      }))
    } catch (error) {
      console.error("BillFilterService: fetchGroupBillsForUser error:", error)
      throw error
    }
  }

  /**
   * Fetch group members who were present when a bill was created
   * Only returns members whose joined_at <= bill.created_at
   */
  async fetchEligibleMembersForBill(billId: string): Promise<User[]> {
    try {
      // First get the bill creation date and group ID
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select("created_at, group_id")
        .eq("id", billId)
        .single()

      if (billError) {
        console.error("Error fetching bill data:", billError)
        throw billError
      }

      // Fetch members who joined before or on the bill creation date
      const { data: membersData, error: membersError } = await supabase
        .from("group_members")
        .select(`
          user_id,
          joined_at,
          role,
          users (
            id,
            name,
            email,
            avatar,
            upi_id,
            created_at
          )
        `)
        .eq("group_id", billData.group_id)
        .lte("joined_at", billData.created_at)

      if (membersError) {
        console.error("Error fetching eligible members:", membersError)
        throw membersError
      }

      // Extract user data and filter out any null users
      const eligibleUsers = (membersData || [])
        .map((member: any) => member.users)
        .filter(Boolean) as User[]

      return eligibleUsers
    } catch (error) {
      console.error("BillFilterService: fetchEligibleMembersForBill error:", error)
      throw error
    }
  }

  /**
   * Check if a user is eligible to see a specific bill
   * Returns true if the bill was created after the user joined the group
   */
  async isUserEligibleForBill(billId: string, userId: string): Promise<boolean> {
    try {
      // Get bill details
      const { data: billData, error: billError } = await supabase
        .from("bills")
        .select("created_at, group_id")
        .eq("id", billId)
        .single()

      if (billError) {
        console.error("Error fetching bill data:", billError)
        return false
      }

      // Get user's join date for this group
      const { data: memberData, error: memberError } = await supabase
        .from("group_members")
        .select("joined_at")
        .eq("group_id", billData.group_id)
        .eq("user_id", userId)
        .single()

      if (memberError) {
        console.error("Error fetching user membership:", memberError)
        return false
      }

      if (!memberData) {
        console.log("User is not a member of this group")
        return false
      }

      const billCreated = new Date(billData.created_at)
      const userJoined = new Date(memberData.joined_at)
      const isEligible = billCreated >= userJoined

      console.log(`Bill eligibility check: Bill created ${billCreated.toISOString()}, User joined ${userJoined.toISOString()}, Eligible: ${isEligible}`)
      
      return isEligible
    } catch (error) {
      console.error("BillFilterService: isUserEligibleForBill error:", error)
      return false
    }
  }

  /**
   * Get user's join date for a specific group
   */
  async getUserJoinDate(groupId: string, userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from("group_members")
        .select("joined_at")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .single()

      if (error) {
        console.error("Error fetching user join date:", error)
        return null
      }

      return data?.joined_at || null
    } catch (error) {
      console.error("BillFilterService: getUserJoinDate error:", error)
      return null
    }
  }

  /**
   * Fetch all bills for a specific group (for Group Bills page)
   * Returns all bills for the group that the user is eligible to see
   */
  async fetchAllGroupBillsForUser(groupId: string, userId: string): Promise<FilteredBill[]> {
    try {
      // First get the user's join date for this group
      const { data: memberData, error: memberError } = await supabase
        .from("group_members")
        .select("joined_at")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .single()

      if (memberError) {
        console.error("Error fetching user membership:", memberError)
        throw memberError
      }

      if (!memberData) {
        // User is not a member of this group
        return []
      }

      // Fetch all bills created after user joined (no limit for Group Bills page)
      const { data: billsData, error: billsError } = await supabase
        .from("bills")
        .select(`
          *,
          items:bill_items(*),
          splits:bill_splits(*),
          group:groups(name),
          creator:users!bills_created_by_fkey(name)
        `)
        .eq("group_id", groupId)
        .gte("created_at", memberData.joined_at)
        .order("created_at", { ascending: false })

      if (billsError) {
        console.error("Error fetching all group bills:", billsError)
        throw billsError
      }

      return (billsData || []).map(bill => ({
        ...bill,
        userJoinedAt: memberData.joined_at
      }))
    } catch (error) {
      console.error("BillFilterService: fetchAllGroupBillsForUser error:", error)
      throw error
    }
  }

  /**
   * Calculate user balances (owed and owing) only for bills they are eligible to participate in
   * This ensures new members don't see balances for bills created before they joined
   * 
   * Logic:
   * - For bills where user is the creator: "You're owed" = sum of others' unpaid shares, "You owe" = 0
   * - For bills where user is a participant: "You owe" = user's unpaid share, "You're owed" = 0
   */
  async fetchUserBalances(userId: string): Promise<{ totalOwed: number; totalOwing: number }> {
    try {
      // First, get all groups the user is a member of with their join dates
      const { data: membershipData, error: membershipError } = await supabase
        .from("group_members")
        .select("group_id, joined_at")
        .eq("user_id", userId)

      if (membershipError) {
        console.error("Error fetching user memberships:", membershipError)
        throw membershipError
      }

      if (!membershipData || membershipData.length === 0) {
        return { totalOwed: 0, totalOwing: 0 }
      }

      // Get all group IDs
      const groupIds = membershipData.map(membership => membership.group_id)

      // Create a map of group_id to join_date for quick lookup
      const joinDateMap = new Map(
        membershipData.map(membership => [membership.group_id, membership.joined_at])
      )

      // Fetch all bill splits with bill details for proper balance calculation
      const { data: allSplitsData, error: splitsError } = await supabase
        .from("bill_splits")
        .select(`
          amount,
          paid,
          user_id,
          bills!inner(
            id,
            group_id,
            created_at,
            created_by,
            status
          )
        `)
        .eq("paid", false)
        .in("bills.status", ["pending", "approved"])
        .in("bills.group_id", groupIds)

      if (splitsError) {
        console.error("Error fetching bill splits:", splitsError)
        throw splitsError
      }

      // Filter splits to only include bills created after user joined the group
      const eligibleSplits = (allSplitsData || []).filter(split => {
        const bill = split.bills
        if (!bill) return false

        const userJoinedAt = joinDateMap.get(bill.group_id)
        if (!userJoinedAt) return false

        const billCreated = new Date(bill.created_at)
        const userJoined = new Date(userJoinedAt)
        return billCreated >= userJoined
      })

      // Group splits by bill_id for easier processing
      const splitsByBill = new Map<string, any[]>()
      eligibleSplits.forEach(split => {
        const billId = split.bills.id
        if (!splitsByBill.has(billId)) {
          splitsByBill.set(billId, [])
        }
        splitsByBill.get(billId)!.push(split)
      })

      let totalOwed = 0  // Money others owe to the user (user is creator)
      let totalOwing = 0 // Money user owes to others (user is participant)

      // Process each bill
      splitsByBill.forEach((splits, billId) => {
        const bill = splits[0]?.bills
        if (!bill) return

        const isCreator = bill.created_by === userId
        const userSplit = splits.find(split => split.user_id === userId)
        const otherSplits = splits.filter(split => split.user_id !== userId)

        if (isCreator) {
          // User is the creator: "You're owed" = sum of others' unpaid shares
          const amountOwedToBillCreator = otherSplits.reduce((sum, split) => sum + split.amount, 0)
          totalOwed += amountOwedToBillCreator
          console.log(`Bill ${billId} (creator): Others owe ${amountOwedToBillCreator}`)
        } else if (userSplit) {
          // User is a participant: "You owe" = user's unpaid share
          totalOwing += userSplit.amount
          console.log(`Bill ${billId} (participant): User owes ${userSplit.amount}`)
        }
      })

      console.log(`BillFilterService: Final balances - You're owed: ${totalOwed}, You owe: ${totalOwing}`)
      console.log(`BillFilterService: Processed ${splitsByBill.size} eligible bills`)

      return { totalOwed, totalOwing }
    } catch (error) {
      console.error("BillFilterService: fetchUserBalances error:", error)
      throw error
    }
  }
}

export const billFilterService = new BillFilterService()
