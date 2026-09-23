/**
 * BottomNavBar.tsx
 * Persistent 5-tab bottom navigation bar for mobile inspector workflow:
 * [Home | Inspections | + New | Actions | Sync]
 * Executive Light Theme with vector Ionicons and dynamic badge counts.
 */

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { inspectionRepository } from "../db/InspectionRepository";
import { observationRepository } from "../db/ObservationRepository";
import { colors, shadows } from "../theme";

interface Props {
  currentRoute: string;
  navigation: any;
}

export const BottomNavBar: React.FC<Props> = ({ currentRoute, navigation }) => {
  const [activeInspections, setActiveInspections] = useState(0);
  const [pendingSync, setPendingSync] = useState(0);

  const loadBadges = async () => {
    try {
      const [inspCount, outboxCount, obsStats] = await Promise.all([
        inspectionRepository.getActiveCount(),
        inspectionRepository.getPendingOutboxCount(),
        observationRepository.getSyncStats(),
      ]);
      setActiveInspections(inspCount);
      setPendingSync(obsStats.pending + outboxCount);
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    loadBadges();
    const interval = setInterval(loadBadges, 3000);
    return () => clearInterval(interval);
  }, []);

  const tabs: Array<{
    name: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
    badge?: number;
    isFab?: boolean;
  }> = [
    { name: "Dashboard", label: "Home", icon: "home-outline", activeIcon: "home" },
    {
      name: "Inspections",
      label: "Inspections",
      icon: "clipboard-outline",
      activeIcon: "clipboard",
      badge: activeInspections,
    },
    { name: "NewObservation", label: "New Obs", icon: "add", activeIcon: "add", isFab: true },
    { name: "Actions", label: "Actions", icon: "construct-outline", activeIcon: "construct" },
    {
      name: "Queue",
      label: "Sync",
      icon: "sync-outline",
      activeIcon: "sync",
      badge: pendingSync,
    },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = currentRoute === tab.name;

        if (tab.isFab) {
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.fabWrapper}
              activeOpacity={0.85}
              onPress={() => {
                if (!isActive) navigation.navigate(tab.name);
              }}
            >
              <View style={styles.fabButton}>
                <Ionicons name="add" size={26} color="#FFFFFF" />
              </View>
              <Text style={[styles.labelText, isActive && styles.activeLabelText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tabButton}
            activeOpacity={0.7}
            onPress={() => {
              if (!isActive) navigation.navigate(tab.name);
            }}
          >
            <View style={styles.iconWrapper}>
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={22}
                color={isActive ? colors.primary : colors.textMuted}
              />
              {tab.badge !== undefined && tab.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.labelText, isActive && styles.activeLabelText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    paddingTop: 8,
    alignItems: "flex-end",
    justifyContent: "space-around",
    ...shadows.md,
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 4,
  },
  fabWrapper: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    transform: [{ translateY: -10 }],
  },
  fabButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },
  iconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    height: 26,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  labelText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 4,
  },
  activeLabelText: {
    color: colors.primary,
    fontWeight: "700",
  },
});
