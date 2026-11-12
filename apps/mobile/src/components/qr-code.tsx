import qrcode from "qrcode-generator";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

// Drawn with plain views, so the app needs no SVG or native QR library.
// Always dark on white with a quiet zone, which every scanner reads.
export function QrCode({ value, size }: { value: string; size: number }) {
  const modules = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(value);
    code.make();
    const count = code.getModuleCount();
    return Array.from({ length: count }, (_, row) =>
      Array.from({ length: count }, (__, column) => code.isDark(row, column)),
    );
  }, [value]);
  const quietZone = 4;
  const cell = Math.floor(size / (modules.length + quietZone * 2));

  return (
    <View style={[styles.frame, { padding: cell * quietZone }]}>
      {modules.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((dark, columnIndex) => (
            <View
              key={columnIndex}
              style={{ width: cell, height: cell, backgroundColor: dark ? "#000" : "#fff" }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: "#fff", alignSelf: "center", borderRadius: 8 },
  row: { flexDirection: "row" },
});
