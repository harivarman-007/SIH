/**
 * QueueScreen.tsx
 * Lists all locally stored observations with sync status:
 * - Executive Light Theme (white surfaces, slate-50 canvas, royal blue accents)
 * - Vector Ionicons (zero emojis)
 * - Provides manual "Sync Now" trigger and sync% progress bar.
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
import { Ionicons } from "@expo/vector-icons";
import { LocalObservation } from "../db/schema";
import { observationRepository } from "../db/ObservationRepository";
import { triggerManualSync, isOnline } from "../sync/TaskManager";
import { getSyncStats } from "../sync/SyncWorker";
import { useConnectivityStore } from "../store/useConnectivity";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { BottomNavBar } from "../components/BottomNavBar";
import { colors, shadows } from "../theme";

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

const STATUS_CONFIG: Record<
  string,
  {
    color: string;
    bg: string;
    border: string;
    iconName: keyof typeof Ionicons.glyphMap;
  }
> = {
  pending: {
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    iconName: "time-outline",
  },
  synced: {
    color: "#16A34A",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    iconName: "checkmark-circle-outline",
  },
  error: {
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#FECACA",
    iconName: "alert-circle-outline",
  },
};

const FLAG_COLOR: Record<string, string> = {
  high: "#DC2626",
  medium: "#D97706",
  low: "#16A34A",
};

function ObservationCard({ obs }: { obs: LocalObservation }) {
  const statusCfg = STATUS_CONFIG[obs.sync_status] ?? STATUS_CONFIG.pending;
  const flagColor = FLAG_COLOR[obs.edge_flag ?? "low"] || "#16A34A";
  const dateStr = new Date(obs.created_at).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={[styles.obsCard, { borderLeftColor: flagColor }, shadows.sm]}>
      <View style={styles.obsCardHeader}>
        <View style={styles.obsCardLeft}>
          <Text style={[styles.obsFlagBadge, { color: flagColor }]}>
            {(obs.edge_flag ?? "low").toUpperCase()}
          </Text>
          <Text style={styles.obsCategory}>{obs.category}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {obs.compliance_status ? (
            <View
              style={[
                styles.statusBadge,
                obs.compliance_status === "violation"
                  ? { backgroundColor: colors.dangerLight, borderColor: colors.dangerBorder }
                  : { backgroundColor: colors.successLight, borderColor: colors.successBorder },
              ]}
            >
              <Ionicons
                name={obs.compliance_status === "violation" ? "alert-circle" : "shield-checkmark"}
                size={11}
                color={obs.compliance_status === "violation" ? colors.dangerText : colors.successText}
                style={{ marginRight: 3 }}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: obs.compliance_status === "violation" ? colors.dangerText : colors.successText },
                ]}
              >
                {obs.compliance_status.toUpperCase()}
              </Text>
            </View>
          ) : null}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusCfg.bg, borderColor: statusCfg.border },
            ]}
          >
            <Ionicons
              name={statusCfg.iconName}
              size={12}
              color={statusCfg.color}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.statusText, { color: statusCfg.color }]}>
              {obs.sync_status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.obsDescription} numberOfLines={2}>
        {obs.description}
      </Text>
      <View style={styles.obsCardFooter}>
        <Text style={styles.obsDate}>{dateStr}</Text>
        {obs.edge_score !== null && (
          <Text style={[styles.obsScore, { color: flagColor }]}>
            Risk Score: {(obs.edge_score * 100).toFixed(0)}%
          </Text>
        )}
      </View>
      {obs.last_error && (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={12} color="#DC2626" style={{ marginRight: 4 }} />
          <Text style={styles.errorText} numberOfLines={1}>
            {obs.last_error}
          </Text>
        </View>
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
      let summaryMsg = `Synced ${result.succeeded} observations.`;
      if (result.outboxSucceeded > 0) {
        summaryMsg += `\nSynced ${result.outboxSucceeded} inspection events.`;
      }
      if (result.deltaInspections > 0 || result.deltaActions > 0) {
        summaryMsg += `\nPulled ${result.deltaInspections} inspections, ${result.deltaActions} actions.`;
      }
      if (result.failed > 0 || result.outboxFailed > 0) {
        summaryMsg += `\nFailures: ${result.failed + result.outboxFailed}.`;
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Offline Sync Outbox</Text>
        <Text style={styles.headerSubtitle}>
          Local SQLite mutations queued for cloud reconciliation
        </Text>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats?.total ?? 0}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#16A34A" }]}>{stats?.synced ?? 0}</Text>
          <Text style={styles.statLabel}>Synced</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#D97706" }]}>{stats?.pending ?? 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: "#DC2626" }]}>{stats?.error ?? 0}</Text>
          <Text style={styles.statLabel}>Error</Text>
        </View>
      </View>

      {/* Sync Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Reconciliation Rate</Text>
          <Text style={styles.progressPct}>{syncPct}%</Text>
        </View>
        <View style={styles.progressBarOuter}>
          <View style={[styles.progressBarInner, { width: `${syncPct}%` }]} />
        </View>
      </View>

      {/* Demo Offline Simulator Toggle */}
      <View style={styles.demoToggleRow}>
        <View style={styles.demoToggleLeft}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="beaker-outline" size={14} color="#B45309" />
            <Text style={styles.demoToggleLabel}>DEMO: Simulate Offline</Text>
          </View>
          <Text style={styles.demoToggleHint}>Blocks all sync calls without disabling device Wi-Fi</Text>
        </View>
        <Switch
          value={simulateOffline}
          onValueChange={toggleSimulateOffline}
          trackColor={{ false: "#E2E8F0", true: "#DC2626" }}
          thumbColor="#FFFFFF"
          testID="offline-toggle"
        />
      </View>

      {/* Network Status + Sync Button */}
      <View style={styles.syncSection}>
        <View style={styles.networkIndicator}>
          <View
            style={[
              styles.networkDot,
              {
                backgroundColor: simulateOffline
                  ? "#DC2626"
                  : networkStatus === true
                  ? "#16A34A"
                  : networkStatus === false
                  ? "#DC2626"
                  : "#94A3B8",
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
          style={[styles.syncButton, isSyncing && styles.syncButtonDisabled, shadows.sm]}
          onPress={handleSyncNow}
          disabled={isSyncing}
          testID="sync-now-button"
          activeOpacity={0.8}
        >
          {isSyncing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="cloud-upload-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.syncButtonText}>Sync Now</Text>
            </View>
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
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cloud-done-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No Observations in Queue</Text>
            <Text style={styles.emptySubtitle}>
              Log field hazard observations or run an inspection to populate the outbox.
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, shadows.sm]}
              onPress={() => navigation.navigate("NewObservation")}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.emptyButtonText}>New Observation</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Bottom Navigation */}
      <BottomNavBar currentRoute="Queue" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.subtext,
    marginTop: 2,
  },
  statsBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  statLabel: {
    fontSize: 10,
    color: colors.subtext,
    marginTop: 2,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  progressSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: colors.surface,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: {
    color: colors.subtext,
    fontSize: 12,
    fontWeight: "600",
  },
  progressPct: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  progressBarOuter: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarInner: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  demoToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  demoToggleLeft: {
    flex: 1,
    marginRight: 12,
  },
  demoToggleLabel: {
    color: "#B45309",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  demoToggleHint: {
    color: "#92400E",
    fontSize: 11,
    marginTop: 2,
  },
  syncSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    color: colors.subtext,
    fontSize: 12,
    fontWeight: "600",
  },
  syncButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
  },
  obsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border,
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
    letterSpacing: 0.6,
  },
  obsCategory: {
    color: colors.subtext,
    fontSize: 11,
    textTransform: "capitalize",
    fontWeight: "600",
  },
  statusBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  obsDescription: {
    color: colors.text,
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
    color: colors.subtext,
    fontSize: 11,
  },
  obsScore: {
    fontSize: 11,
    fontWeight: "700",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 6,
    marginTop: 6,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 11,
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 48,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.subtext,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
});
