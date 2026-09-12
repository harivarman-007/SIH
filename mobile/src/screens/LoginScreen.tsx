/**
 * LoginScreen.tsx
 * Inspector login screen with JWT auth.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuthStore } from "../store/authStore";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Login">;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter both email and password.");
      return;
    }
    clearError();
    try {
      await login(email.trim(), password.trim());
      navigation.replace("Dashboard");
    } catch {
      // error already set in store
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>⛏️</Text>
          </View>
          <Text style={styles.appName}>INTELLIFUSION</Text>
          <Text style={styles.tagline}>AI-Powered Mine Safety Compliance</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Inspector Login</Text>
          <Text style={styles.cardSubtitle}>Sign in to your DGMS account</Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="inspector@coalmine.gov.in"
              placeholderTextColor="#4B5563"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              testID="email-input"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#4B5563"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              testID="password-input"
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            testID="login-button"
            accessibilityLabel="Login button"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In →</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Demo hint */}
        <View style={styles.demoHint}>
          <Text style={styles.demoHintText}>
            Demo: Use seeded inspector credentials from generate_mock_data.py
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#1E3A5F",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  logoIcon: {
    fontSize: 36,
  },
  appName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 3,
  },
  tagline: {
    marginTop: 6,
    fontSize: 12,
    color: "#64748B",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F1F5F9",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 24,
  },
  errorBanner: {
    backgroundColor: "#7F1D1D",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#DC2626",
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 13,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#F1F5F9",
    fontSize: 15,
  },
  loginButton: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#2563EB",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  demoHint: {
    marginTop: 24,
    alignItems: "center",
  },
  demoHintText: {
    color: "#475569",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});
