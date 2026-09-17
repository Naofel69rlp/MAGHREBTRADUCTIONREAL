import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius, spacing } from "@/src/theme/theme";

type ToastType = "success" | "error" | "info";

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICON: Record<ToastType, keyof typeof Feather.glyphMap> = {
  success: "check-circle",
  error: "alert-triangle",
  info: "info",
};

const BG: Record<ToastType, string> = {
  success: colors.success,
  error: colors.error,
  info: colors.brand,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    setToast({ message, type });
    opacity.value = withTiming(1, { duration: 220 });
    translateY.value = withTiming(0, { duration: 220 });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 220 });
      translateY.value = withTiming(-20, { duration: 220 });
    }, 2600);
  }, [opacity, translateY]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            { top: insets.top + spacing.sm, backgroundColor: BG[toast.type] },
            style,
          ]}
          testID="app-toast"
        >
          <Feather name={ICON[toast.type]} size={18} color="#fff" />
          <Text style={styles.text} numberOfLines={2}>
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    flex: 1,
    color: "#fff",
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
});
