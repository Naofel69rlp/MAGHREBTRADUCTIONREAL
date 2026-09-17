import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { api, BASE_URL } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { useI18n } from "@/src/i18n/I18nContext";
import { useSubscription } from "@/src/lib/revenuecat";
import { Flag } from "@/src/components/Flag";
import { ResultCard, type TranslationResult } from "@/src/components/ResultCard";
import { playAudioUrl } from "@/src/audio/player";
import { colors, fonts, radius, spacing } from "@/src/theme/theme";
import { isDialect, LANG_LIST, type LangCode } from "@/src/theme/languages";

type Phase = "camera" | "preview" | "result";

interface OcrResult extends TranslationResult {
  no_text?: boolean;
}

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style);
}

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { t, langName } = useI18n();
  const { isSubscribed } = useSubscription();

  const cameraRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();

  const [phase, setPhase] = useState<Phase>("camera");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [target, setTarget] = useState<LangCode>("fr");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [listening, setListening] = useState(false);
  const [savedHistory, setSavedHistory] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const resetToCamera = () => {
    setPhase("camera");
    setPhotoUri(null);
    setImageB64(null);
    setResult(null);
    setIsFav(false);
    setSavedHistory(false);
  };

  const processImage = useCallback(async (uri: string) => {
    const manip = await manipulateAsync(uri, [{ resize: { width: 1500 } }], {
      compress: 0.6,
      base64: true,
      format: SaveFormat.JPEG,
    });
    setPhotoUri(manip.uri);
    setImageB64(manip.base64 ?? null);
    setResult(null);
    setIsFav(false);
    setSavedHistory(false);
    setPhase("preview");
  }, []);

  const takePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) await processImage(photo.uri);
    } catch {
      showToast(t("tError"), "error");
    } finally {
      setCapturing(false);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        showToast(t("cameraSettings"), "error");
        Linking.openSettings();
      }
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      await processImage(res.assets[0].uri);
    }
  };

  const doTranslate = async (tgt: LangCode = target) => {
    if (!imageB64) return;
    haptic();
    setLoading(true);
    try {
      // Client-side premium gate (RC entitlement OR backend allowlist), same as text translate.
      const usage = await api.get("/usage");
      const premiumActive = isSubscribed || !!usage?.is_premium;
      if (!premiumActive && usage && usage.remaining <= 0) {
        showToast(t("tLimit"), "error");
        setLoading(false);
        router.push("/premium");
        return;
      }
      const data: OcrResult = await api.post("/ocr-translate", {
        image_base64: imageB64,
        target_lang: tgt,
      });
      if (data.no_text || !data.translated_text) {
        showToast(t("ocrNoText"), "info");
        setLoading(false);
        return;
      }
      setResult(data);
      setIsFav(false);
      setSavedHistory(false);
      setPhase("result");
    } catch (e: any) {
      if (e?.status === 429) {
        showToast(t("tLimit"), "error");
        router.push("/premium");
      } else {
        showToast(t("ocrFailed"), "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const onSelectTarget = (code: LangCode) => {
    setPickerOpen(false);
    setTarget(code);
    if (phase === "result" && imageB64) {
      doTranslate(code);
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

  const onAddToHistory = async () => {
    if (!result || savedHistory) return;
    haptic();
    try {
      await api.post("/history", {
        source_text: result.source_text,
        translated_text: result.translated_text,
        phonetic: result.phonetic,
        source_lang: result.source_lang,
        target_lang: result.target_lang,
      });
      setSavedHistory(true);
      showToast(t("addedToHistory"), "success");
    } catch {
      showToast(t("tError"), "error");
    }
  };

  const TargetChip = (
    <Pressable style={styles.targetChip} onPress={() => setPickerOpen(true)} testID="camera-target-chip">
      <Text style={styles.targetChipLabel}>{t("ocrTargetLabel")}</Text>
      <Flag code={target} size={22} />
      <Text style={styles.targetChipName}>{langName(target)}</Text>
      <Feather name="chevron-down" size={16} color={colors.onBrand} />
    </Pressable>
  );

  const langPicker = (
    <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
      <Pressable style={styles.pickerOverlay} onPress={() => setPickerOpen(false)}>
        <View style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>{t("ocrTargetLabel")}</Text>
          <FlatList
            data={LANG_LIST}
            keyExtractor={(l) => l.code}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.pickerRow, item.code === target && styles.pickerRowActive]}
                onPress={() => onSelectTarget(item.code)}
                testID={`camera-lang-${item.code}`}
              >
                <Flag code={item.code} size={26} />
                <Text style={styles.pickerRowName}>{langName(item.code)}</Text>
                {item.code === target && <Feather name="check" size={18} color={colors.brand} />}
              </Pressable>
            )}
          />
        </View>
      </Pressable>
    </Modal>
  );

  // ---- Permission gate ----------------------------------------------------
  if (Platform.OS !== "web" && !camPerm) {
    return (
      <View style={styles.centerRoot}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (Platform.OS !== "web" && camPerm && !camPerm.granted) {
    return (
      <View style={[styles.permRoot, { paddingTop: insets.top + spacing.xl }]}>
        <Pressable style={styles.permBack} onPress={() => router.back()} testID="camera-back-button">
          <Feather name="arrow-left" size={24} color={colors.onBrand} />
        </Pressable>
        <View style={styles.permContent}>
          <View style={styles.permIcon}>
            <Feather name="camera" size={34} color={colors.brandDark} />
          </View>
          <Text style={styles.permTitle}>{t("cameraPermTitle")}</Text>
          <Text style={styles.permText}>{t("cameraPermText")}</Text>
          <Pressable
            style={styles.permBtn}
            testID="camera-permission-button"
            onPress={async () => {
              const res = await requestCamPerm();
              if (!res.granted && !res.canAskAgain) Linking.openSettings();
            }}
          >
            <Text style={styles.permBtnText}>{t("cameraPermBtn")}</Text>
          </Pressable>
          <Pressable style={styles.permGallery} onPress={pickFromGallery}>
            <Feather name="image" size={18} color={colors.gold} />
            <Text style={styles.permGalleryText}>{t("gallery")}</Text>
          </Pressable>
        </View>
        {langPicker}
      </View>
    );
  }

  // ---- Result phase -------------------------------------------------------
  if (phase === "result" && result) {
    return (
      <View style={styles.resultRoot}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable style={styles.topBtn} onPress={() => router.back()} testID="camera-back-button">
            <Feather name="arrow-left" size={22} color={colors.brand} />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>{t("cameraTitle")}</Text>
          <Pressable style={styles.topBtn} onPress={resetToCamera} testID="camera-retake-button">
            <Feather name="camera" size={20} color={colors.brand} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
          showsVerticalScrollIndicator={false}
        >
          {photoUri && (
            <Image source={{ uri: photoUri }} style={styles.resultThumb} resizeMode="cover" />
          )}

          <View style={styles.pickerInline}>{TargetChip}</View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.brand} />
              <Text style={styles.loadingText}>{t("analyzing")}</Text>
            </View>
          ) : (
            <>
              <View style={styles.detectedCard} testID="detected-text-card">
                <View style={styles.detectedHeader}>
                  <Flag code={result.source_lang} size={20} />
                  <Text style={styles.detectedLabel}>
                    {t("detectedText")} · {langName(result.source_lang)}
                  </Text>
                </View>
                <Text
                  style={[styles.detectedText, isDialect(result.source_lang) && styles.rtl]}
                >
                  {result.source_text}
                </Text>
              </View>

              <View style={{ marginTop: spacing.lg }}>
                <ResultCard
                  result={result}
                  isFavorite={isFav}
                  onFavorite={onFavorite}
                  onListen={onListen}
                  onCopy={onCopy}
                  listening={listening}
                />
              </View>

              <Pressable
                style={[styles.historyBtn, savedHistory && styles.historyBtnDone]}
                onPress={onAddToHistory}
                disabled={savedHistory}
                testID="add-history-button"
              >
                <Feather name={savedHistory ? "check" : "clock"} size={18} color={colors.brand} />
                <Text style={styles.historyBtnText}>
                  {savedHistory ? t("addedToHistory") : t("addToHistory")}
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
        {langPicker}
      </View>
    );
  }

  // ---- Preview phase ------------------------------------------------------
  if (phase === "preview" && photoUri) {
    return (
      <View style={styles.cameraRoot}>
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        <View style={[styles.topBar, styles.topBarDark, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable style={styles.topBtnDark} onPress={resetToCamera} testID="camera-retake-button">
            <Feather name="arrow-left" size={22} color={colors.onBrand} />
          </Pressable>
          <Text style={styles.topTitleDark} numberOfLines={1}>{t("cameraTitle")}</Text>
          <View style={styles.topBtnDark} />
        </View>

        <View style={[styles.previewBottom, { paddingBottom: insets.bottom + spacing.lg }]}>
          {TargetChip}
          <View style={styles.previewActions}>
            <Pressable style={styles.previewRetake} onPress={resetToCamera}>
              <Feather name="refresh-ccw" size={18} color={colors.onBrand} />
              <Text style={styles.previewRetakeText}>{t("retake")}</Text>
            </Pressable>
            <Pressable
              style={styles.previewTranslate}
              onPress={() => doTranslate()}
              disabled={loading}
              testID="camera-translate-button"
            >
              {loading ? (
                <ActivityIndicator color={colors.brandDark} />
              ) : (
                <>
                  <Feather name="arrow-right-circle" size={20} color={colors.brandDark} />
                  <Text style={styles.previewTranslateText}>{t("translate")}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
        {langPicker}
      </View>
    );
  }

  // ---- Camera (live) phase ------------------------------------------------
  return (
    <View style={styles.cameraRoot}>
      {Platform.OS !== "web" ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.webFallback]}>
          <Feather name="camera-off" size={40} color="rgba(255,255,255,0.5)" />
          <Text style={styles.webFallbackText}>{t("tVoiceMobile")}</Text>
        </View>
      )}

      {/* Framing guide */}
      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />
        </View>
        <Text style={styles.frameHint}>{t("cameraFrameHint")}</Text>
      </View>

      <View style={[styles.topBar, styles.topBarDark, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable style={styles.topBtnDark} onPress={() => router.back()} testID="camera-back-button">
          <Feather name="arrow-left" size={22} color={colors.onBrand} />
        </Pressable>
        <Text style={styles.topTitleDark} numberOfLines={1}>{t("cameraTitle")}</Text>
        <View style={styles.topBtnDark} />
      </View>

      <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        {TargetChip}
        <View style={styles.controls}>
          <Pressable style={styles.galleryBtn} onPress={pickFromGallery} testID="camera-gallery-button">
            <Feather name="image" size={24} color={colors.onBrand} />
          </Pressable>
          <Pressable style={styles.shutter} onPress={takePhoto} disabled={capturing} testID="camera-capture-button">
            <View style={styles.shutterInner}>
              {capturing ? <ActivityIndicator color={colors.brandDark} /> : null}
            </View>
          </Pressable>
          <View style={styles.galleryBtn} />
        </View>
      </View>
      {langPicker}
    </View>
  );
}

const OVERLAY = "rgba(18,58,34,0.55)";

const styles = StyleSheet.create({
  centerRoot: { flex: 1, backgroundColor: colors.brandDark, alignItems: "center", justifyContent: "center" },
  cameraRoot: { flex: 1, backgroundColor: "#000" },
  webFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.brandDark, gap: spacing.md },
  webFallbackText: { color: "rgba(255,255,255,0.7)", fontFamily: fonts.medium, fontSize: 14 },

  // Top bar (light + dark variants)
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarDark: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: "transparent", borderBottomWidth: 0 },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  topBtnDark: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  topTitle: { flex: 1, textAlign: "center", fontFamily: fonts.displaySemi, fontSize: 18, color: colors.brand },
  topTitleDark: { flex: 1, textAlign: "center", fontFamily: fonts.semibold, fontSize: 15, color: colors.onBrand },

  // Framing guide
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  frame: { width: "78%", height: "40%", borderRadius: radius.lg },
  corner: { position: "absolute", width: 34, height: 34, borderColor: colors.gold },
  cTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: radius.lg },
  cTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: radius.lg },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: radius.lg },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: radius.lg },
  frameHint: {
    marginTop: spacing.xl,
    color: colors.onBrand,
    fontFamily: fonts.medium,
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    overflow: "hidden",
  },

  // Camera bottom controls
  cameraBottom: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.xl, gap: spacing.lg },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  galleryBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: colors.gold, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(212,175,55,0.2)" },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.onBrand, alignItems: "center", justifyContent: "center" },

  // Target chip (over dark)
  targetChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: spacing.sm,
    backgroundColor: OVERLAY,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.5)",
  },
  targetChipLabel: { fontFamily: fonts.medium, fontSize: 12, color: "rgba(253,251,247,0.75)" },
  targetChipName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onBrand },

  // Preview
  previewBottom: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.xl, gap: spacing.lg },
  previewActions: { flexDirection: "row", gap: spacing.md },
  previewRetake: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0.45)" },
  previewRetakeText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onBrand },
  previewTranslate: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.gold },
  previewTranslateText: { fontFamily: fonts.bold, fontSize: 16, color: colors.brandDark },

  // Result
  resultRoot: { flex: 1, backgroundColor: colors.surface },
  resultThumb: { width: "100%", height: 160, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  pickerInline: { marginTop: spacing.lg, alignItems: "center" },
  loadingBox: { marginTop: spacing.xxl, alignItems: "center", gap: spacing.md },
  loadingText: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurfaceTertiary },
  detectedCard: { marginTop: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  detectedHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  detectedLabel: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: colors.onSurfaceTertiary },
  detectedText: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 26, color: colors.onSurface },
  rtl: { textAlign: "right", writingDirection: "rtl" },
  historyBtn: { marginTop: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  historyBtnDone: { opacity: 0.7 },
  historyBtnText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.brand },

  // Permission
  permRoot: { flex: 1, backgroundColor: colors.brandDark, paddingHorizontal: spacing.xl },
  permBack: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  permContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingBottom: spacing.xxxl },
  permIcon: { width: 72, height: 72, borderRadius: 22, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  permTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.onBrand, textAlign: "center" },
  permText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: "rgba(253,251,247,0.8)", textAlign: "center", paddingHorizontal: spacing.md },
  permBtn: { marginTop: spacing.lg, backgroundColor: colors.gold, paddingVertical: spacing.lg, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  permBtnText: { fontFamily: fonts.bold, fontSize: 16, color: colors.brandDark },
  permGallery: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  permGalleryText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.gold },

  // Lang picker modal
  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  pickerCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "70%" },
  pickerTitle: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.onSurface, marginBottom: spacing.md, textAlign: "center" },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md },
  pickerRowActive: { backgroundColor: colors.brandTertiary },
  pickerRowName: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface },
});
