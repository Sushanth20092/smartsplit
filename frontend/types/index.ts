export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  upi_id?: string
  created_at: string
}

export interface Group {
  id: string
  name: string
  description?: string
  created_by: string
  invite_code: string
  created_at: string
  members: GroupMember[]
  total_expenses: number
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  role: "admin" | "member"
  joined_at: string
  user: User
}

export interface Bill {
  id: string
  group_id: string
  created_by: string
  title: string
  description?: string
  total_amount: number
  currency: string
  receipt_image?: string
  created_at: string
  items: BillItem[]
  splits: BillSplit[]
  status: "draft" | "pending" | "approved" | "settled" | "cancelled"
  approved_at?: string
  settled_at?: string
  tip_amount: number
  tax_amount: number
  split_method?: "equal" | "by_item" | "custom"
  group?: { name: string }
  creator?: { name: string }
}

export interface BillItem {
  id: string
  bill_id: string
  name: string
  price: number // This will be the total price (quantity × rate)
  quantity: number
  rate?: number // Unit price per item
  category?: string
  assigned_users?: string[]
  created_at?: string
}

export interface ParsedItem {
  name: string
  quantity: number
  rate: number
  total: number
}

export interface BillItemParserProps {
  items: ParsedItem[]
  onItemsChange: (items: BillItem[]) => void
}

export interface BillSplit {
  id: string
  bill_id: string
  user_id: string
  amount: number
  paid: boolean
  paid_at?: string
  approval_status: "pending" | "approved" | "rejected"
  approval_at?: string
  payment_status: "pending" | "submitted" | "confirmed" | "rejected"
  upi_reference?: string
  upi_screenshot_url?: string
  rejection_reason?: string
  users?: User
}

export interface Payment {
  id: string
  from_user_id: string
  to_user_id: string
  amount: number
  currency: string
  bill_id?: string
  group_id: string
  status: "pending" | "completed" | "failed"
  payment_method: "stripe" | "paypal" | "venmo" | "cash"
  created_at: string
  completed_at?: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: "bill_added" | "bill_pending_approval" | "payment_request" | "payment_received" | "payment_submitted" | "payment_confirmed" | "payment_rejected" | "group_invite" | "user_joined_group" | "user_left_group" | "bill_settled"
  read: boolean
  data?: any
  created_at: string
}

export interface ChatMessage {
  id: string
  group_id: string
  user_id: string
  message: string
  created_at: string
  user: User
}

export type RootStackParamList = {
  Splash: undefined
  Onboarding: undefined
  Login: undefined
  Signup: undefined
  ForgotPassword: undefined
  Dashboard: undefined
  CreateGroup: undefined
  JoinGroup: undefined
  GroupList: { initialGroups?: Group[] } | undefined
  GroupDetails: { groupId: string; shouldRefresh?: boolean }
  GroupBills: { groupId: string; groupName: string }
  AddBill: { groupId: string }
  BillEdit: { billId: string }
  BillSplit: { billId: string }
  BillDetails: { billId: string }
  BillSummary: { billId: string }
  AllBills: undefined
  Approval: { billId: string }
  Payment: { billId: string }
  PaymentHistory: undefined
  PaymentRequest: { userId: string; amount: number }
  ExpenseTracking: undefined
  Profile: undefined
  Settings: undefined
  Notifications: undefined
  GroupChat: { groupId: string }
  GroupMembers: { groupId: string }
  GroupSettings: { groupId: string }
}
