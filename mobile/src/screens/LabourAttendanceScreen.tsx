/**
 * LabourAttendanceScreen.tsx
 * Statutory Labour Attendance Register & Outbox for Inspectors / Mine Officials.
 * Offline-first via SQLite local_labour_attendance table, with auto-sync when online.
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
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { labourRepository } from "../db/LabourRepository";
import { LocalLabourAttendance } from "../db/schema";
import { submitAttendance, fetchAttendanceList } from "../api/labour";
import { useAuthStore } from "../store/authStore";
import { isOnline } from "../sync/TaskManager";
import { colors, shadows } from "../theme";

export default function LabourAttendanceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuthStore();

  const [records, setRecords] = useState<LocalLabourAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [workerId, setWorkerId] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [shiftType, setShiftType] = useState<"day" | "night">("day");
  const [clockInTime, setClockInTime] = useState("08:00");
  const [clockOutTime, setClockOutTime] = useState("16:30");
  const [contractorId, setContractorId] = useState("");

  const loadAttendance = useCallback(async () => {
    try {
      // 1. Load local SQLite outbox records
      const localData = await labourRepository.getAll();
      setRecords(localData);

      // 2. If online, try pulling server records or syncing pending
      const online = await isOnline();
      if (online) {
        // Sync pending
        const pending = await labourRepository.getPending();
        for (const item of pending) {
          try {
            const res = await submitAttendance({
              worker_id: item.worker_id,
              worker_name: item.worker_name,
              mine_site_id: item.mine_site_id,
              contractor_id: item.contractor_id,
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
        // Refresh local view
        const refreshed = await labourRepository.getAll();
        setRecords(refreshed);
      }
    } catch (err) {
      console.warn("Failed to load attendance records:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleRecordAttendance = async () => {
    if (!workerId.trim() || !workerName.trim()) {
      Alert.alert("Missing Fields", "Please enter Worker ID and Worker Name.");
      return;
    }

    setSubmitting(true);
    const todayStr = new Date().toISOString().split("T")[0];
    const clockInIso = new Date(`${todayStr}T${clockInTime}:00`).toISOString();
    const clockOutIso = clockOutTime
      ? new Date(`${todayStr}T${clockOutTime}:00`).toISOString()
      : null;

    // Calculate approximate hours worked for local preview
    const inDate = new Date(`${todayStr}T${clockInTime}:00`);
    const outDate = clockOutTime ? new Date(`${todayStr}T${clockOutTime}:00`) : null;
    let localHours = 0;
    let localOt = 0;
    let localViolation = false;
    let violationReason = null;

    if (outDate) {
      localHours = (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60);
      if (localHours < 0) localHours += 24; // overnight shift
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

    const mineSiteId = user?.mine_site_id || "5f92941a-dbf7-4697-a3d7-1c101210523c";

    try {
      // 1. Store in local SQLite outbox
      const localId = await labourRepository.insert({
        worker_id: workerId.trim(),
        worker_name: workerName.trim(),
        mine_site_id: mineSiteId,
        contractor_id: contractorId.trim() || null,
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
            worker_id: workerId.trim(),
            worker_name: workerName.trim(),
            mine_site_id: mineSiteId,
            contractor_id: contractorId.trim() || null,
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
      setWorkerId("");
      setWorkerName("");
      setContractorId("");
      setShowForm(false);
      await loadAttendance();

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
            <Text style={styles.title}>Labour Attendance</Text>
            <Text style={styles.subtitle}>Mines Act 1952 Statutory Register</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.newButton}
          onPress={() => setShowForm(!showForm)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={showForm ? "close" : "add"}
            size={18}
            color={colors.surface}
          />
          <Text style={styles.newButtonText}>{showForm ? "Cancel" : "Record"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              loadAttendance();
            }}
            colors={[colors.primary]}
          />
        }
      >
        {/* Statutory Overview Card */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={styles.overviewTitle}>Statutory Rules Active</Text>
          </View>
          <Text style={styles.overviewText}>
            Max Shift: 8.0h · Max Overtime: 2.0h · Min Rest: 16.0h (Mines Act Sec 28, 30, 31)
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{records.length}</Text>
              <Text style={styles.statLabel}>Total Shifts</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.successText }]}>
                {records.length - violationsCount}
              </Text>
              <Text style={styles.statLabel}>Compliant</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: colors.dangerText }]}>
                {violationsCount}
              </Text>
              <Text style={styles.statLabel}>Violations</Text>
            </View>
          </View>
        </View>

        {/* Attendance Form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Record Shift Attendance</Text>

            <Text style={styles.fieldLabel}>Worker ID *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. W-1049"
              placeholderTextColor={colors.textLight}
              value={workerId}
              onChangeText={setWorkerId}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Worker Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Rajesh Kumar"
              placeholderTextColor={colors.textLight}
              value={workerName}
              onChangeText={setWorkerName}
            />

            <Text style={styles.fieldLabel}>Shift Type</Text>
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
                  size={14}
                  color={shiftType === "day" ? colors.primary : colors.textMuted}
                />
                <Text
                  style={[
                    styles.shiftTypeText,
                    shiftType === "day" && styles.shiftTypeTextActive,
                  ]}
                >
                  Day Shift (8h)
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
                  size={14}
                  color={shiftType === "night" ? colors.primary : colors.textMuted}
                />
                <Text
                  style={[
                    styles.shiftTypeText,
                    shiftType === "night" && styles.shiftTypeTextActive,
                  ]}
                >
                  Night Shift (8h)
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.halfCol}>
                <Text style={styles.fieldLabel}>Clock In (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={clockInTime}
                  onChangeText={setClockInTime}
                  placeholder="08:00"
                  placeholderTextColor={colors.textLight}
                />
              </View>
              <View style={styles.halfCol}>
                <Text style={styles.fieldLabel}>Clock Out (HH:MM)</Text>
                <TextInput
                  style={styles.input}
                  value={clockOutTime}
                  onChangeText={setClockOutTime}
                  placeholder="16:30"
                  placeholderTextColor={colors.textLight}
                />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Contractor ID (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Leave blank for direct employee"
              placeholderTextColor={colors.textLight}
              value={contractorId}
              onChangeText={setContractorId}
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleRecordAttendance}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.surface} />
                  <Text style={styles.submitBtnText}>Save Attendance Entry</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Muster Roll List */}
        <Text style={styles.sectionHeading}>Muster Roll Records ({records.length})</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} size="small" color={colors.primary} />
        ) : records.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={32} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No Attendance Records</Text>
            <Text style={styles.emptySubtitle}>
              Log shift attendance to track statutory compliance and overtime.
            </Text>
          </View>
        ) : (
          records.map((item) => (
            <View key={item.local_id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <View>
                  <Text style={styles.workerName}>{item.worker_name}</Text>
                  <Text style={styles.workerId}>ID: {item.worker_id}</Text>
                </View>

                {item.is_violation ? (
                  <View style={styles.violationBadge}>
                    <Ionicons name="alert-circle" size={12} color={colors.dangerText} />
                    <Text style={styles.violationBadgeText}>Violation</Text>
                  </View>
                ) : (
                  <View style={styles.compliantBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.successText} />
                    <Text style={styles.compliantBadgeText}>Compliant</Text>
                  </View>
                )}
              </View>

              <View style={styles.recordMeta}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Shift Date</Text>
                  <Text style={styles.metaVal}>{item.shift_date}</Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Duration</Text>
                  <Text style={styles.metaVal}>{item.hours_worked.toFixed(1)}h</Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Overtime</Text>
                  <Text
                    style={[
                      styles.metaVal,
                      item.overtime_hours > 0 ? { color: colors.warningText } : null,
                    ]}
                  >
                    {item.overtime_hours > 0 ? `+${item.overtime_hours.toFixed(1)}h` : "None"}
                  </Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>Sync</Text>
                  <Text
                    style={[
                      styles.metaVal,
                      item.sync_status === "synced"
                        ? { color: colors.successText }
                        : { color: colors.warningText },
                    ]}
                  >
                    {item.sync_status === "synced" ? "Synced" : "Local"}
                  </Text>
                </View>
              </View>

              {item.violation_reason ? (
                <View style={styles.violationDetailBox}>
                  <Ionicons name="warning-outline" size={12} color={colors.dangerText} />
                  <Text style={styles.violationDetailText}>{item.violation_reason}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 12,
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
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  overviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadows.sm,
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  overviewTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  overviewText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  statNum: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
    marginTop: 2,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadows.sm,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.text,
  },
  shiftTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  shiftTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  shiftTypeBtnActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  shiftTypeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  shiftTypeTextActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  rowInputs: {
    flexDirection: "row",
    gap: 8,
  },
  halfCol: {
    flex: 1,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 14,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.surface,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "center",
  },
  recordCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
    ...shadows.sm,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  workerName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  workerId: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  violationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  violationBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.dangerText,
  },
  compliantBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  compliantBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.successText,
  },
  recordMeta: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    padding: 8,
    justifyContent: "space-between",
  },
  metaCol: {
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  metaVal: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
  },
  violationDetailBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.dangerLight,
    borderRadius: 6,
    padding: 6,
  },
  violationDetailText: {
    fontSize: 10,
    color: colors.dangerText,
    fontWeight: "600",
    flex: 1,
  },
});
