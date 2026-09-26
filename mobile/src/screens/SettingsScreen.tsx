/**
 * SettingsScreen.tsx
 * Dedicated System Settings & Language Configuration for Mobile Inspectors.
 * Allows switching between 8 official & regional languages:
 * - System: English (default), Sanskrit (formal statutory register)
 * - Regional: Hindi, Bengali, Odia, Telugu, Marathi, Santali
 * Auto-detects mine site state defaults and syncs preferences with backend / offline storage.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { useAuthStore } from "../store/authStore";
import { useTranslation, LanguageCode, LanguageMeta, SUPPORTED_LANGUAGES } from "../i18n";
import { getActiveBackendUrl } from "../api/client";
import { observationRepository } from "../db/ObservationRepository";
import { BottomNavBar } from "../components/BottomNavBar";
import { colors, shadows } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Settings">;
};

export default function SettingsScreen({ navigation }: Props) {
  const { user, logout, updateUserLanguagePreference } = useAuthStore();
  const {
    t,
    language,
    changeLanguage,
    resetToDefaultLanguage,
    isDerived,
    derivedLanguage,
    supportedLanguages,
    syncWithUser,
  } = useTranslation();

  const [isUpdating, setIsUpdating] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    // Keep i18n synchronized with user profile mine site state
    syncWithUser(user?.preferred_language, user?.mine_site_state);
    observationRepository.getSyncStats().then((s) => setQueuedCount(s.pending)).catch(() => {});
  }, [user, syncWithUser]);

  const handleSelectLanguage = async (targetCode: LanguageCode) => {
    if (targetCode === language && !isDerived) return;
    setIsUpdating(true);
    try {
      await changeLanguage(targetCode);
      await updateUserLanguagePreference(targetCode);
    } catch {
      // Handled gracefully in offline mode
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsUpdating(true);
    try {
      await resetToDefaultLanguage();
      await updateUserLanguagePreference(null);
      Alert.alert(
        t("common.success"),
        t("settings.derived_from_site", {
          state: user?.mine_site_state || "Mine Site",
          lang: derivedLanguage.toUpperCase(),
        })
      );
    } catch {
      // offline safe
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(t("settings.sign_out"), "Are you sure you want to sign out?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.sign_out"),
        style: "destructive",
        onPress: async () => {
          await logout();
          navigation.replace("Login");
        },
      },
    ]);
  };

  const systemLangs = supportedLanguages.filter((l) => l.category === "system");
  const regionalLangs = supportedLanguages.filter((l) => l.category === "regional");

  const renderLanguageItem = (meta: LanguageMeta) => {
    const isSelected = language === meta.code;
    return (
      <TouchableOpacity
        key={meta.code}
        style={[styles.langItem, isSelected && styles.langItemActive]}
        onPress={() => handleSelectLanguage(meta.code)}
        activeOpacity={0.7}
      >
        <View style={styles.langLeft}>
          <View style={[styles.langRadio, isSelected && styles.langRadioActive]}>
            {isSelected && <View style={styles.langRadioInner} />}
          </View>
          <View style={styles.langTextContainer}>
            <View style={styles.langTitleRow}>
              <Text style={[styles.langNative, isSelected && styles.langTextHighlight]}>
                {meta.nativeName}
              </Text>
              <Text style={styles.langEnglish}>({meta.name})</Text>
              {meta.code === "sa" && (
                <View style={styles.formalBadge}>
                  <Text style={styles.formalBadgeText}>STATUTORY</Text>
                </View>
              )}
            </View>
            <Text style={styles.langSub}>
              {meta.regionalState ? `${meta.regionalState} • ` : ""}
              {meta.description}
            </Text>
          </View>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={28} color="#FFFFFF" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.full_name || "Field Inspector"}</Text>
            <Text style={styles.userEmail}>{user?.email || "inspector@coalmine.gov.in"}</Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>
                {(user?.role || "inspector").replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Language Configuration Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBg}>
              <Ionicons name="language" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{t("settings.language_title")}</Text>
              <Text style={styles.sectionSubtitle}>{t("settings.language_subtitle")}</Text>
            </View>
            {isUpdating && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          {/* Current derivation indicator banner */}
          <View style={styles.derivationBanner}>
            <Ionicons
              name={isDerived ? "navigate" : "options-outline"}
              size={16}
              color={colors.primary}
            />
            <Text style={styles.derivationText}>
              {isDerived
                ? t("settings.derived_from_site", {
                    state: user?.mine_site_state || "Mine Region",
                    lang: derivedLanguage.toUpperCase(),
                  })
                : `${t("settings.current_language")}: ${language.toUpperCase()} (Manual Override)`}
            </Text>
          </View>

          {/* System Languages */}
          <Text style={styles.langCategoryHeader}>{t("settings.system_languages")}</Text>
          {systemLangs.map(renderLanguageItem)}

          {/* Regional Languages */}
          <Text style={[styles.langCategoryHeader, { marginTop: 16 }]}>
            {t("settings.regional_languages")}
          </Text>
          {regionalLangs.map(renderLanguageItem)}

          {/* Reset to site default button */}
          <TouchableOpacity
            style={[styles.resetButton, isDerived && styles.resetButtonDisabled]}
            disabled={isDerived || isUpdating}
            onPress={handleResetToDefault}
          >
            <Ionicons
              name="refresh-outline"
              size={16}
              color={isDerived ? colors.textMuted : colors.primary}
            />
            <Text
              style={[
                styles.resetButtonText,
                isDerived && { color: colors.textMuted },
              ]}
            >
              {t("settings.reset_to_site_default")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mine Site & Server Diagnostics */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t("settings.storage_diagnostics")}</Text>
          
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>{t("settings.mine_site")}</Text>
            <Text style={styles.diagValue}>{user?.mine_site_id ? `Site #${user.mine_site_id.slice(0, 8)}` : "All Mines"}</Text>
          </View>

          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>{t("settings.state")}</Text>
            <Text style={styles.diagValue}>{user?.mine_site_state || "Not Specified"}</Text>
          </View>

          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>{t("settings.server_url")}</Text>
            <Text style={styles.diagValue} numberOfLines={1}>{getActiveBackendUrl()}</Text>
          </View>

          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>{t("settings.total_cached")}</Text>
            <Text style={[styles.diagValue, { color: queuedCount > 0 ? colors.warningText : colors.successText, fontWeight: "700" }]}>
              {queuedCount} pending
            </Text>
          </View>

          <TouchableOpacity
            style={styles.diagLink}
            onPress={() => navigation.navigate("Queue")}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
            <Text style={styles.diagLinkText}>{t("queue.title")} →</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.dangerText} />
          <Text style={styles.signOutText}>{t("settings.sign_out")}</Text>
        </TouchableOpacity>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>Intellifusion SafeMine v1.0 • SIH26024</Text>
        </View>
      </ScrollView>

      <BottomNavBar currentRoute="Settings" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    ...shadows.sm,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  roleTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    ...shadows.sm,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionIconBg: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  derivationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 14,
    gap: 8,
  },
  derivationText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    flex: 1,
  },
  langCategoryHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  langItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    backgroundColor: colors.surface,
  },
  langItemActive: {
    borderColor: colors.primary,
    backgroundColor: "#F0F7FF",
  },
  langLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  langRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  langRadioActive: {
    borderColor: colors.primary,
  },
  langRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  langTextContainer: {
    flex: 1,
  },
  langTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  langNative: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  langEnglish: {
    fontSize: 13,
    color: colors.textMuted,
  },
  langTextHighlight: {
    color: colors.primary,
  },
  formalBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  formalBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#475569",
  },
  langSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: 12,
  },
  resetButtonDisabled: {
    opacity: 0.5,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  diagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  diagLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  diagValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    maxWidth: "60%",
  },
  diagLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  diagLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.dangerText,
  },
  footerNote: {
    alignItems: "center",
    marginTop: 8,
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
