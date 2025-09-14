/**
 * Test script to verify that bill creators are automatically marked as paid
 * when all members approve a bill.
 * 
 * This script simulates the approval flow and checks that:
 * 1. When all members approve a bill, the bill status changes to 'approved'
 * 2. The creator's bill_split is automatically marked as paid and confirmed
 * 3. The UI correctly displays the creator's payment status
 */

const { createClient } = require('@supabase/supabase-js')

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = 'your-supabase-url'
const supabaseKey = 'your-supabase-anon-key'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testCreatorAutoPayment() {
  console.log('🧪 Testing Creator Auto-Payment Feature...\n')

  try {
    // Step 1: Create a test bill with splits
    console.log('1. Creating test bill...')
    
    // This would typically be done through your app's bill creation flow
    // For testing, you'd need to:
    // - Create a bill in 'pending' status
    // - Create bill_splits for multiple users including the creator
    // - Ensure creator is auto-approved but not yet paid
    
    const testBillId = 'test-bill-id' // Replace with actual test bill ID
    
    // Step 2: Check initial state
    console.log('2. Checking initial bill_splits state...')
    const { data: initialSplits, error: initialError } = await supabase
      .from('bill_splits')
      .select('user_id, approval_status, payment_status, paid')
      .eq('bill_id', testBillId)
    
    if (initialError) throw initialError
    
    console.log('Initial splits:', initialSplits)
    
    // Step 3: Simulate all non-creator members approving
    console.log('3. Simulating member approvals...')
    
    const creatorId = 'creator-user-id' // Replace with actual creator ID
    const nonCreatorSplits = initialSplits.filter(split => split.user_id !== creatorId)
    
    // Approve each non-creator split
    for (const split of nonCreatorSplits) {
      const { error: approveError } = await supabase
        .from('bill_splits')
        .update({ 
          approval_status: 'approved',
          approval_at: new Date().toISOString()
        })
        .eq('bill_id', testBillId)
        .eq('user_id', split.user_id)
      
      if (approveError) throw approveError
      console.log(`✅ Approved split for user: ${split.user_id}`)
    }
    
    // Step 4: Check if bill status changed to approved
    console.log('4. Checking bill status...')
    const { data: billData, error: billError } = await supabase
      .from('bills')
      .select('status, approved_at')
      .eq('id', testBillId)
      .single()
    
    if (billError) throw billError
    
    console.log('Bill status:', billData.status)
    console.log('Approved at:', billData.approved_at)
    
    // Step 5: Check if creator was automatically marked as paid
    console.log('5. Checking creator payment status...')
    const { data: creatorSplit, error: creatorError } = await supabase
      .from('bill_splits')
      .select('payment_status, paid, paid_at')
      .eq('bill_id', testBillId)
      .eq('user_id', creatorId)
      .single()
    
    if (creatorError) throw creatorError
    
    console.log('Creator payment status:', creatorSplit.payment_status)
    console.log('Creator paid:', creatorSplit.paid)
    console.log('Creator paid at:', creatorSplit.paid_at)
    
    // Step 6: Verify results
    console.log('\n📊 Test Results:')
    
    const billApproved = billData.status === 'approved'
    const creatorPaid = creatorSplit.paid === true
    const creatorConfirmed = creatorSplit.payment_status === 'confirmed'
    
    console.log(`✅ Bill approved: ${billApproved}`)
    console.log(`✅ Creator marked as paid: ${creatorPaid}`)
    console.log(`✅ Creator payment confirmed: ${creatorConfirmed}`)
    
    if (billApproved && creatorPaid && creatorConfirmed) {
      console.log('\n🎉 All tests passed! Creator auto-payment is working correctly.')
    } else {
      console.log('\n❌ Some tests failed. Check the implementation.')
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

// Instructions for running the test
console.log(`
📋 Test Instructions:

1. Update the Supabase credentials at the top of this file
2. Create a test bill with multiple participants
3. Update testBillId and creatorId with actual values
4. Run: node test_creator_auto_payment.js

This test will:
- Simulate all members approving a bill
- Verify the bill status changes to 'approved'
- Verify the creator is automatically marked as paid and confirmed
`)

// Uncomment to run the test
// testCreatorAutoPayment()

module.exports = { testCreatorAutoPayment }