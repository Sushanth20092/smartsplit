import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImageManipulator from 'expo-image-manipulator'

interface ImageCropperProps {
  visible: boolean
  imageUri: string
  onCropComplete: (croppedImageUri: string) => void
  onCancel: () => void
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window')

export const ImageCropper: React.FC<ImageCropperProps> = ({
  visible,
  imageUri,
  onCropComplete,
  onCancel,
}) => {
  const [cropping, setCropping] = useState(false)
  // Layout of the image wrapper (container around the image)
  const [imageLayout, setImageLayout] = useState({ x: 0, y: 0, width: 0, height: 0 })
  // Natural/source dimensions of the image
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null)
  // Actual displayed image rect within the wrapper when using resizeMode="contain"
  const [displayedRect, setDisplayedRect] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [showManualCrop, setShowManualCrop] = useState(false)

  // Simple crop area state (in pixels relative to VISIBLE image area, not entire wrapper)
  const [cropBox, setCropBox] = useState({
    x: 20,
    y: 40,
    width: 200,
    height: 120
  })

  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [initialCropBox, setInitialCropBox] = useState({ x: 0, y: 0, width: 0, height: 0 })

  // Load image natural size when URI changes
  React.useEffect(() => {
    if (!imageUri) return
    Image.getSize(
      imageUri,
      (w, h) => setSourceSize({ width: w, height: h }),
      () => setSourceSize(null)
    )
  }, [imageUri])

  // Compute the displayed (visible) image rect within the wrapper for resizeMode="contain"
  React.useEffect(() => {
    if (!sourceSize || imageLayout.width === 0 || imageLayout.height === 0) return

    const wrapperW = imageLayout.width
    const wrapperH = imageLayout.height
    const imgW = sourceSize.width
    const imgH = sourceSize.height

    const imgAspect = imgW / imgH
    const wrapperAspect = wrapperW / wrapperH

    if (imgAspect > wrapperAspect) {
      // Image fills width, letterboxing top/bottom
      const width = wrapperW
      const height = wrapperW / imgAspect
      const x = 0
      const y = (wrapperH - height) / 2
      setDisplayedRect({ x, y, width, height })
    } else {
      // Image fills height, letterboxing left/right
      const height = wrapperH
      const width = wrapperH * imgAspect
      const x = (wrapperW - width) / 2
      const y = 0
      setDisplayedRect({ x, y, width, height })
    }
  }, [sourceSize, imageLayout])

  // Initialize crop box when image and displayed rect are ready
  const initializeCropBox = () => {
    const visW = displayedRect.width || imageLayout.width
    const visH = displayedRect.height || imageLayout.height
    if (visW > 0 && visH > 0) {
      const defaultWidth = visW * 0.85
      const defaultHeight = visH * 0.7
      const defaultX = (visW - defaultWidth) / 2
      const defaultY = (visH - defaultHeight) / 2

      setCropBox({
        x: defaultX,
        y: defaultY,
        width: defaultWidth,
        height: defaultHeight
      })

      console.log('Initialized crop box (visible area):', { defaultX, defaultY, defaultWidth, defaultHeight })
    }
  }

  // Handle touch start for dragging
  const handleTouchStart = (event: any) => {
    if (isResizing) return // Don't start dragging if resizing

    // Try to get coordinates from different event types
    let pageX, pageY
    if (event.nativeEvent) {
      pageX = event.nativeEvent.pageX || event.nativeEvent.locationX
      pageY = event.nativeEvent.pageY || event.nativeEvent.locationY
    } else {
      pageX = event.pageX || event.locationX || 0
      pageY = event.pageY || event.locationY || 0
    }

    setIsDragging(true)
    setIsResizing(false)
    setDragStart({ x: pageX, y: pageY })
    setInitialCropBox({ ...cropBox })
    console.log('Touch start:', { pageX, pageY, cropBox })
  }

  // Handle touch move for dragging
  const handleTouchMove = (event: any) => {
    if (!isDragging || isResizing) return

    // Try to get coordinates from different event types
    let pageX, pageY
    if (event.nativeEvent) {
      pageX = event.nativeEvent.pageX || event.nativeEvent.locationX
      pageY = event.nativeEvent.pageY || event.nativeEvent.locationY
    } else {
      pageX = event.pageX || event.locationX || 0
      pageY = event.pageY || event.locationY || 0
    }

    const deltaX = pageX - dragStart.x
    const deltaY = pageY - dragStart.y

    // Constrain movement within the visible image rect
    const maxX = (displayedRect.width || imageLayout.width) - cropBox.width
    const maxY = (displayedRect.height || imageLayout.height) - cropBox.height
    const newX = Math.max(0, Math.min(maxX, initialCropBox.x + deltaX))
    const newY = Math.max(0, Math.min(maxY, initialCropBox.y + deltaY))

    setCropBox(prev => ({
      ...prev,
      x: newX,
      y: newY
    }))

    console.log('Touch move:', { deltaX, deltaY, newX, newY, pageX, pageY })
  }

  // Handle touch end
  const handleTouchEnd = () => {
    setIsDragging(false)
    setIsResizing(false)
    console.log('Touch end - dragging:', isDragging, 'resizing:', isResizing)
  }

  // Handle resize touch start
  const handleResizeTouchStart = (event: any) => {
    if (event.stopPropagation) event.stopPropagation()

    // Try to get coordinates from different event types
    let pageX, pageY
    if (event.nativeEvent) {
      pageX = event.nativeEvent.pageX || event.nativeEvent.locationX
      pageY = event.nativeEvent.pageY || event.nativeEvent.locationY
    } else {
      pageX = event.pageX || event.locationX || 0
      pageY = event.pageY || event.locationY || 0
    }

    setIsResizing(true)
    setIsDragging(false) // Prevent dragging while resizing
    setDragStart({ x: pageX, y: pageY })
    setInitialCropBox({ ...cropBox })
    console.log('Resize touch start:', { pageX, pageY, cropBox })
  }

  // Handle resize touch move
  const handleResizeTouchMove = (event: any) => {
    if (!isResizing) return

    // Try to get coordinates from different event types
    let pageX, pageY
    if (event.nativeEvent) {
      pageX = event.nativeEvent.pageX || event.nativeEvent.locationX
      pageY = event.nativeEvent.pageY || event.nativeEvent.locationY
    } else {
      pageX = event.pageX || event.locationX || 0
      pageY = event.pageY || event.locationY || 0
    }

    const deltaX = pageX - dragStart.x
    const deltaY = pageY - dragStart.y

    const visW = displayedRect.width || imageLayout.width
    const visH = displayedRect.height || imageLayout.height
    const newWidth = Math.max(80, Math.min(visW - cropBox.x, initialCropBox.width + deltaX)) // Larger minimum size
    const newHeight = Math.max(80, Math.min(visH - cropBox.y, initialCropBox.height + deltaY)) // Larger minimum size

    setCropBox(prev => ({
      ...prev,
      width: newWidth,
      height: newHeight
    }))

    console.log('Resize move:', { deltaX, deltaY, newWidth, newHeight, pageX, pageY })
  }

  const handleManualCrop = async () => {
    if (!imageUri) {
      Alert.alert('Error', 'No image to crop')
      return
    }

    setCropping(true)
    try {
      console.log('Starting manual crop with crop box:', cropBox)
      console.log('Image layout:', imageLayout)

      // Get image dimensions first
      const imageInfo = await ImageManipulator.manipulateAsync(imageUri, [], { format: ImageManipulator.SaveFormat.JPEG })

      // Calculate crop parameters relative to actual image size, accounting for letterboxing
      const visW = displayedRect.width || imageLayout.width
      const visH = displayedRect.height || imageLayout.height
      const scaleX = imageInfo.width / visW
      const scaleY = imageInfo.height / visH

      // cropBox is relative to visible area; add its offset within the source by adjusting origin
      const cropParams = {
        originX: (cropBox.x) * scaleX,
        originY: (cropBox.y) * scaleY,
        width: cropBox.width * scaleX,
        height: cropBox.height * scaleY,
      }

      console.log('Crop parameters:', cropParams)

      const croppedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: cropParams }],
        {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG
        }
      )

      console.log('Manual crop completed:', croppedImage.uri)
      onCropComplete(croppedImage.uri)
    } catch (error) {
      console.error('Manual crop error:', error)
      Alert.alert(
        'Crop Error',
        'Failed to crop image. Would you like to use the original image?',
        [
          {
            text: 'Use Original',
            onPress: () => onCropComplete(imageUri)
          },
          {
            text: 'Cancel',
            onPress: onCancel,
            style: 'cancel'
          }
        ]
      )
    } finally {
      setCropping(false)
    }
  }

  const handleQuickCrop = async (cropParams: { x: number, y: number, width: number, height: number }) => {
    if (!imageUri || !imageLayout.width) return

    setCropping(true)
    try {
      // Get image dimensions first
      const imageInfo = await ImageManipulator.manipulateAsync(imageUri, [], { format: ImageManipulator.SaveFormat.JPEG })

      const cropImageParams = {
        originX: cropParams.x * imageInfo.width,
        originY: cropParams.y * imageInfo.height,
        width: cropParams.width * imageInfo.width,
        height: cropParams.height * imageInfo.height,
      }

      const croppedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: cropImageParams }],
        {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG
        }
      )

      console.log('Quick crop completed:', croppedImage.uri)
      onCropComplete(croppedImage.uri)
    } catch (error) {
      console.error('Quick crop error:', error)
      Alert.alert('Crop Error', 'Failed to crop image. Please try again.')
    } finally {
      setCropping(false)
    }
  }

  const handleCancel = () => {
    if (cropping) return // Prevent cancel during cropping
    onCancel()
  }

  const handleUseOriginal = () => {
    onCropComplete(imageUri)
  }

  // Initialize crop box once per image after the displayedRect is known
  const [cropInitializedFor, setCropInitializedFor] = useState<string | null>(null)

  React.useEffect(() => {
    if (!imageUri) return
    if (displayedRect.width > 0 && displayedRect.height > 0 && cropInitializedFor !== imageUri) {
      initializeCropBox()
      setCropInitializedFor(imageUri)
    }
  }, [displayedRect, imageUri])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={handleCancel}
            disabled={cropping}
          >
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crop Receipt</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          <View style={styles.instructionContainer}>
            <View style={styles.instructionHeader}>
              <Ionicons name="information-circle-outline" size={24} color="#007AFF" />
              <Text style={styles.instructionTitle}>Crop Your Receipt</Text>
            </View>
            <Text style={styles.instructionText}>
              Crop to include only bill items and prices for best accuracy.
            </Text>
          </View>

          {!showManualCrop ? (
            // Quick crop options
            <View style={styles.optionsContainer}>
              <Text style={styles.optionsTitle}>Choose Crop Method:</Text>

              <TouchableOpacity
                style={[styles.cropOption, styles.manualOption]}
                onPress={() => setShowManualCrop(true)}
                disabled={cropping}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="hand-left-outline" size={24} color="#FF9500" />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Manual Crop</Text>
                  <Text style={styles.optionDescription}>Drag and resize to crop freely</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
              </TouchableOpacity>





              <TouchableOpacity
                style={[styles.cropOption, styles.originalOption]}
                onPress={handleUseOriginal}
                disabled={cropping}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="image-outline" size={24} color="#34C759" />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Use Original</Text>
                  <Text style={styles.optionDescription}>Process the full image without cropping</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
              </TouchableOpacity>
            </View>
          ) : (
            // Manual crop interface
            <View style={styles.manualCropContainer}>
              <View style={styles.manualCropHeader}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setShowManualCrop(false)}
                  disabled={cropping}
                >
                  <Ionicons name="arrow-back" size={24} color="#007AFF" />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.manualCropTitle}>Drag to Crop</Text>
                <View style={styles.headerButtons}>
                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={() => {
                      initializeCropBox()
                    }}
                    disabled={cropping}
                  >
                    <Text style={styles.resetButtonText}>Reset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cropButton}
                    onPress={handleManualCrop}
                    disabled={cropping}
                  >
                    <Text style={styles.cropButtonText}>Crop</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {imageUri && (
                <View style={styles.imageContainer}>
                  <View
                    style={styles.imageWrapper}
                    onLayout={(event) => {
                      const { x, y, width, height } = event.nativeEvent.layout
                      console.log('Image wrapper layout:', { x, y, width, height })
                      setImageLayout({ x: 0, y: 0, width, height }) // x,y relative to wrapper
                    }}
                  >
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />

                    {/* Simple crop overlay */}
                    <View
                      style={[
                        styles.cropOverlay,
                        {
                          // Position overlay relative to the visible image area inside wrapper
                          left: (displayedRect.x || 0) + cropBox.x,
                          top: (displayedRect.y || 0) + cropBox.y,
                          width: cropBox.width,
                          height: cropBox.height,
                        }
                      ]}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onStartShouldSetResponder={() => true}
                      onMoveShouldSetResponder={() => true}
                      onResponderGrant={handleTouchStart}
                      onResponderMove={handleTouchMove}
                      onResponderRelease={handleTouchEnd}
                    >
                      <Text style={styles.cropAreaText}>Drag to move</Text>

                      {/* Simple resize handle */}
                      <View
                        style={styles.resizeHandle}
                        onTouchStart={handleResizeTouchStart}
                        onTouchMove={handleResizeTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onStartShouldSetResponder={() => true}
                        onMoveShouldSetResponder={() => true}
                        onResponderGrant={handleResizeTouchStart}
                        onResponderMove={handleResizeTouchMove}
                        onResponderRelease={handleTouchEnd}
                      >
                        <Ionicons name="resize-outline" size={16} color="#FFFFFF" />
                      </View>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.manualInstructions}>
                <Text style={styles.instructionText}>
                  Drag to move. Pinch to resize the crop box.
                </Text>
              </View>
            </View>
          )}

          {cropping && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Cropping image...</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  cancelButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  instructionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#3C3C43',
    lineHeight: 20,
  },
  imageContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
    position: 'relative',
  },
  imageWrapper: {
    width: screenWidth * 0.85, // 85% of screen width for better visibility
    height: screenHeight * 0.4, // 40% of screen height for larger preview
    borderRadius: 8,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  optionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  cropOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  originalOption: {
    borderBottomWidth: 0,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
  manualOption: {
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#FF9500',
    borderRadius: 8,
    marginBottom: 8,
  },
  manualCropContainer: {
    flex: 1,
  },
  manualCropHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 4,
  },
  manualCropTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  resetButton: {
    backgroundColor: '#8E8E93',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cropButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cropButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cropOverlay: {
    position: 'absolute',
    borderWidth: 3, // Thicker border for better visibility
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.15)', // Slightly more visible background
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropDragArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 50,
  },
  cropAreaText: {
    fontSize: 14, // Slightly larger text
    color: '#007AFF',
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // More opaque background
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    textAlign: 'center',
  },
  resizeHandle: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    width: 48, // Larger handle for easier interaction
    height: 48,
    backgroundColor: '#FF9500',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  manualInstructions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
})
