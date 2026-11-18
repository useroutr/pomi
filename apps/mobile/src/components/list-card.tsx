import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { radius, usePalette } from "@/theme/theme";

// Where a row's text starts (padding, logo, gap), so dividers line up with it.
const DIVIDER_INSET = 68;

// Rows grouped in one rounded card with hairline dividers, the way banking
// apps list transactions.
export function ListCard({ children }: { children: ReactNode }) {
  const palette = usePalette();
  const rows = Children.toArray(children);
  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>
      {rows.map((row, index) => (
        <Fragment key={isValidElement(row) && row.key !== null ? row.key : index}>
          {index > 0 && <View style={[styles.divider, { backgroundColor: palette.line }]} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.row,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: DIVIDER_INSET },
});
