/**
 * DashboardScreen.tsx
 * Summary view: today's stats, sync%, high-risk count.
 * Executive Light Theme with vector Ionicons and Royal Blue branding.
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { observationRepository } from "../db/ObservationRepository";
import { getSyncStats } from "../sync/SyncWorker";
import { isOnline } from "../sync/TaskManager";
import { useAuthStore } from "../store/authStore";
import { LocalObservation } from "../db/schema";
import { BottomNavBar } from "../components/BottomNavBar";
import { colors, shadows } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Dashboard">;
};

interface DashboardStats {
  totalToday: number;
  highRiskCount: number;
  syncPct: number;
  pendingCount: number;
  recentObservations: LocalObservation[];
  online: boolean;
}

const FLAG_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  high: { color: colors.dangerText, bg: colors.dangerLight, border: colors.dangerBorder },
  medium: { color: colors.warningText, bg: colors.warningLight, border: colors.warningBorder },
  low: { color: colors.successText, bg: colors.successLight, border: colors.successBorder },
};

function StatCard({
  value,
  label,
  icon,
  iconColor,
  iconBg,
}: {
  value: number | string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.statCardValue}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user, logout } = useAuthStore();

  const loadStats = useCallback(async () => {
    const [all, syncStats, online] = await Promise.all([
      observationRepository.getAll(),
      getSyncStats(),
      isOnline(),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayObs = all.filter(
      (o) => new Date(o.created_at) >= todayStart
    );
    const highRiskCount = all.filter((o) => o.edge_flag === "high").length;

    setStats({
      totalToday: todayObs.length,
      highRiskCount,
      syncPct: syncStats.syncPct,
      pendingCount: syncStats.pending,
      recentObservations: all.slice(0, 5),
      online,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadStats();
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    navigation.replace("Login");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Good {getTimeOfDay()}, Inspector
            </Text>
            <Text style={styles.userName}>{user?.full_name ?? user?.email ?? "Field Inspector"}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{(user?.role ?? "inspector").replace(/_/g, " ").toUpperCase()}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            testID="logout-button"
          >
            <Ionicons name="log-out-outline" size={16} color={colors.textMuted} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Network / Sync status banner */}
        <View
          style={[
            styles.networkBanner,
            { borderColor: stats?.online ? colors.successBorder : colors.warningBorder },
          ]}
        >
          <View style={styles.networkBannerLeft}>
            <View
              style={[
                styles.networkDot,
                { backgroundColor: stats?.online ? colors.success : colors.warning },
              ]}
            />
            <Text style={styles.networkBannerText}>
              {stats?.online
                ? `Online · ${stats.pendingCount} observation(s) ready to sync`
                : `Offline · ${stats?.pendingCount ?? 0} observation(s) queued`}
            </Text>
          </View>
          {stats && !stats.online && stats.pendingCount > 0 && (
            <TouchableOpacity
              onPress={() => navigation.navigate("Queue")}
              style={styles.viewQueueLink}
            >
              <Text style={styles.viewQueueText}>View Queue →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          <StatCard
            value={stats?.totalToday ?? 0}
            label="Today's Logs"
            icon="document-text"
            iconColor={colors.primary}
            iconBg={colors.primaryLight}
          />
          <StatCard
            value={stats?.highRiskCount ?? 0}
            label="High Risk"
            icon="alert-circle"
            iconColor={colors.dangerText}
            iconBg={colors.dangerLight}
          />
          <StatCard
            value={`${stats?.syncPct ?? 0}%`}
            label="Sync Rate"
            icon="cloud-done"
            iconColor={colors.successText}
            iconBg={colors.successLight}
          />
        </View>

        {/* Recent Observations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Observations</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Queue")}>
              <Text style={styles.seeAllLink}>View All →</Text>
            </TouchableOpacity>
          </View>

          {(stats?.recentObservations ?? []).length === 0 ? (
            <View style={styles.emptyRecent}>
              <Ionicons name="document-outline" size={28} color={colors.textLight} />
              <Text style={styles.emptyRecentText}>
                No observations logged yet. Tap + to start.
              </Text>
            </View>
          ) : (
            stats?.recentObservations.map((obs) => {
              const flagCfg = FLAG_CONFIG[obs.edge_flag ?? "low"] || FLAG_CONFIG.low;
              return (
                <View
                  key={obs.local_id}
                  style={[styles.recentItem, { borderLeftColor: flagCfg.color }]}
                >
                  <View style={styles.recentItemContent}>
                    <View style={styles.recentTopRow}>
                      <Text style={styles.recentCategory}>{obs.category}</Text>
                      <View style={[styles.flagPill, { backgroundColor: flagCfg.bg, borderColor: flagCfg.border }]}>
                        <Text style={[styles.flagPillText, { color: flagCfg.color }]}>
                          {(obs.edge_flag ?? "low").toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.recentDesc} numberOfLines={2}>
                      {obs.description}
                    </Text>
                  </View>
                  <View style={styles.recentMeta}>
                    <Ionicons
                      name={
                        obs.sync_status === "synced"
                          ? "checkmark-circle"
                          : obs.sync_status === "error"
                          ? "alert-circle"
                          : "time"
                      }
                      size={18}
                      color={
                        obs.sync_status === "synced"
                          ? colors.success
                          : obs.sync_status === "error"
                          ? colors.danger
                          : colors.warning
                      }
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Persistent Bottom Navigation */}
      <BottomNavBar currentRoute="Dashboard" navigation={navigation} />
    </View>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
    marginBottom: 6,
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  roleText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  logoutText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  networkBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    ...shadows.sm,
  },
  networkBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  networkBannerText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  viewQueueLink: {
    paddingLeft: 8,
  },
  viewQueueText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  kpiGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statCardValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 2,
  },
  statCardLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  seeAllLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  emptyRecent: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    gap: 8,
  },
  emptyRecentText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
  recentItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3.5,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...shadows.sm,
  },
  recentItemContent: {
    flex: 1,
    marginRight: 12,
  },
  recentTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  recentCategory: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  flagPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  flagPillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  recentDesc: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  recentMeta: {
    alignItems: "center",
    justifyContent: "center",
  },
});
