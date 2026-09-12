/**
 * AppNavigator.tsx
 * Stack navigator — Login → (authenticated) Dashboard ↔ NewObservation → RiskCard, Queue
 */

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RiskScoringResult } from "../models/RiskScoringEngine";

import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import NewObservationScreen from "../screens/NewObservationScreen";
import RiskCardScreen from "../screens/RiskCardScreen";
import QueueScreen from "../screens/QueueScreen";

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  NewObservation: undefined;
  RiskCard: { localId: number; riskResult: RiskScoringResult };
  Queue: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: "#0F172A" },
  headerTintColor: "#F1F5F9",
  headerTitleStyle: { fontWeight: "700" as const, fontSize: 16 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: "#0F172A" },
};

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            title: "Intellifusion",
            headerLeft: () => null, // no back from dashboard
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="NewObservation"
          component={NewObservationScreen}
          options={{ title: "New Observation" }}
        />
        <Stack.Screen
          name="RiskCard"
          component={RiskCardScreen}
          options={{
            title: "Risk Card",
            headerLeft: () => null, // no going back — already saved
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="Queue"
          component={QueueScreen}
          options={{ title: "Sync Queue" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
