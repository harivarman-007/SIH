/**
 * RiskCardScreen.tsx
 * Displays the on-device risk assessment immediately after observation capture:
 * - Executive Light Theme (white surfaces, slate-50 canvas, royal blue accents)
 * - Vector Ionicons (zero emojis)
 * - Shows score, flag, top contributing factors, and rule override reason.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/AppNavigator";
import type { RiskScoringResult } from "../models/RiskScoringEngine";
import { colors, shadows } from "../theme";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "RiskCard">;
  route: RouteProp<RootStackParamList, "RiskCard">;
};

const FLAG_CONFIG: Record<
  string,
  {
    color: string;
    bg: string;
    border: string;
    iconName: keyof typeof Ionicons.glyphMap;
    label: string;
  }
> = {
  high: {
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#FECACA",
    iconName: "alert-circle",
    label: "HIGH RISK",
  },
  medium: {
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    iconName: "warning",
    label: "MEDIUM RISK",
  },
  low: {
    color: "#16A34A",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    iconName: "checkmark-circle",
    label: "LOW RISK",
  },
};

function ScoreArc({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const flag = score >= 0.6 ? "high" : score >= 0.35 ? "medium" : "low";
  const cfg = FLAG_CONFIG[flag];

  return (
    <View style={[styles.scoreArcContainer, { borderColor: cfg.color }]}>
      <Ionicons name={cfg.iconName} size={32} color={cfg.color} style={{ marginBottom: 4 }} />
      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
        <Text style={[styles.scoreNumber, { color: cfg.color }]}>{pct}</Text>
        <Text style={styles.scorePercent}>/ 100</Text>
      </View>
      <View style={[styles.flagPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
        <Text style={[styles.scoreFlagLabel, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </View>
  );
}

function ContributorBadge({ name }: { name: string }) {
  const displayName = name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  return (
    <View style={styles.contributorBadge}>
      <Text style={styles.contributorText}>{displayName}</Text>
    </View>
  );
}

export default function RiskCardScreen({ navigation, route }: Props) {
  const { localId, riskResult } = route.params as {
    localId: number;
    riskResult: RiskScoringResult;
  };

  const flag = riskResult.flag;
  const cfg = FLAG_CONFIG[flag] || FLAG_CONFIG.low;
  const isRuleTrigger = riskResult.rule_triggered;

  const handleGoToQueue = () => {
    navigation.navigate("Queue");
  };

  const handleNewObservation = () => {
    navigation.navigate("NewObservation");
  };

  const handleDashboard = () => {
    navigation.navigate("Dashboard");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Risk Assessment</Text>
        <Text style={styles.headerSubtitle}>On-device edge AI isolation forest inference</Text>
      </View>

      {/* Score Card */}
      <View style={[styles.scoreCard, shadows.sm]}>
        <ScoreArc score={riskResult.score} />

        {isRuleTrigger && (
          <View style={styles.ruleBanner}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Ionicons name="flash" size={14} color="#DC2626" />
              <Text style={styles.ruleBannerTitle}>CRITICAL DGMS RULE TRIGGERED</Text>
            </View>
            <Text style={styles.ruleBannerRule}>{riskResult.reasons.rule_override}</Text>
          </View>
        )}
      </View>

      {/* Rationale */}
      {riskResult.reasons.rationale ? (
        <View style={styles.rationaleCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Ionicons name="warning-outline" size={14} color="#D97706" />
            <Text style={styles.rationaleLabel}>HAZARD DETECTED</Text>
          </View>
          <Text style={styles.rationaleText}>{riskResult.reasons.rationale}</Text>
        </View>
      ) : null}

      {/* Top Contributors */}
      {riskResult.reasons.top_contributors && riskResult.reasons.top_contributors.length > 0 ? (
        <View style={[styles.card, shadows.sm]}>
          <Text style={styles.sectionLabel}>PRIMARY RISK DRIVERS</Text>
          <View style={styles.contributorsRow}>
            {riskResult.reasons.top_contributors.map((c) => (
              <ContributorBadge key={c} name={c} />
            ))}
          </View>
        </View>
      ) : null}

      {/* Feature Breakdown */}
      {riskResult.reasons.features ? (
        <View style={[styles.card, shadows.sm]}>
          <Text style={styles.sectionLabel}>FEATURE IMPACT BREAKDOWN</Text>
          <View style={styles.featureTable}>
            {Object.entries(riskResult.reasons.features)
              .filter(([, v]) => (v as number) > 0)
              .map(([key, val]) => (
                <View key={key} style={styles.featureRow}>
                  <Text style={styles.featureKey}>{key.replace(/_/g, " ")}</Text>
                  <View style={styles.featureBarOuter}>
                    <View
                      style={[
                        styles.featureBarInner,
                        {
                          width: `${Math.round((val as number) * 100)}%`,
                          backgroundColor: cfg.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.featureVal, { color: cfg.color }]}>
                    {((val as number) * 100).toFixed(0)}%
                  </Text>
                </View>
              ))}
          </View>
        </View>
      ) : null}

      {/* Offline Badge */}
      <View style={styles.offlineBadge}>
        <Ionicons name="cloud-offline-outline" size={15} color={colors.primary} style={{ marginRight: 6 }} />
        <Text style={styles.offlineBadgeText}>
          Saved offline · Local ID #{localId} · Queued for cloud sync
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryAction, shadows.sm]}
          onPress={handleGoToQueue}
          testID="goto-queue-button"
          activeOpacity={0.8}
        >
          <Ionicons name="cloud-upload-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.primaryActionText}>View Sync Queue</Text>
        </TouchableOpacity>
        <View style={styles.secondaryRow}>
          <TouchableOpacity
            style={[styles.secondaryAction, shadows.sm]}
            onPress={handleNewObservation}
            testID="new-obs-button"
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={17} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.secondaryActionTextPrimary}>New Observation</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryAction, shadows.sm]}
            onPress={handleDashboard}
            testID="dashboard-button"
            activeOpacity={0.8}
          >
            <Ionicons name="home-outline" size={17} color={colors.text} style={{ marginRight: 4 }} />
            <Text style={styles.secondaryActionText}>Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreArcContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  scoreNumber: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  scorePercent: {
    fontSize: 13,
    color: colors.subtext,
    fontWeight: "600",
    marginLeft: 2,
  },
  flagPill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  scoreFlagLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  ruleBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    width: "100%",
  },
  ruleBannerTitle: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  ruleBannerRule: {
    color: "#991B1B",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  rationaleCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  rationaleLabel: {
    color: "#D97706",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  rationaleText: {
    color: "#92400E",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
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
  contributorsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contributorBadge: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  contributorText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  featureTable: {
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featureKey: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
    width: "40%",
  },
  featureBarOuter: {
    flex: 1,
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: "hidden",
  },
  featureBarInner: {
    height: "100%",
    borderRadius: 4,
  },
  featureVal: {
    fontSize: 12,
    fontWeight: "700",
    width: 36,
    textAlign: "right",
  },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    padding: 10,
  },
  offlineBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  primaryAction: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  secondaryActionTextPrimary: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});
