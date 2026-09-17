import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { colors, fonts, radius, spacing } from "@/src/theme/theme";

interface Props {
  title: string;
  subtitle?: string;
  actionIcon?: keyof typeof Feather.glyphMap;
  onAction?: () => void;
  actionTestID?: string;
}

export function ScreenHeader({ title, subtitle, actionIcon, onAction, actionTestID }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {actionIcon && onAction && (
          <Pressable style={styles.action} onPress={onAction} testID={actionTestID}>
            <Feather name={actionIcon} size={20} color={colors.brand} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.brand,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.onSurfaceTertiary,
    marginTop: 2,
  },
  action: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
});
