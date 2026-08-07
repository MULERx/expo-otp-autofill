import { EventSubscription } from 'expo-modules-core';
import { useEffect, useState, useCallback, useRef } from 'react';

import { ExpoOtpAutofillModuleEvents } from './ExpoOtpAutofill.types';
import ExpoOtpAutofillModule from './ExpoOtpAutofillModule';
import { isAndroid } from './isAndroid';

export * from './ExpoOtpAutofill.types';
export type { EventSubscription };

export type OtpLength = number | [number, number];

const DEFAULT_MIN_LENGTH = 4;
const DEFAULT_MAX_LENGTH = 8;
// Longer than any real OTP; only exists so a bogus option can't build a
// pathological quantifier.
const ABSOLUTE_MAX_LENGTH = 32;

// Words that commonly label an OTP in an SMS.
const KEYWORDS = 'otp|passcode|password|code|pin|verification|token';
// Filler allowed between the keyword and the digits, e.g. "OTP is 1234",
// "code: 1234", "code for 1234". Each is optional and repeatable.
const CONNECTORS = String.raw`\s*(?:is|are|:|=|-|\bfor\b|\byour\b|\bthe\b)`;

/**
 * Coerces the `length` option into a safe `[min, max]` integer pair.
 *
 * These values are interpolated into a `RegExp` quantifier, so they must never
 * reach the regex unvalidated: a reversed range such as `[6, 4]` throws
 * `SyntaxError: numbers out of order in {} quantifier`, and a non-numeric value
 * that bypasses the TypeScript type would be a regex-injection vector.
 */
function normalizeLength(length?: OtpLength): [number, number] {
  let rawMin: unknown;
  let rawMax: unknown;

  if (Array.isArray(length)) {
    [rawMin, rawMax] = length;
  } else if (length !== undefined && length !== null) {
    rawMin = length;
    rawMax = length;
  }

  const min = toBoundedInt(rawMin, DEFAULT_MIN_LENGTH);
  const max = toBoundedInt(rawMax, DEFAULT_MAX_LENGTH);

  // Tolerate a reversed range rather than building an invalid quantifier.
  return min > max ? [max, min] : [min, max];
}

function toBoundedInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? Math.floor(value) : NaN;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, ABSOLUTE_MAX_LENGTH);
}

/**
 * Extracts an OTP from an SMS body.
 *
 * Patterns are tried most-specific first so that an unrelated number earlier in
 * the message (an order or reference number) can't win over the real code.
 */
export function extractOtp(
  text: string,
  options?: { length?: OtpLength },
): string | null {
  if (typeof text !== 'string' || text.length === 0) return null;

  const [minLength, maxLength] = normalizeLength(options?.length);
  const digits = `([0-9]{${minLength},${maxLength}})(?![0-9])`;

  const patterns = [
    // 1. Keyword, optional connectors, then the code.
    //    "OTP: 123456", "Your OTP is 1234", "verification code is 123456",
    //    "Use code 8899", "code = 1234"
    new RegExp(`(?:${KEYWORDS})(?:${CONNECTORS})*\\s*${digits}`, 'i'),
    // 2. Reverse phrasing: the code, then the keyword.
    //    "123456 is your verification code",
    //    "483920 is your Google verification code"
    new RegExp(
      `${digits}[\\s.,]*(?:is|as)\\b(?:\\s+\\w+){0,3}?\\s*(?:${KEYWORDS})\\b`,
      'i',
    ),
    // 3. Last resort: any standalone run of digits of the right length.
    //    `(?:^|[^0-9])` rather than a `(?<![0-9])` lookbehind, which older
    //    JS engines don't support.
    new RegExp(`(?:^|[^0-9])${digits}`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export async function getAppHashAsync(): Promise<string> {
  return await ExpoOtpAutofillModule.getAppHashAsync();
}

export async function startSmsRetrieverAsync(): Promise<boolean> {
  return await ExpoOtpAutofillModule.startSmsRetrieverAsync();
}

export async function stopSmsRetrieverAsync(): Promise<void> {
  await ExpoOtpAutofillModule.stopSmsRetrieverAsync();
}

/**
 * Opt-in hook that triggers the Play Services OTP Retriever and listens for the SMS.
 * Will resolve `otp` automatically from the captured text.
 * Requires ZERO Android permissions.
 *
 * No-ops on every platform except Android — iOS autofills one-time codes itself
 * via `<TextInput textContentType="oneTimeCode" />`.
 */
export function useOtpAutoFill(options?: { length?: OtpLength; timeout?: number }) {
  const [otp, setOtp] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The effect below subscribes once, so reading `options` directly inside the
  // listeners would pin them to the values from the first render.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const clear = useCallback(() => {
    setOtp(null);
    setMessage(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isAndroid) return;

    let isMounted = true;
    let subReceived: EventSubscription | null = null;
    let subError: EventSubscription | null = null;

    async function setup() {
      if (!isMounted) return;
      try {
        await startSmsRetrieverAsync();
      } catch (err) {
        console.warn('Failed to start SMS Retriever: ', err);
      }
    }

    subReceived = ExpoOtpAutofillModule.addListener('onOtpReceived', (event) => {
      if (!isMounted) return;
      const msg = event?.message;
      if (typeof msg !== 'string') return;

      setMessage(msg);
      const detectedCode = extractOtp(msg, { length: optionsRef.current?.length });

      if (detectedCode) {
        setOtp(detectedCode);

        // Auto timeout reset
        const timeoutMs = optionsRef.current?.timeout ?? 30000;
        if (timeoutMs > 0) {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            if (isMounted) clear();
          }, timeoutMs);
        }
      }
      // Restart listener for the next message
      setup();
    });

    subError = ExpoOtpAutofillModule.addListener('onOtpError', () => {
      // Timeout from Google Play Services (5 mins elapsed with no SMS)
      // Restart listener automatically
      setup();
    });

    setup();

    return () => {
      isMounted = false;
      subReceived?.remove();
      subError?.remove();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Native side resolves a promise; swallow rejections so unmounting can't
      // surface an unhandled rejection.
      stopSmsRetrieverAsync().catch(() => {});
    };
  }, [clear]);

  return { otp, message, clear };
}

export function addListener<EventName extends keyof ExpoOtpAutofillModuleEvents>(
  eventName: EventName,
  listener: ExpoOtpAutofillModuleEvents[EventName],
): EventSubscription {
  return ExpoOtpAutofillModule.addListener(eventName, listener);
}
