# expo-otp-autofill

A native Expo wrapper for Android's official **Google SMS Retriever API**. This library allows your React Native / Expo application to automatically detect and auto-fill incoming OTP SMS messages with **ZERO Android permissions** requested from the user.

[![npm version](https://img.shields.io/npm/v/expo-otp-autofill)](https://www.npmjs.com/package/expo-otp-autofill)
[![Platform](https://img.shields.io/badge/platform-Android-green)](https://www.npmjs.com/package/expo-otp-autofill)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 Features

| Feature | Description |
|---|---|
| **Zero Permissions** | No need to ask the user for dangerous `RECEIVE_SMS` or `READ_SMS` permissions. Play Store completely approves this exact method. |
| **Silent Intercept** | Google Play Services intercepts only the SMS meant for your app based on the 11-char app Hash. |
| **`useOtpAutoFill` Hook** | Simple plug-and-play React hook with auto-parsing logic and clear/timeout functionality. |
| **App Hash Generator** | Generate the exact 11-character app hash Google requires (`getAppHashAsync()`), directly derived from your app's package name and signing certificate. |

> **Note:** Because this library uses the official Google SMS Retriever API, the server transmitting your OTP messages **must append your 11-character App Hash at the very end of the SMS content.** Example:
>
> `Your verification code is 123456.`
> ` `
> `AB12cd3Efgh`

---

## 📦 Installation

```bash
npx expo install expo-otp-autofill
```

After installation, ensure you rebuild your Android codebase, as this includes native Google Play Services dependencies:

```bash
npx expo prebuild --clean
npx expo run:android
```

---

## 📖 Hook Usage: `useOtpAutoFill()`

This is the main API you will use inside your components. It will trigger Android to listen for the OTP SMS targeting your app for up to 5 minutes.

```tsx
import React, { useEffect } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useOtpAutoFill, getAppHashAsync } from 'expo-otp-autofill';

export default function MyLoginScreen() {
  // 1. Hook begins listening automatically on mount
  const { otp, message, clear } = useOtpAutoFill({
    length: 6,         // Optional: Number of digits to extract (default is [4, 8])
    timeout: 30000,    // Optional: How long to keep the `otp` state before clearing (default 30000ms. 0 disables)
  });

  useEffect(() => {
    // Optional: Print your 11-character App Hash so you can configure it on your server!
    getAppHashAsync().then((hash) => console.log('My App Hash is:', hash));
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      {message && <Text style={{ color: 'gray' }}>Captured exact SMS: {message}</Text>}
      
      <TextInput
        value={otp ?? ''}
        placeholder="Waiting for OTP without permissions..."
        style={{ borderWidth: 1, padding: 10, marginVertical: 10, fontSize: 20 }}
      />
      
      <Button title="Manually Clear OTP" onPress={clear} />
    </View>
  );
}
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `length` | `number` or `[min, max]` | `[4, 8]` | Forces regex to only extract digits matching this length constraint. |
| `timeout` | `number` | `30000` | Once an OTP is parsed, automatically clear the state variable to `null` after this many milliseconds. Pass `0` to disable auto-clearing. |

### Return Value

| Property | Type | Description |
|---|---|---|
| `otp` | `string \| null` | The purely extracted numeric code (e.g. `"123456"`) |
| `message` | `string \| null` | The raw complete SMS message including your app hash. |
| `clear` | `() => void` | Cancels the active listener and clears the `otp` and `message` variables. |

---

## 📖 Under-the-Hood APIs

If you prefer imperative control instead of Hooks, you can use the core functions explicitly:

### `startSmsRetrieverAsync()`
Initiates 5-minute listening window inside Google Play Services. Returns boolean.
```ts
const started = await startSmsRetrieverAsync();
```

### `stopSmsRetrieverAsync()`
Stops listening and unregisters native Broadcast Receiver. (No-op if already stopped).
```ts
stopSmsRetrieverAsync();
```

### `getAppHashAsync()`
Computes the 11-char hash from your current Keystore. Returns String.
```ts
const hash = await getAppHashAsync();
```

### `extractOtp(text, options?)`
Pure JS function to extract OTP digits out of a larger SMS phrase.
```ts
const extracted = extractOtp('Your code is 6451. df3Wz2qP', { length: 4 });
// "6451"
```

---

## 🤝 Need to read ALL messages without a hash?

If you are building an offline app, a budget tracker, or an app that does not control the server sending the SMS, **the SMS Retriever API will not work for you**. 

Instead, use its sister library: **[expo-sms-listener](https://www.npmjs.com/package/expo-sms-listener)**. It requires the `RECEIVE_SMS` user permission, but allows you to capture any SMS from any sender, even when your app is completely closed.

---

## License

MIT © [MULERx](https://github.com/MULERx)
