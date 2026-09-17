import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Flag } from "@/src/components/Flag";
import { colors, fonts, radius, spacing } from "@/src/theme/theme";
import { isDialect, type LangCode } from "@/src/theme/languages";

export interface RowItem {
  id: string;
  source_text: string;
  translated_text: string;
  phonetic: string;
  source_lang: LangCode;
  target_lang: LangCode;
}

interface Props {
  item: RowItem;
  onListen: () => void;
  listening: boolean;
  actionIcon: keyof typeof Feather.glyphMap;
  actionColor: string;
  onAction: () => void;
  actionTestID: string;
}

export function TranslationRow({
  item,
  onListen,
  listening,
  actionIcon,
  actionColor,
  onAction,
  actionTestID,
}: Props) {
  const targetIsArabic = isDialect(item.target_lang);
  return (
    <View style={styles.card} testID={`row-${item.id}`}>
      <View style={styles.top}>
        <View style={styles.pair}>
          <Flag code={item.source_lang} size={20} />
          <Feather name="arrow-right" size={14} color={colors.onSurfaceTertiary} />
          <Flag code={item.target_lang} size={20} />
        </View>
        <View style={styles.rowActions}>
          <Pressable onPress={onListen} hitSlop={8} testID={`row-listen-${item.id}`}>
            {listening ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <Feather name="volume-2" size={20} color={colors.brand} />
            )}
          </Pressable>
          <Pressable onPress={onAction} hitSlop={8} testID={actionTestID}>
            <Feather name={actionIcon} size={20} color={actionColor} />
          </Pressable>
        </View>
      </View>

      <Text style={styles.source} numberOfLines={2}>
        {item.source_text}
      </Text>
      <Text style={[styles.translated, targetIsArabic && styles.arabic]} numberOfLines={3}>
        {item.translated_text}
      </Text>
      {item.phonetic ? <Text style={styles.phonetic}>{item.phonetic}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  pair: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  source: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurfaceSecondary,
    marginBottom: spacing.xs,
  },
  translated: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    lineHeight: 30,
    color: colors.onSurface,
  },
  arabic: {
    fontFamily: undefined,
    fontWeight: "600",
    textAlign: "right",
    writingDirection: "rtl",
  },
  phonetic: {
    marginTop: spacing.xs,
    fontFamily: fonts.medium,
    fontStyle: "italic",
    fontSize: 14,
    color: colors.brand,
  },
});
