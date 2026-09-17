import React, { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Flag } from "@/src/components/Flag";
import { useI18n } from "@/src/i18n/I18nContext";
import { colors, fonts, radius, spacing } from "@/src/theme/theme";
import { LANG_LIST, LANGUAGES, type LangCode } from "@/src/theme/languages";

interface Props {
  source: LangCode;
  target: LangCode;
  onChange: (source: LangCode, target: LangCode) => void;
}

function haptic() {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function LanguageSelector({ source, target, onChange }: Props) {
  const { t, langName } = useI18n();
  const [picker, setPicker] = useState<null | "source" | "target">(null);

  const swap = () => {
    haptic();
    onChange(target, source);
  };

  const pick = (code: LangCode) => {
    if (!picker) return;
    if (picker === "source") {
      onChange(code, code === target ? source : target);
    } else {
      onChange(code === source ? target : source, code);
    }
    setPicker(null);
  };

  const renderSide = (code: LangCode, side: "source" | "target", testID: string) => {
    const info = LANGUAGES[code];
    return (
      <Pressable
        style={styles.side}
        onPress={() => {
          haptic();
          setPicker(side);
        }}
        testID={testID}
      >
        <Flag code={code} size={30} />
        <View style={styles.sideTextWrap}>
          <Text style={styles.sideName} numberOfLines={1}>
            {langName(code)}
          </Text>
          {info.main && <View style={[styles.accentBar, { backgroundColor: info.accent }]} />}
        </View>
        <Feather name="chevron-down" size={14} color={colors.onSurfaceTertiary} />
      </Pressable>
    );
  };

  return (
    <View style={styles.container} testID="language-selector">
      {renderSide(source, "source", "language-source-button")}
      <Pressable style={styles.swap} onPress={swap} testID="language-swap-button">
        <Feather name="repeat" size={18} color={colors.onBrand} />
      </Pressable>
      {renderSide(target, "target", "language-target-button")}

      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setPicker(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>
              {picker === "source" ? t("from") : t("to")}
            </Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {LANG_LIST.map((l) => {
                const active = picker === "source" ? l.code === source : l.code === target;
                return (
                  <Pressable
                    key={l.code}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => pick(l.code)}
                    testID={`lang-option-${l.code}`}
                  >
                    {l.main && <View style={[styles.optionAccent, { backgroundColor: l.accent }]} />}
                    <Flag code={l.code} size={30} />
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {langName(l.code)}
                    </Text>
                    {active && <Feather name="check" size={18} color={colors.brand} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(244,239,230,0.95)",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
  },
  side: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  sideTextWrap: { flexShrink: 1, alignItems: "flex-start" },
  sideName: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.onSurface,
  },
  accentBar: {
    height: 2.5,
    width: "100%",
    borderRadius: 2,
    marginTop: 3,
  },
  swap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: spacing.xs,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(26,44,30,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.xs,
  },
  sheetTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 20,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  optionActive: {
    backgroundColor: colors.brandTertiary,
  },
  optionAccent: {
    position: "absolute",
    left: 0,
    top: spacing.sm,
    bottom: spacing.sm,
    width: 4,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  optionText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onSurface,
  },
  optionTextActive: {
    fontFamily: fonts.semibold,
    color: colors.brand,
  },
});
