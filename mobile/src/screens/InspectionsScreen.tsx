/**
 * InspectionsScreen.tsx
 * Field Inspector statutory inspections screen:
 * - Executive Light Theme (white surfaces, slate-50 canvas, royal blue accents)
 * - Offline-first execution: SCHEDULED -> IN_PROGRESS -> SUBMITTED queued in local outbox
 * - Mandatory sign-off notes when submitting with zero observations (Phase 29 Rule #2)
 * - Pull-to-refresh two-way delta sync
 */

import React, { useState, useCallback } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { inspectionRepository } from "../db/InspectionRepository";
import { pullDeltaSync } from "../sync/SyncWorker";
import { CachedInspection } from "../db/schema";
import { BottomNavBar } from "../components/BottomNavBar";
import { colors, shadows } from "../theme";

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
        return { color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" };
      case "in_progress":
        return { color: "#B45309", bg: "#FEF3C7", border: "#FDE68A" };
      case "submitted":
        return { color: "#7E22CE", bg: "#F3E8FF", border: "#E9D5FF" };
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
        <Text style={styles.headerTitle}>Statutory Inspections</Text>
        <Text style={styles.headerSubtitle}>
          Assigned field inspection lifecycle & offline outbox
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(["ALL", "SCHEDULED", "IN_PROGRESS", "SUBMITTED", "CLOSED"] as StatusFilter[]).map((f) => {
          const isActive = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, isActive && styles.activeFilterChip]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
                {f.replace("_", " ")}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Inspection List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="clipboard-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
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
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const st = getStatusStyle(item.status);
            const isScheduled = item.status.toLowerCase() === "scheduled";
            const isInProgress = item.status.toLowerCase() === "in_progress";

            return (
              <View style={[styles.card, shadows.sm]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.codeText}>{item.code}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
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
                  <Text style={[styles.metaLabel, { marginLeft: 14 }]}>Due:</Text>
                  <Text style={styles.metaValue}>
                    {new Date(item.due_at).toLocaleDateString()}
                  </Text>
                </View>

                {/* Observation Count indicator */}
                <View style={styles.obsBadgeRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="search-outline" size={13} color={colors.primary} />
                    <Text style={styles.obsBadgeText}>
                      {item.observation_count} Observation(s) Linked
                    </Text>
                  </View>
                  {item.notes && (
                    <Text style={styles.notesExcerpt} numberOfLines={1}>
                      {item.notes}
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
                      <Ionicons name="play" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.startBtnText}>Start Inspection</Text>
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
                        <Ionicons name="add" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.addObsBtnText}>Add Observation</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.submitBtn}
                        activeOpacity={0.8}
                        onPress={() => handleSubmitPress(item)}
                      >
                        <Ionicons name="checkmark-done" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.submitBtnText}>Submit Report</Text>
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
          <View style={[styles.modalCard, shadows.lg]}>
            <Text style={styles.modalTitle}>Zero-Violation Sign-Off</Text>
            <Text style={styles.modalDescription}>
              This inspection ({activeSubmitInspection?.code}) has 0 recorded observations. Per DGMS regulations, submitting a clean inspection requires mandatory certification notes.
            </Text>

            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={4}
              placeholder="Enter statutory sign-off notes (e.g., sector surveyed, all gas levels safe, bulkheads sealed)..."
              placeholderTextColor="#94A3B8"
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
                  <ActivityIndicator color="#FFFFFF" size="small" />
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
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    flexWrap: "wrap",
    backgroundColor: colors.background,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.subtext,
  },
  activeFilterText: {
    color: "#FFFFFF",
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
  codeText: {
    fontFamily: "monospace",
    fontWeight: "800",
    color: colors.primary,
    fontSize: 13,
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
    letterSpacing: 0.4,
  },
  titleText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
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
  obsBadgeRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  obsBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  notesExcerpt: {
    fontSize: 11,
    color: colors.subtext,
    marginTop: 4,
    fontStyle: "italic",
  },
  actionsRow: {
    marginTop: 2,
  },
  startBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  startBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  inProgressActionGroup: {
    flexDirection: "row",
    gap: 8,
  },
  addObsBtn: {
    flex: 1,
    backgroundColor: "#0284C7",
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  addObsBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: "#16A34A",
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
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
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 12,
    color: colors.subtext,
    lineHeight: 17,
    marginBottom: 14,
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.text,
    fontSize: 13,
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
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    color: colors.subtext,
    fontWeight: "700",
    fontSize: 12,
  },
  modalConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  modalConfirmText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
