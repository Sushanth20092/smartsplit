// Simple test to verify validation logic
console.log("Testing Rate Validation Logic");

// Simulate the validation function from BillItemParser
const validateItemRate = (rate, itemId) => {
  if (isNaN(rate)) {
    return "Rate must be a valid number"
  }
  // Rate must be greater than or equal to zero (≥ 0)
  if (rate < 0) {
    return "Rate must be zero or positive (≥ 0)"
  }
  return undefined
}

// Test cases
const testCases = [
  { rate: 0, expected: undefined, description: "Rate = 0 (should pass)" },
  { rate: 5, expected: undefined, description: "Rate = 5 (should pass)" },
  { rate: 10.50, expected: undefined, description: "Rate = 10.50 (should pass)" },
  { rate: -1, expected: "Rate must be zero or positive (≥ 0)", description: "Rate = -1 (should fail)" },
  { rate: -10.5, expected: "Rate must be zero or positive (≥ 0)", description: "Rate = -10.5 (should fail)" },
  { rate: NaN, expected: "Rate must be a valid number", description: "Rate = NaN (should fail)" },
  { rate: "invalid", expected: "Rate must be a valid number", description: "Rate = 'invalid' (should fail)" }
]

console.log("\n=== VALIDATION TEST RESULTS ===");
testCases.forEach((testCase, index) => {
  const result = validateItemRate(testCase.rate, `test_${index}`)
  const passed = result === testCase.expected
  console.log(`${passed ? '✅' : '❌'} ${testCase.description}`)
  if (!passed) {
    console.log(`   Expected: ${testCase.expected}`)
    console.log(`   Got: ${result}`)
  }
})

// Test the input parsing logic
console.log("\n=== INPUT PARSING TEST ===");
const testInputs = [
  { input: "", expected: 0, description: "Empty string" },
  { input: "5", expected: 5, description: "Valid positive number" },
  { input: "0", expected: 0, description: "Zero" },
  { input: "-5", expected: -5, description: "Negative number" },
  { input: "10.50", expected: 10.50, description: "Decimal number" },
  { input: "abc", expected: NaN, description: "Invalid text" }
]

testInputs.forEach(testCase => {
  const rate = testCase.input.trim() === '' ? 0 : Number.parseFloat(testCase.input)
  const finalRate = isNaN(rate) ? 0 : rate
  const validationResult = validateItemRate(finalRate, 'test')
  
  console.log(`Input: "${testCase.input}" -> Rate: ${finalRate} -> Validation: ${validationResult || 'PASS'}`)
})