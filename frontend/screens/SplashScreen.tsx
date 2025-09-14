import type React from "react"
import { View, Text, StyleSheet, ActivityIndicator, Image } from "react-native"
import { LinearGradient } from "expo-linear-gradient"

const SplashScreen: React.FC = () => {
  return (
    <LinearGradient colors={["#ffffffff", "#ea00ffff"]} style={styles.container}>
      <View style={styles.content}>
        <Image 
          source={require("../../assets/onboard.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        {/* <Text style={styles.title}>SmartSplit</Text> */}
        <Text style={styles.subtitle}>Split bills with ease</Text>
        <ActivityIndicator size="large" color="#fff" style={styles.loader} />
      </View>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
  },
  logo: {
    width: 300,  // Increased from 80 to 150
    height: 300,  // Increased from 80 to 150
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
})

export default SplashScreen