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

import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { colors, fonts, radius, spacing } from "@/src/theme/theme";

export default function EmailAuth() {
  const insets = useSafeAreaInsets();
  const { registerWithEmail, loginWithEmail, signingIn } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<"login" | "register">("register");

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isRegister = mode === "register";

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      showToast("Email et mot de passe requis", "error");
      return;
    }
    if (isRegister) {
      if (!username.trim() || !firstName.trim() || !lastName.trim()) {
        showToast("Nom d'utilisateur, prénom et nom sont requis", "error");
        return;
      }
      if (password.length < 6) {
        showToast("Le mot de passe doit contenir au moins 6 caractères", "error");
        return;
      }
      if (password !== confirmPassword) {
        showToast("Les mots de passe ne correspondent pas", "error");
        return;
      }
      try {
        await registerWithEmail({
          username: username.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
        });
      } catch (e: any) {
        showToast(e?.message || "Impossible de créer le compte", "error");
      }
    } else {
      try {
        await loginWithEmail(email.trim(), password);
      } catch (e: any) {
        showToast(e?.message || "Email ou mot de passe incorrect", "error");
      }
    }
  };

  return (
    <LinearGradient colors={[colors.brand, colors.brandDark]} style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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

          <Text style={styles.title}>
            {isRegister ? "Créer un compte" : "Se connecter"}
          </Text>
          <Text style={styles.subtitle}>
            {isRegister
              ? "Rejoins MaghrebTraduction avec ton email"
              : "Connecte-toi avec ton email et mot de passe"}
          </Text>

          <View style={styles.form}>
            {isRegister && (
              <>
                <Field label="Nom d'utilisateur" value={username} onChangeText={setUsername} autoCapitalize="none" />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Field label="Prénom" value={firstName} onChangeText={setFirstName} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Nom" value={lastName} onChangeText={setLastName} />
                  </View>
                </View>
                <Field
                  label="Téléphone (facultatif)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </>
            )}

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Field
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {isRegister && (
              <Field
                label="Confirmer le mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            )}
          </View>

          <Pressable style={styles.submitButton} onPress={onSubmit} disabled={signingIn}>
            {signingIn ? (
              <ActivityIndicator color={colors.onSurface} />
            ) : (
              <Text style={styles.submitText}>
                {isRegister ? "Créer mon compte" : "Se connecter"}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.switchModeButton}
            onPress={() => setMode(isRegister ? "login" : "register")}
          >
            <Text style={styles.switchModeText}>
              {isRegister
                ? "Déjà un compte ? Se connecter"
                : "Pas encore de compte ? S'inscrire"}
            </Text>
          </Pressable>
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
    color: "rgba(253,251,247,0.75)",
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  form: { gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  field: { gap: spacing.xs },
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
    marginTop: spacing.xl,
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
  switchModeButton: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  switchModeText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.gold,
  },
});
