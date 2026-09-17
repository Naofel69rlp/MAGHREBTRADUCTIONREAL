import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { api, BASE_URL } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { useI18n } from "@/src/i18n/I18nContext";
import { Flag } from "@/src/components/Flag";
import { BackgroundPattern } from "@/src/components/BackgroundPattern";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { playAudioUrl } from "@/src/audio/player";
import { colors, fonts, radius, spacing } from "@/src/theme/theme";
import { type LangCode } from "@/src/theme/languages";

interface Phrase {
  fr: string;
  translations: Record<string, { text: string; phonetic: string }>;
}
interface Category {
  category: string;
  icon: keyof typeof Feather.glyphMap;
  items: Phrase[];
}

const DIALECTS: LangCode[] = ["ma", "dz", "tn"];

export default function ExpressionsScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { t, langName } = useI18n();
  const [data, setData] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialect, setDialect] = useState<LangCode>("ma");
  const [catIndex, setCatIndex] = useState(0);
  const [listeningKey, setListeningKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/expressions");
        setData(res);
      } catch {
        showToast(t("loadErrorExpr"), "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [showToast]);

  const currentItems = useMemo(
    () => (data[catIndex] ? data[catIndex].items : []),
    [data, catIndex],
  );

  const listen = useCallback(
    async (phrase: Phrase) => {
      const key = `${phrase.fr}-${dialect}`;
      if (listeningKey) return;
      const tr = phrase.translations[dialect];
      if (!tr) return;
      setListeningKey(key);
      try {
        const res = await api.post("/tts", { text: tr.text, lang: dialect });
        await playAudioUrl(`${BASE_URL}${res.url}`);
      } catch {
        showToast(t("tAudio"), "error");
      } finally {
        setListeningKey(null);
      }
    },
    [dialect, listeningKey, showToast],
  );

  const saveFav = useCallback(
    async (phrase: Phrase) => {
      const tr = phrase.translations[dialect];
      if (!tr) return;
      try {
        await api.post("/favorites", {
          source_text: phrase.fr,
          translated_text: tr.text,
          phonetic: tr.phonetic,
          source_lang: "fr",
          target_lang: dialect,
        });
        showToast("Ajouté aux favoris", "success");
      } catch {
        showToast("Impossible d'ajouter aux favoris", "error");
      }
    },
    [dialect, showToast],
  );

  return (
    <View style={styles.root}>
      <BackgroundPattern />
      <ScreenHeader title={t("expressionsTitle")} subtitle={t("expressionsSubtitle")} />

      {/* Dialect chips */}
      <View style={styles.dialectRow}>
        {DIALECTS.map((d) => {
          const active = d === dialect;
          return (
            <Pressable
              key={d}
              style={[styles.dialectChip, active && styles.dialectChipActive]}
              onPress={() => setDialect(d)}
              testID={`dialect-${d}`}
            >
              <Flag code={d} size={20} />
              <Text style={[styles.dialectText, active && styles.dialectTextActive]}>
                {langName(d)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Category chips (single horizontal scroller) */}
      {!loading && (
        <View style={styles.catRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRowContent}
          >
            {data.map((c, i) => {
              const active = i === catIndex;
              return (
                <Pressable
                  key={c.category}
                  style={[styles.catChip, active && styles.catChipActive]}
                  onPress={() => setCatIndex(i)}
                  testID={`category-${i}`}
                >
                  <Feather
                    name={c.icon}
                    size={14}
                    color={active ? colors.onBrand : colors.brand}
                  />
                  <Text style={[styles.catText, active && styles.catTextActive]}>
                    {c.category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={currentItems}
          keyExtractor={(item, i) => `${item.fr}-${i}`}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xxl,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const tr = item.translations[dialect];
            const key = `${item.fr}-${dialect}`;
            return (
              <View style={styles.phraseCard} testID={`phrase-${item.fr}`}>
                <View style={styles.phraseTop}>
                  <Text style={styles.phraseFr}>{item.fr}</Text>
                  <View style={styles.phraseActions}>
                    <Pressable onPress={() => listen(item)} hitSlop={8} testID={`phrase-listen-${item.fr}`}>
                      {listeningKey === key ? (
                        <ActivityIndicator size="small" color={colors.brand} />
                      ) : (
                        <Feather name="volume-2" size={20} color={colors.brand} />
                      )}
                    </Pressable>
                    <Pressable onPress={() => saveFav(item)} hitSlop={8} testID={`phrase-fav-${item.fr}`}>
                      <Feather name="star" size={20} color={colors.gold} />
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.phraseArabic}>{tr?.text}</Text>
                <Text style={styles.phrasePhonetic}>{tr?.phonetic}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  dialectRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  dialectChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dialectChipActive: {
    backgroundColor: colors.brandTertiary,
    borderColor: colors.brand,
  },
  dialectText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  dialectTextActive: { color: colors.brand },
  catRow: { height: 56, justifyContent: "center" },
  catRowContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  catChip: {
    flexShrink: 0,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  catText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.brand,
  },
  catTextActive: { color: colors.onBrand },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  phraseCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  phraseTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  phraseFr: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.onSurfaceSecondary,
  },
  phraseActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginLeft: spacing.md,
  },
  phraseArabic: {
    marginTop: spacing.md,
    fontSize: 24,
    fontWeight: "600",
    color: colors.onSurface,
    textAlign: "right",
    writingDirection: "rtl",
  },
  phrasePhonetic: {
    marginTop: spacing.xs,
    fontFamily: fonts.medium,
    fontStyle: "italic",
    fontSize: 15,
    color: colors.brand,
  },
});
