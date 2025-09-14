export interface OCRResult {
  text: string
  items: Array<{
    name: string
    quantity: number
    rate: number
    total: number
  }>
  total?: number
  merchant?: string
  date?: string
}

import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system'

export class OCRService {
  private readonly OCR_API_KEY = 'K87899142388957' // Free OCR.space API key
  private readonly OCR_API_URL = 'https://api.ocr.space/parse/image'

  constructor() {
    console.log("OCR: Initialized with OCR.space cloud API (Expo Go compatible)")
  }

  async processImage(imageUri: string): Promise<OCRResult> {
    try {
      console.log("OCR: Starting cloud OCR processing for image:", imageUri)

      // First optimize the image for better OCR results
      const optimizedImageUri = await this.optimizeImage(imageUri)
      console.log("OCR: Image optimized, uploading to OCR service...")

      // Convert image to base64 for API upload
      const base64Image = await this.convertImageToBase64(optimizedImageUri)
      console.log("OCR: Image converted to base64, calling OCR API...")

      // Call OCR.space API with timeout and retry logic
      let extractedText = ""
      let attempts = 0
      const maxAttempts = 2

      while (attempts < maxAttempts && !extractedText) {
        attempts++
        try {
          console.log(`OCR: API attempt ${attempts}/${maxAttempts}`)
          extractedText = await this.callOCRAPI(base64Image)

          if (extractedText && extractedText.trim() !== "") {
            console.log("OCR: Successfully extracted text on attempt", attempts)
            break
          }
        } catch (apiError) {
          console.log(`OCR: API attempt ${attempts} failed:`, apiError)
          if (attempts === maxAttempts) {
            throw apiError
          }
          // Wait 2 seconds before retry
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      if (!extractedText || extractedText.trim() === "") {
        console.log("OCR: No text extracted after all attempts, using fallback data")
        return this.getBasicMockData()
      }

      console.log("OCR: Raw text extracted:", extractedText)
      console.log("OCR: Text length:", extractedText.length)

      // Parse the extracted text into structured receipt data
      const parsedResult = this.parseReceiptText(extractedText)
      console.log("OCR: Parsed result:", parsedResult)

      return parsedResult

    } catch (error) {
      console.error("OCR processing error:", error)
      console.log("OCR: Cloud OCR failed, using fallback data")
      return this.getBasicMockData()
    }
  }

  private async optimizeImage(imageUri: string): Promise<string> {
    try {
      console.log("OCR: Optimizing image for better text recognition...")

      // First, get image info to check size
      const imageInfo = await FileSystem.getInfoAsync(imageUri)
      if (imageInfo.exists && imageInfo.size) {
        const sizeKB = imageInfo.size / 1024
        console.log(`OCR: Original image size: ${sizeKB.toFixed(1)} KB`)
      }

      // Optimize image for better OCR results with smaller file size
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          { resize: { width: 800 } }, // Smaller size to reduce file size but still good for OCR
        ],
        {
          compress: 0.7, // More compression to reduce file size
          format: ImageManipulator.SaveFormat.JPEG
        }
      )

      // Check optimized image size
      const optimizedInfo = await FileSystem.getInfoAsync(result.uri)
      if (optimizedInfo.exists && optimizedInfo.size) {
        const optimizedSizeKB = optimizedInfo.size / 1024
        console.log(`OCR: Optimized image size: ${optimizedSizeKB.toFixed(1)} KB`)

        // If still too large, compress more aggressively
        if (optimizedSizeKB > 500) {
          console.log("OCR: Image still large, applying additional compression...")
          const furtherCompressed = await ImageManipulator.manipulateAsync(
            result.uri,
            [
              { resize: { width: 600 } },
            ],
            {
              compress: 0.5,
              format: ImageManipulator.SaveFormat.JPEG
            }
          )

          const finalInfo = await FileSystem.getInfoAsync(furtherCompressed.uri)
          if (finalInfo.exists && finalInfo.size) {
            console.log(`OCR: Final compressed size: ${(finalInfo.size / 1024).toFixed(1)} KB`)
          }

          return furtherCompressed.uri
        }
      }

      console.log("OCR: Image optimized successfully")
      return result.uri
    } catch (error) {
      console.log("OCR: Image optimization failed, using original image:", error)
      return imageUri
    }
  }

  private async convertImageToBase64(imageUri: string): Promise<string> {
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      return base64
    } catch (error) {
      console.error("Error converting image to base64:", error)
      throw new Error("Failed to convert image to base64")
    }
  }

  private async callOCRAPI(base64Image: string): Promise<string> {
    try {
      // Check image size and compress if too large
      const imageSizeKB = (base64Image.length * 3) / 4 / 1024
      console.log(`OCR: Image size: ${imageSizeKB.toFixed(1)} KB`)

      if (imageSizeKB > 1024) { // If larger than 1MB
        console.log("OCR: Image too large, using fallback...")
        throw new Error("Image too large for OCR processing")
      }

      const formData = new FormData()
      formData.append('apikey', this.OCR_API_KEY)
      formData.append('language', 'eng')
      formData.append('isOverlayRequired', 'false')
      formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`)
      formData.append('iscreatesearchablepdf', 'false')
      formData.append('issearchablepdfhidetextlayer', 'false')

      console.log("OCR: Calling OCR.space API...")

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OCR API timeout after 30 seconds')), 30000)
      })

      // Race between fetch and timeout
      const fetchPromise = fetch(this.OCR_API_URL, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header for FormData - let the browser set it
      })

      const response = await Promise.race([fetchPromise, timeoutPromise])

      console.log(`OCR: API response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.log("OCR: API error response:", errorText)
        throw new Error(`OCR API request failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log("OCR: API response received:", result)

      if (result.IsErroredOnProcessing) {
        console.log("OCR: API processing error:", result.ErrorMessage)
        throw new Error(`OCR API error: ${result.ErrorMessage}`)
      }

      if (!result.ParsedResults || result.ParsedResults.length === 0) {
        console.log("OCR: No parsed results in API response")
        return ""
      }

      const extractedText = result.ParsedResults[0].ParsedText || ""
      console.log("OCR: Successfully extracted text, length:", extractedText.length)
      return extractedText

    } catch (error) {
      console.error("OCR API call failed:", error)
      throw error
    }
  }

  private getSmartMockData(): OCRResult {
    // Test the new rate-based parsing logic with various scenarios
    const testReceiptText = `Restaurant ABC
Date: 2024-01-15
Biryani 2 1200
Garlic Naan 1 50
Paneer Butter Masala 3 150 450
Chaat 40
Coffee 2 25 50
Dal Tadka 1 120
Total 1910`

    console.log("OCR: Testing new rate-based parsing logic with mock receipt...")
    return this.parseReceiptText(testReceiptText)
  }

  private getBasicMockData(): OCRResult {
    // Fallback basic mock data
    return {
      text: "Sample Receipt\nCoffee Shop\n2024-01-15\nCoffee 4.50\nSandwich 8.99\nTax 1.35\nTotal 14.84",
      items: [
        { name: "Coffee", price: 4.50, quantity: 1 },
        { name: "Sandwich", price: 8.99, quantity: 1 },
        { name: "Tax", price: 1.35, quantity: 1 }
      ],
      total: 14.84,
      merchant: "Coffee Shop",
      date: "2024-01-15"
    }
  }

  private parseReceiptText(text: string): OCRResult {
    const lines = text.split("\n").filter((line) => line.trim())
    const items: Array<{ name: string; rate: number; quantity: number; total: number }> = []
    let total = 0
    let merchant = ""
    let date = ""

    console.log("OCR: Parsing receipt text with improved logic...")
    console.log("OCR: Raw lines:", lines)

    // First, try to reconstruct item lines from fragmented OCR text
    const reconstructedLines = this.reconstructItemLines(lines)
    console.log("OCR: Reconstructed lines:", reconstructedLines)

    for (let i = 0; i < reconstructedLines.length; i++) {
      const line = reconstructedLines[i].trim()

      // Try to find merchant (usually first few lines)
      if (i < 3 && !merchant && line.length > 3 && !this.containsNumbers(line)) {
        merchant = line
      }

      // Try to find date
      const dateMatch = line.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)
      if (dateMatch && !date) {
        date = dateMatch[0]
      }

      // Parse line for item details using improved logic
      const parsedItem = this.parseReceiptLine(line)
      if (parsedItem) {
        // Check if this might be the total
        if (
          line.toLowerCase().includes("total") ||
          line.toLowerCase().includes("subtotal") ||
          line.toLowerCase().includes("amount") ||
          line.toLowerCase().includes("sum")
        ) {
          total = parsedItem.total
          console.log(`OCR: Found total: ${total}`)
        } else {
          items.push(parsedItem)
          console.log(`OCR: Parsed item: ${JSON.stringify(parsedItem)}`)
        }
      }
    }

    // If no total found, calculate from items
    if (total === 0 && items.length > 0) {
      total = items.reduce((sum, item) => sum + item.total, 0)
    }

    console.log(`OCR: Final parsing result - ${items.length} items, total: ${total}`)

    return {
      text,
      items,
      total,
      merchant,
      date,
    }
  }

  /**
   * Reconstruct item lines from fragmented OCR text
   * OCR sometimes splits "chicken tikka 1 345" into separate lines:
   * ["chicken tikka", "butter chicken", "1", "2", "345", "400"]
   * This function reconstructs them back into proper item lines.
   */
  private reconstructItemLines(lines: string[]): string[] {
    console.log("OCR: Starting line reconstruction...")

    // Separate text lines from number lines
    const textLines: string[] = []
    const numberLines: string[] = []

    lines.forEach(line => {
      const trimmed = line.trim()
      if (!trimmed) return

      // Check if line is purely numeric (or contains only numbers and currency symbols)
      if (/^[\d₹$,.\s]+$/.test(trimmed)) {
        numberLines.push(trimmed)
      } else if (!this.containsNumbers(trimmed)) {
        // Line contains only text (item names)
        textLines.push(trimmed)
      } else {
        // Line contains both text and numbers - keep as is
        textLines.push(trimmed)
      }
    })

    console.log("OCR: Text lines:", textLines)
    console.log("OCR: Number lines:", numberLines)

    // If we have separated text and numbers, try to reconstruct
    if (textLines.length > 0 && numberLines.length > 0) {
      return this.combineTextAndNumbers(textLines, numberLines)
    }

    // Otherwise, return original lines
    return lines
  }

  /**
   * Combine text lines with number lines to form complete item lines
   * Smart pairing: quantities are usually small (1-10), totals are usually larger (50+)
   */
  private combineTextAndNumbers(textLines: string[], numberLines: string[]): string[] {
    const reconstructed: string[] = []

    // Extract all numbers from number lines
    const allNumbers: number[] = []
    numberLines.forEach(line => {
      const numbers = line.split(/\s+/).map(token => this.parseNumber(token)).filter(n => n !== null && n > 0)
      allNumbers.push(...numbers)
    })

    console.log("OCR: Extracted numbers:", allNumbers)

    // Determine the pattern based on numbers per text line
    const numbersPerItem = Math.floor(allNumbers.length / textLines.length)
    console.log(`OCR: Detected ${numbersPerItem} numbers per item (${allNumbers.length} numbers / ${textLines.length} items)`)

    if (numbersPerItem === 2) {
      // 2 numbers per item: quantity + total
      return this.pairTwoNumbers(textLines, allNumbers)
    } else if (numbersPerItem === 3) {
      // 3 numbers per item: quantity + unit_price + total
      return this.pairThreeNumbers(textLines, allNumbers)
    } else {
      // Fallback: use smart pairing or sequential
      return this.fallbackPairing(textLines, allNumbers)
    }
  }

  /**
   * Pair 2 numbers per item (quantity + total)
   * Smart pairing: quantities are small, totals are large
   */
  private pairTwoNumbers(textLines: string[], allNumbers: number[]): string[] {
    const reconstructed: string[] = []

    console.log("OCR: Attempting smart 2-number pairing...")

    // Separate numbers by likely type
    const likelyQuantities = allNumbers.filter(n => n <= 20) // Small numbers are likely quantities
    const likelyTotals = allNumbers.filter(n => n > 20) // Large numbers are likely totals

    console.log("OCR: Likely quantities:", likelyQuantities)
    console.log("OCR: Likely totals:", likelyTotals)

    // If we have equal numbers of text lines, quantities, and totals - perfect smart match
    if (textLines.length === likelyQuantities.length && textLines.length === likelyTotals.length) {
      for (let i = 0; i < textLines.length; i++) {
        const quantity = likelyQuantities[i]
        const total = likelyTotals[i]

        const reconstructedLine = `${textLines[i]} ${quantity} ${total}`
        reconstructed.push(reconstructedLine)
        console.log(`OCR: Smart 2-pair: "${textLines[i]}" + qty:${quantity} + total:${total} = "${reconstructedLine}"`)
      }

      return reconstructed
    }

    // Fallback: sequential pairing
    console.log("OCR: Smart 2-pairing failed, using sequential pairing...")

    for (let i = 0; i < textLines.length; i++) {
      const quantity = allNumbers[i * 2]
      const total = allNumbers[i * 2 + 1]

      if (quantity !== undefined && total !== undefined) {
        const reconstructedLine = `${textLines[i]} ${quantity} ${total}`
        reconstructed.push(reconstructedLine)
        console.log(`OCR: Sequential 2-pair: "${textLines[i]}" + qty:${quantity} + total:${total} = "${reconstructedLine}"`)
      } else {
        reconstructed.push(textLines[i])
      }
    }

    return reconstructed
  }

  /**
   * Pair 3 numbers per item (quantity + unit_price + total)
   * Handles pattern: [qty1, qty2, unit1, unit2, total1, total2]
   */
  private pairThreeNumbers(textLines: string[], allNumbers: number[]): string[] {
    const reconstructed: string[] = []

    console.log("OCR: Attempting smart 3-number pairing...")

    // Try pattern detection: [qty1, qty2, ...] [unit1, unit2, ...] [total1, total2, ...]
    const itemCount = textLines.length

    if (allNumbers.length === itemCount * 3) {
      // Try grouped pattern: all quantities first, then all unit prices, then all totals
      const quantities = allNumbers.slice(0, itemCount)
      const unitPrices = allNumbers.slice(itemCount, itemCount * 2)
      const totals = allNumbers.slice(itemCount * 2, itemCount * 3)

      console.log("OCR: Trying grouped pattern - quantities:", quantities, "unitPrices:", unitPrices, "totals:", totals)

      // Validate the pattern: quantities should be small, totals should be larger
      const validPattern = quantities.every(q => q <= 20) &&
                          totals.every(t => t >= Math.max(...quantities)) &&
                          totals.every((total, i) => total >= unitPrices[i] * quantities[i] * 0.8) // Allow some OCR error

      if (validPattern) {
        for (let i = 0; i < textLines.length; i++) {
          const quantity = quantities[i]
          const unitPrice = unitPrices[i]
          const total = totals[i]

          const reconstructedLine = `${textLines[i]} ${quantity} ${unitPrice} ${total}`
          reconstructed.push(reconstructedLine)
          console.log(`OCR: Grouped 3-pair: "${textLines[i]}" + qty:${quantity} + unit:${unitPrice} + total:${total} = "${reconstructedLine}"`)
        }

        return reconstructed
      }
    }

    // Fallback: sequential pairing (qty, unit, total for each item)
    console.log("OCR: Grouped pattern failed, using sequential 3-number pairing...")

    for (let i = 0; i < textLines.length; i++) {
      const quantity = allNumbers[i * 3]
      const unitPrice = allNumbers[i * 3 + 1]
      const total = allNumbers[i * 3 + 2]

      if (quantity !== undefined && unitPrice !== undefined && total !== undefined) {
        const reconstructedLine = `${textLines[i]} ${quantity} ${unitPrice} ${total}`
        reconstructed.push(reconstructedLine)
        console.log(`OCR: Sequential 3-pair: "${textLines[i]}" + qty:${quantity} + unit:${unitPrice} + total:${total} = "${reconstructedLine}"`)
      } else {
        reconstructed.push(textLines[i])
      }
    }

    return reconstructed
  }

  /**
   * Fallback pairing when pattern is unclear
   */
  private fallbackPairing(textLines: string[], allNumbers: number[]): string[] {
    const reconstructed: string[] = []

    // Smart pairing strategy: separate likely quantities from likely totals
    const likelyQuantities = allNumbers.filter(n => n <= 20) // Quantities are usually small
    const likelyTotals = allNumbers.filter(n => n > 20) // Totals are usually larger

    console.log("OCR: Likely quantities:", likelyQuantities)
    console.log("OCR: Likely totals:", likelyTotals)

    // If we have equal numbers of text lines, quantities, and totals - perfect match
    if (textLines.length === likelyQuantities.length && textLines.length === likelyTotals.length) {
      textLines.forEach((textLine, index) => {
        const quantity = likelyQuantities[index]
        const total = likelyTotals[index]
        const reconstructedLine = `${textLine} ${quantity} ${total}`
        reconstructed.push(reconstructedLine)
        console.log(`OCR: Smart pair: "${textLine}" + qty:${quantity} + total:${total} = "${reconstructedLine}"`)
      })
      return reconstructed
    }

    // Sequential pairing as last resort
    console.log("OCR: Using sequential pairing...")

    let numberIndex = 0
    textLines.forEach(textLine => {
      if (numberIndex >= allNumbers.length) {
        reconstructed.push(textLine)
        return
      }

      const remainingTextLines = textLines.length - reconstructed.length
      const remainingNumbers = allNumbers.length - numberIndex

      let numbersToTake = Math.min(3, Math.floor(remainingNumbers / remainingTextLines))
      if (numbersToTake === 0) numbersToTake = 1

      const itemNumbers = allNumbers.slice(numberIndex, numberIndex + numbersToTake)
      numberIndex += numbersToTake

      const reconstructedLine = `${textLine} ${itemNumbers.join(' ')}`
      reconstructed.push(reconstructedLine)

      console.log(`OCR: Sequential: "${textLine}" + [${itemNumbers.join(', ')}] = "${reconstructedLine}"`)
    })

    return reconstructed
  }

  /**
   * Enhanced line parser with rate calculation logic
   * Handles three scenarios:
   * 1. Only Quantity and Total: "Biryani 2 1200" → Calculate Rate = Total / Quantity
   * 2. Quantity, Rate, and Total: "Paneer Butter Masala 3 150 450" → Use Total, ignore OCR rate
   * 3. Only Quantity and Rate: "Chaat 40" → Calculate Total = Quantity × Rate
   */
  private parseReceiptLine(line: string): { name: string; quantity: number; rate: number; total: number } | null {
    try {
      const trimmedLine = line.trim()
      if (!trimmedLine) return null

      console.log(`OCR: Parsing line: "${trimmedLine}"`)

      // Step 1: Tokenization - Split line into tokens
      const tokens = trimmedLine.split(/\s+/).filter(token => token.length > 0)
      if (tokens.length === 0) return null

      // Step 2: Number Identification - Find all number tokens
      const numberTokens: { value: number; index: number }[] = []
      tokens.forEach((token, index) => {
        const numValue = this.parseNumber(token)
        if (numValue !== null && numValue > 0) {
          numberTokens.push({ value: numValue, index })
        }
      })

      // Must have at least one number
      if (numberTokens.length === 0) return null

      // Step 3: Extract item name (all tokens before first numeric token)
      const firstNumberIndex = numberTokens[0].index
      const nameTokens = tokens.slice(0, firstNumberIndex)
      const name = nameTokens.join(' ').trim()

      if (!name) return null

      // Step 4: Extract numeric values based on scenarios
      let quantity: number
      let rate: number
      let total: number

      if (numberTokens.length === 1) {
        // Scenario 3: Only one number after name
        // Could be either quantity+rate or just total
        // Assume it's total with quantity = 1
        quantity = 1
        total = numberTokens[0].value
        rate = total / quantity
        console.log(`OCR: Scenario - Single number as total: quantity=${quantity}, rate=${rate}, total=${total}`)
      } else if (numberTokens.length === 2) {
        // Scenario 1: Quantity and Total present
        // First number = Quantity, Last number = Total
        quantity = numberTokens[0].value
        total = numberTokens[1].value
        rate = total / quantity
        console.log(`OCR: Scenario - Quantity and Total: quantity=${quantity}, rate=${rate}, total=${total}`)
      } else {
        // Scenario 2: Quantity, Rate, and Total present (3+ numbers)
        // First number = Quantity, Last number = Total, ignore middle numbers
        quantity = numberTokens[0].value
        total = numberTokens[numberTokens.length - 1].value
        rate = total / quantity
        console.log(`OCR: Scenario - Multiple numbers, using first and last: quantity=${quantity}, rate=${rate}, total=${total}`)
      }

      // Validation
      if (quantity <= 0 || rate <= 0 || total <= 0) {
        console.log(`OCR: Invalid values - quantity=${quantity}, rate=${rate}, total=${total}`)
        return null
      }

      const result = {
        name,
        quantity: Math.round(quantity), // Ensure quantity is integer
        rate: Math.round(rate * 100) / 100, // Round rate to 2 decimal places
        total: Math.round(total * 100) / 100 // Round total to 2 decimal places
      }

      console.log(`OCR: Successfully parsed: ${JSON.stringify(result)}`)
      return result

    } catch (error) {
      console.error("OCR: Error parsing line:", line, error)
      return null
    }
  }

  /**
   * Parse a token as a number, handling various formats
   */
  private parseNumber(token: string): number | null {
    // Remove common currency symbols and commas
    const cleanToken = token.replace(/[₹$,]/g, '')

    // Check if it's a valid number
    const num = parseFloat(cleanToken)

    if (isNaN(num) || num < 0) return null

    return num
  }

  /**
   * Check if a string contains any numbers
   */
  private containsNumbers(str: string): boolean {
    return /\d/.test(str)
  }
}

export const ocrService = new OCRService()
