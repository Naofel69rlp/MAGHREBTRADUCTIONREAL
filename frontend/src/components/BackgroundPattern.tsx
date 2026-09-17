import React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";

const PATTERN_URL =
  "https://images.unsplash.com/photo-1714636608872-048fc9231892?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwxfHxzdWJ0bGUlMjBnZW9tZXRyaWMlMjBwYXR0ZXJuJTIwd2hpdGUlMjBiZWlnZSUyMHRleHR1cmV8ZW58MHx8fHwxNzg2ODE5NDgzfDA&ixlib=rb-4.1.0&q=85";

export function BackgroundPattern() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: PATTERN_URL }}
        style={[StyleSheet.absoluteFill, styles.img]}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  img: {
    opacity: 0.04,
  },
});
