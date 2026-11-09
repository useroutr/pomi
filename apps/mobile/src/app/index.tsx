import { product } from "@pomi/shared";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.tagline}>{product.tagline}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  name: { fontSize: 40, fontWeight: "700" },
  tagline: { fontSize: 17, textAlign: "center", opacity: 0.7 },
});
