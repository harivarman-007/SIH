/**
 * InspectionsScreen.tsx
 * Field Inspector statutory inspections screen:
 * - Offline-first execution: SCHEDULED -> IN_PROGRESS -> SUBMITTED queued in local outbox
 * - Mandatory sign-off notes when submitting with zero observations (Phase 29 Rule #2)
 * - Pull-to-refresh two-way delta sync
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { inspectionRepository } from "../db/InspectionRepository";
import { pullDeltaSync } from "../sync/SyncWorker";
import { CachedInspection } from "../db/schema";
import { BottomNavBar } from "../components/BottomNavBar";

type StatusFilter = "ALL" | "SCHEDULED" | "IN_PROGRESS" | "SUBMITTED" | "CLOSED";

export default function InspectionsScreen({ navigation }: any) {
  const [inspections, setInspections] = useState<CachedInspection[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal for zero-observation mandatory sign-off notes
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [activeSubmitInspection, setActiveSubmitInspection] = useState<CachedInspection | null>(null);
  const [signOffNotes, setSignOffNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await inspectionRepository.getAll();
      setInspections(data);
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
      Alert.alert("Sync Error", err?.message || "Failed to sync delta updates.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStart = async (item: CachedInspection) => {
    Alert.alert(
      "Start Inspection",
      `Begin statutory inspection ${item.code}? Status will update locally and queue for sync.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start",
          onPress: async () => {
            try {
              await inspectionRepository.startInspectionLocal(item.id);
              await loadData();
              Alert.alert("Started", `Inspection ${item.code} is now IN PROGRESS.`);
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Failed to start inspection.");
            }
          },
        },
      ]
    );
  };

  const handleSubmitPress = (item: CachedInspection) => {
    if (item.observation_count === 0) {
      // Mandatory sign-off notes required per Phase 29 Rule #2
      setActiveSubmitInspection(item);
      setSignOffNotes("");
      setSubmitModalVisible(true);
    } else {
      Alert.alert(
        "Submit Inspection Report",
        `Submit inspection ${item.code} with ${item.observation_count} observation(s) for manager review?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Submit",
            onPress: async () => {
              try {
                await inspectionRepository.submitInspectionLocal(item.id);
                await loadData();
                Alert.alert("Submitted", `Inspection ${item.code} report submitted!`);
              } catch (err: any) {
                Alert.alert("Error", err?.message || "Failed to submit inspection.");
              }
            },
          },
        ]
      );
    }
  };

  const handleConfirmZeroObsSubmit = async () => {
    if (!signOffNotes.trim()) {
      Alert.alert("Required", "Mandatory sign-off notes are required when submitting an inspection with 0 observations.");
      return;
    }

    if (!activeSubmitInspection) return;

    setSubmitting(true);
    try {
      await inspectionRepository.submitInspectionLocal(activeSubmitInspection.id, signOffNotes.trim());
      setSubmitModalVisible(false);
      await loadData();
      Alert.alert("Submitted", `Inspection ${activeSubmitInspection.code} submitted with sign-off certification!`);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to submit inspection.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = inspections.filter((i) => {
    if (filter === "ALL") return true;
    return i.status.toUpperCase() === filter;
  });

  const getStatusStyle = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case "scheduled":
        return { color: "#60A5FA", bg: "#1E3A8A" };
      case "in_progress":
        return { color: "#F59E0B", bg: "#78350F" };
      case "submitted":
        return { color: "#C084FC", bg: "#581C87" };
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
        <Text style={styles.headerTitle}>Statutory Inspections</Text>
        <Text style={styles.headerSubtitle}>
          Assigned field inspection lifecycle & offline outbox
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(["ALL", "SCHEDULED", "IN_PROGRESS", "SUBMITTED", "CLOSED"] as StatusFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.activeFilterChip]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.activeFilterText]}>
              {f.replace("_", " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Inspection List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Inspections Found</Text>
          <Text style={styles.emptySubtitle}>
            Pull down to sync assigned inspections from server
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
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
            const st = getStatusStyle(item.status);
            const isScheduled = item.status.toLowerCase() === "scheduled";
            const isInProgress = item.status.toLowerCase() === "in_progress";

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.codeText}>{item.code}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>
                      {item.status.replace("_", " ").toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.titleText}>{item.title}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Scheduled:</Text>
                  <Text style={styles.metaValue}>
                    {new Date(item.scheduled_for).toLocaleDateString()}
                  </Text>
                  <Text style={[styles.metaLabel, { marginLeft: 12 }]}>Due:</Text>
                  <Text style={styles.metaValue}>
                    {new Date(item.due_at).toLocaleDateString()}
                  </Text>
                </View>

                {/* Observation Count indicator */}
                <View style={styles.obsBadgeRow}>
                  <Text style={styles.obsBadgeText}>
                    🔍 {item.observation_count} Observation(s) Linked
                  </Text>
                  {item.notes && (
                    <Text style={styles.notesExcerpt} numberOfLines={1}>
                      📝 {item.notes}
                    </Text>
                  )}
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  {isScheduled && (
                    <TouchableOpacity
                      style={styles.startBtn}
                      activeOpacity={0.8}
                      onPress={() => handleStart(item)}
                    >
                      <Text style={styles.startBtnText}>▶ Start Inspection</Text>
                    </TouchableOpacity>
                  )}

                  {isInProgress && (
                    <View style={styles.inProgressActionGroup}>
                      <TouchableOpacity
                        style={styles.addObsBtn}
                        activeOpacity={0.8}
                        onPress={() =>
                          navigation.navigate("NewObservation", {
                            inspectionId: item.id,
                            inspectionCode: item.code,
                          })
                        }
                      >
                        <Text style={styles.addObsBtnText}>➕ Add Observation</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.submitBtn}
                        activeOpacity={0.8}
                        onPress={() => handleSubmitPress(item)}
                      >
                        <Text style={styles.submitBtnText}>✓ Submit Report</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Mandatory Sign-Off Modal for 0 Observations */}
      <Modal
        visible={submitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSubmitModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Zero-Violation Sign-Off</Text>
            <Text style={styles.modalDescription}>
              This inspection ({activeSubmitInspection?.code}) has 0 recorded observations. Per DGMS regulations, submitting a clean inspection requires mandatory certification notes.
            </Text>

            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={4}
              placeholder="Enter statutory sign-off notes (e.g., sector surveyed, all gas levels safe, bulkheads sealed)..."
              placeholderTextColor="#64748B"
              value={signOffNotes}
              onChangeText={setSignOffNotes}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSubmitModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, !signOffNotes.trim() && styles.disabledBtn]}
                disabled={submitting || !signOffNotes.trim()}
                onPress={handleConfirmZeroObsSubmit}
              >
                {submitting ? (
                  <ActivityIndicator color="#0F172A" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Certify & Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <BottomNavBar currentRoute="Inspections" navigation={navigation} />

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
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
  },
  activeFilterChip: {
    backgroundColor: "#F59E0B",
    borderColor: "#D97706",
  },
  filterText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
  },
  activeFilterText: {
    color: "#0F172A",
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
  codeText: {
    fontFamily: "monospace",
    fontWeight: "800",
    color: "#F59E0B",
    fontSize: 13,
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
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
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
  obsBadgeRow: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  obsBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#38BDF8",
  },
  notesExcerpt: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 4,
  },
  actionsRow: {
    marginTop: 4,
  },
  startBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  startBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  inProgressActionGroup: {
    flexDirection: "row",
    gap: 8,
  },
  addObsBtn: {
    flex: 1,
    backgroundColor: "#0EA5E9",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  addObsBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: "#16A34A",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#334155",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 16,
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: "#0F172A",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 12,
    color: "#FFFFFF",
    fontSize: 12,
    textAlignVertical: "top",
    minHeight: 90,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#334155",
  },
  modalCancelText: {
    color: "#F1F5F9",
    fontWeight: "700",
    fontSize: 12,
  },
  modalConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F59E0B",
  },
  modalConfirmText: {
    color: "#0F172A",
    fontWeight: "800",
    fontSize: 12,
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
