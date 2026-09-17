import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";

import { type LangCode } from "@/src/theme/languages";

// Map each translation language to its ISO country code for the real flag image.
const ISO: Record<LangCode, string> = {
  fr: "fr",
  ma: "ma",
  dz: "dz",
  tn: "tn",
  en: "gb", // English → United Kingdom flag (Union Jack)
  es: "es",
  it: "it",
  nl: "nl",
};

export function flagUrl(iso: string, width = 80): string {
  return `https://flagcdn.com/w${width}/${iso}.png`;
}

interface Props {
  code: LangCode;
  size?: number;
}

/** Real country flag badge (rounded), rendered from an official flag image. */
export function Flag({ code, size = 26 }: Props) {
  const width = size;
  const height = Math.round(size * 0.75);
  return (
    <View style={[styles.frame, { width, height, borderRadius: Math.max(3, size * 0.14) }]}>
      <Image
        source={{ uri: flagUrl(ISO[code]) }}
        style={{ width, height }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.15)",
    backgroundColor: "#EAE4D8",
  },
});
