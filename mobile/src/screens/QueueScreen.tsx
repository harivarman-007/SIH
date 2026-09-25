/**
 * QueueScreen.tsx
 * Lists all locally stored observations with sync status:
 * - Executive Light Theme (white surfaces, slate-50 canvas, royal blue accents)
 * - Vector Ionicons (zero emojis)
 * - Provides manual "Sync Now" trigger and sync% progress bar.
 */

import React, { useState, useCallback, useEffect } from "react";
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
  Modal,
  TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LocalObservation } from "../db/schema";
import { observationRepository } from "../db/ObservationRepository";
import { triggerManualSync, isOnline } from "../sync/TaskManager";
import { getSyncStats, resetSyncWatermark } from "../sync/SyncWorker";
import { useConnectivityStore } from "../store/useConnectivity";
import { getActiveBackendUrl, setActiveBackendUrl, DEFAULT_BACKEND_URL } from "../api/client";
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
  const [isFullSyncing, setIsFullSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<boolean | null>(null);
  const { simulateOffline, toggleSimulateOffline } = useConnectivityStore();

  // Server switching modal
  const [currentServer, setCurrentServer] = useState<string>(getActiveBackendUrl());
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [customServerInput, setCustomServerInput] = useState("");
  const [isTestingServer, setIsTestingServer] = useState(false);

  const loadData = useCallback(async () => {
    const [obs, syncStats, online] = await Promise.all([
      observationRepository.getAll(),
      getSyncStats(),
      isOnline(),
    ]);
    setObservations(obs);
    setStats(syncStats);
    setNetworkStatus(online);
    setCurrentServer(getActiveBackendUrl());
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
      const result = await triggerManualSync(false);
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

  const handleForceFullSync = async () => {
    Alert.alert(
      "Force Full Re-Sync",
      "This will reset the sync watermark and pull all inspections, actions, and observations from the server.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Proceed",
          onPress: async () => {
            setIsFullSyncing(true);
            try {
              const result = await triggerManualSync(true);
              await loadData();
              Alert.alert(
                "Full Re-Sync Complete",
                `Pulled ${result.deltaInspections} inspections and ${result.deltaActions} actions.\nOutbox: ${result.outboxSucceeded} synced, ${result.succeeded} observations synced.`
              );
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Full re-sync failed.";
              Alert.alert("Re-Sync Error", msg);
            } finally {
              setIsFullSyncing(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenServerModal = () => {
    setCustomServerInput(currentServer);
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
      // Test connectivity by pinging health endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      try {
        const resp = await fetch(`${clean}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!resp.ok && resp.status !== 404) {
          // If server responded with any HTTP status, it exists
        }
      } catch {
        // Warning if unreachable, but allow user to confirm
      }

      await setActiveBackendUrl(clean);
      setCurrentServer(clean);
      setServerModalVisible(false);
      Alert.alert(
        "Sync Server Updated",
        `Backend set to:\n${clean}\n\nTip: You can now trigger 'Force Full Re-Sync' to pull data from this server.`
      );
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update server URL.";
      Alert.alert("Server Config Error", msg);
    } finally {
      setIsTestingServer(false);
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

      {/* Server & Connectivity Settings Bar */}
      <View style={styles.serverCard}>
        <View style={styles.serverRow}>
          <View style={styles.serverLeft}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="server-outline" size={14} color={colors.primary} />
              <Text style={styles.serverLabel}>BACKEND SYNC SERVER</Text>
            </View>
            <Text style={styles.serverUrlText} numberOfLines={1}>
              {currentServer}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.changeServerBtn}
            onPress={handleOpenServerModal}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.changeServerBtnText}>Change</Text>
          </TouchableOpacity>
        </View>
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

      {/* Network Status + Action Buttons */}
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
              ? "Offline (sim)"
              : networkStatus === true
              ? "Online"
              : networkStatus === false
              ? "Offline"
              : "Checking..."}
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={[styles.fullSyncButton, isFullSyncing && styles.syncButtonDisabled, shadows.sm]}
            onPress={handleForceFullSync}
            disabled={isFullSyncing || isSyncing}
            activeOpacity={0.8}
          >
            {isFullSyncing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="refresh" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.fullSyncButtonText}>Full Re-Sync</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.syncButton, (isSyncing || isFullSyncing) && styles.syncButtonDisabled, shadows.sm]}
            onPress={handleSyncNow}
            disabled={isSyncing || isFullSyncing}
            testID="sync-now-button"
            activeOpacity={0.8}
          >
            {isSyncing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="cloud-upload-outline" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.syncButtonText}>Sync Now</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
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

      {/* Modal: Change Sync Server */}
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
              <Text style={styles.modalTitle}>Change Sync Server</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Configure the cloud or edge backend URL for mobile delta sync and outbox reconciliation.
            </Text>

            <Text style={styles.inputLabel}>SERVER URL</Text>
            <TextInput
              style={styles.serverInput}
              value={customServerInput}
              onChangeText={setCustomServerInput}
              placeholder="http://10.178.236.88:8000"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {/* Quick Presets */}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>QUICK PRESETS</Text>
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
  serverCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  serverLeft: {
    flex: 1,
    marginRight: 10,
  },
  serverLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: colors.primary,
  },
  serverUrlText: {
    fontSize: 12,
    color: colors.text,
    fontFamily: "monospace",
    marginTop: 2,
  },
  changeServerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  changeServerBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  fullSyncButton: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  fullSyncButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
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
    borderRadius: 16,
    padding: 20,
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
    color: colors.subtext,
    lineHeight: 17,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: colors.subtext,
    marginBottom: 6,
  },
  serverInput: {
    backgroundColor: "#F8FAFC",
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
    color: colors.subtext,
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
