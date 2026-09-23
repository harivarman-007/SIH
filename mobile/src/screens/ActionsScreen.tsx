/**
 * ActionsScreen.tsx
 * Field Inspector view for linked corrective actions (Phase 29):
 * - Executive Light Theme (white surfaces, slate-50 canvas, royal blue accents)
 * - Vector Ionicons (zero emojis)
 * - Strictly read-only (no action/resume buttons)
 * - Mirrors web design amber rejection banner with reason and submission round
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
import { Ionicons } from "@expo/vector-icons";
import { actionRepository } from "../db/ActionRepository";
import { pullDeltaSync } from "../sync/SyncWorker";
import { CachedAction } from "../db/schema";
import { BottomNavBar } from "../components/BottomNavBar";
import { colors, shadows } from "../theme";

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

  const getPriorityStyle = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "critical":
        return { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" };
      case "high":
        return { color: "#EA580C", bg: "#FFF7ED", border: "#FFEDD5" };
      case "medium":
        return { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" };
      case "low":
        return { color: "#0284C7", bg: "#F0F9FF", border: "#BAE6FD" };
      default:
        return { color: "#64748B", bg: "#F8FAFC", border: "#E2E8F0" };
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case "assigned":
        return { color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" };
      case "accepted":
        return { color: "#0284C7", bg: "#F0F9FF", border: "#BAE6FD" };
      case "in_progress":
        return { color: "#B45309", bg: "#FEF3C7", border: "#FDE68A" };
      case "pending_verification":
        return { color: "#7E22CE", bg: "#F3E8FF", border: "#E9D5FF" };
      case "rejected":
        return { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" };
      case "closed":
        return { color: "#047857", bg: "#ECFDF5", border: "#A7F3D0" };
      default:
        return { color: "#475569", bg: "#F1F5F9", border: "#E2E8F0" };
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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : actions.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="construct-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
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
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const st = getStatusBadge(item.status);
            const priStyle = getPriorityStyle(item.priority);
            const isRejected = item.status.toLowerCase() === "rejected" || Boolean(item.rejection_reason);

            return (
              <View style={[styles.card, shadows.sm]}>
                
                {/* Header: Code, Priority, Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.codeGroup}>
                    <Text style={styles.codeText}>{item.code}</Text>
                    <View style={[styles.priorityPill, { backgroundColor: priStyle.bg, borderColor: priStyle.border }]}>
                      <Text style={[styles.priorityText, { color: priStyle.color }]}>
                        {item.priority.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
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
                  <Ionicons name="calendar-outline" size={13} color={colors.subtext} style={{ marginRight: 4 }} />
                  <Text style={styles.metaLabel}>Remediation Deadline:</Text>
                  <Text style={styles.metaValue}>
                    {new Date(item.deadline).toLocaleDateString()} {new Date(item.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>

                {/* Rejection Banner */}
                {isRejected && (
                  <View style={styles.rejectionBanner}>
                    <View style={styles.rejectionHeader}>
                      <Ionicons name="warning-outline" size={14} color="#B45309" style={{ marginRight: 6 }} />
                      <Text style={styles.rejectionTitle}>
                        Submission Rejected (Round {item.submission_round})
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
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  codeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  codeText: {
    fontFamily: "monospace",
    fontWeight: "800",
    color: colors.primary,
    fontSize: 13,
  },
  priorityPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  titleText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 13,
    color: colors.subtext,
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 11,
    color: colors.subtext,
    fontWeight: "600",
    marginRight: 4,
  },
  metaValue: {
    fontSize: 11,
    color: colors.text,
    fontWeight: "600",
  },
  rejectionBanner: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  rejectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  rejectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#B45309",
  },
  rejectionReason: {
    fontSize: 12,
    color: "#92400E",
    fontStyle: "italic",
    lineHeight: 16,
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
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.subtext,
    textAlign: "center",
    marginTop: 4,
  },
});
