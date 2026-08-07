/**
 * Default (non-Android) resolution. Metro and jest-expo pick `isAndroid.android.ts`
 * on Android and fall back to this file on iOS, web, and Node.
 *
 * Deliberately a platform-split constant rather than `Platform.OS` from
 * `react-native`: this package otherwise has no `react-native` runtime import,
 * and adding one would pull in `react-native-web` on web builds.
 */
export const isAndroid = false;
