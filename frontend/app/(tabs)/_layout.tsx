import React from "react";
import { Platform, StyleSheet } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { colors, fonts } from "@/src/theme/theme";

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  // Keep the app tab bar comfortably above the Android system navigation bar
  // (gesture pill or 3-button nav) on every device size.
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 14 : 0);
  const barHeight = 60 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarStyle: [
          styles.tabBar,
          { height: barHeight, paddingBottom: bottomInset + 8 },
        ],
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: { paddingVertical: 6 },
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabHome"),
          tabBarIcon: ({ color, size }) => <Feather name="globe" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("tabHistory"),
          tabBarIcon: ({ color, size }) => <Feather name="clock" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t("tabFavorites"),
          tabBarIcon: ({ color, size }) => <Feather name="star" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="expressions"
        options={{
          title: t("tabExpressions"),
          tabBarIcon: ({ color, size }) => <Feather name="book-open" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
  },
});
