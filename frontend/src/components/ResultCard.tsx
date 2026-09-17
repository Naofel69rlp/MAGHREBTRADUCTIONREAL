import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Flag } from "@/src/components/Flag";
import { useI18n } from "@/src/i18n/I18nContext";
import { colors, fonts, radius, spacing } from "@/src/theme/theme";
import { isDialect, type LangCode } from "@/src/theme/languages";

export interface TranslationResult {
  id?: string;
  source_text: string;
  translated_text: string;
  phonetic: string;
  source_lang: LangCode;
  target_lang: LangCode;
}

interface Props {
  result: TranslationResult;
  isFavorite: boolean;
  onFavorite: () => void;
  onListen: () => void;
  onCopy: () => void;
  listening: boolean;
}

export function ResultCard({
  result,
  isFavorite,
  onFavorite,
  onListen,
  onCopy,
  listening,
}: Props) {
  const { t, langName } = useI18n();
  const targetIsArabic = isDialect(result.target_lang);

  return (
    <View style={styles.card} testID="result-card">
      <View style={styles.header}>
        <Flag code={result.target_lang} size={22} />
        <Text style={styles.langLabel}>{langName(result.target_lang)}</Text>
      </View>

      <Text
        style={[styles.translated, targetIsArabic && styles.arabic]}
        testID="result-translated-text"
      >
        {result.translated_text}
      </Text>

      {result.phonetic ? (
        <Text style={styles.phonetic} testID="result-phonetic-text">
          {result.phonetic}
        </Text>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={onListen} testID="result-listen-button">
          {listening ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <Feather name="volume-2" size={20} color={colors.brand} />
          )}
          <Text style={styles.actionText}>{t("listen")}</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={onCopy} testID="result-copy-button">
          <Feather name="copy" size={20} color={colors.brand} />
          <Text style={styles.actionText}>{t("copy")}</Text>
        </Pressable>

        <Pressable style={styles.action} onPress={onFavorite} testID="result-favorite-button">
          <Feather name="star" size={20} color={isFavorite ? colors.gold : colors.brand} />
          <Text style={styles.actionText}>{isFavorite ? t("saved") : t("favorite")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  langLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.onSurfaceTertiary,
  },
  translated: {
    fontFamily: fonts.semibold,
    fontSize: 26,
    lineHeight: 38,
    color: colors.onSurface,
  },
  arabic: {
    fontFamily: undefined,
    textAlign: "right",
    writingDirection: "rtl",
    fontWeight: "600",
  },
  phonetic: {
    marginTop: spacing.sm,
    fontFamily: fonts.medium,
    fontStyle: "italic",
    fontSize: 16,
    color: colors.brand,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  action: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  actionText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },
});
