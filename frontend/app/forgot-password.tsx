import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, radius, spacing } from "@/src/theme/theme";

export default function ForgotPassword() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onRequestCode = async () => {
    if (!email.trim()) {
      showToast("Entre ton email", "error");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      showToast("Si ce compte existe, un code a été envoyé", "success");
      setStep("reset");
    } catch (e: any) {
      showToast(e?.message || "Une erreur est survenue", "error");
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    if (code.trim().length !== 6) {
      showToast("Le code contient 6 chiffres", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("Le mot de passe doit contenir au moins 6 caractères", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Les mots de passe ne correspondent pas", "error");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: email.trim(),
        code: code.trim(),
        new_password: newPassword,
      });
      showToast("Mot de passe mis à jour !", "success");
      router.replace("/email-auth");
    } catch (e: any) {
      showToast(e?.message || "Code incorrect", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[colors.brand, colors.brandDark]} style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color={colors.onBrand} />
          </Pressable>

          <Text style={styles.title}>Mot de passe oublié</Text>
          <Text style={styles.subtitle}>
            {step === "request"
              ? "Entre ton email, on t'enverra un code pour réinitialiser ton mot de passe."
              : `Entre le code reçu à ${email} et ton nouveau mot de passe.`}
          </Text>

          {step === "request" ? (
            <>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <Pressable style={styles.submitButton} onPress={onRequestCode} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.onGold} />
                ) : (
                  <Text style={styles.submitText}>Envoyer le code</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Field label="Code reçu par email" value={code} onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))} keyboardType="phone-pad" />
              <Field label="Nouveau mot de passe" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
              <Field label="Confirmer le mot de passe" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
              <Pressable style={styles.submitButton} onPress={onResetPassword} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color={colors.onGold} />
                ) : (
                  <Text style={styles.submitText}>Réinitialiser le mot de passe</Text>
                )}
              </Pressable>
              <Pressable style={styles.resendButton} onPress={onRequestCode} disabled={loading}>
                <Text style={styles.resendText}>Renvoyer le code</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "phone-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        keyboardType={props.keyboardType ?? "default"}
        placeholderTextColor="rgba(44,43,41,0.4)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, flexGrow: 1 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "rgba(253,251,247,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.onBrand,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(253,251,247,0.75)",
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  field: { gap: spacing.xs, marginBottom: spacing.md },
  fieldLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "rgba(253,251,247,0.85)",
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.onSurface,
    fontFamily: fonts.regular,
    fontSize: 16,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.sm,
  },
  submitButton: {
    marginTop: spacing.lg,
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
    alignItems: "center",
  },
  resendText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.gold,
  },
});
