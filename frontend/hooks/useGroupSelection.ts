import { useState, useEffect } from "react"
import { Alert } from "react-native"
import { supabase } from "../../backend/supabase/client"
import { useAuth } from "../contexts/AuthProvider"
import type { Group } from "../types"

export const useGroupSelection = () => {
  const { user } = useAuth()
  const [userGroups, setUserGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [showGroupSelection, setShowGroupSelection] = useState(false)

  const fetchUserGroups = async (): Promise<Group[]> => {
    if (!user) return []

    setLoading(true)
    try {
      // Fetch groups where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from("group_members")
        .select(`
          group_id,
          groups (
            id,
            name,
            description,
            created_by,
            invite_code,
            created_at,
            total_expenses
          )
        `)
        .eq("user_id", user.id)

      if (memberError) throw memberError

      // Extract groups and fetch member counts
      const groups = memberData?.map((item: any) => item.groups).filter(Boolean) || []
      
      // Fetch member counts for each group
      const groupsWithMembers = await Promise.all(
        groups.map(async (group: any) => {
          const { data: membersData, error: membersError } = await supabase
            .from("group_members")
            .select("user_id")
            .eq("group_id", group.id)

          if (membersError) {
            console.error("Error fetching members for group:", group.id, membersError)
            return { ...group, members: [] }
          }

          return {
            ...group,
            members: membersData || [],
          }
        })
      )

      setUserGroups(groupsWithMembers)
      return groupsWithMembers
    } catch (error) {
      console.error("Error fetching user groups:", error)
      Alert.alert("Error", "Failed to load your groups")
      return []
    } finally {
      setLoading(false)
    }
  }

  const handleAddBillFromDashboard = async (): Promise<string | null> => {
    const groups = await fetchUserGroups()
    
    if (groups.length === 0) {
      // User is not in any groups - show group selection modal with empty state
      setShowGroupSelection(true)
      return null
    } else if (groups.length === 1) {
      // User is in exactly one group - use it directly
      return groups[0].id
    } else {
      // User is in multiple groups - show selection modal
      setShowGroupSelection(true)
      return null
    }
  }

  const handleGroupSelected = (groupId: string): string => {
    setShowGroupSelection(false)
    return groupId
  }

  const handleCreateGroup = () => {
    setShowGroupSelection(false)
    // Navigation will be handled by the component using this hook
  }

  const handleJoinGroup = () => {
    setShowGroupSelection(false)
    // Navigation will be handled by the component using this hook
  }

  const closeGroupSelection = () => {
    setShowGroupSelection(false)
  }

  // Fetch groups on mount
  useEffect(() => {
    if (user) {
      fetchUserGroups()
    }
  }, [user])

  return {
    userGroups,
    loading,
    showGroupSelection,
    handleAddBillFromDashboard,
    handleGroupSelected,
    handleCreateGroup,
    handleJoinGroup,
    closeGroupSelection,
    refetchGroups: fetchUserGroups,
  }
}
