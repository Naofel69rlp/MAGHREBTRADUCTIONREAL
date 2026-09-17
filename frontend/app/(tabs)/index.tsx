import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";

import { api, BASE_URL } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { useI18n } from "@/src/i18n/I18nContext";
import { useSubscription } from "@/src/lib/revenuecat";
import { BackgroundPattern } from "@/src/components/BackgroundPattern";
import { LanguageSelector } from "@/src/components/LanguageSelector";
import { ResultCard, type TranslationResult } from "@/src/components/ResultCard";
import { playAudioUrl } from "@/src/audio/player";
import { APP_NAME, colors, fonts, radius, spacing } from "@/src/theme/theme";
import { type LangCode } from "@/src/theme/languages";

interface Usage {
  used: number;
  limit: number;
  remaining: number;
  is_premium: boolean;
}

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style);
}

export default function TranslateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useI18n();
  const { isSubscribed } = useSubscription();

  const [source, setSource] = useState<LangCode>("fr");
  const [target, setTarget] = useState<LangCode>("ma");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [listening, setListening] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [recording, setRecording] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const fetchUsage = useCallback(async () => {
    try {
      const u = await api.get("/usage");
      setUsage(u);
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUsage();
    }, [fetchUsage]),
  );

  const onChangeLangs = (s: LangCode, tt: LangCode) => {
    setSource(s);
    setTarget(tt);
    setResult(null);
  };

  const doTranslate = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      showToast(t("tEnterPhrase"), "info");
      return;
    }
    // Client-side premium gate: RC entitlement OR backend allowlist premium.
    const premium = isSubscribed || !!usage?.is_premium;
    if (!premium && usage && usage.remaining <= 0) {
      showToast(t("tLimit"), "error");
      router.push("/premium");
      return;
    }
    haptic();
    setLoading(true);
    setResult(null);
    setIsFav(false);
    try {
      const data = await api.post("/translate", {
        text: trimmed,
        source_lang: source,
        target_lang: target,
      });
      setResult(data);
      if (data.usage) setUsage(data.usage);
    } catch (e: any) {
      if (e.status === 429) {
        showToast(t("tLimit"), "error");
        router.push("/premium");
      } else {
        showToast(t("tTranslateFailed"), "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const onFavorite = async () => {
    if (!result || isFav) return;
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post("/favorites", {
        source_text: result.source_text,
        translated_text: result.translated_text,
        phonetic: result.phonetic,
        source_lang: result.source_lang,
        target_lang: result.target_lang,
      });
      setIsFav(true);
      showToast(t("tAddedFav"), "success");
    } catch {
      showToast(t("tFavError"), "error");
    }
  };

  const onListen = async () => {
    if (!result || listening) return;
    setListening(true);
    try {
      const data = await api.post("/tts", {
        text: result.translated_text,
        lang: result.target_lang,
      });
      await playAudioUrl(`${BASE_URL}${data.url}`);
    } catch {
      showToast(t("tAudio"), "error");
    } finally {
      setListening(false);
    }
  };

  const onCopy = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.translated_text);
    showToast(t("tCopied"), "success");
  };

  const ensureMicPermission = async (): Promise<boolean> => {
    const current = await AudioModule.getRecordingPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain) {
      const req = await AudioModule.requestRecordingPermissionsAsync();
      if (req.granted) return true;
      if (!req.canAskAgain) {
        showToast(t("tMicSettings"), "error");
        Linking.openSettings();
      }
      return req.granted;
    }
    showToast(t("tMicSettings"), "error");
    Linking.openSettings();
    return false;
  };

  const toggleRecord = async () => {
    if (Platform.OS === "web") {
      showToast(t("tVoiceMobile"), "info");
      return;
    }
    if (recording) {
      try {
        await recorder.stop();
        setRecording(false);
        const uri = recorder.uri;
        if (!uri) return;
        setLoading(true);
        const form = new FormData();
        form.append("file", { uri, name: "audio.m4a", type: "audio/m4a" } as any);
        form.append("lang", source);
        const data = await api.postForm("/transcribe", form);
        if (data.text) {
          setText(data.text);
          showToast(t("tTransReady"), "success");
        } else {
          showToast(t("tNoSpeech"), "info");
        }
      } catch {
        showToast(t("tTransFailed"), "error");
      } finally {
        setLoading(false);
      }
      return;
    }

    const ok = await ensureMicPermission();
    if (!ok) return;
    try {
      haptic(Haptics.ImpactFeedbackStyle.Medium);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch {
      showToast(t("tMicUnavailable"), "error");
    }
  };

  const premiumActive = isSubscribed || !!usage?.is_premium;
  const usageLabel = premiumActive
    ? t("premium")
    : usage
      ? t("freeLeft", { n: usage.remaining, limit: usage.limit })
      : "…";

  return (
    <View style={styles.root}>
      <BackgroundPattern />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Text
            style={styles.logo}
            testID="app-logo"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {APP_NAME}
          </Text>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.usageChip}
              onPress={() => router.push("/premium")}
              testID="usage-chip"
            >
              <Feather
                name={premiumActive ? "check-circle" : "zap"}
                size={13}
                color={colors.gold}
              />
              <Text style={styles.usageText}>{usageLabel}</Text>
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              onPress={() => router.push("/settings")}
              testID="settings-button"
            >
              <Feather name="settings" size={18} color={colors.brand} />
            </Pressable>
          </View>
        </View>
        <View style={styles.selectorWrap}>
          <LanguageSelector source={source} target={target} onChange={onChangeLangs} />
        </View>
      </View>

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={spacing.xl}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            placeholder={t("placeholder")}
            placeholderTextColor={colors.onSurfaceTertiary}
            multiline
            value={text}
            onChangeText={setText}
            testID="translate-input"
          />
          <View style={styles.inputFooter}>
            {text.length > 0 && (
              <Pressable onPress={() => setText("")} testID="clear-input-button" hitSlop={8}>
                <Feather name="x-circle" size={22} color={colors.onSurfaceTertiary} />
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable
              style={styles.micFab}
              onPress={() => router.push("/camera")}
              testID="camera-button"
            >
              <Feather name="camera" size={20} color={colors.brand} />
            </Pressable>
            <Pressable
              style={[styles.micFab, recording && styles.micFabActive]}
              onPress={toggleRecord}
              testID="mic-button"
            >
              <Feather
                name={recording ? "square" : "mic"}
                size={20}
                color={recording ? colors.onBrand : colors.brand}
              />
            </Pressable>
          </View>
        </View>

        <Pressable
          style={[styles.translateBtn, loading && styles.translateBtnDisabled]}
          onPress={doTranslate}
          disabled={loading}
          testID="translate-button"
        >
          {loading ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <>
              <Feather name="arrow-right-circle" size={20} color={colors.onBrand} />
              <Text style={styles.translateBtnText}>{t("translate")}</Text>
            </>
          )}
        </Pressable>

        {loading && !result && (
          <View style={styles.skeleton} testID="result-skeleton">
            <View style={[styles.skelLine, { width: "40%" }]} />
            <View style={[styles.skelLine, { width: "90%", height: 26 }]} />
            <View style={[styles.skelLine, { width: "60%" }]} />
          </View>
        )}

        {result && !loading && (
          <View style={styles.resultWrap}>
            <ResultCard
              result={result}
              isFavorite={isFav}
              onFavorite={onFavorite}
              onListen={onListen}
              onCopy={onCopy}
              listening={listening}
            />
          </View>
        )}

        {!result && !loading && (
          <View style={styles.empty} testID="translate-empty">
            <Feather name="message-square" size={40} color={colors.surfaceTertiary} />
            <Text style={styles.emptyText}>{t("homeEmpty")}</Text>
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.brand,
    flex: 1,
    marginRight: spacing.sm,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  usageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.goldSoft,
  },
  usageText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.brand,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  selectorWrap: { marginTop: spacing.md },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  inputCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 150,
  },
  input: {
    flex: 1,
    minHeight: 90,
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 26,
    color: colors.onSurface,
    textAlignVertical: "top",
  },
  inputFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  micFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  micFabActive: {
    backgroundColor: colors.error,
  },
  translateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
  },
  translateBtnDisabled: { opacity: 0.6 },
  translateBtnText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.onBrand,
  },
  resultWrap: { marginTop: spacing.xl },
  skeleton: {
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  skelLine: {
    height: 16,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceTertiary,
  },
  empty: {
    marginTop: spacing.xxxl,
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.onSurfaceTertiary,
    textAlign: "center",
  },
});
