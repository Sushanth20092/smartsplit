"use client"

import React, { useState, useRef, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  type ViewToken,
  Image,
} from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { Button } from "../components/Button"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RootStackParamList } from "../types"

type OnboardingScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Onboarding"
>

interface Props {
  navigation: OnboardingScreenNavigationProp
}

interface OnboardingItem {
  image: any
  title: string
  description: string
  colors: [string, string] // explicitly typed to 2 colors
  buttonColor: string
}

const onboardingData: OnboardingItem[] = [
  {
    image: require("../../assets/slide1.png"),
    title: "Fair Group Splitting",
    description:
      "Create groups and split bills automatically for roommates, friends, and colleagues — no more awkward math or confusion.",
    colors: ["#00C6FF", "#0072FF"],
    buttonColor: "#0072FF",
  },
  {
    image: require("../../assets/slide2.png"),
    title: "AI Bill Scanner",
    description:
      "Snap a photo of your receipt — our AI extracts all items and totals instantly and accurately.",
    colors: ["#11998E", "#38EF7D"],
    buttonColor: "#11998E",
  },
  {
    image: require("../../assets/slide3.png"),
    title: "Instant Payments",
    description:
      "Send and receive money instantly using UPI, QR code, or your preferred payment method — hassle-free and secure.",
    colors: ["#8E2DE2", "#4A00E0"],
    buttonColor: "#8E2DE2",
  },
]

const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const flatListRef = useRef<FlatList<OnboardingItem>>(null)

  const handleNext = () => {
    const nextIndex = currentIndex + 1
    if (nextIndex < onboardingData.length) {
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true })
    } else {
      navigation.navigate("Login")
    }
  }

  const handleSkip = () => {
    navigation.navigate("Login")
  }

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index)
      }
    },
    []
  )

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  }

  return (
    <LinearGradient
      colors={onboardingData[currentIndex]?.colors || ["#000", "#333"]}
      style={styles.container}
    >
      <FlatList
        ref={flatListRef}
        data={onboardingData}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(item) => item.title}
        renderItem={({ item, index }) => (
          <View style={styles.slide}>
            <View style={styles.imageContainer}>
              <Image
                source={item.image}
                style={[
                  styles.slideImage,
                  index === 2 && styles.largeImage, // slightly bigger for 3rd slide
                ]}
              />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {onboardingData.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === currentIndex && styles.activeDot]}
            />
          ))}
        </View>

        <View style={styles.buttons}>
          <Button
            title="Skip"
            onPress={handleSkip}
            variant="outline"
            size="medium"
            style={{
              borderColor: "rgba(255,255,255,0.8)",
              borderWidth: 1.5,
              backgroundColor: "rgba(255,255,255,0.1)",
            }}
            textStyle={{ color: "#FFFFFF" }} // ✅ fixed text color
          />
          <Button
            title={
              currentIndex === onboardingData.length - 1
                ? "Get Started"
                : "Next"
            }
            onPress={handleNext}
            variant="secondary"
            size="medium"
            style={{
              backgroundColor: "#fff",
              borderRadius: 8,
            }}
            textStyle={{
              color: onboardingData[currentIndex].buttonColor,
              fontWeight: "bold",
            }}
          />
        </View>
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  slide: {
    width: Dimensions.get("window").width,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  imageContainer: {
    height: 280, // fixed height ensures titles always align
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  slideImage: {
    width: 280,
    height: 280,
    resizeMode: "contain",
  },
  largeImage: {
    width: 230,
    height: 230,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  footer: {
    paddingHorizontal: 40,
    paddingBottom: 40,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#fff",
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 50,
  },
})

export default OnboardingScreen
