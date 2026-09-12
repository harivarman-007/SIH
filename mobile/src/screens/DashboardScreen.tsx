/**
 * DashboardScreen.tsx
 * Summary view: today's stats, sync%, high-risk count.
 * FAB to create a new observation.
 */

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { observationRepository } from "../db/ObservationRepository";
import { getSyncStats } from "../sync/SyncWorker";
import { isOnline } from "../sync/TaskManager";
import { useAuthStore } from "../store/authStore";
import { LocalObservation } from "../db/schema";

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

const FLAG_COLOR: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#22C55E",
};

function StatCard({
  value,
  label,
  icon,
  color = "#60A5FA",
}: {
  value: number | string;
  label: string;
  icon: string;
  color?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statCardIcon}>{icon}</Text>
      <Text style={[styles.statCardValue, { color }]}>{value}</Text>
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
            tintColor="#2563EB"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Good {getTimeOfDay()}, Inspector
            </Text>
            <Text style={styles.userName}>{user?.email ?? "Field Inspector"}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{(user?.role ?? "inspector").toUpperCase()}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            testID="logout-button"
          >
            <Text style={styles.logoutText}>↪ Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Network / Sync status */}
        <View
          style={[
            styles.networkBanner,
            { borderColor: stats?.online ? "#22C55E" : "#F59E0B" },
          ]}
        >
          <View style={styles.networkBannerLeft}>
            <View
              style={[
                styles.networkDot,
                { backgroundColor: stats?.online ? "#22C55E" : "#F59E0B" },
              ]}
            />
            <Text style={styles.networkBannerText}>
              {stats?.online
                ? `Online — ${stats.pendingCount} observation(s) ready to sync`
                : `Offline — ${stats?.pendingCount ?? 0} observation(s) queued`}
            </Text>
          </View>
          {stats && !stats.online && stats.pendingCount > 0 && (
            <TouchableOpacity
              onPress={() => navigation.navigate("Queue")}
              style={styles.viewQueueLink}
            >
              <Text style={styles.viewQueueText}>View →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          <StatCard
            value={stats?.totalToday ?? 0}
            label="Today's Reports"
            icon="📋"
            color="#60A5FA"
          />
          <StatCard
            value={stats?.highRiskCount ?? 0}
            label="High Risk"
            icon="🔴"
            color="#EF4444"
          />
          <StatCard
            value={`${stats?.syncPct ?? 0}%`}
            label="Sync Rate"
            icon="📡"
            color="#22C55E"
          />
        </View>

        {/* Recent Observations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Observations</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Queue")}>
              <Text style={styles.seeAllLink}>See all →</Text>
            </TouchableOpacity>
          </View>

          {(stats?.recentObservations ?? []).length === 0 ? (
            <View style={styles.emptyRecent}>
              <Text style={styles.emptyRecentText}>
                No observations logged yet. Tap + to start.
              </Text>
            </View>
          ) : (
            stats?.recentObservations.map((obs) => {
              const flagColor = FLAG_COLOR[obs.edge_flag ?? "low"];
              return (
                <View key={obs.local_id} style={[styles.recentItem, { borderLeftColor: flagColor }]}>
                  <View style={styles.recentItemContent}>
                    <Text style={styles.recentCategory}>{obs.category}</Text>
                    <Text style={styles.recentDesc} numberOfLines={1}>
                      {obs.description}
                    </Text>
                  </View>
                  <View style={styles.recentMeta}>
                    <Text style={[styles.recentFlag, { color: flagColor }]}>
                      {(obs.edge_flag ?? "low").toUpperCase()}
                    </Text>
                    <Text style={styles.recentSync}>
                      {obs.sync_status === "synced" ? "✅" : obs.sync_status === "error" ? "❌" : "⏳"}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("NewObservation")}
        testID="new-observation-fab"
        accessibilityLabel="Log new observation"
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
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
    backgroundColor: "#0F172A",
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F1F5F9",
    marginTop: 2,
    marginBottom: 6,
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#1E3A5F",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#2563EB",
  },
  roleText: {
    color: "#60A5FA",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  logoutText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  networkBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
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
    color: "#CBD5E1",
    fontSize: 12,
    flex: 1,
  },
  viewQueueLink: {
    paddingLeft: 8,
  },
  viewQueueText: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "600",
  },
  kpiGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  statCardIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  statCardValue: {
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 2,
  },
  statCardLabel: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
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
    color: "#F1F5F9",
    fontSize: 15,
    fontWeight: "700",
  },
  seeAllLink: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyRecent: {
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
  },
  emptyRecentText: {
    color: "#475569",
    fontSize: 13,
    textAlign: "center",
  },
  recentItem: {
    backgroundColor: "#1E293B",
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recentItemContent: {
    flex: 1,
    marginRight: 12,
  },
  recentCategory: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  recentDesc: {
    color: "#CBD5E1",
    fontSize: 13,
  },
  recentMeta: {
    alignItems: "flex-end",
    gap: 4,
  },
  recentFlag: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  recentSync: {
    fontSize: 14,
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  fabIcon: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 32,
  },
});
