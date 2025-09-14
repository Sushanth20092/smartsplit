import { OCRService } from '../ocrService'

describe('OCRService - Receipt Line Parsing', () => {
  let ocrService: OCRService

  beforeEach(() => {
    ocrService = new OCRService()
  })

  describe('parseReceiptLine', () => {
    // Test cases from new requirements
    test('should parse "Biryani 2 1200" correctly (Scenario 1: Quantity and Total)', () => {
      const result = (ocrService as any).parseReceiptLine('Biryani 2 1200')
      expect(result).toEqual({
        name: 'Biryani',
        quantity: 2,
        rate: 600,
        total: 1200
      })
    })

    test('should parse "Garlic Naan 1 50" correctly (Scenario 1: Quantity and Total)', () => {
      const result = (ocrService as any).parseReceiptLine('Garlic Naan 1 50')
      expect(result).toEqual({
        name: 'Garlic Naan',
        quantity: 1,
        rate: 50,
        total: 50
      })
    })

    test('should parse "Paneer Butter Masala 3 150 450" correctly (Scenario 2: Quantity, Rate, Total)', () => {
      const result = (ocrService as any).parseReceiptLine('Paneer Butter Masala 3 150 450')
      expect(result).toEqual({
        name: 'Paneer Butter Masala',
        quantity: 3,
        rate: 150,
        total: 450
      })
    })

    test('should parse "Chaat 40" correctly (Scenario 3: Single number as total)', () => {
      const result = (ocrService as any).parseReceiptLine('Chaat 40')
      expect(result).toEqual({
        name: 'Chaat',
        quantity: 1,
        rate: 40,
        total: 40
      })
    })

    // Additional test cases for robustness
    test('should handle decimal rates and totals', () => {
      const result = (ocrService as any).parseReceiptLine('Coffee 2 25.50')
      expect(result).toEqual({
        name: 'Coffee',
        quantity: 2,
        rate: 12.75,
        total: 25.50
      })
    })

    test('should handle currency symbols', () => {
      const result = (ocrService as any).parseReceiptLine('Tea ₹25.50')
      expect(result).toEqual({
        name: 'Tea',
        quantity: 1,
        rate: 25.50,
        total: 25.50
      })
    })

    test('should handle commas in numbers', () => {
      const result = (ocrService as any).parseReceiptLine('Special Biryani 2 1,200')
      expect(result).toEqual({
        name: 'Special Biryani',
        quantity: 2,
        rate: 600,
        total: 1200
      })
    })

    test('should ignore intermediate numbers correctly', () => {
      const result = (ocrService as any).parseReceiptLine('Special Thali 2 150 50 400')
      expect(result).toEqual({
        name: 'Special Thali',
        quantity: 2,
        rate: 200,
        total: 400
      })
    })

    test('should handle 4+ numbers by using first and last', () => {
      const result = (ocrService as any).parseReceiptLine('Deluxe Meal 3 100 200 300 900')
      expect(result).toEqual({
        name: 'Deluxe Meal',
        quantity: 3,
        rate: 300,
        total: 900
      })
    })

    // Edge cases
    test('should return null for empty line', () => {
      const result = (ocrService as any).parseReceiptLine('')
      expect(result).toBeNull()
    })

    test('should return null for line with no numbers', () => {
      const result = (ocrService as any).parseReceiptLine('Restaurant Name')
      expect(result).toBeNull()
    })

    test('should return null for line with only numbers', () => {
      const result = (ocrService as any).parseReceiptLine('123 456 789')
      expect(result).toBeNull()
    })

    test('should return null for line with negative price', () => {
      const result = (ocrService as any).parseReceiptLine('Item -50')
      expect(result).toBeNull()
    })

    test('should return null for line with zero price', () => {
      const result = (ocrService as any).parseReceiptLine('Free Item 0')
      expect(result).toBeNull()
    })

    test('should handle single character item names', () => {
      const result = (ocrService as any).parseReceiptLine('A 1 50')
      expect(result).toEqual({
        name: 'A',
        quantity: 1,
        price: 50
      })
    })

    test('should handle items with numbers in name', () => {
      const result = (ocrService as any).parseReceiptLine('Coke 500ml 2 80')
      expect(result).toEqual({
        name: 'Coke 500ml',
        quantity: 2,
        price: 80
      })
    })
  })

  describe('parseNumber', () => {
    test('should parse integer', () => {
      const result = (ocrService as any).parseNumber('123')
      expect(result).toBe(123)
    })

    test('should parse decimal', () => {
      const result = (ocrService as any).parseNumber('45.67')
      expect(result).toBe(45.67)
    })

    test('should parse number with currency symbol', () => {
      const result = (ocrService as any).parseNumber('₹100')
      expect(result).toBe(100)
    })

    test('should parse number with comma', () => {
      const result = (ocrService as any).parseNumber('1,234')
      expect(result).toBe(1234)
    })

    test('should return null for non-number', () => {
      const result = (ocrService as any).parseNumber('abc')
      expect(result).toBeNull()
    })

    test('should return null for negative number', () => {
      const result = (ocrService as any).parseNumber('-50')
      expect(result).toBeNull()
    })
  })

  describe('containsNumbers', () => {
    test('should return true for string with numbers', () => {
      const result = (ocrService as any).containsNumbers('abc123')
      expect(result).toBe(true)
    })

    test('should return false for string without numbers', () => {
      const result = (ocrService as any).containsNumbers('abcdef')
      expect(result).toBe(false)
    })
  })

  describe('Full receipt parsing integration', () => {
    test('should parse complete receipt correctly with rate calculations', () => {
      const receiptText = `Restaurant ABC
Date: 2024-01-15
Biryani 2 1200
Garlic Naan 1 50
Paneer Butter Masala 3 150 450
Chaat 40
Total 1740`

      const result = (ocrService as any).parseReceiptText(receiptText)

      expect(result.merchant).toBe('Restaurant ABC')
      expect(result.items).toHaveLength(4)
      expect(result.items[0]).toEqual({ name: 'Biryani', quantity: 2, rate: 600, total: 1200 })
      expect(result.items[1]).toEqual({ name: 'Garlic Naan', quantity: 1, rate: 50, total: 50 })
      expect(result.items[2]).toEqual({ name: 'Paneer Butter Masala', quantity: 3, rate: 150, total: 450 })
      expect(result.items[3]).toEqual({ name: 'Chaat', quantity: 1, rate: 40, total: 40 })
      expect(result.total).toBe(1740)
    })
  })
})
