import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n/I18nContext";
import { flagUrl } from "@/src/components/Flag";
import { INTERFACE_LANGUAGES, type Locale } from "@/src/i18n/translations";
import { colors, fonts, radius, spacing } from "@/src/theme/theme";

// Interface locale → ISO country code for the official flag image.
const LOCALE_ISO: Record<Locale, string> = {
  fr: "fr",
  en: "gb",
  es: "es",
  it: "it",
  nl: "nl",
  de: "de",
  pt: "pt",
};

function LocaleFlag({ locale, size = 28 }: { locale: Locale; size?: number }) {
  const width = size;
  const height = Math.round(size * 0.75);
  return (
    <View style={[styles.flag, { width, height }]}>
      <Image
        source={{ uri: flagUrl(LOCALE_ISO[locale]) }}
        style={{ width, height }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
    </View>
  );
}

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t, locale, setLocale } = useI18n();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerTitle}>{t("settingsTitle")}</Text>
        <Pressable style={styles.close} onPress={() => router.back()} testID="settings-close-button">
          <Feather name="x" size={22} color={colors.brand} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>{t("interfaceLanguage")}</Text>
        <Text style={styles.sectionDesc}>{t("interfaceLanguageDesc")}</Text>

        <View style={styles.card}>
          {INTERFACE_LANGUAGES.map((l, idx) => {
            const active = l.code === locale;
            return (
              <Pressable
                key={l.code}
                style={[styles.option, idx > 0 && styles.optionBorder]}
                onPress={() => setLocale(l.code)}
                testID={`interface-lang-${l.code}`}
              >
                <LocaleFlag locale={l.code} />
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {l.native}
                </Text>
                {active && <Feather name="check-circle" size={20} color={colors.brand} />}
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: spacing.xxl }]}>{t("account")}</Text>
        <View style={styles.card}>
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <Feather name="user" size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.email} numberOfLines={1}>
                {user?.email}
              </Text>
              <Text style={styles.plan}>
                {user?.is_premium ? t("premiumActive") : t("freePlan")}
              </Text>
            </View>
            {user?.is_premium && <Feather name="award" size={20} color={colors.gold} />}
          </View>
        </View>

        <Pressable style={styles.logout} onPress={signOut} testID="logout-button">
          <Feather name="log-out" size={18} color={colors.error} />
          <Text style={styles.logoutText}>{t("logout")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.brand },
  close: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.onSurfaceTertiary,
    marginBottom: spacing.xs,
  },
  sectionDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.onSurfaceTertiary,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  optionBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  optionText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
  optionTextActive: { fontFamily: fonts.semibold, color: colors.brand },
  flag: {
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.15)",
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  email: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  plan: { fontFamily: fonts.regular, fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 2 },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: { fontFamily: fonts.bold, fontSize: 15, color: colors.error },
});
