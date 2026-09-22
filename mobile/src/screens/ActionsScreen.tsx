/**
 * ActionsScreen.tsx
 * Field Inspector view for linked corrective actions (Phase 29):
 * - Strictly read-only (no action/resume buttons)
 * - Mirrors web design Q4 amber rejection banner with reason and submission round
 * - Pull-to-refresh two-way delta sync
 */

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { actionRepository } from "../db/ActionRepository";
import { pullDeltaSync } from "../sync/SyncWorker";
import { CachedAction } from "../db/schema";
import { BottomNavBar } from "../components/BottomNavBar";

export default function ActionsScreen({ navigation }: any) {
  const [actions, setActions] = useState<CachedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await actionRepository.getAll();
      setActions(data);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await pullDeltaSync(true);
      await loadData();
    } catch (err: any) {
      Alert.alert("Sync Error", err?.message || "Failed to sync actions.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "critical":
        return "#EF4444";
      case "high":
        return "#F87171";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#38BDF8";
      default:
        return "#94A3B8";
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case "assigned":
        return { color: "#60A5FA", bg: "#1E3A8A" };
      case "accepted":
        return { color: "#38BDF8", bg: "#0369A1" };
      case "in_progress":
        return { color: "#F59E0B", bg: "#78350F" };
      case "pending_verification":
        return { color: "#C084FC", bg: "#581C87" };
      case "rejected":
        return { color: "#F87171", bg: "#7F1D1D" };
      case "closed":
        return { color: "#22C55E", bg: "#14532D" };
      default:
        return { color: "#94A3B8", bg: "#334155" };
    }
  };

  return (
    <View style={styles.screen}>
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Corrective Actions</Text>
        <Text style={styles.headerSubtitle}>
          Remediation tracking linked to your statutory observations
        </Text>
      </View>

      {/* Action List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : actions.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>🛠️</Text>
          <Text style={styles.emptyTitle}>No Corrective Actions</Text>
          <Text style={styles.emptySubtitle}>
            Corrective actions assigned by mine management will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={actions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#F59E0B"
            />
          }
          renderItem={({ item }) => {
            const st = getStatusBadge(item.status);
            const priColor = getPriorityColor(item.priority);
            const isRejected = item.status.toLowerCase() === "rejected" || Boolean(item.rejection_reason);

            return (
              <View style={styles.card}>
                
                {/* Header: Code, Priority, Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.codeGroup}>
                    <Text style={styles.codeText}>{item.code}</Text>
                    <View style={[styles.priorityPill, { borderColor: priColor }]}>
                      <Text style={[styles.priorityText, { color: priColor }]}>
                        {item.priority.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>
                      {item.status.replace("_", " ").toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Title and Description */}
                <Text style={styles.titleText}>{item.title}</Text>
                <Text style={styles.descriptionText} numberOfLines={3}>
                  {item.description}
                </Text>

                {/* Meta: Deadline */}
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Remediation Deadline:</Text>
                  <Text style={styles.metaValue}>
                    {new Date(item.deadline).toLocaleDateString()} {new Date(item.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>

                {/* Q4 Amber Rejection Banner (mirroring web design exactly per Answer #3) */}
                {isRejected && (
                  <View style={styles.rejectionBanner}>
                    <View style={styles.rejectionHeader}>
                      <Text style={styles.rejectionTitle}>
                        ⚠️ Submission Rejected (Round {item.submission_round})
                      </Text>
                    </View>
                    <Text style={styles.rejectionReason}>
                      &ldquo;{item.rejection_reason || "Remediation evidence failed verification audit."}&rdquo;
                    </Text>
                    <Text style={styles.rejectionFooter}>
                      Status: Awaiting contractor re-work and evidence resubmission
                    </Text>
                  </View>
                )}

              </View>
            );
          }}
        />
      )}

      {/* Bottom Navigation */}
      <BottomNavBar currentRoute="Actions" navigation={navigation} />

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  codeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  codeText: {
    fontFamily: "monospace",
    fontWeight: "800",
    color: "#F59E0B",
    fontSize: 13,
  },
  priorityPill: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: "800",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  titleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 16,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginRight: 4,
  },
  metaValue: {
    fontSize: 11,
    color: "#CBD5E1",
    fontWeight: "600",
  },
  rejectionBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  rejectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  rejectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#F59E0B",
  },
  rejectionReason: {
    fontSize: 11,
    color: "#FDE68A",
    fontStyle: "italic",
    lineHeight: 15,
    marginBottom: 4,
  },
  rejectionFooter: {
    fontSize: 10,
    color: "#D97706",
    fontWeight: "600",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F1F5F9",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },
});
