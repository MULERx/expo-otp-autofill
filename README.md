# expo-otp-autofill

**Automatically read and auto-fill OTP SMS codes in Expo and React Native apps on Android — with zero SMS permissions.**

A thin, typed Expo module around Google's official [SMS Retriever API](https://developers.google.com/identity/sms-retriever/overview). Your app receives only the one verification SMS addressed to it, so you never request `RECEIVE_SMS` or `READ_SMS` and never trip Play Store's restricted-permission review.

[![npm version](https://img.shields.io/npm/v/expo-otp-autofill)](https://www.npmjs.com/package/expo-otp-autofill)
[![npm downloads](https://img.shields.io/npm/dm/expo-otp-autofill)](https://www.npmjs.com/package/expo-otp-autofill)
[![platform: Android](https://img.shields.io/badge/platform-Android-3DDC84)](#platform-support)
[![license: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

| | |
|---|---|
| **Platforms** | Android (functional) · iOS & Web (safe no-op) |
| **Permissions** | None |
| **Requires** | Google Play Services · an 11-char app hash appended to your SMS |
| **Exports** | `useOtpAutoFill` · `extractOtp` · `getAppHashAsync` · `startSmsRetrieverAsync` · `stopSmsRetrieverAsync` · `addListener` |

---

## Requirements

The SMS Retriever API only delivers a message to your app if the SMS **ends with your app's 11-character hash**. Get the hash with [`getAppHashAsync()`](#getapphashasync) and have your SMS provider append it:

```
Your verification code is 123456.

AB12cd3Efgh
```

The hash is derived from your package name **and signing certificate**, so debug builds, release builds, and Play App Signing each produce a different one. Read it at runtime rather than hard-coding it.

## Installation

```bash
npx expo install expo-otp-autofill
```

This adds a native Play Services dependency, so rebuild:

```bash
npx expo prebuild --clean
npx expo run:android
```

Not compatible with Expo Go — use a development build.

## Quick start

```tsx
import { TextInput } from 'react-native';
import { useOtpAutoFill } from 'expo-otp-autofill';

export default function VerifyScreen() {
  const { otp, message, clear } = useOtpAutoFill({ length: 6 });

  return (
    <TextInput
      value={otp ?? ''}
      placeholder="Enter the 6-digit code"
      keyboardType="number-pad"
      textContentType="oneTimeCode" // iOS QuickType autofill
      autoComplete="sms-otp"        // Android autofill hint
    />
  );
}
```

Listening starts on mount and re-arms automatically after every message, so consecutive codes (e.g. after "resend") are captured without extra work.

---

## API

### `useOtpAutoFill(options?)`

React hook. Starts the retriever on mount, parses the incoming SMS, and cleans up on unmount.

**Options**

| Option | Type | Default | Description |
|---|---|---|---|
| `length` | `number \| [min, max]` | `[4, 8]` | Number of digits to extract. |
| `timeout` | `number` | `30000` | Milliseconds before `otp` auto-resets to `null`. `0` disables auto-clearing. |

**Returns**

| Property | Type | Description |
|---|---|---|
| `otp` | `string \| null` | The extracted code, e.g. `"123456"`. |
| `message` | `string \| null` | The raw SMS body, including the app hash. |
| `clear` | `() => void` | Resets `otp` and `message`. Listening continues. |

### `extractOtp(text, options?)`

Pure function — no native module, works on every platform. Returns `string | null`.

```ts
extractOtp('Your code is 6451. df3Wz2qP', { length: 4 }); // "6451"
```

Patterns are tried most-specific first, so an unrelated number earlier in the message cannot win:

1. **Keyword then code** — `OTP: 1234`, `Your OTP is 1234`, `verification code is 123456`
2. **Code then keyword** — `123456 is your verification code`
3. **Any standalone digit run** of the right length, as a last resort

```ts
extractOtp('Order #987654 confirmed. Your OTP is 1234'); // "1234", not "987654"
```

Recognised keywords: `otp`, `passcode`, `password`, `code`, `pin`, `verification`, `token`.

**It never throws.** Non-string `text` returns `null`; an out-of-range, reversed, or non-numeric `length` falls back to `[4, 8]`.

### `getAppHashAsync()`

`Promise<string>` — the 11-character hash to append to your SMS. Returns `""` on iOS and web.

```ts
const hash = await getAppHashAsync(); // "AB12cd3Efgh"
```

### `startSmsRetrieverAsync()` / `stopSmsRetrieverAsync()`

Imperative control if you'd rather not use the hook. `start` opens a **5-minute** listening window in Play Services and resolves `true` once armed; `stop` unregisters the receiver.

```ts
await startSmsRetrieverAsync(); // Promise<boolean>
await stopSmsRetrieverAsync();  // Promise<void>
```

### `addListener(eventName, listener)`

Subscribe directly to native events. Returns an `EventSubscription` with `.remove()`.

```ts
const sub = addListener('onOtpReceived', ({ message }) => console.log(message));
sub.remove();
```

| Event | Payload | Fired when |
|---|---|---|
| `onOtpReceived` | `{ message: string }` | A matching SMS arrives. |
| `onOtpError` | `{ message: string }` | The 5-minute window expires with no SMS. |

**Exported types:** `OtpLength`, `EventSubscription`, `ExpoOtpAutofillModuleEvents`.

---

## Platform support

The SMS Retriever API is Android-only. On iOS and web **every export is a safe no-op**, so you can call `useOtpAutoFill()` unconditionally in shared code — as the Rules of Hooks require — without platform branching or crashes.

| API | Android | iOS / Web |
|---|---|---|
| `useOtpAutoFill()` | Listens for the OTP SMS | `{ otp: null, message: null, clear }`; never touches native code |
| `getAppHashAsync()` | 11-char hash | `""` |
| `startSmsRetrieverAsync()` | `true` once armed | `false` |
| `stopSmsRetrieverAsync()` | Unregisters the receiver | No-op |
| `extractOtp()` | Works | Works — pure JS |

**iOS needs no library.** The OS surfaces one-time codes in the QuickType bar when a field opts in. One `TextInput` covers both platforms:

```tsx
<TextInput textContentType="oneTimeCode" autoComplete="sms-otp" keyboardType="number-pad" />
```

---

## FAQ

**Does this require SMS permissions?**
No. It requests no permissions at all. Google Play Services filters the SMS and hands your app only the message ending in its app hash.

**Can it read arbitrary or historical SMS?**
No. It only ever sees a message that ends with your app hash and arrives while the 5-minute window is open. For general SMS access, see [expo-sms-listener](https://www.npmjs.com/package/expo-sms-listener) (requires `RECEIVE_SMS`).

**Why is no OTP detected?**
Most often the SMS is missing the app hash, or the hash belongs to a different build variant. Log `await getAppHashAsync()` in the exact build you're testing and compare it to the trailing characters of the SMS.

**Does it work in Expo Go?**
No. It contains native code — use `npx expo prebuild` and a development build.

**Does it work on iOS or the web?**
It runs without crashing but does nothing. See [Platform support](#platform-support). Use `textContentType="oneTimeCode"` on iOS.

**Does it work on Android devices without Google Play Services?**
No. The SMS Retriever API is part of Play Services.

**Can it catch more than one code?**
Yes. The hook re-arms the listener after every message and after the 5-minute timeout.

---

## Related

**[expo-sms-listener](https://www.npmjs.com/package/expo-sms-listener)** — reads any SMS from any sender, including while the app is closed. Requires the `RECEIVE_SMS` permission. Use it when you don't control the server sending the message.

## License

MIT © [MULERx](https://github.com/MULERx)
