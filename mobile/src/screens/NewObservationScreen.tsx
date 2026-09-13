/**
 * NewObservationScreen.tsx
 * Form to log a new mine inspection observation.
 * On submit: runs on-device risk scoring → saves to SQLite → navigates to RiskCardScreen.
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
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { RiskScoringEngine, ObservationInput } from "../models/RiskScoringEngine";
import { observationRepository } from "../db/ObservationRepository";
import modelData from "../../assets/model/model.json";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "NewObservation">;
  route: RouteProp<RootStackParamList, "NewObservation">;
};

type Category = "safety" | "environment" | "labour" | "production";

const engine = new RiskScoringEngine(modelData as never);

const CATEGORY_OPTIONS: { key: Category; label: string; icon: string; color: string }[] = [
  { key: "safety", label: "Safety", icon: "⚠️", color: "#DC2626" },
  { key: "environment", label: "Environment", icon: "🌿", color: "#16A34A" },
  { key: "labour", label: "Labour", icon: "👷", color: "#D97706" },
  { key: "production", label: "Production", icon: "⚙️", color: "#2563EB" },
];

export default function NewObservationScreen({ navigation }: Props) {
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

  // When GPS toggle is turned on, fetch location immediately
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
      // 1. Run on-device risk scoring
      const obsInput: ObservationInput = {
        category,
        description: description.trim(),
        created_at: new Date().toISOString(),
        zone_risk_baseline: 0.4, // default — zone picker is Phase 4 enrichment
        inspector_historical_high_rate: 0.25,
        days_since_last_zone_inspection: 7,
        has_photo: Boolean(photoUri),
      };
      const riskResult = engine.scoreObservation(obsInput);

      const numericGas = gasReading.trim() ? parseFloat(gasReading.trim()) : null;
      const validGas = numericGas !== null && !isNaN(numericGas) ? numericGas : null;

      // 2. Persist to SQLite
      const localId = await observationRepository.insert({
        category,
        description: description.trim(),
        photo_uri: photoUri,
        gas_reading_value: validGas,
        gas_reading_unit: validGas !== null ? "% CH₄" : null,
        lat,
        lng,
        beacon_id: beaconId.trim() || null,
        mine_site_id: null, // will be set from profile in later version
        zone_id: null,
        edge_score: riskResult.score,
        edge_flag: riskResult.flag,
        edge_reasons_json: JSON.stringify(riskResult.reasons),
      });

      // 3. Navigate to Risk Card
      navigation.replace("RiskCard", { localId, riskResult });
    } catch (err) {
      Alert.alert("Error", "Failed to save observation. Please try again.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>New Observation</Text>
      <Text style={styles.screenSubtitle}>Field inspection report — works offline</Text>

      {/* Category Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CATEGORY</Text>
        <View style={styles.categoryRow}>
          {CATEGORY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.categoryChip,
                category === opt.key && { borderColor: opt.color, backgroundColor: `${opt.color}20` },
              ]}
              onPress={() => setCategory(opt.key)}
              testID={`category-${opt.key}`}
            >
              <Text style={styles.categoryIcon}>{opt.icon}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  category === opt.key && { color: opt.color },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>OBSERVATION DESCRIPTION</Text>
        <TextInput
          style={styles.descriptionInput}
          placeholder="Describe what you observed in detail..."
          placeholderTextColor="#4B5563"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          testID="description-input"
        />
      </View>

      {/* Gas / Sensor Telemetry Reading (Optional) */}
      {(category === "safety" || category === "environment") && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GAS CONCENTRATION / TELEMETRY (OPTIONAL)</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="e.g. 1.25"
              placeholderTextColor="#4B5563"
              value={gasReading}
              onChangeText={setGasReading}
              keyboardType="decimal-pad"
            />
            <View style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#1F2937", borderRadius: 8 }}>
              <Text style={{ color: "#9CA3AF", fontSize: 12, fontFamily: "monospace" }}>% CH₄</Text>
            </View>
          </View>
        </View>
      )}

      {/* Photo */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>EVIDENCE PHOTO</Text>
        <TouchableOpacity
          style={styles.photoButton}
          onPress={pickPhoto}
          testID="photo-button"
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoIcon}>📷</Text>
              <Text style={styles.photoPlaceholderText}>Tap to attach photo</Text>
            </View>
          )}
        </TouchableOpacity>
        {photoUri && (
          <TouchableOpacity onPress={() => setPhotoUri(null)}>
            <Text style={styles.removePhotoText}>✕ Remove photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Location */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>LOCATION</Text>
        <View style={styles.gpsRow}>
          <Text style={styles.gpsLabel}>GPS Geo-tag</Text>
          {isGeoLoading ? (
            <ActivityIndicator color="#2563EB" size="small" />
          ) : (
            <Switch
              value={useGps}
              onValueChange={setUseGps}
              trackColor={{ false: "#334155", true: "#2563EB" }}
              thumbColor="#FFFFFF"
              testID="gps-toggle"
            />
          )}
        </View>
        {useGps && lat !== null && (
          <View style={styles.coordBox}>
            <Text style={styles.coordText}>📍 {lat.toFixed(5)}, {lng?.toFixed(5)}</Text>
          </View>
        )}
        <View style={styles.fieldGroup}>
          <TextInput
            style={styles.input}
            placeholder="Underground Beacon ID (optional)"
            placeholderTextColor="#4B5563"
            value={beaconId}
            onChangeText={setBeaconId}
            testID="beacon-input"
          />
        </View>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        testID="submit-button"
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>⚡ Score & Save Offline</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F1F5F9",
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 10,
  },
  categoryChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#334155",
    backgroundColor: "#1E293B",
  },
  categoryIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  descriptionInput: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 14,
    color: "#F1F5F9",
    fontSize: 15,
    minHeight: 120,
  },
  photoButton: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#334155",
    borderStyle: "dashed",
    height: 160,
  },
  photoPreview: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E293B",
  },
  photoIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  photoPlaceholderText: {
    color: "#64748B",
    fontSize: 13,
  },
  removePhotoText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 10,
  },
  gpsLabel: {
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: "500",
  },
  coordBox: {
    backgroundColor: "#0F2942",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  coordText: {
    color: "#60A5FA",
    fontSize: 12,
    fontFamily: "monospace",
  },
  fieldGroup: {
    marginTop: 4,
  },
  input: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#F1F5F9",
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#2563EB",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
