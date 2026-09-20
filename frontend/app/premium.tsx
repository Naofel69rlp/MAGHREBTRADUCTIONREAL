import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { PurchasesPackage } from "react-native-purchases";

import { useToast } from "@/src/components/Toast";
import { useI18n } from "@/src/i18n/I18nContext";
import { useSubscription } from "@/src/lib/revenuecat";
import { APP_NAME, colors, fonts, radius, spacing } from "@/src/theme/theme";

const HERO =
  "https://images.unsplash.com/photo-1678851168042-cc40b9f93a8f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2OTV8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwZWxlZ2FudCUyMGRhcmslMjBncmVlbiUyMGFuZCUyMGdvbGQlMjBhYnN0cmFjdCUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzg2ODE5NDgzfDA&ixlib=rb-4.1.0&q=85";

// Compact localisation for the purchase-flow specific strings.
const RC: Record<string, Record<string, string>> = {
  fr: { restore: "Restaurer mes achats", unavailable: "Abonnements indisponibles pour le moment. Réessayez plus tard.", confirmTitle: "Confirmer l'abonnement", confirmYes: "Confirmer", cancel: "Annuler", already: "Vous êtes déjà Premium 🎉", thanks: "Merci ! Premium activé.", best: "MEILLEURE OFFRE", simulated: "Achat simulé (Test Store)" },
  en: { restore: "Restore purchases", unavailable: "Subscriptions are unavailable right now. Please try again later.", confirmTitle: "Confirm subscription", confirmYes: "Confirm", cancel: "Cancel", already: "You are already Premium 🎉", thanks: "Thanks! Premium activated.", best: "BEST VALUE", simulated: "Simulated purchase (Test Store)" },
  es: { restore: "Restaurar compras", unavailable: "Las suscripciones no están disponibles ahora. Inténtalo más tarde.", confirmTitle: "Confirmar suscripción", confirmYes: "Confirmar", cancel: "Cancelar", already: "Ya eres Premium 🎉", thanks: "¡Gracias! Premium activado.", best: "MEJOR OFERTA", simulated: "Compra simulada (Test Store)" },
  it: { restore: "Ripristina acquisti", unavailable: "Abbonamenti non disponibili al momento. Riprova più tardi.", confirmTitle: "Conferma abbonamento", confirmYes: "Conferma", cancel: "Annulla", already: "Sei già Premium 🎉", thanks: "Grazie! Premium attivato.", best: "MIGLIORE OFFERTA", simulated: "Acquisto simulato (Test Store)" },
  nl: { restore: "Aankopen herstellen", unavailable: "Abonnementen zijn nu niet beschikbaar. Probeer het later opnieuw.", confirmTitle: "Abonnement bevestigen", confirmYes: "Bevestigen", cancel: "Annuleren", already: "Je bent al Premium 🎉", thanks: "Bedankt! Premium geactiveerd.", best: "BESTE KEUS", simulated: "Gesimuleerde aankoop (Test Store)" },
  de: { restore: "Käufe wiederherstellen", unavailable: "Abos sind derzeit nicht verfügbar. Bitte später erneut versuchen.", confirmTitle: "Abo bestätigen", confirmYes: "Bestätigen", cancel: "Abbrechen", already: "Du bist bereits Premium 🎉", thanks: "Danke! Premium aktiviert.", best: "BESTES ANGEBOT", simulated: "Simulierter Kauf (Test Store)" },
  pt: { restore: "Restaurar compras", unavailable: "Assinaturas indisponíveis no momento. Tente novamente mais tarde.", confirmTitle: "Confirmar assinatura", confirmYes: "Confirmar", cancel: "Cancelar", already: "Você já é Premium 🎉", thanks: "Obrigado! Premium ativado.", best: "MELHOR OFERTA", simulated: "Compra simulada (Test Store)" },
};

export default function Premium() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { t, locale } = useI18n();
  const {
    rcEnabled,
    offerings,
    isSubscribed,
    identityReady,
    isLoading,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
  } = useSubscription();

  const s = RC[locale] || RC.fr;
  const [confirmPkg, setConfirmPkg] = useState<PurchasesPackage | null>(null);

  const benefits = [t("b1"), t("b2"), t("b3"), t("b4"), t("b5")];

  const { annual, monthly } = useMemo(() => {
    const pkgs = offerings?.current?.availablePackages ?? [];
    // 1) Standard RevenueCat package types.
    let annual = pkgs.find((p) => p.packageType === "ANNUAL") ?? null;
    let monthly = pkgs.find((p) => p.packageType === "MONTHLY") ?? null;
    // 2) Fallback for custom package/product identifiers (e.g. "45annuel:premium-annuel",
    //    "5mensuel:mensuel-premium") or CUSTOM package types.
    if (!annual) {
      annual =
        pkgs.find((p) =>
          /annu|year|annual|p1y|45/i.test(`${p.identifier} ${p.product?.identifier ?? ""}`),
        ) ?? null;
    }
    if (!monthly) {
      monthly =
        pkgs.find((p) =>
          p !== annual &&
          /mensuel|month|p1m|(^|[^0-9])5([^0-9]|$)/i.test(`${p.identifier} ${p.product?.identifier ?? ""}`),
        ) ?? null;
    }
    // 3) Last resort: exactly the two available packages, higher price = annual.
    if (!annual && !monthly && pkgs.length > 0) {
      const sorted = [...pkgs].sort(
        (a, b) => (a.product?.price ?? 0) - (b.product?.price ?? 0),
      );
      monthly = sorted[0] ?? null;
      annual = sorted.length > 1 ? sorted[sorted.length - 1] : null;
    }
    return { annual, monthly };
  }, [offerings]);

  const hasOfferings = !!(annual || monthly);

  const doPurchase = async (pkg: PurchasesPackage) => {
    setConfirmPkg(null);
    try {
      await purchase(pkg);
      showToast(s.thanks, "success");
      router.back();
    } catch (e: any) {
      if (e?.userCancelled || String(e?.message).includes("cancel")) return;
      if (String(e?.message).includes("identity_not_ready")) {
        showToast(t("tError"), "error");
        return;
      }
      showToast(t("tError"), "error");
    }
  };

  const onRestore = async () => {
    try {
      await restore();
      showToast(s.thanks, "success");
    } catch {
      showToast(t("tError"), "error");
    }
  };

  const renderPlan = (pkg: PurchasesPackage | null, highlight: boolean, fallbackName: string, fallbackPrice: string, per: string) => {
    const price = pkg?.product.priceString ?? fallbackPrice;
    const selectable = !!pkg && !isSubscribed && identityReady;
    return (
      <Pressable
        style={[styles.plan, highlight && styles.planHighlight, !selectable && styles.planDisabled]}
        onPress={() => pkg && selectable && setConfirmPkg(pkg)}
        disabled={!selectable}
        testID={highlight ? "plan-annual" : "plan-monthly"}
      >
        {highlight && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{s.best}</Text>
          </View>
        )}
        <Text style={styles.planName}>{fallbackName}</Text>
        <Text style={styles.planPrice}>{price}</Text>
        <Text style={styles.planPer}>{per}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={{ uri: HERO }} style={StyleSheet.absoluteFill} resizeMode="cover">
        <LinearGradient
          colors={["rgba(18,58,34,0.55)", "rgba(18,58,34,0.9)", colors.brandDark]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <Pressable
        style={[styles.close, { top: insets.top + spacing.sm }]}
        onPress={() => router.back()}
        testID="premium-close-button"
      >
        <Feather name="x" size={22} color={colors.onBrand} />
      </Pressable>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingTop: insets.top + spacing.xxxl,
          paddingBottom: insets.bottom + spacing.xl,
          flexGrow: 1,
          justifyContent: "space-between",
        }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <View style={styles.crown}>
            <Feather name="award" size={30} color={colors.brandDark} />
          </View>
          <Text style={styles.title}>{t("premiumTitle", { app: APP_NAME })}</Text>
          <Text style={styles.subtitle}>{t("premiumSubtitle")}</Text>

          <View style={styles.benefits}>
            {benefits.map((b) => (
              <View key={b} style={styles.benefit}>
                <Feather name="check-circle" size={20} color={colors.gold} />
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>

          {isSubscribed ? (
            <View style={styles.alreadyBox} testID="already-premium">
              <Feather name="check-circle" size={22} color={colors.gold} />
              <Text style={styles.alreadyText}>{s.already}</Text>
            </View>
          ) : isLoading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xxl }} />
          ) : hasOfferings ? (
            <View style={styles.plans}>
              {renderPlan(annual, true, t("annual"), "45 €", `${t("perYear")} · ${t("monthEq")}`)}
              {renderPlan(monthly, false, t("monthly"), "5 €", t("perMonth"))}
            </View>
          ) : (
            <Text style={styles.unavailable} testID="offerings-unavailable">{s.unavailable}</Text>
          )}
        </View>

        <View style={styles.bottom}>
          {!isSubscribed && hasOfferings && (
            <Text style={styles.tapHint}>{t("premiumNote")}</Text>
          )}
          {rcEnabled && (
            <Pressable style={styles.restore} onPress={onRestore} disabled={isRestoring} testID="restore-button">
              {isRestoring ? (
                <ActivityIndicator color={colors.onBrand} />
              ) : (
                <Text style={styles.restoreText}>{s.restore}</Text>
              )}
            </Pressable>
          )}
          <View style={styles.legalRow}>
            <Pressable
              onPress={() => Linking.openURL("https://claude.ai/artifact/ND71x4KbzdU4NHgUzxx55T")}
            >
              <Text style={styles.legalLink}>Politique de confidentialité</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable
              onPress={() =>
                Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")
              }
            >
              <Text style={styles.legalLink}>Conditions d'utilisation</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Confirmation modal (custom — no Alert) */}
      <Modal visible={!!confirmPkg} transparent animationType="fade" onRequestClose={() => setConfirmPkg(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} testID="purchase-confirm-modal">
            <Text style={styles.modalTitle}>{s.confirmTitle}</Text>
            <Text style={styles.modalPrice}>{confirmPkg?.product.priceString}</Text>
            {rcEnabled && <Text style={styles.modalSim}>{s.simulated}</Text>}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setConfirmPkg(null)} testID="confirm-cancel">
                <Text style={styles.modalCancelText}>{s.cancel}</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirm}
                onPress={() => confirmPkg && doPurchase(confirmPkg)}
                disabled={isPurchasing}
                testID="confirm-purchase"
              >
                {isPurchasing ? (
                  <ActivityIndicator color={colors.brandDark} />
                ) : (
                  <Text style={styles.modalConfirmText}>{s.confirmYes}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandDark },
  close: {
    position: "absolute",
    right: spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  crown: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.onBrand },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(253,251,247,0.8)",
    marginTop: spacing.sm,
  },
  benefits: { marginTop: spacing.xl, gap: spacing.md },
  benefit: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  benefitText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onBrand, flex: 1 },
  plans: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xxl },
  plan: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  planHighlight: { borderColor: colors.gold, backgroundColor: "rgba(212,175,55,0.12)" },
  planDisabled: { opacity: 0.6 },
  badge: {
    position: "absolute",
    top: -10,
    left: spacing.lg,
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.5, color: colors.brandDark },
  planName: { fontFamily: fonts.semibold, fontSize: 14, color: "rgba(253,251,247,0.85)" },
  planPrice: { fontFamily: fonts.display, fontSize: 28, color: colors.onBrand, marginTop: spacing.xs },
  planPer: { fontFamily: fonts.regular, fontSize: 12, color: "rgba(253,251,247,0.6)", marginTop: 2 },
  unavailable: {
    marginTop: spacing.xxl,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(253,251,247,0.75)",
    textAlign: "center",
  },
  alreadyBox: {
    marginTop: spacing.xxl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(212,175,55,0.15)",
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  alreadyText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onBrand },
  bottom: { marginTop: spacing.xl, gap: spacing.md },
  tapHint: { fontFamily: fonts.regular, fontSize: 12, color: "rgba(253,251,247,0.6)", textAlign: "center" },
  restore: { paddingVertical: spacing.md, alignItems: "center" },
  restoreText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.gold },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  legalLink: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "rgba(253,251,247,0.6)",
    textDecorationLine: "underline",
  },
  legalDot: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "rgba(253,251,247,0.4)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
  },
  modalTitle: { fontFamily: fonts.displaySemi, fontSize: 20, color: colors.onSurface },
  modalPrice: { fontFamily: fonts.display, fontSize: 30, color: colors.brand, marginTop: spacing.sm },
  modalSim: { fontFamily: fonts.regular, fontSize: 12, color: colors.onSurfaceTertiary, marginTop: spacing.xs },
  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl, width: "100%" },
  modalCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  modalCancelText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurfaceSecondary },
  modalConfirm: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: "center",
  },
  modalConfirmText: { fontFamily: fonts.bold, fontSize: 15, color: colors.brandDark },
});
