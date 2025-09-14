/**
 * Debug script to check creator payment status
 * Run this in your browser console or as a Node.js script
 */

// For browser console (replace with your actual bill ID)
const debugCreatorPayment = async (billId) => {
  console.log('🔍 Debugging Creator Payment Status for Bill:', billId)
  
  try {
    // Check bill status
    const { data: billData, error: billError } = await supabase
      .from('bills')
      .select('id, status, created_by, approved_at')
      .eq('id', billId)
      .single()
    
    if (billError) {
      console.error('❌ Error fetching bill:', billError)
      return
    }
    
    console.log('📋 Bill Data:', billData)
    
    // Check all bill splits
    const { data: allSplits, error: splitsError } = await supabase
      .from('bill_splits')
      .select('user_id, approval_status, payment_status, paid, paid_at')
      .eq('bill_id', billId)
    
    if (splitsError) {
      console.error('❌ Error fetching splits:', splitsError)
      return
    }
    
    console.log('💰 All Bill Splits:', allSplits)
    
    // Find creator's split
    const creatorSplit = allSplits.find(split => split.user_id === billData.created_by)
    console.log('👤 Creator Split:', creatorSplit)
    
    // Check approval status
    const allApproved = allSplits.every(split => split.approval_status === 'approved')
    console.log('✅ All Approved:', allApproved)
    
    // Summary
    console.log('\n📊 Summary:')
    console.log(`Bill Status: ${billData.status}`)
    console.log(`All Members Approved: ${allApproved}`)
    console.log(`Creator Payment Status: ${creatorSplit?.payment_status || 'NOT FOUND'}`)
    console.log(`Creator Paid: ${creatorSplit?.paid || false}`)
    console.log(`Creator Paid At: ${creatorSplit?.paid_at || 'NULL'}`)
    
    if (billData.status === 'approved' && creatorSplit?.payment_status !== 'confirmed') {
      console.log('⚠️  ISSUE: Bill is approved but creator is not marked as confirmed!')
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error)
  }
}

// For testing - replace 'your-bill-id' with actual bill ID
// debugCreatorPayment('your-bill-id')

console.log(`
🔧 Debug Instructions:

1. Open your browser console on the app page
2. Copy and paste this entire script
3. Run: debugCreatorPayment('your-actual-bill-id')
4. Check the output for any issues

This will show you:
- Current bill status
- All bill splits and their statuses
- Whether the creator's payment is properly marked
- Any discrepancies between expected and actual state
`)

// Export for Node.js usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { debugCreatorPayment }
}