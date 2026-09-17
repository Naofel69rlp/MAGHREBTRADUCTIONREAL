import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";
import { APP_NAME, colors, fonts } from "@/src/theme/theme";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container} testID="splash-loading">
        <Text style={styles.logo}>{APP_NAME}</Text>
        <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.brand,
    textAlign: "center",
  },
});
