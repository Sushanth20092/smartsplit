"use client"

import type React from "react"
import { createContext, useContext, useState, type ReactNode } from "react"
import type { Theme } from "../types"

const lightTheme: Theme = {
  colors: {
    primary: "#007AFF",
    secondary: "#FF9500",
    background: "#FFFFFF",
    surface: "#F2F2F7",
    text: "#1C1C1E",
    error: "#FF3B30",
    success: "#34C759",
    warning: "#FF9500",
  },
  fonts: {
    regular: "System",
    medium: "System",
    bold: "System",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
}

const darkTheme: Theme = {
  colors: {
    primary: "#0A84FF",
    secondary: "#FF9F0A",
    background: "#000000",
    surface: "#1C1C1E",
    text: "#FFFFFF",
    error: "#FF453A",
    success: "#30D158",
    warning: "#FF9F0A",
  },
  fonts: {
    regular: "System",
    medium: "System",
    bold: "System",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
}

interface ThemeContextType {
  theme: Theme
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDark, setIsDark] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
  }

  const theme = isDark ? darkTheme : lightTheme

  const value = {
    theme,
    isDark,
    toggleTheme,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
