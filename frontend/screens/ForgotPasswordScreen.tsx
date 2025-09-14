"use client"

import { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, ScrollView, Alert, Animated, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import { BlurView } from "expo-blur"
import { Button } from "../components/Button"
import { InputField } from "../components/InputField"
import { useAuth } from "../contexts/AuthProvider"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RootStackParamList } from "../types"

type ForgotPasswordScreenNavigationProp = StackNavigationProp<RootStackParamList, "ForgotPassword">

interface Props {
  navigation: ForgotPasswordScreenNavigationProp
}

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const { resetPassword } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start()
  }, [fadeAnim])

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address")
      return
    }

    setLoading(true)
    try {
      await resetPassword(email)
      Alert.alert("Reset Link Sent", "Check your email for password reset instructions", [
        { text: "OK", onPress: () => navigation.navigate("Login") },
      ])
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.logo}>🔒</Text>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>Enter your email address and we'll send you a link to reset your password</Text>
          </View>

          <Animated.View style={{ ...styles.formContainer, opacity: fadeAnim }}>
            <BlurView intensity={100} tint="light" style={styles.blurContainer}>
              <View style={styles.form}>
                <InputField
                  label="Email"
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                />

               <Button
                    title="Send Reset Link"
                    onPress={() => {}} // ❌ remove functionality
                    loading={false}
                    size="large"
                    disabled={true} // disables button
/>

                <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.backToLoginButton}>
                  <Text style={styles.backToLoginText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    paddingBottom: 40,
  },
  logo: {
    fontSize: 60,
    marginBottom: 20,
    color: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    lineHeight: 22,
  },
  formContainer: {
    borderRadius: 20,
    marginHorizontal: 8,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: "hidden", // This is important for the blur effect to work correctly
  },
  blurContainer: {
    padding: 24,
  },
  form: {
    gap: 16,
  },
  backToLoginButton: {
    alignItems: "center",
    marginTop: 10,
  },
  backToLoginText: {
    color: "#fff",
    fontSize: 16,
  },
})

export default ForgotPasswordScreen
