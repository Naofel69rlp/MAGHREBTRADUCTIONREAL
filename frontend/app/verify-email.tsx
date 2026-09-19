import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, radius, spacing } from "@/src/theme/theme";

export default function VerifyEmail() {
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { refreshUser } = useAuth();
  const { showToast } = useToast();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const onVerify = async () => {
    if (code.trim().length !== 6) {
      showToast("Le code contient 6 chiffres", "error");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/verify-email", { email, code: code.trim() });
      await refreshUser();
      showToast("Email vérifié !", "success");
      router.replace("/(tabs)");
    } catch (e: any) {
      showToast(e?.message || "Code incorrect", "error");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setResending(true);
    try {
      await api.post("/auth/resend-verification", { email });
      showToast("Nouveau code envoyé", "success");
    } catch (e: any) {
      showToast(e?.message || "Impossible de renvoyer le code", "error");
    } finally {
      setResending(false);
    }
  };

  return (
    <LinearGradient colors={[colors.brand, colors.brandDark]} style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View
          style={[
            styles.content,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
          ]}
        >
          <View style={styles.iconBadge}>
            <Feather name="mail" size={32} color={colors.gold} />
          </View>

          <Text style={styles.title}>Vérifie ton email</Text>
          <Text style={styles.subtitle}>
            On a envoyé un code à 6 chiffres à{"\n"}
            <Text style={{ fontFamily: fonts.bold }}>{email}</Text>
          </Text>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor="rgba(44,43,41,0.3)"
          />

          <Pressable style={styles.submitButton} onPress={onVerify} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.onGold} />
            ) : (
              <Text style={styles.submitText}>Vérifier</Text>
            )}
          </Pressable>

          <Pressable style={styles.resendButton} onPress={onResend} disabled={resending}>
            <Text style={styles.resendText}>
              {resending ? "Envoi..." : "Renvoyer le code"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.xl, alignItems: "center", justifyContent: "center" },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: "rgba(212,175,55,0.15)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.onBrand,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(253,251,247,0.8)",
    textAlign: "center",
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
  codeInput: {
    width: "100%",
    backgroundColor: colors.surface,
    color: colors.onSurface,
    fontFamily: fonts.bold,
    fontSize: 28,
    textAlign: "center",
    letterSpacing: 12,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },
  submitButton: {
    width: "100%",
    backgroundColor: colors.gold,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.onGold,
  },
  resendButton: {
    marginTop: spacing.lg,
    padding: spacing.sm,
  },
  resendText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.gold,
  },
});
