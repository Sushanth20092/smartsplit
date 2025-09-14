"use client"

import type React from "react"
import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator, TransitionPresets } from "@react-navigation/stack"
import { useAuth } from "../contexts/AuthProvider"

// Remove SplashScreen import since we won't need it
import OnboardingScreen from "../screens/OnboardingScreen"
import LoginScreen from "../screens/LoginScreen"
import SignupScreen from "../screens/SignupScreen"
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen"
import DashboardScreen from "../screens/DashboardScreen"
import ProfileScreen from "../screens/ProfileScreen"
import CreateGroupScreen from "../screens/CreateGroupScreen"
import JoinGroupScreen from "../screens/JoinGroupScreen"
import GroupListScreen from "../screens/GroupListScreen"
import GroupDetailsScreen from "../screens/GroupDetailsScreen"
import GroupBillsScreen from "../screens/GroupBillsScreen"
import AddBillScreen from "../screens/AddBillScreen"
import BillEditScreen from "../screens/BillEditScreen"
import BillSplitScreen from "../screens/BillSplitScreen"
import BillDetailsScreen from "../screens/BillDetailsScreen"
import BillSummaryScreen from "../screens/BillSummaryScreen"
import AllBillsScreen from "../screens/AllBillsScreen"
import ApprovalScreen from "../screens/ApprovalScreen"
import PaymentScreen from "../screens/PaymentScreen"
import GroupChatScreen from "../screens/GroupChatScreen"
import NotificationsScreen from "../screens/NotificationsScreen"

import type { RootStackParamList } from "../types"

const Stack = createStackNavigator<RootStackParamList>()

export const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth()

  // Keep native splash visible while auth state is resolving to avoid flicker
  if (loading) {
    return null
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          ...TransitionPresets.SlideFromRightIOS,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        {!user ? (
          // Auth screens with smooth transitions
          <>
            <Stack.Screen
              name="Onboarding"
              component={OnboardingScreen}
              options={{
                ...TransitionPresets.FadeFromBottomAndroid,
              }}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{
                ...TransitionPresets.SlideFromRightIOS,
                transitionSpec: {
                  open: {
                    animation: 'timing',
                    config: {
                      duration: 350,
                    },
                  },
                  close: {
                    animation: 'timing',
                    config: {
                      duration: 300,
                    },
                  },
                },
              }}
            />
            <Stack.Screen
              name="Signup"
              component={SignupScreen}
              options={{
                ...TransitionPresets.SlideFromRightIOS,
                transitionSpec: {
                  open: {
                    animation: 'timing',
                    config: {
                      duration: 350,
                    },
                  },
                  close: {
                    animation: 'timing',
                    config: {
                      duration: 300,
                    },
                  },
                },
                cardStyleInterpolator: ({ current, layouts }) => {
                  return {
                    cardStyle: {
                      transform: [
                        {
                          translateX: current.progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [layouts.screen.width, 0],
                          }),
                        },
                      ],
                      opacity: current.progress.interpolate({
                        inputRange: [0, 0.3, 1],
                        outputRange: [0, 0.9, 1],
                      }),
                    },
                  };
                },
              }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{
                ...TransitionPresets.ModalSlideFromBottomIOS,
              }}
            />
          </>
        ) : (
          // App screens
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
            <Stack.Screen name="JoinGroup" component={JoinGroupScreen} />
            <Stack.Screen name="GroupList" component={GroupListScreen} />
            <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
            <Stack.Screen name="GroupBills" component={GroupBillsScreen} />
            <Stack.Screen name="AddBill" component={AddBillScreen} />
            <Stack.Screen name="BillEdit" component={BillEditScreen} />
            <Stack.Screen name="BillSplit" component={BillSplitScreen} />
            <Stack.Screen name="BillDetails" component={BillDetailsScreen} />
            <Stack.Screen name="BillSummary" component={BillSummaryScreen} />
            <Stack.Screen name="AllBills" component={AllBillsScreen} />
            <Stack.Screen name="Approval" component={ApprovalScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="GroupChat" component={GroupChatScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}