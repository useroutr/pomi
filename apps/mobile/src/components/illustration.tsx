import { Image } from "react-native";
import bellHeart from "../../assets/illustrations/bell-heart.png";
import coin from "../../assets/illustrations/coin.png";
import link from "../../assets/illustrations/link.png";
import lock from "../../assets/illustrations/lock.png";
import mail from "../../assets/illustrations/mail.png";
import moneyBag from "../../assets/illustrations/money-bag.png";
import tick from "../../assets/illustrations/tick.png";
import wallet from "../../assets/illustrations/wallet.png";

// 3D renders from 3dicons by Vijay Verma (CC0, github.com/realvjy/3dicons),
// the "gradient" style, whose violet, pink and orange are Pomi's own. Sized
// to 360 px, enough for 120 points on a 3x screen.
const ILLUSTRATIONS = { bellHeart, coin, link, lock, mail, moneyBag, tick, wallet };

export type IllustrationName = keyof typeof ILLUSTRATIONS;

// Decoration: the words next to it carry the meaning, so it is hidden from
// screen readers.
export function Illustration({ name, size = 120 }: { name: IllustrationName; size?: number }) {
  return (
    <Image
      source={ILLUSTRATIONS[name]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}
