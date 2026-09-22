/**
 * AppNavigator.tsx
 * Stack navigator — Login → (authenticated) Dashboard ↔ Inspections ↔ Actions ↔ NewObservation → RiskCard, Queue
 */

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RiskScoringResult } from "../models/RiskScoringEngine";

import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import InspectionsScreen from "../screens/InspectionsScreen";
import ActionsScreen from "../screens/ActionsScreen";
import NewObservationScreen from "../screens/NewObservationScreen";
import RiskCardScreen from "../screens/RiskCardScreen";
import QueueScreen from "../screens/QueueScreen";

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Inspections: undefined;
  Actions: undefined;
  NewObservation: { inspectionId?: string; inspectionCode?: string } | undefined;
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
            headerLeft: () => null,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="Inspections"
          component={InspectionsScreen}
          options={{
            title: "Inspections",
            headerLeft: () => null,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="Actions"
          component={ActionsScreen}
          options={{
            title: "Corrective Actions",
            headerLeft: () => null,
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
            headerLeft: () => null,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="Queue"
          component={QueueScreen}
          options={{
            title: "Sync & Outbox",
            headerLeft: () => null,
            gestureEnabled: false,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
