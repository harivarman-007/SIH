/**
 * NewObservationScreen.tsx
 * Form to log a new mine inspection observation:
 * - Executive Light Theme (white surfaces, slate-50 canvas, royal blue accents)
 * - Vector Ionicons (zero emojis)
 * - On submit: runs on-device risk scoring -> saves to SQLite -> navigates to RiskCardScreen.
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { RiskScoringEngine, ObservationInput } from "../models/RiskScoringEngine";
import { observationRepository } from "../db/ObservationRepository";
import modelData from "../../assets/model/model.json";
import { colors, shadows } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "NewObservation">;
  route: RouteProp<RootStackParamList, "NewObservation">;
};

type Category = "safety" | "environment" | "labour" | "production";

const engine = new RiskScoringEngine(modelData as never);

const CATEGORY_OPTIONS: {
  key: Category;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  color: string;
  bgLight: string;
}[] = [
  { key: "safety", label: "Safety", iconName: "warning-outline", color: "#DC2626", bgLight: "#FEF2F2" },
  { key: "environment", label: "Environment", iconName: "leaf-outline", color: "#16A34A", bgLight: "#F0FDF4" },
  { key: "labour", label: "Labour", iconName: "people-outline", color: "#D97706", bgLight: "#FFFBEB" },
  { key: "production", label: "Production", iconName: "cog-outline", color: "#2563EB", bgLight: "#EFF6FF" },
];

export default function NewObservationScreen({ navigation, route }: Props) {
  const [category, setCategory] = useState<Category>("safety");
  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [gasReading, setGasReading] = useState("");
  const [useGps, setUseGps] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [beaconId, setBeaconId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeoLoading, setIsGeoLoading] = useState(false);

  useEffect(() => {
    if (useGps) {
      fetchLocation();
    } else {
      setLat(null);
      setLng(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGps]);

  const fetchLocation = async () => {
    setIsGeoLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location permission is required for GPS geo-tagging.");
        setUseGps(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);
    } catch {
      Alert.alert("GPS Error", "Could not fetch location. Using beacon ID only.");
      setUseGps(false);
    } finally {
      setIsGeoLoading(false);
    }
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera permission is needed to capture evidence photos.");
      return;
    }
    Alert.alert("Attach Photo", "Choose source", [
      {
        text: "Camera",
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.7,
            allowsEditing: false,
          });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: "Gallery",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
            allowsEditing: false,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("Missing description", "Please describe the observation.");
      return;
    }

    setIsSubmitting(true);
    try {
      const obsInput: ObservationInput = {
        category,
        description: description.trim(),
        created_at: new Date().toISOString(),
        zone_risk_baseline: 0.4,
        inspector_historical_high_rate: 0.25,
        days_since_last_zone_inspection: 7,
        has_photo: Boolean(photoUri),
      };
      const riskResult = engine.scoreObservation(obsInput);

      const numericGas = gasReading.trim() ? parseFloat(gasReading.trim()) : null;
      const validGas = numericGas !== null && !isNaN(numericGas) ? numericGas : null;

      const localId = await observationRepository.insert({
        category,
        description: description.trim(),
        photo_uri: photoUri,
        gas_reading_value: validGas,
        gas_reading_unit: validGas !== null ? "% CH₄" : null,
        lat,
        lng,
        beacon_id: beaconId.trim() || null,
        mine_site_id: null,
        zone_id: null,
        inspection_id: route?.params?.inspectionId || null,
        edge_score: riskResult.score,
        edge_flag: riskResult.flag,
        edge_reasons_json: JSON.stringify(riskResult.reasons),
      });

      navigation.replace("RiskCard", { localId, riskResult });
    } catch (err: any) {
      console.error("Save observation failed:", err);
      Alert.alert(
        "Failed to Save Observation",
        err?.message || "An unexpected error occurred while saving the observation. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>New Observation</Text>
        <Text style={styles.screenSubtitle}>Field inspection hazard report — edge AI enabled</Text>
      </View>

      {route?.params?.inspectionCode && (
        <View style={styles.linkedBanner}>
          <Ionicons name="clipboard-outline" size={15} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.linkedBannerText}>
            Linked to Statutory Inspection: {route.params.inspectionCode}
          </Text>
        </View>
      )}

      {/* Category Selector */}
      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.sectionLabel}>CATEGORY</Text>
        <View style={styles.categoryRow}>
          {CATEGORY_OPTIONS.map((opt) => {
            const isSelected = category === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.categoryChip,
                  isSelected && {
                    borderColor: opt.color,
                    backgroundColor: opt.bgLight,
                  },
                ]}
                onPress={() => setCategory(opt.key)}
                testID={`category-${opt.key}`}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={opt.iconName}
                  size={20}
                  color={isSelected ? opt.color : "#64748B"}
                  style={{ marginBottom: 4 }}
                />
                <Text
                  style={[
                    styles.categoryLabel,
                    isSelected && { color: opt.color, fontWeight: "700" },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Description */}
      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.sectionLabel}>OBSERVATION DESCRIPTION</Text>
        <TextInput
          style={styles.descriptionInput}
          placeholder="Describe condition, location specifics, hazard signs..."
          placeholderTextColor="#94A3B8"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          testID="description-input"
        />
      </View>

      {/* Gas / Sensor Telemetry Reading (Optional) */}
      {(category === "safety" || category === "environment") && (
        <View style={[styles.card, shadows.sm]}>
          <Text style={styles.sectionLabel}>GAS CONCENTRATION / TELEMETRY (OPTIONAL)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="e.g. 1.25"
              placeholderTextColor="#94A3B8"
              value={gasReading}
              onChangeText={setGasReading}
              keyboardType="decimal-pad"
            />
            <View style={styles.unitBadge}>
              <Text style={styles.unitBadgeText}>% CH₄</Text>
            </View>
          </View>
        </View>
      )}

      {/* Photo */}
      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.sectionLabel}>EVIDENCE PHOTO</Text>
        <TouchableOpacity
          style={styles.photoButton}
          onPress={pickPhoto}
          testID="photo-button"
          activeOpacity={0.8}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={32} color="#64748B" style={{ marginBottom: 6 }} />
              <Text style={styles.photoPlaceholderText}>Tap to capture photo evidence</Text>
            </View>
          )}
        </TouchableOpacity>
        {photoUri && (
          <TouchableOpacity
            style={styles.removePhotoBtn}
            onPress={() => setPhotoUri(null)}
          >
            <Ionicons name="trash-outline" size={13} color="#EF4444" style={{ marginRight: 4 }} />
            <Text style={styles.removePhotoText}>Remove photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Location */}
      <View style={[styles.card, shadows.sm]}>
        <Text style={styles.sectionLabel}>GEOGRAPHIC LOCATION</Text>
        <View style={styles.gpsRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="location-outline" size={17} color={colors.primary} />
            <Text style={styles.gpsLabel}>GPS Geo-tag</Text>
          </View>
          {isGeoLoading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Switch
              value={useGps}
              onValueChange={setUseGps}
              trackColor={{ false: "#E2E8F0", true: colors.primary }}
              thumbColor="#FFFFFF"
              testID="gps-toggle"
            />
          )}
        </View>
        {useGps && lat !== null && (
          <View style={styles.coordBox}>
            <Text style={styles.coordText}>GPS: {lat.toFixed(5)}, {lng?.toFixed(5)}</Text>
          </View>
        )}
        <View style={styles.fieldGroup}>
          <TextInput
            style={styles.input}
            placeholder="Underground Beacon ID (optional)"
            placeholderTextColor="#94A3B8"
            value={beaconId}
            onChangeText={setBeaconId}
            testID="beacon-input"
          />
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.buttonDisabled, shadows.md]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        testID="submit-button"
        activeOpacity={0.8}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="flash" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.submitButtonText}>Score & Save Offline</Text>
          </View>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  header: {
    paddingVertical: 8,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  screenSubtitle: {
    fontSize: 12,
    color: colors.subtext,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    color: colors.subtext,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 8,
  },
  categoryChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: "#F8FAFC",
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.subtext,
  },
  descriptionInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.text,
    fontSize: 13,
    minHeight: 100,
  },
  photoButton: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    height: 140,
    backgroundColor: "#F8FAFC",
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    color: colors.subtext,
    fontSize: 12,
    fontWeight: "500",
  },
  removePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  removePhotoText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  gpsLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  coordBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  coordText: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "600",
  },
  fieldGroup: {
    marginTop: 2,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
  },
  unitBadge: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitBadgeText: {
    color: colors.subtext,
    fontSize: 12,
    fontFamily: "monospace",
    fontWeight: "700",
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  linkedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    padding: 12,
  },
  linkedBannerText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 12,
  },
});
