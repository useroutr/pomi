import { findSignInCode, SIGN_IN_CODE_LENGTH } from "@pomi/shared";
import { router, useLocalSearchParams } from "expo-router";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, TextInput, View } from "react-native";
import { Button, IconButton } from "@/components/button";
import { Icon } from "@/components/icon";
import { Illustration } from "@/components/illustration";
import { PasteOffer } from "@/components/paste-offer";
import { PressableScale } from "@/components/pressable-scale";
import { Screen, ScreenHeader } from "@/components/screen";
import { Steps } from "@/components/steps";
import { Text } from "@/components/text";
import { useClipboardOffer } from "@/lib/clipboard-offer";
import { haptics } from "@/lib/haptics";
import { useReduceMotion } from "@/lib/reduce-motion";
import { useSession } from "@/lib/session";
import { radius, usePalette } from "@/theme/theme";

// The server sends at most one code a minute to an address.
const RESEND_AFTER_SECONDS = 60;
// Long enough to see the boxes turn green before the next screen.
const ACCEPTED_PAUSE_MS = 350;

type Phase = "entering" | "checking" | "refused" | "accepted";

export default function CodeScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { api, verifyCode } = useSession();
  const palette = usePalette();
  const reduceMotion = useReduceMotion();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("entering");
  const [focused, setFocused] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_AFTER_SECONDS);
  const accepting = phase === "checking" || phase === "accepted";
  const { offer, dismiss } = useClipboardOffer(
    findSignInCode,
    !accepting && code.length < SIGN_IN_CODE_LENGTH,
  );

  useEffect(() => {
    if (secondsLeft === 0) {
      return;
    }
    const timer = setTimeout(() => {
      setSecondsLeft(secondsLeft - 1);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [secondsLeft]);

  function enter(text: string) {
    if (accepting) {
      return;
    }
    // A paste or the keyboard's suggestion can bring a whole sentence.
    const digits = findSignInCode(text) ?? text.replace(/\D/g, "").slice(0, SIGN_IN_CODE_LENGTH);
    setCode(digits);
    setError(null);
    setPhase("entering");
    if (digits.length === SIGN_IN_CODE_LENGTH) {
      void signIn(digits);
    }
  }

  function pasteFromClipboard(text: string) {
    const pasted = findSignInCode(text);
    if (pasted === null) {
      haptics.warning();
      setError("What you copied isn't a 6-digit code. Copy the code from the email and try again.");
      return;
    }
    haptics.select();
    enter(pasted);
  }

  async function signIn(entered: string) {
    setPhase("checking");
    setNotice(null);
    dismiss();
    const result = await verifyCode(email, entered);
    if (!result.ok) {
      haptics.warning();
      setError(result.message);
      setPhase("refused");
      refuse();
      return;
    }
    haptics.success();
    setPhase("accepted");
    setTimeout(() => {
      // A new account claims its link next; a returning one goes home.
      router.replace(result.handle === null ? "/link" : "/home");
    }, ACCEPTED_PAUSE_MS);
  }

  // Shakes the boxes like a refused passcode, then empties them for the next
  // try. The keyboard stays up throughout.
  function refuse() {
    const clear = () => {
      setCode("");
      input.current?.focus();
    };
    if (reduceMotion) {
      clear();
      return;
    }
    Animated.sequence(
      [-10, 10, -7, 7, -3, 0].map((offset) =>
        Animated.timing(shake, { toValue: offset, duration: 50, useNativeDriver: true }),
      ),
    ).start(clear);
  }

  async function resend() {
    setResending(true);
    setError(null);
    const result = await api.postNoContent("/api/auth/code", { email });
    setResending(false);
    if (result.ok) {
      haptics.select();
      setSecondsLeft(RESEND_AFTER_SECONDS);
      setCode("");
      setPhase("entering");
      setNotice("We sent a new code. Use the newest one.");
      input.current?.focus();
    } else {
      haptics.warning();
      setError(result.message);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        leading={
          <IconButton
            icon="back"
            label="Back"
            onPress={() => {
              router.back();
            }}
          />
        }
        trailing={<Steps current={2} />}
      />
      <View style={styles.intro}>
        <Illustration name="mail" size={76} />
        <Text variant="title" accessibilityRole="header">
          Check your email
        </Text>
        <Text variant="body" tone="secondary">
          We sent a 6-digit code to
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${email}. Change email`}
          onPress={() => {
            router.back();
          }}
          style={[styles.emailChip, { backgroundColor: palette.fill }]}
        >
          <Icon name="mail" size={14} color={palette.textSecondary} />
          <Text variant="callout" style={styles.emailText} numberOfLines={1} ellipsizeMode="middle">
            {email}
          </Text>
          <Text variant="label" tone="secondary">
            Change
          </Text>
        </PressableScale>
      </View>

      <Animated.View style={[styles.boxes, { transform: [{ translateX: shake }] }]}>
        <CodeBoxes code={code} phase={phase} focused={focused} reduceMotion={reduceMotion} />
        {/* One real field over the boxes: it takes typing, the keyboard's
            code suggestion from Mail, and a long-press paste. The cursor is
            pinned to the end so a tap mid-code can't insert digits there. */}
        <TextInput
          ref={input}
          value={code}
          onChangeText={enter}
          selection={{ start: code.length, end: code.length }}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          autoFocus
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          accessibilityLabel="Sign-in code, 6 digits"
          caretHidden
          selectionColor="transparent"
          style={styles.field}
        />
      </Animated.View>

      <Status phase={phase} error={error} notice={notice} />

      {offer !== null && (
        <PasteOffer
          offer={offer}
          title="Copied the code?"
          description={
            offer.kind === "found"
              ? `Paste ${offer.value.slice(0, 3)} ${offer.value.slice(3)} from your clipboard.`
              : "No need to type it."
          }
          onPaste={pasteFromClipboard}
        />
      )}

      <View style={styles.resend}>
        <Button
          title={
            secondsLeft > 0
              ? `Resend code in 0:${String(secondsLeft).padStart(2, "0")}`
              : "Resend code"
          }
          variant="plain"
          size="medium"
          pending={resending}
          disabled={secondsLeft > 0 || accepting}
          onPress={() => void resend()}
        />
      </View>
    </Screen>
  );
}

function CodeBoxes({
  code,
  phase,
  focused,
  reduceMotion,
}: {
  code: string;
  phase: Phase;
  focused: boolean;
  reduceMotion: boolean;
}) {
  const palette = usePalette();
  const cursor = phase === "entering" || phase === "refused" ? code.length : -1;
  const boxes = Array.from({ length: SIGN_IN_CODE_LENGTH }, (_, index) => {
    const digit = code[index];
    const active = focused && index === cursor;
    const border =
      phase === "accepted"
        ? palette.paid.foreground
        : phase === "refused"
          ? palette.danger
          : active
            ? palette.focus
            : digit === undefined
              ? "transparent"
              : palette.line;
    return (
      <View
        key={index}
        style={[
          styles.box,
          {
            backgroundColor:
              phase === "accepted"
                ? palette.paid.background
                : digit === undefined
                  ? palette.fill
                  : palette.surface,
            borderColor: border,
          },
        ]}
      >
        {digit !== undefined ? (
          <Text
            variant="title"
            tone={phase === "accepted" ? "paid" : "primary"}
            style={[styles.digit, phase === "checking" && styles.checking]}
          >
            {digit}
          </Text>
        ) : (
          active && <Caret blink={!reduceMotion} />
        )}
      </View>
    );
  });
  const half = SIGN_IN_CODE_LENGTH / 2;
  return (
    <View style={styles.row} accessible={false} importantForAccessibility="no-hide-descendants">
      {boxes.slice(0, half)}
      <View style={[styles.dash, { backgroundColor: palette.textTertiary }]} />
      {boxes.slice(half)}
    </View>
  );
}

function Caret({ blink }: { blink: boolean }) {
  const palette = usePalette();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!blink) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.delay(330),
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [blink, opacity]);
  return <Animated.View style={[styles.caret, { backgroundColor: palette.text, opacity }]} />;
}

// One line under the boxes whose height never changes, so the screen does not
// jump as the code is checked.
function Status({
  phase,
  error,
  notice,
}: {
  phase: Phase;
  error: string | null;
  notice: string | null;
}) {
  const palette = usePalette();
  if (phase === "checking") {
    return (
      <View style={styles.status}>
        <ActivityIndicator size="small" color={palette.textSecondary} />
        <Text variant="callout" tone="secondary">
          Checking your code…
        </Text>
      </View>
    );
  }
  if (phase === "accepted") {
    return (
      <View style={styles.status}>
        <Icon name="checkCircle" size={18} color={palette.paid.foreground} />
        <Text variant="callout" tone="paid">
          You're in.
        </Text>
      </View>
    );
  }
  if (error !== null) {
    return (
      <View style={styles.status} accessibilityLiveRegion="polite">
        <Icon name="warning" size={18} color={palette.danger} />
        <Text variant="callout" tone="danger" style={styles.statusText}>
          {error}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      <Text variant="callout" tone="secondary" style={styles.statusText}>
        {notice ?? "The code works for 10 minutes. If it isn't in your inbox, check spam."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 8, paddingTop: 8, alignItems: "flex-start" },
  emailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%",
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  emailText: { flexShrink: 1, fontWeight: "600" },
  boxes: { marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  box: {
    flex: 1,
    height: 64,
    borderRadius: radius.field,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: { fontSize: 30, lineHeight: 36 },
  checking: { opacity: 0.55 },
  dash: { width: 8, height: 2, borderRadius: 1 },
  caret: { width: 2, height: 28, borderRadius: 1 },
  field: {
    ...StyleSheet.absoluteFill,
    color: "transparent",
    fontSize: 16,
  },
  status: { flexDirection: "row", alignItems: "flex-start", gap: 8, minHeight: 42 },
  statusText: { flex: 1 },
  resend: { marginTop: "auto", alignItems: "center" },
});
