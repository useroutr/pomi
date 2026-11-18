import { product } from "@pomi/shared";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type ViewStyle } from "react-native";
import { AssetLogo, NetworkLogo } from "@/components/asset-logo";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { Illustration, type IllustrationName } from "@/components/illustration";
import { PomiLogo } from "@/components/logo";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { useReduceMotion } from "@/lib/reduce-motion";
import { BRAND_SCREEN_GRADIENT } from "@/theme/palette";
import { radius } from "@/theme/theme";

// The first screen, painted in the brand colors the way money apps open:
// what Pomi does, shown by 3D objects and two payments, then one way in.
// The same step serves people new and returning: email works for both.
export default function WelcomeScreen() {
  return (
    <Screen
      scroll={false}
      backgroundStyle={styles.brandScreen}
      footer={
        <>
          <Button
            title="Get started"
            variant="inverse"
            onPress={() => {
              router.push("/email");
            }}
          />
          <View style={styles.trust}>
            <Icon name="lock" size={12} color="rgba(255, 255, 255, 0.9)" />
            <Text variant="footnote" style={styles.soft}>
              Pomi never holds your money.
            </Text>
          </View>
        </>
      }
    >
      <StatusBar style="light" />
      <View style={styles.stage}>
        <Floating name="coin" size={92} style={styles.coin} delay={0} />
        <Floating name="moneyBag" size={190} style={styles.bag} delay={400} />
        <Floating name="wallet" size={104} style={styles.wallet} delay={800} />
        <Chip style={styles.chipOne} tilt="-4deg" delay={300}>
          <AssetLogo symbol="USDC" size={24} />
          <Text variant="label" style={styles.chipText}>
            +25 USDC from Kemi
          </Text>
        </Chip>
        <Chip style={styles.chipTwo} tilt="3deg" delay={600}>
          <View>
            <AssetLogo symbol="ETH" size={24} />
            <View style={styles.chipBadge}>
              <NetworkLogo network="base" size={11} />
            </View>
          </View>
          <Text variant="label" style={styles.chipText}>
            Paid with ETH on Base
          </Text>
        </Chip>
      </View>
      <View style={styles.words}>
        <View accessibilityRole="header">
          <PomiLogo height={52} color="#FFFFFF" />
        </View>
        <Text variant="title2" style={[styles.tagline, styles.white]}>
          {product.tagline}
        </Text>
      </View>
    </Screen>
  );
}

// A 3D object that rises into place, then drifts up and down slowly.
function Floating({
  name,
  size,
  style,
  delay,
}: {
  name: IllustrationName;
  size: number;
  style: ViewStyle;
  delay: number;
}) {
  const reduceMotion = useReduceMotion();
  const appear = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      appear.setValue(1);
      return;
    }
    Animated.timing(appear, {
      toValue: 1,
      duration: 600,
      delay,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut((value) => Easing.sin(value)),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut((value) => Easing.sin(value)),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [appear, drift, delay, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.floating,
        style,
        {
          opacity: appear,
          transform: [
            { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
            { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
          ],
        },
      ]}
    >
      <Illustration name={name} size={size} />
    </Animated.View>
  );
}

function Chip({
  children,
  style,
  tilt,
  delay,
}: {
  children: ReactNode;
  style: ViewStyle;
  tilt: string;
  delay: number;
}) {
  const reduceMotion = useReduceMotion();
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: reduceMotion ? 0 : 520,
      delay: reduceMotion ? 0 : delay,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    }).start();
  }, [appear, delay, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.chip,
        style,
        {
          opacity: appear,
          transform: [
            { rotate: tilt },
            { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  brandScreen: { backgroundImage: BRAND_SCREEN_GRADIENT },
  stage: { flex: 1, minHeight: 360 },
  floating: { position: "absolute" },
  coin: { top: "6%", left: "4%" },
  bag: { top: "24%", alignSelf: "center" },
  wallet: { bottom: "4%", right: "2%" },
  words: { gap: 8, paddingBottom: 8 },
  white: { color: "#FFFFFF" },
  soft: { color: "rgba(255, 255, 255, 0.9)" },
  tagline: { fontFamily: "BricolageGrotesque_500Medium" },
  chip: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 8,
    paddingRight: 14,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: "#FFFFFF",
    boxShadow: "0 10px 24px rgba(20, 10, 40, 0.22)",
  },
  chipOne: { top: "10%", right: 0 },
  chipTwo: { bottom: "16%", left: 0 },
  chipText: { fontSize: 14, color: "#15121C" },
  chipBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  trust: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 10,
  },
});
