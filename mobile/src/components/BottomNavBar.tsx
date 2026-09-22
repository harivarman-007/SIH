/**
 * BottomNavBar.tsx
 * Persistent 5-tab bottom navigation bar for mobile inspector workflow:
 * [Home | Inspections | New Obs | Actions | Sync]
 * Displays dynamic badge counts for active inspections and pending sync queue.
 */

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { inspectionRepository } from "../db/InspectionRepository";
import { observationRepository } from "../db/ObservationRepository";

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

  const tabs = [
    { name: "Dashboard", label: "Home", icon: "🏠" },
    { name: "Inspections", label: "Inspections", icon: "📋", badge: activeInspections },
    { name: "NewObservation", label: "+ New", icon: "➕", isFab: true },
    { name: "Actions", label: "Actions", icon: "🛠️" },
    { name: "Queue", label: "Sync", icon: "🔄", badge: pendingSync },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = currentRoute === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tabButton, tab.isFab && styles.fabTab]}
            activeOpacity={0.7}
            onPress={() => {
              if (!isActive) {
                navigation.navigate(tab.name);
              }
            }}
          >
            <View style={styles.iconWrapper}>
              <Text style={[styles.iconText, isActive && styles.activeIconText]}>
                {tab.icon}
              </Text>
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
    backgroundColor: "#0B132B",
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    paddingBottom: 16,
    paddingTop: 8,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 4,
  },
  fabTab: {
    transform: [{ translateY: -4 }],
  },
  iconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 20,
    opacity: 0.7,
  },
  activeIconText: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#0B132B",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  labelText: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  activeLabelText: {
    color: "#F59E0B",
    fontWeight: "700",
  },
});
