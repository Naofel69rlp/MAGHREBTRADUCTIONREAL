import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { api, BASE_URL } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { useI18n } from "@/src/i18n/I18nContext";
import { BackgroundPattern } from "@/src/components/BackgroundPattern";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { TranslationRow, type RowItem } from "@/src/components/TranslationRow";
import { playAudioUrl } from "@/src/audio/player";
import { colors, fonts, spacing } from "@/src/theme/theme";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [items, setItems] = useState<RowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listeningId, setListeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get("/history");
      setItems(data);
    } catch {
      showToast(t("loadErrorHistory"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const listen = async (item: RowItem) => {
    if (listeningId) return;
    setListeningId(item.id);
    try {
      const data = await api.post("/tts", { text: item.translated_text, lang: item.target_lang });
      await playAudioUrl(`${BASE_URL}${data.url}`);
    } catch {
      showToast(t("tAudio"), "error");
    } finally {
      setListeningId(null);
    }
  };

  const saveFavorite = async (item: RowItem) => {
    try {
      await api.post("/favorites", {
        source_text: item.source_text,
        translated_text: item.translated_text,
        phonetic: item.phonetic,
        source_lang: item.source_lang,
        target_lang: item.target_lang,
      });
      showToast(t("tAddedFav"), "success");
    } catch {
      showToast(t("tFavError"), "error");
    }
  };

  const clearAll = async () => {
    try {
      await api.del("/history");
      setItems([]);
      showToast(t("tHistoryCleared"), "success");
    } catch {
      showToast(t("tError"), "error");
    }
  };

  return (
    <View style={styles.root}>
      <BackgroundPattern />
      <ScreenHeader
        title={t("historyTitle")}
        subtitle={items.length ? t("translationsCount", { n: items.length }) : undefined}
        actionIcon={items.length ? "trash-2" : undefined}
        onAction={clearAll}
        actionTestID="clear-history-button"
      />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.brand} />}
        renderItem={({ item }) => (
          <TranslationRow
            item={item}
            onListen={() => listen(item)}
            listening={listeningId === item.id}
            actionIcon="star"
            actionColor={colors.gold}
            onAction={() => saveFavorite(item)}
            actionTestID={`save-fav-${item.id}`}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty} testID="history-empty">
              <Feather name="clock" size={44} color={colors.surfaceTertiary} />
              <Text style={styles.emptyTitle}>{t("historyEmptyTitle")}</Text>
              <Text style={styles.emptyText}>{t("historyEmptyText")}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingTop: spacing.xxxl,
  },
  emptyTitle: { fontFamily: fonts.displaySemi, fontSize: 20, color: colors.onSurface, textAlign: "center" },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.onSurfaceTertiary, textAlign: "center" },
});
