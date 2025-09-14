"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from '../../backend/supabase/client'
import type { User } from "../types"

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSigningUp, setIsSigningUp] = useState(false)

  useEffect(() => {
    console.log('AuthProvider useEffect triggered, isSigningUp:', isSigningUp)
    
    // Development safety timeout - force loading to false after 5 seconds
    const devTimeout = setTimeout(() => {
      if (loading) {
        console.log('DEV MODE: Force setting loading to false after timeout')
        setLoading(false)
      }
    }, 5000)

    const minimalFromSession = (sUser: any) => {
      const name = sUser?.user_metadata?.name || (sUser?.email ? String(sUser.email).split('@')[0] : 'User')
      const created_at = sUser?.created_at || new Date().toISOString()
      return {
        id: sUser.id,
        email: sUser.email,
        name,
        created_at,
      } as User
    }
    
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id || 'No session')
      
      if (session?.user && !isSigningUp) {
        // Immediately set a minimal user to enable instant navigation
        setUser(minimalFromSession(session.user))
        setLoading(false)
        // Fetch full profile in background
        fetchUserProfile(session.user.id)
      } else {
        console.log('Setting loading to false - no session or signing up')
        setLoading(false)
      }
      
      clearTimeout(devTimeout) // Clear timeout if we got a response
    }).catch(async (error) => {
      console.error('Error getting session:', error)
      // Clear any stale session data to be safe
      try { await supabase.auth.signOut() } catch {}
      setLoading(false)
      clearTimeout(devTimeout)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id || 'No session')
      
      if (session?.user) {
        // Set minimal user immediately for smooth UX
        setUser(minimalFromSession(session.user))
        setLoading(false)
        console.log('Auth change: fetching profile')
        // Add delay for new signups to let profile be created
        if (event === 'SIGNED_UP') {
          console.log('New signup detected, waiting for profile creation...')
          setTimeout(() => fetchUserProfile(session.user!.id), 3000)
        } else {
          await fetchUserProfile(session.user.id)
        }
      } else {
        console.log('Auth change: clearing user, setting loading false')
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(devTimeout)
    }
  }, [isSigningUp])

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('Fetching user profile for:', userId)
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      )
      
      const fetchPromise = supabase.from("users").select("*").eq("id", userId).single()
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any

      if (error) {
        console.error('Error fetching user profile:', error)
        // Don't throw error, just set user to null and continue
        setUser(null)
        setLoading(false)
        return
      }
      
      console.log('User profile fetched successfully:', data)
      setUser(data)
    } catch (error) {
      console.error("Error fetching user profile:", error)
      setUser(null)
    } finally {
      console.log('Setting loading to false')
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log('Starting signup process...')

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            name: name.trim()
          }
        }
      })

      if (error) throw error

      console.log('Signup successful, user ID:', data.user?.id)

      // Manually create user profile if user was created
      if (data.user?.id) {
        console.log('Creating user profile...')

        // Try to create the user profile manually
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: email.trim(),
            name: name.trim()
          })

        if (profileError) {
          console.log('Profile creation error (might already exist):', profileError)
        } else {
          console.log('User profile created successfully')
        }

        // Wait a bit for the profile to be available
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Fetch and set the user profile
        await fetchUserProfile(data.user.id)
      }
    } catch (error) {
      console.error('Signup failed:', error)
      throw error
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }

  const refreshUser = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id)
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


