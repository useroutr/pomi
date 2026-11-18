# Pomi's mobile design

How the receiver app looks and behaves, and why. The code is the source of truth for exact
values: colors in `apps/mobile/src/theme/palette.ts`, type in `apps/mobile/src/theme/type.ts`,
components in `apps/mobile/src/components`.

## Direction

Vibrant the way shipped money apps are, and clear about money, like a bank. The layouts follow
apps people already use: Home is built like Revolut's (a colored card with its actions on it), the amount screen like Cash App's (the whole screen in the brand color, the number its only
subject), and the paid moment like Monzo's and Cash App's. The welcome screen opens on the
brand gradient with floating 3D objects; Activity leads with "Paid to you this month" per
asset; requests and payments are listed in one rounded card per group, as banking apps list
transactions; a request's detail repeats Home's gradient card and round actions; You is a
profile header over settings rows with colored icon tiles. Four things carry the brand:

- **The vibrant card.** Each tab has one card in the brand colors: the page card on Home, "Paid
  to you" on Activity, the profile on You (`VibrantSurface`). Its ground is a mesh of soft
  radial pools (light violet top left, pink top right, orange bottom right, deep indigo bottom
  left, `VIBRANT_MESH`), which reads as colored light seen through frosted glass, with a fine
  film grain over it: a 128-point tile drawn at 1x, 2x and 3x by
  `apps/mobile/scripts/render-textures.py`, so each speck is one device pixel. White text sits
  top left, where white still meets 4.6:1; the warm pools sit behind white controls. A
  frosted "glass" button carries a card's second action, and a QR code keeps its white tile.
- **The brand gradient.** Violet into pink into orange (`BRAND_GRADIENT` in
  `palette.ts`), for whole screens: the amount screen, the welcome and "You were paid". White
  text sits on its violet end; its orange end carries only large type and white buttons.
- **One violet action per screen** (`#6A3DF5`) on a cool light ground (`#F6F4F9`) with white
  cards. At night the ground turns near-black (`#0E0C14`) and the action a lighter violet.
  Every text color meets 4.5:1 on what it sits on.
- **The mark.** A bold lowercase p whose bowl is a coin (a ring around a dot), its stem cut
  from the bowl by a gap that follows the ring (`POMI_MARK` in `packages/shared/src/mark.ts`,
  drawn by `PomiMark` in the app). Like Linktree's asterisk with its detached trunk, it is one
  flat color, a familiar glyph with one deliberate break, and it reads at favicon size. The
  app icon is the white mark on the brand violet with its coin in coral; the welcome screen
  sets it beside "pomi" in Bricolage Grotesque Bold; it sits in the centre of every QR code.
  The orb survives only as the avatar behind a receiver's initial.
- **3D illustrations** in the same violet, pink and orange carry warmth where a screen would
  otherwise be empty: the first request, the code email, the wallet step, notifications and
  the paid moment.
- **Bricolage Grotesque** for names, titles and amounts; the system font (SF Pro, Roboto) for
  everything read at length, so Dynamic Type keeps working. Display sizes cap their growth so
  a 64-point amount still fits at the largest text size.

## Research behind it

From Apple's Human Interface Guidelines, Nielsen Norman Group's onboarding research, and the
shipped flows of Cash App, Monzo and Luma:

- Asking for money starts with the amount: a large figure over a keypad, as in Cash App.
- Onboarding is only what Pomi needs to pay someone: email, code, their link, where money
  lands. No tutorial carousel. Each step says why it is asked.
- Notifications are asked for after the first request, when "know the moment you're paid"
  means something, and never at launch. The prompt has one button, which opens the system's.
- A finished action is a moment of its own ("You were paid"), and a confirmation repeats what
  happened, when, and where the money went.
- Status is always a word and a dot, never color alone.
- The bottom bar is Pomi's own dock (`components/dock.tsx`, on Expo Router's headless tabs): the
  three tabs in a floating capsule, the current one opened into a dark pill with its name, the
  others icons only, and asking for money as a round violet button beside the capsule, one tap
  away from every tab, as Cash App and Venmo put their main action in the bar. The page fades
  out under the dock rather than showing through it.

## Navigation

```text
welcome → email → code → link (name and handle) → payout → home
tabs: Home · Activity · You, and the dock's + opens ask
sheets: ask (amount → details → ready to share), page QR, scan
pushed: request detail, payout, name, pay box
full screen: you were paid (from a payment notification)
```

A signed-in receiver without a handle is sent to the link step at launch. Skipping the payout
step leaves a notice on Home, and asking for money then leads back to it.

## QR codes

Drawn the way Linktree draws its QR cards: rounded modules, soft finder eyes and the mark in a
cleared centre, all in one ink, straight onto a card of one light color with the receiver's
initial above and the link below (`QrCode`, `ShareCard`; the modules come from `drawQrCode` in
`packages/shared/src/qr-paths.ts`). The page QR screen offers four cards (lavender, peach,
blush, paper; `QR_COLORWAYS`), each ink at least 9.8:1 on its card. Codes stay dark on light,
never inverted, because some wallets' scanners cannot read a light code on a dark ground. Error
correction is H and Pomi's links fit in version 6, so the cleared centre never covers an
alignment pattern. Every colorway was decoded by Apple's Vision framework at card size and at
the 84-point size on Home, with the longest request and handle links.

## Pasting what was copied elsewhere

The two things a receiver copies from another app, the sign-in code from Mail and their
address from a wallet, are offered back as a card ("Copied the code?") when the screen opens
and whenever Pomi returns to the front. On iOS 16 and later the card's button is Apple's own
Paste control, which pastes without the system's "Allow Paste" alert; Pomi never reads the
clipboard unasked there. On Android, where reading is quiet, the card names what it found.

Whatever is pasted, typed or suggested by the keyboard goes through the same finders in
`@pomi/shared` (`findSignInCode`, `findStellarAccount`, `findEvmAddress`), so a whole sentence from the email or
a wallet's payment link still yields the code or the address. The code boxes also take a
long-press paste and the keyboard's code suggestion from Mail.

## Motion and haptics

Springs under 300 ms. Every control shrinks slightly under the finger (`PressableScale`).
Steps of the ask sheet slide in the direction of travel. The amount shrinks smoothly to fit as
digits are added, bumps with each key and shakes when a key is refused; a wrong sign-in code
shakes its boxes the same way. Nothing makes the keyboard drop while a code is checked.
Reduce Motion turns all of this into plain cuts, and stops the orb breathing.

Haptics have one meaning each (`src/lib/haptics.ts`): a light tap on a main button, a tick when
a choice changes or a key is pressed, success when money is asked for or lands, and a warning
when something is refused.

## Assets and where they come from

| Asset                                   | Source                                                                                                                                                                                  | License                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Token, network and wallet logos         | [web3icons](https://github.com/0xa3k5/web3icons), `@web3icons/core` 4.0.60, the "background" set, drawn with `react-native-svg`. 4.0.60 added the Stellar wallets (LOBSTR, Varial, xBull, Albedo, Rabet), Soroswap, Aquarius and BLND. Only imported logos are bundled; other assets get a monogram. | MIT |
| Card grain                              | Rendered by `apps/mobile/scripts/render-textures.py` (seeded noise)                                                                                                                     | Pomi's own                                    |
| 3D illustrations                        | [3dicons](https://github.com/realvjy/3dicons) by Vijay Verma, the "gradient" style, resized to 360 px in `apps/mobile/assets/illustrations`                                              | CC0 1.0                                       |
| Display font                            | Bricolage Grotesque, `@expo-google-fonts/bricolage-grotesque`                                                                                                                           | SIL Open Font License 1.1                     |
| Interface icons                         | SF Symbols on iOS, Material Symbols on Android, through `expo-symbols`                                                                                                                  | Apple's and Google's terms for system symbols |
| App icon, Android adaptive icon, splash | Rendered from the mark by `apps/mobile/scripts/render-icons.py`. iOS uses an Icon Composer bundle (`assets/pomi.icon`) so the system adds Liquid Glass and the dark and tinted looks.    | Pomi's own                                    |

Adding a requestable asset means adding its logo to `LOGOS` in
`apps/mobile/src/components/asset-logo.tsx`.

## Where payers can pay from

Useroutr decides. `GET /api/assets` returns `payWith`, every network in Useroutr's asset list
with the tokens it takes, read from the same cached catalog as the requestable assets. The app
only maps each network id to a name and logo (`apps/mobile/src/lib/networks.ts`); a network it
has no entry for still shows, under its id and a monogram.

## Where receivers are paid

Also Useroutr's call: an asset it marks `destination: true` can be asked for, on its own
network. You lists one row per such network, with its logo, the tokens a request there pays in,
and the saved address or "Add". The payout screen takes the network: Stellar addresses get the
account checks, EVM addresses the checksum, and an address pasted in one case gets a warning
that no typo can be caught in it. Opened without a network (onboarding, or Home's notice before
any address exists), it lets the receiver pick one.

Wherever an asset shows, its logo carries the network's in its corner (`AssetMark`), as wallets
draw tokens. Ask's asset pills add the network's name under the symbol once the assets on offer
span more than one network, and an asset on a network with no address yet leads to that
network's payout screen. The keypad stops at the asset's own decimal places (six for USDC on
Base). Only a Stellar payment links to Stellar Expert: Pomi does not yet check which chain the
settlement hash of a payout on another network belongs to, so it links none.

## Links

Every link goes somewhere real and was checked to load: LOBSTR (lobstr.co) and Varial
(varialwallet.com, the wallet formerly called Freighter) for a first Stellar wallet, and
Stellar's own wallet list; MetaMask (metamask.com) and Coinbase Wallet (base.app, its own
site) for a first EVM wallet, and ethereum.org's wallet finder; Stellar Expert for a Stellar
payment's transaction.
