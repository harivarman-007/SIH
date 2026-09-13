/**
 * App.tsx
 * Root component. Initializes SQLite DB, registers background sync,
 * and restores auth session before rendering navigator.
 */

import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { openDatabase } from "./src/db/schema";
import { registerBackgroundSync } from "./src/sync/TaskManager";
import { useAuthStore } from "./src/store/authStore";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    async function bootstrap() {
      try {
        // 1. Initialize SQLite
        await openDatabase();

        // 2. Register background sync task
        await registerBackgroundSync();

        // 3. Restore JWT session (if token stored in SecureStore)
        await restoreSession();
      } catch (err) {
        console.warn("Bootstrap error:", err);
      } finally {
        setAppReady(true);
      }
    }
    bootstrap();
  }, [restoreSession]);

  if (!appReady) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>⛏️ INTELLIFUSION</Text>
        <ActivityIndicator color="#2563EB" size="large" style={{ marginTop: 24 }} />
        <Text style={styles.splashSubtitle}>Initializing offline storage...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F1F5F9",
    letterSpacing: 4,
  },
  splashSubtitle: {
    marginTop: 16,
    fontSize: 12,
    color: "#475569",
    letterSpacing: 0.5,
  },
});
