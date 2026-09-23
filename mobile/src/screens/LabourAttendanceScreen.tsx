/**
 * LabourAttendanceScreen.tsx
 * Statutory Labour Attendance Register & Outbox for Mine Officials.
 * Decoupled Worker Master Directory lookup with offline SQLite caching.
 * Role-gated: Only mine_official role can access this screen.
 * Executive Light Theme with vector Ionicons.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { labourRepository } from "../db/LabourRepository";
import { workerRepository } from "../db/WorkerRepository";
import { LocalLabourAttendance, LocalWorker } from "../db/schema";
import { submitAttendance, fetchWorkersList } from "../api/labour";
import { useAuthStore } from "../store/authStore";
import { isOnline } from "../sync/TaskManager";
import { colors, shadows } from "../theme";

export default function LabourAttendanceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuthStore();

  // Role Gate: strictly mine_official
  const isMineOfficial = user?.role === "mine_official";

  const [records, setRecords] = useState<LocalLabourAttendance[]>([]);
  const [workers, setWorkers] = useState<LocalWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [selectedWorker, setSelectedWorker] = useState<LocalWorker | null>(null);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");
  const [shiftType, setShiftType] = useState<"day" | "night">("day");
  const [clockInTime, setClockInTime] = useState("08:00");
  const [clockOutTime, setClockOutTime] = useState("16:30");

  const loadData = useCallback(async () => {
    if (!isMineOfficial) {
      setLoading(false);
      return;
    }

    try {
      const mineSiteId = user?.mine_site_id ?? undefined;

      // 1. Load local SQLite outbox records & local workers cache
      const [localAtt, localW] = await Promise.all([
        labourRepository.getAll(),
        workerRepository.getAllActive(mineSiteId),
      ]);
      setRecords(localAtt);
      setWorkers(localW);

      // 2. If online, sync workers master list & pending attendance
      const online = await isOnline();
      if (online) {
        try {
          const remoteWorkers = await fetchWorkersList(mineSiteId);
          await workerRepository.upsertMany(remoteWorkers);
          const refreshedWorkers = await workerRepository.getAllActive(mineSiteId);
          setWorkers(refreshedWorkers);
        } catch (workerErr) {
          console.warn("Failed to sync worker master directory:", workerErr);
        }

        // Sync pending attendance outbox
        const pending = await labourRepository.getPending();
        for (const item of pending) {
          try {
            const res = await submitAttendance({
              worker_id: item.worker_id,
              shift_date: item.shift_date,
              shift_type: item.shift_type,
              clock_in: item.clock_in,
              clock_out: item.clock_out,
            });
            await labourRepository.markSynced(item.local_id, res.id);
          } catch (syncErr: any) {
            await labourRepository.markError(item.local_id, syncErr.message || "Sync failed");
          }
        }
        const refreshed = await labourRepository.getAll();
        setRecords(refreshed);
      }
    } catch (err) {
      console.warn("Failed to load attendance records:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [isMineOfficial, user?.mine_site_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // If unauthorized role, fail closed
  if (!isMineOfficial) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <View style={styles.restrictedCard}>
          <View style={styles.restrictedIconBox}>
            <Ionicons name="lock-closed" size={32} color={colors.danger} />
          </View>
          <Text style={styles.restrictedTitle}>Access Restricted</Text>
          <Text style={styles.restrictedSubtitle}>
            The Statutory Labour Attendance Register is restricted to Mine Officials.
          </Text>
          <TouchableOpacity
            style={styles.restrictedBackButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
            <Text style={styles.restrictedBackText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleRecordAttendance = async () => {
    if (!selectedWorker) {
      Alert.alert("Missing Worker", "Please select a worker from the master directory.");
      return;
    }

    setSubmitting(true);
    const todayStr = new Date().toISOString().split("T")[0];
    const clockInIso = new Date(`${todayStr}T${clockInTime}:00`).toISOString();
    const clockOutIso = clockOutTime
      ? new Date(`${todayStr}T${clockOutTime}:00`).toISOString()
      : null;

    // Approximate hours worked for local preview
    const inDate = new Date(`${todayStr}T${clockInTime}:00`);
    const outDate = clockOutTime ? new Date(`${todayStr}T${clockOutTime}:00`) : null;
    let localHours = 8.0;
    let localOt = 0.0;
    let localViolation = false;
    let violationReason: string | null = null;

    if (outDate) {
      localHours = (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60);
      if (localHours < 0) localHours += 24;
      if (localHours > 8.0) {
        localOt = localHours - 8.0;
      }
      if (localHours > 10.0) {
        localViolation = true;
        violationReason = `Shift duration of ${localHours.toFixed(1)}h exceeds statutory limit of 10h (Mines Act 1952 Sec 28/30)`;
      } else if (localOt > 2.0) {
        localViolation = true;
        violationReason = `Overtime of ${localOt.toFixed(1)}h exceeds statutory limit of 2h`;
      }
    }

    const mineSiteId = selectedWorker.mine_site_id || user?.mine_site_id || "5f92941a-dbf7-4697-a3d7-1c101210523c";

    try {
      // 1. Store in local SQLite outbox
      const localId = await labourRepository.insert({
        worker_id: selectedWorker.id,
        worker_badge_number: selectedWorker.badge_number,
        worker_name: selectedWorker.name,
        worker_role: selectedWorker.role,
        mine_site_id: mineSiteId,
        contractor_id: selectedWorker.contractor_id,
        shift_date: todayStr,
        shift_type: shiftType,
        clock_in: clockInIso,
        clock_out: clockOutIso,
        hours_worked: localHours,
        overtime_hours: localOt,
        is_violation: localViolation,
        violation_reason: violationReason,
      });

      // 2. Try online sync if connected
      const online = await isOnline();
      if (online) {
        try {
          const res = await submitAttendance({
            worker_id: selectedWorker.id,
            shift_date: todayStr,
            shift_type: shiftType,
            clock_in: clockInIso,
            clock_out: clockOutIso,
          });
          await labourRepository.markSynced(localId, res.id);
        } catch {
          // Keep as pending in outbox
        }
      }

      // Reset form & reload
      setSelectedWorker(null);
      setShowForm(false);
      await loadData();

      Alert.alert(
        "Attendance Recorded",
        online
          ? "Shift logged and verified against Mines Act 1952 statutory rules."
          : "Saved offline in local outbox. Will sync automatically when connected."
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save attendance.");
    } finally {
      setSubmitting(false);
    }
  };

  const violationsCount = records.filter((r) => r.is_violation).length;
  const filteredPickerWorkers = workers.filter((w) => {
    if (!pickerSearchQuery.trim()) return true;
    const q = pickerSearchQuery.toLowerCase();
    return w.name.toLowerCase().includes(q) || w.badge_number.toLowerCase().includes(q) || w.role.toLowerCase().includes(q);
  });

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Statutory Labour Register</Text>
            <Text style={styles.headerSubtitle}>Mines Act 1952 · Shift Muster Roll</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm(!showForm)}
          activeOpacity={0.8}
        >
          <Ionicons name={showForm ? "close" : "add"} size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              loadData();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* KPI Strip */}
        <View style={styles.kpiStrip}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Shifts</Text>
            <Text style={styles.kpiValue}>{records.length}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Workers Master</Text>
            <Text style={styles.kpiValue}>{workers.length}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiLabel, { color: colors.danger }]}>Violations</Text>
            <Text style={[styles.kpiValue, { color: colors.danger }]}>{violationsCount}</Text>
          </View>
        </View>

        {/* Collapsible Shift Attendance Form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Record Shift Attendance</Text>
            <Text style={styles.formSubtitle}>
              Select worker from master directory and specify shift timings.
            </Text>

            {/* Worker Picker Field */}
            <Text style={styles.inputLabel}>Worker Identity (Master Directory) *</Text>
            {selectedWorker ? (
              <View style={styles.selectedWorkerCard}>
                <View style={styles.selectedWorkerLeft}>
                  <View style={styles.workerAvatar}>
                    <Text style={styles.avatarText}>{selectedWorker.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedWorkerName}>{selectedWorker.name}</Text>
                    <Text style={styles.selectedWorkerSub}>
                      Badge: {selectedWorker.badge_number} · {selectedWorker.role}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setShowPickerModal(true)}
                  style={styles.changeWorkerBtn}
                >
                  <Text style={styles.changeWorkerText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.selectWorkerPlaceholder}
                onPress={() => setShowPickerModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add-outline" size={18} color={colors.primary} />
                <Text style={styles.selectWorkerPlaceholderText}>
                  Tap to search and select worker...
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
              </TouchableOpacity>
            )}

            {/* Shift Type Picker */}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Shift Type *</Text>
            <View style={styles.shiftTypeRow}>
              <TouchableOpacity
                style={[
                  styles.shiftTypeBtn,
                  shiftType === "day" && styles.shiftTypeBtnActive,
                ]}
                onPress={() => setShiftType("day")}
              >
                <Ionicons
                  name="sunny-outline"
                  size={16}
                  color={shiftType === "day" ? "#FFFFFF" : colors.text}
                />
                <Text
                  style={[
                    styles.shiftTypeText,
                    shiftType === "day" && styles.shiftTypeTextActive,
                  ]}
                >
                  Day (08:00 - 16:30)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shiftTypeBtn,
                  shiftType === "night" && styles.shiftTypeBtnActive,
                ]}
                onPress={() => setShiftType("night")}
              >
                <Ionicons
                  name="moon-outline"
                  size={16}
                  color={shiftType === "night" ? "#FFFFFF" : colors.text}
                />
                <Text
                  style={[
                    styles.shiftTypeText,
                    shiftType === "night" && styles.shiftTypeTextActive,
                  ]}
                >
                  Night Shift
                </Text>
              </TouchableOpacity>
            </View>

            {/* Times */}
            <View style={styles.timeRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Clock In (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={clockInTime}
                  onChangeText={setClockInTime}
                  placeholder="08:00"
                  placeholderTextColor={colors.textLight}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>Clock Out (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={clockOutTime}
                  onChangeText={setClockOutTime}
                  placeholder="16:30"
                  placeholderTextColor={colors.textLight}
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleRecordAttendance}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Save Shift Attendance</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Muster Register Entries</Text>
          <Text style={styles.sectionCount}>{records.length} records</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
        ) : records.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={40} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No Attendance Records Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the &apos;+&apos; button above to select a worker and record their shift.
            </Text>
          </View>
        ) : (
          records.map((item) => (
            <View key={item.local_id} style={styles.attendanceCard}>
              <View style={styles.cardTop}>
                <View style={styles.cardWorkerInfo}>
                  <Text style={styles.workerName}>{item.worker_name}</Text>
                  <Text style={styles.workerMeta}>
                    {item.worker_badge_number || item.worker_id.slice(0, 8)} · {item.worker_role || "Miner"}
                  </Text>
                </View>

                {item.is_violation ? (
                  <View style={styles.violationBadge}>
                    <Ionicons name="alert-circle" size={12} color={colors.danger} />
                    <Text style={styles.violationText}>Statutory Breach</Text>
                  </View>
                ) : (
                  <View style={styles.compliantBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                    <Text style={styles.compliantText}>Compliant</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardMiddle}>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textLight} />
                  <Text style={styles.metaText}>{item.shift_date.split("T")[0]}</Text>
                  <Text style={styles.metaBullet}>·</Text>
                  <Ionicons name="time-outline" size={14} color={colors.textLight} />
                  <Text style={styles.metaText}>
                    {item.shift_type.toUpperCase()} ({item.hours_worked.toFixed(1)}h)
                  </Text>
                </View>

                {item.overtime_hours > 0 && (
                  <Text style={styles.otBadge}>+{item.overtime_hours.toFixed(1)}h OT</Text>
                )}
              </View>

              {item.is_violation && item.violation_reason && (
                <View style={styles.reasonBox}>
                  <Ionicons name="warning-outline" size={12} color={colors.danger} />
                  <Text style={styles.reasonText}>{item.violation_reason}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* WORKER PICKER MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={showPickerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Worker</Text>
                <Text style={styles.modalSubtitle}>Worker Master Directory ({workers.length} active)</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPickerModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={colors.textLight} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by worker name, badge, role..."
                placeholderTextColor={colors.textLight}
                value={pickerSearchQuery}
                onChangeText={setPickerSearchQuery}
                autoFocus={true}
              />
            </View>

            {/* Workers List */}
            <ScrollView style={styles.modalScroll}>
              {filteredPickerWorkers.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>No workers match your search.</Text>
                </View>
              ) : (
                filteredPickerWorkers.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={styles.workerRow}
                    onPress={() => {
                      setSelectedWorker(w);
                      setShowPickerModal(false);
                      setPickerSearchQuery("");
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.workerAvatar}>
                      <Text style={styles.avatarText}>{w.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workerRowName}>{w.name}</Text>
                      <Text style={styles.workerRowMeta}>
                        Badge: {w.badge_number} · {w.role}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 1,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.sm,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  kpiStrip: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.textLight,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    ...shadows.sm,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  formSubtitle: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: colors.text,
  },
  selectWorkerPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  selectWorkerPlaceholderText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
  selectedWorkerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 12,
  },
  selectedWorkerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  workerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  selectedWorkerName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  selectedWorkerSub: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 1,
  },
  changeWorkerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeWorkerText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "700",
  },
  shiftTypeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  shiftTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  shiftTypeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  shiftTypeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  shiftTypeTextActive: {
    color: "#FFFFFF",
  },
  timeRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
    ...shadows.sm,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  sectionCount: {
    fontSize: 11,
    color: colors.textLight,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 240,
  },
  attendanceCard: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    ...shadows.sm,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardWorkerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  workerMeta: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 1,
  },
  compliantBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  compliantText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.success,
  },
  violationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  violationText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.danger,
  },
  cardMiddle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: colors.textLight,
  },
  metaBullet: {
    fontSize: 11,
    color: colors.textLight,
    marginHorizontal: 2,
  },
  otBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#D97706",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reasonBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FFE4E6",
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  reasonText: {
    fontSize: 11,
    color: colors.danger,
    flex: 1,
  },
  // Restricted State
  restrictedCard: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    maxWidth: 320,
    ...shadows.sm,
  },
  restrictedIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  restrictedTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  restrictedSubtitle: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 18,
  },
  restrictedBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  restrictedBackText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 2,
  },
  modalScroll: {
    maxHeight: 360,
  },
  modalEmpty: {
    padding: 24,
    alignItems: "center",
  },
  modalEmptyText: {
    fontSize: 12,
    color: colors.textLight,
  },
  workerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  workerRowName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  workerRowMeta: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 1,
  },
});
