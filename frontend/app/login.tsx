import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as AppleAuthentication from "expo-apple-authentication";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { useI18n } from "@/src/i18n/I18nContext";
import { APP_NAME, colors, fonts, radius, spacing } from "@/src/theme/theme";

export default function Login() {
  const insets = useSafeAreaInsets();
  const { signIn, signInWithApple, signingIn } = useAuth();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => setAppleAvailable(false));
    }
  }, []);

  const onApple = async () => {
    try {
      await signInWithApple();
    } catch {
      showToast(t("tAppleFailed"), "error");
    }
  };

  const features = [
    { icon: "message-square", text: t("feat1") },
    { icon: "volume-2", text: t("feat2") },
    { icon: "book-open", text: t("feat3") },
  ];

  return (
    <LinearGradient colors={[colors.brand, colors.brandDark]} style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.top}>
          <View style={styles.logoBadge}>
            <Feather name="globe" size={30} color={colors.gold} />
          </View>
          <Text
            style={styles.title}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {APP_NAME}
          </Text>
          <Text style={styles.subtitle}>{t("loginSubtitle")}</Text>
        </View>

        <View style={styles.features}>
          {features.map((f) => (
            <View key={f.text} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Feather name={f.icon as any} size={18} color={colors.brand} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.bottom}>
          <Pressable
            style={styles.googleButton}
            onPress={signIn}
            disabled={signingIn}
            testID="google-signin-button"
          >
            {signingIn ? (
              <ActivityIndicator color={colors.onSurface} />
            ) : (
              <>
                <Feather name="log-in" size={20} color={colors.onSurface} />
                <Text style={styles.googleText}>{t("continueGoogle")}</Text>
              </>
            )}
          </Pressable>

          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={radius.pill}
              style={styles.appleButton}
              onPress={onApple}
              testID="apple-signin-button"
            />
          )}

          <Text style={styles.legal}>{t("legal")}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: "space-between",
  },
  top: { alignItems: "center", marginTop: spacing.xxl },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: "rgba(212,175,55,0.15)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.onBrand,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(253,251,247,0.75)",
    textAlign: "center",
    marginTop: spacing.md,
  },
  features: {
    gap: spacing.lg,
    marginVertical: spacing.xl,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onBrand,
    flex: 1,
  },
  bottom: { gap: spacing.md },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
  },
  googleText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.onSurface,
  },
  appleButton: {
    width: "100%",
    height: 54,
  },
  legal: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "rgba(253,251,247,0.5)",
    textAlign: "center",
  },
});
