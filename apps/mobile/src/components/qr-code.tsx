import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { drawQrCode, roundedSquare } from "@/lib/qr-paths";
import { PomiMark } from "./logo";

// A QR code drawn the way Pomi's cards show it: rounded modules, soft finder
// eyes and Pomi's mark in a cleared centre, all in one ink. Dark ink on a light
// ground, never the reverse, because some wallets' scanners cannot read a
// light code on a dark ground. Error correction "H" survives the cleared
// centre, and Pomi's links fit in version 6 or below, which have no alignment
// pattern there to lose.
export function QrCode({
  value,
  size,
  ink = "#15121C",
  ground = "#FFFFFF",
  quietZone = 2,
}: {
  value: string;
  size: number;
  ink?: string;
  ground?: string;
  // In modules. A card around the code adds to it.
  quietZone?: number;
}) {
  const code = useMemo(() => drawQrCode(value), [value]);
  const extent = code.count + quietZone * 2;
  const markSize = (size * (code.clear - 2)) / extent;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="QR code for this link"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`${String(-quietZone)} ${String(-quietZone)} ${String(extent)} ${String(extent)}`}
      >
        <Path d={roundedSquare(-quietZone, -quietZone, extent, quietZone * 1.6)} fill={ground} />
        <Path d={code.modules} fill={ink} />
        <Path d={code.finders} fill={ink} fillRule="evenodd" />
      </Svg>
      <View style={{ position: "absolute" }}>
        <PomiMark size={markSize} color={ink} />
      </View>
    </View>
  );
}
