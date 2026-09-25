/**
 * LoginScreen.tsx
 * Inspector login screen with JWT auth.
 * Executive Light Theme with vector icons and Royal Blue branding.
 */

import React, { useState, useEffect } from "react";
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
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/authStore";
import { getActiveBackendUrl, setActiveBackendUrl } from "../api/client";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { colors, shadows } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Login">;
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState<string>(getActiveBackendUrl());
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [customServerInput, setCustomServerInput] = useState("");
  const [isTestingServer, setIsTestingServer] = useState(false);

  const { login, isLoading, error, clearError } = useAuthStore();

  useEffect(() => {
    setServerUrl(getActiveBackendUrl());
  }, []);

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

  const handleOpenServerModal = () => {
    setCustomServerInput(serverUrl);
    setServerModalVisible(true);
  };

  const handleSaveServer = async (targetUrl: string) => {
    let clean = targetUrl.trim();
    if (!clean) {
      Alert.alert("Invalid URL", "Please enter a valid backend server URL.");
      return;
    }
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = "http://" + clean;
    }

    setIsTestingServer(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        await fetch(`${clean}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
      } catch {
        // Allow proceeding even if ping warning
      }

      await setActiveBackendUrl(clean);
      setServerUrl(clean);
      setServerModalVisible(false);
      Alert.alert("Server Configured", `Backend server updated to:\n${clean}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update server URL.";
      Alert.alert("Config Error", msg);
    } finally {
      setIsTestingServer(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    clearError();
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
            <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
          </View>
          <Text style={styles.appName}>INTELLIFUSION</Text>
          <Text style={styles.tagline}>Directorate General of Mines Safety (DGMS)</Text>
        </View>

        {/* Server Badge */}
        <TouchableOpacity
          style={styles.serverBadge}
          onPress={handleOpenServerModal}
          activeOpacity={0.8}
        >
          <Ionicons name="server-outline" size={13} color={colors.primary} />
          <Text style={styles.serverBadgeText} numberOfLines={1}>
            Server: {serverUrl}
          </Text>
          <Text style={styles.serverChangeLink}>Change</Text>
        </TouchableOpacity>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Field Mobility Console</Text>
          <Text style={styles.cardSubtitle}>Sign in to your inspector account</Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={colors.dangerText} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="inspector1@mine.in"
              placeholderTextColor={colors.textLight}
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
              placeholderTextColor={colors.textLight}
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
              <View style={styles.btnRow}>
                <Text style={styles.loginButtonText}>Sign In</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Demo Fill Buttons */}
        <View style={styles.demoSection}>
          <Text style={styles.demoSectionTitle}>QUICK DEMO ACCOUNTS</Text>
          <View style={styles.demoButtonsRow}>
            <TouchableOpacity
              style={styles.demoChip}
              onPress={() => fillDemo("inspector1@mine.in")}
              activeOpacity={0.7}
            >
              <Ionicons name="person-outline" size={12} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.demoChipText}>Inspector 1</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoChip}
              onPress={() => fillDemo("official1@mine.in")}
              activeOpacity={0.7}
            >
              <Ionicons name="business-outline" size={12} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.demoChipText}>Mine Official</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal: Change Server */}
        <Modal
          visible={serverModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setServerModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, shadows.lg]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Ionicons name="server" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Configure Server URL</Text>
              </View>
              <Text style={styles.modalSubtitle}>
                Select or enter the backend endpoint for mobile synchronization.
              </Text>

              <Text style={styles.modalLabel}>SERVER URL</Text>
              <TextInput
                style={styles.modalInput}
                value={customServerInput}
                onChangeText={setCustomServerInput}
                placeholder="http://10.178.236.88:8000"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              <Text style={[styles.modalLabel, { marginTop: 12 }]}>PRESETS</Text>
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => setCustomServerInput("http://10.178.236.88:8000")}
                >
                  <Text style={styles.presetChipText}>Host LAN (10.178.236.88)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => setCustomServerInput("http://10.0.2.2:8000")}
                >
                  <Text style={styles.presetChipText}>Android Sim (10.0.2.2)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => setCustomServerInput("http://localhost:8000")}
                >
                  <Text style={styles.presetChipText}>Localhost (127.0.0.1)</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setServerModalVisible(false)}
                  disabled={isTestingServer}
                >
                  <Text style={styles.modalCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSaveBtn, isTestingServer && { opacity: 0.6 }]}
                  onPress={() => handleSaveServer(customServerInput)}
                  disabled={isTestingServer}
                >
                  {isTestingServer ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Save Server</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    ...shadows.sm,
  },
  appName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 2,
  },
  tagline: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerLight,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  errorText: {
    color: colors.dangerText,
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    ...shadows.sm,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  demoHint: {
    marginTop: 20,
    alignItems: "center",
  },
  demoHintText: {
    color: colors.textLight,
    fontSize: 11,
    textAlign: "center",
  },
  serverBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 20,
    gap: 6,
    maxWidth: "92%",
  },
  serverBadgeText: {
    fontSize: 11,
    color: colors.primary,
    fontFamily: "monospace",
    flexShrink: 1,
  },
  serverChangeLink: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    textDecorationLine: "underline",
  },
  demoSection: {
    marginTop: 24,
    alignItems: "center",
  },
  demoSectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  demoButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  demoChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...shadows.sm,
  },
  demoChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
    fontFamily: "monospace",
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 18,
  },
  presetChip: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  presetChipText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: "600",
  },
  modalBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelBtnText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 12,
  },
  modalSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  modalSaveBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
});
