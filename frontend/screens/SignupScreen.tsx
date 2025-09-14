"use client"

import { useState, useEffect, useRef } from "react"
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform, KeyboardAvoidingView, Animated, Image } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import { BlurView } from "expo-blur"
import { Button } from "../components/Button"
import { InputField } from "../components/InputField"
import { useAuth } from "../contexts/AuthProvider"
import type { StackNavigationProp } from "@react-navigation/stack"
import type { RootStackParamList } from "../types"
import { Ionicons } from "@expo/vector-icons"
import { supabase } from "../../backend/supabase/client"
import AsyncStorage from '@react-native-async-storage/async-storage'

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, "Signup">

interface Props {
  navigation: SignupScreenNavigationProp
}

const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start()
  }, [fadeAnim])

  // Validation error states
  const [nameError, setNameError] = useState("")
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [confirmPasswordError, setConfirmPasswordError] = useState("")

  // Clear all errors
  const clearErrors = () => {
    setNameError("")
    setEmailError("")
    setPasswordError("")
    setConfirmPasswordError("")
  }

  // Email validation - must end with @gmail.com
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@gmail\.com$/
    return emailRegex.test(email)
  }

  // Password strength validation
  const isStrongPassword = (password: string) => {
    return password.length >= 8 &&
           /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password)
  }

  const validateForm = () => {
    clearErrors()
    let isValid = true

    // Name validation
    if (!name.trim()) {
      setNameError("Full name is required")
      isValid = false
    } else if (name.trim().length < 2) {
      setNameError("Name must be at least 2 characters")
      isValid = false
    }

    // Email validation
    if (!email.trim()) {
      setEmailError("Email is required")
      isValid = false
    } else if (!isValidEmail(email.trim())) {
      setEmailError("Please enter a valid Gmail address (must end with @gmail.com)")
      isValid = false
    }

    // Password validation
    if (!password) {
      setPasswordError("Password is required")
      isValid = false
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      isValid = false
    } else if (!isStrongPassword(password)) {
      setPasswordError("Password must contain uppercase, lowercase, and number")
      isValid = false
    }

    // Confirm password validation
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password")
      isValid = false
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match")
      isValid = false
    }

    return isValid
  }

  const handleSignup = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            // This name will be used by the database trigger to create the user profile
            name: name.trim(),
          },
        },
      })

      if (error) {
        throw error
      }

      // If signUp is successful, Supabase sends a confirmation email by default.
      // The session will be null until the user confirms their email.
      if (data.user && !data.session) {
        Alert.alert(
          "Confirm your email",
          "We've sent an email with a confirmation link. Please check your inbox to activate your account.",
          [{ text: "OK", onPress: () => navigation.navigate("Login") }],
        )
      } else if (data.user && data.session) {
        // This case happens if auto-confirm is enabled in Supabase project settings.
        // The user is logged in immediately, set flag to show success message on dashboard
        await AsyncStorage.setItem('justRegistered', 'true')
      }

      // Clear form after success (for email confirmation case)
      setName("")
      setEmail("")
      setPassword("")
      setConfirmPassword("")
    } catch (error) {
      console.error("Signup error:", error)

      // Handle specific error types
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase()

        if (errorMessage.includes('user already registered') ||
            errorMessage.includes('email already exists') ||
            errorMessage.includes('already been registered')) {
          setEmailError("An account with this email already exists")
        } else if (errorMessage.includes('invalid email')) {
          setEmailError("Please enter a valid Gmail address (must end with @gmail.com)")
        } else if (errorMessage.includes('password')) {
          setPasswordError("Password requirements not met")
        } else {
          Alert.alert("Signup Failed", error.message)
        }
      } else {
        Alert.alert("Signup Failed", "An error occurred. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate("Login")}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <ScrollView
            style={{ flex: 1 }} // Add flex: 1 to ScrollView
            contentContainerStyle={styles.content}
            {...(Platform.OS === 'web' && {
              showsVerticalScrollIndicator: false,
              keyboardShouldPersistTaps: "handled"
            })}
          >
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image source={require("../../assets/login.png")} style={styles.logo} />
              </View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join SmartSplit today</Text>
            </View>

            <Animated.View style={{ ...styles.formContainer, opacity: fadeAnim }}>
            <BlurView intensity={100} tint="light" style={styles.blurContainer}>
              <View style={styles.form}>
                <InputField
                  label="Full Name"
                  placeholder="Enter your full name"
                  value={name}
                  onChangeText={(text) => {
                    setName(text)
                    if (nameError) setNameError("")
                  }}
                  error={nameError}
                />
                <InputField
                  label="Email"
                  placeholder="Enter your Gmail address"
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
                <InputField
                  label="Confirm Password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text)
                    if (confirmPasswordError) setConfirmPasswordError("")
                  }}
                  secureTextEntry
                  error={confirmPasswordError}
                />

                <Button title="Create Account" onPress={handleSignup} loading={loading} size="large" />
              </View>
            </BlurView>
          </Animated.View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Already have an account?{" "}
                <Text style={styles.link} onPress={() => navigation.navigate("Login")}>
                  Sign In
                </Text>
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
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
  backButton: {
    position: "absolute",
    top: 60,
    left: 24,
    padding: 12,
    zIndex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    ...(Platform.OS === 'web' && {
      paddingBottom: 60,
      justifyContent: 'space-between',
    }),
  },
  header: {
    alignItems: "center",
    paddingBottom: 40,
  },
  logoContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 40,
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logo: {
    width: 50,
    height: 50,
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
    ...(Platform.OS === 'web' && {
      marginBottom: 20,
    }),
  },
  footer: {
    alignItems: "center",
    paddingVertical: 30,
    ...(Platform.OS === 'web' && {
      marginTop: 'auto',
    }),
  },
  footerText: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
  link: {
    color: "#fff",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
})

export default SignupScreen
