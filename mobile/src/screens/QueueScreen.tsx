/**
 * QueueScreen.tsx
 * Lists all locally stored observations with sync status.
 * Provides manual "Sync Now" trigger and sync% progress bar.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LocalObservation } from "../db/schema";
import { observationRepository } from "../db/ObservationRepository";
import { triggerManualSync, isOnline } from "../sync/TaskManager";
import { getSyncStats } from "../sync/SyncWorker";
import { useConnectivityStore } from "../store/useConnectivity";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { BottomNavBar } from "../components/BottomNavBar";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Queue">;
};

interface SyncStats {
  total: number;
  synced: number;
  pending: number;
  error: number;
  syncPct: number;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  pending: { color: "#F59E0B", bg: "#78350F20", icon: "⏳" },
  synced: { color: "#22C55E", bg: "#14532D20", icon: "✅" },
  error: { color: "#EF4444", bg: "#7F1D1D20", icon: "❌" },
};

const FLAG_COLOR: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#22C55E",
};

function ObservationCard({ obs }: { obs: LocalObservation }) {
  const statusCfg = STATUS_CONFIG[obs.sync_status] ?? STATUS_CONFIG.pending;
  const flagColor = FLAG_COLOR[obs.edge_flag ?? "low"];
  const dateStr = new Date(obs.created_at).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={[styles.obsCard, { borderLeftColor: flagColor }]}>
      <View style={styles.obsCardHeader}>
        <View style={styles.obsCardLeft}>
          <Text style={[styles.obsFlagBadge, { color: flagColor }]}>
            {(obs.edge_flag ?? "low").toUpperCase()}
          </Text>
          <Text style={styles.obsCategory}>{obs.category}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.statusText, { color: statusCfg.color }]}>
            {statusCfg.icon} {obs.sync_status}
          </Text>
        </View>
      </View>
      <Text style={styles.obsDescription} numberOfLines={2}>
        {obs.description}
      </Text>
      <View style={styles.obsCardFooter}>
        <Text style={styles.obsDate}>{dateStr}</Text>
        {obs.edge_score !== null && (
          <Text style={[styles.obsScore, { color: flagColor }]}>
            Score: {(obs.edge_score * 100).toFixed(0)}%
          </Text>
        )}
      </View>
      {obs.last_error && (
        <Text style={styles.errorText} numberOfLines={1}>
          ⚠️ {obs.last_error}
        </Text>
      )}
    </View>
  );
}

export default function QueueScreen({ navigation }: Props) {
  const [observations, setObservations] = useState<LocalObservation[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<boolean | null>(null);
  const { simulateOffline, toggleSimulateOffline } = useConnectivityStore();

  const loadData = useCallback(async () => {
    const [obs, syncStats, online] = await Promise.all([
      observationRepository.getAll(),
      getSyncStats(),
      isOnline(),
    ]);
    setObservations(obs);
    setStats(syncStats);
    setNetworkStatus(online);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const result = await triggerManualSync();
      await loadData();
      let summaryMsg = `✅ Synced ${result.succeeded} observations.`;
      if (result.outboxSucceeded > 0) {
        summaryMsg += `\n📋 Synced ${result.outboxSucceeded} inspection events.`;
      }
      if (result.deltaInspections > 0 || result.deltaActions > 0) {
        summaryMsg += `\n🔄 Pulled ${result.deltaInspections} inspections, ${result.deltaActions} actions.`;
      }
      if (result.failed > 0 || result.outboxFailed > 0) {
        summaryMsg += `\n⚠️ Failures: ${result.failed + result.outboxFailed}.`;
      }
      Alert.alert("Two-Way Sync Complete", summaryMsg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed. Check connection.";
      Alert.alert("Sync Failed", msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncPct = stats?.syncPct ?? 0;

  return (
    <View style={styles.container}>
      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats?.total ?? 0}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#22C55E" }]}>{stats?.synced ?? 0}</Text>
          <Text style={styles.statLabel}>Synced</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#F59E0B" }]}>{stats?.pending ?? 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#EF4444" }]}>{stats?.error ?? 0}</Text>
          <Text style={styles.statLabel}>Error</Text>
        </View>
      </View>

      {/* Sync Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Sync Rate</Text>
          <Text style={styles.progressPct}>{syncPct}%</Text>
        </View>
        <View style={styles.progressBarOuter}>
          <View style={[styles.progressBarInner, { width: `${syncPct}%` }]} />
        </View>
      </View>

      {/* Network Status + Sync Button */}
      {/* Demo Offline Simulator Toggle */}
      <View style={styles.demoToggleRow}>
        <View style={styles.demoToggleLeft}>
          <Text style={styles.demoToggleLabel}>🧪 DEMO: Simulate Offline</Text>
          <Text style={styles.demoToggleHint}>Blocks all sync calls without disabling Wi-Fi</Text>
        </View>
        <Switch
          value={simulateOffline}
          onValueChange={toggleSimulateOffline}
          trackColor={{ false: "#334155", true: "#EF4444" }}
          thumbColor="#FFFFFF"
          testID="offline-toggle"
        />
      </View>

      <View style={styles.syncSection}>
        <View style={styles.networkIndicator}>
          <View
            style={[
              styles.networkDot,
              {
                backgroundColor: simulateOffline
                  ? "#EF4444"
                  : networkStatus === true
                  ? "#22C55E"
                  : networkStatus === false
                  ? "#EF4444"
                  : "#6B7280",
              },
            ]}
          />
          <Text style={styles.networkLabel}>
            {simulateOffline
              ? "Offline (simulated)"
              : networkStatus === true
              ? "Online"
              : networkStatus === false
              ? "Offline"
              : "Checking..."}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
          onPress={handleSyncNow}
          disabled={isSyncing}
          testID="sync-now-button"
        >
          {isSyncing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.syncButtonText}>📤 Sync Now</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Observation List */}
      <FlatList
        data={observations}
        keyExtractor={(item) => String(item.local_id)}
        renderItem={({ item }) => <ObservationCard obs={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#2563EB"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No observations yet</Text>
            <Text style={styles.emptySubtitle}>
              Log your first inspection observation to get started.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate("NewObservation")}
            >
              <Text style={styles.emptyButtonText}>+ New Observation</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Persistent Bottom Navigation */}
      <BottomNavBar currentRoute="Queue" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  statsBar: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#F1F5F9",
  },
  statLabel: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  progressSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  progressPct: {
    color: "#60A5FA",
    fontSize: 12,
    fontWeight: "700",
  },
  progressBarOuter: {
    height: 8,
    backgroundColor: "#334155",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarInner: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 4,
  },
  demoToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: "#1C1917",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#EF4444",
    borderStyle: "dashed",
  },
  demoToggleLeft: {
    flex: 1,
    marginRight: 12,
  },
  demoToggleLabel: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  demoToggleHint: {
    color: "#6B7280",
    fontSize: 10,
    marginTop: 2,
  },
  syncSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  networkIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  networkLabel: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
  },
  syncButton: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 110,
    alignItems: "center",
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
  },
  obsCard: {
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#334155",
  },
  obsCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  obsCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  obsFlagBadge: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  obsCategory: {
    color: "#64748B",
    fontSize: 11,
    textTransform: "capitalize",
  },
  statusBadge: {
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  obsDescription: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  obsCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  obsDate: {
    color: "#475569",
    fontSize: 11,
  },
  obsScore: {
    fontSize: 11,
    fontWeight: "700",
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 11,
    marginTop: 6,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#F1F5F9",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
