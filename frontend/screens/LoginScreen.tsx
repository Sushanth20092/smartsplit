"use client"

import { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, ScrollView, Alert, Animated, TouchableOpacity, Image } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import { BlurView } from "expo-blur"
import { Button } from "../components/Button"
import { InputField } from "../components/InputField"
import { useAuth } from "../contexts/AuthProvider"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RootStackParamList } from "../types"

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">

interface Props {
  navigation: LoginScreenNavigationProp
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start()
  }, [fadeAnim])

  // Validation error states
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")

  // Clear all errors
  const clearErrors = () => {
    setEmailError("")
    setPasswordError("")
  }

  // Email validation
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Validate form
  const validateForm = () => {
    clearErrors()
    let isValid = true

    // Email validation
    if (!email.trim()) {
      setEmailError("Email is required")
      isValid = false
    } else if (!isValidEmail(email.trim())) {
      setEmailError("Please enter a valid email address")
      isValid = false
    }

    // Password validation
    if (!password) {
      setPasswordError("Password is required")
      isValid = false
    }

    return isValid
  }

  const handleLogin = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      await signIn(email.trim(), password)
      // Navigation will be handled by AuthProvider when user state changes
    } catch (error) {
      console.error("Login error:", error)

      // Handle specific error types
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase()

        if (errorMessage.includes('invalid login credentials') ||
            errorMessage.includes('invalid email or password') ||
            errorMessage.includes('email not confirmed')) {
          setEmailError("Invalid email or password")
          setPasswordError("Invalid email or password")
        } else if (errorMessage.includes('email')) {
          setEmailError("Account not found with this email")
        } else if (errorMessage.includes('password')) {
          setPasswordError("Incorrect password")
        } else if (errorMessage.includes('too many requests')) {
          Alert.alert("Too Many Attempts", "Please wait a moment before trying again")
        } else {
          Alert.alert("Login Failed", error.message)
        }
      } else {
        Alert.alert("Login Failed", "An error occurred. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image source={require("../../assets/login.png")} style={styles.logo} />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          <Animated.View style={{ ...styles.formContainer, opacity: fadeAnim }}>
            <BlurView intensity={100} tint="light" style={styles.blurContainer}>
              <View style={styles.form}>
                <InputField
                  label="Email"
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text)
                    if (emailError) setEmailError("")
                  }}
                  keyboardType="email-address"
                  error={emailError}
                />
                <InputField
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text)
                    if (passwordError) setPasswordError("")
                  }}
                  secureTextEntry
                  error={passwordError}
                />

                <Button title="Sign In" onPress={handleLogin} loading={loading} size="large" />

                <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} style={styles.forgotPasswordButton}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </Animated.View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don't have an account?{" "}
              <Text style={styles.link} onPress={() => navigation.navigate("Signup")}>
                Sign Up
              </Text>
            </Text>
          </View>
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
logoContainer: {
  backgroundColor: "rgba(255, 255, 255, 0.85)", // light frosted white
  borderRadius: 60,
  width: 120,
  height: 120,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 24,
  shadowColor: "#000",
  shadowOpacity: 1.50,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 6,
  elevation: 6,
},

logo: {
  width: 80,
  height: 80,
  resizeMode: "contain",
},

  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
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
    gap: 20,
  },
  forgotPasswordButton: {
    alignItems: "center",
  },
  forgotPasswordText: {
    color: "#fff",
    fontSize: 16,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
  },
  link: {
    color: "#fff",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
})

export default LoginScreen

