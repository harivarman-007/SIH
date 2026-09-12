/**
 * RiskCardScreen.tsx
 * Displays the on-device risk assessment immediately after observation capture.
 * Shows score, flag, top contributing factors, and rule override reason.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/AppNavigator";
import type { RiskScoringResult } from "../models/RiskScoringEngine";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "RiskCard">;
  route: RouteProp<RootStackParamList, "RiskCard">;
};

const FLAG_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  high: { color: "#EF4444", bg: "#7F1D1D", icon: "🔴", label: "HIGH RISK" },
  medium: { color: "#F59E0B", bg: "#78350F", icon: "🟡", label: "MEDIUM RISK" },
  low: { color: "#22C55E", bg: "#14532D", icon: "🟢", label: "LOW RISK" },
};

function ScoreArc({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const flag = score >= 0.6 ? "high" : score >= 0.35 ? "medium" : "low";
  const cfg = FLAG_CONFIG[flag];

  return (
    <View style={[styles.scoreArcContainer, { borderColor: cfg.color }]}>
      <Text style={styles.scoreIconLarge}>{cfg.icon}</Text>
      <Text style={[styles.scoreNumber, { color: cfg.color }]}>{pct}</Text>
      <Text style={styles.scorePercent}>/ 100</Text>
      <Text style={[styles.scoreFlagLabel, { color: cfg.color }]}>{cfg.label}</Text>
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
  const cfg = FLAG_CONFIG[flag];
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
        <Text style={styles.headerSubtitle}>On-device edge model result</Text>
      </View>

      {/* Score Card */}
      <View style={[styles.scoreCard, { borderColor: cfg.color }]}>
        <ScoreArc score={riskResult.score} />

        {isRuleTrigger && (
          <View style={styles.ruleBanner}>
            <Text style={styles.ruleBannerTitle}>⚡ CRITICAL RULE TRIGGERED</Text>
            <Text style={styles.ruleBannerRule}>{riskResult.reasons.rule_override}</Text>
          </View>
        )}
      </View>

      {/* Rationale */}
      {riskResult.reasons.rationale ? (
        <View style={styles.rationaleCard}>
          <Text style={styles.rationaleLabel}>⚠️ HAZARD DETECTED</Text>
          <Text style={styles.rationaleText}>{riskResult.reasons.rationale}</Text>
        </View>
      ) : null}

      {/* Top Contributors */}
      {riskResult.reasons.top_contributors && riskResult.reasons.top_contributors.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TOP RISK DRIVERS</Text>
          <View style={styles.contributorsRow}>
            {riskResult.reasons.top_contributors.map((c) => (
              <ContributorBadge key={c} name={c} />
            ))}
          </View>
        </View>
      ) : null}

      {/* Feature Breakdown */}
      {riskResult.reasons.features ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FEATURE BREAKDOWN</Text>
          <View style={styles.featureTable}>
            {Object.entries(riskResult.reasons.features)
              .filter(([, v]) => v > 0)
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

      {/* Offline badge */}
      <View style={styles.offlineBadge}>
        <Text style={styles.offlineBadgeText}>
          📵 Saved offline · Local ID #{localId} · Pending sync
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={handleGoToQueue}
          testID="goto-queue-button"
        >
          <Text style={styles.primaryActionText}>📤 View Sync Queue</Text>
        </TouchableOpacity>
        <View style={styles.secondaryRow}>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={handleNewObservation}
            testID="new-obs-button"
          >
            <Text style={styles.secondaryActionText}>+ New</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={handleDashboard}
            testID="dashboard-button"
          >
            <Text style={styles.secondaryActionText}>🏠 Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F1F5F9",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  scoreCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    marginBottom: 16,
  },
  scoreArcContainer: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderRadius: 80,
    width: 140,
    height: 140,
    marginBottom: 16,
  },
  scoreIconLarge: {
    fontSize: 28,
    marginBottom: 2,
  },
  scoreNumber: {
    fontSize: 40,
    fontWeight: "900",
    lineHeight: 44,
  },
  scorePercent: {
    fontSize: 12,
    color: "#64748B",
  },
  scoreFlagLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  ruleBanner: {
    backgroundColor: "#7F1D1D",
    borderRadius: 10,
    padding: 14,
    width: "100%",
    borderWidth: 1,
    borderColor: "#DC2626",
  },
  ruleBannerTitle: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  ruleBannerRule: {
    color: "#FEE2E2",
    fontSize: 13,
    fontWeight: "600",
  },
  rationaleCard: {
    backgroundColor: "#1C1917",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DC2626",
    marginBottom: 16,
  },
  rationaleLabel: {
    color: "#FCA5A5",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  rationaleText: {
    color: "#FEE2E2",
    fontSize: 13,
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  contributorsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contributorBadge: {
    backgroundColor: "#1E3A5F",
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#2563EB",
  },
  contributorText: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "600",
  },
  featureTable: {
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureKey: {
    flex: 2,
    color: "#94A3B8",
    fontSize: 11,
    textTransform: "capitalize",
  },
  featureBarOuter: {
    flex: 3,
    height: 6,
    backgroundColor: "#334155",
    borderRadius: 3,
    overflow: "hidden",
  },
  featureBarInner: {
    height: "100%",
    borderRadius: 3,
    opacity: 0.8,
  },
  featureVal: {
    width: 36,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "600",
  },
  offlineBadge: {
    backgroundColor: "#0C1A2E",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#1E3A5F",
    alignItems: "center",
  },
  offlineBadgeText: {
    color: "#60A5FA",
    fontSize: 11,
  },
  actions: {
    gap: 10,
  },
  primaryAction: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  secondaryActionText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
});
