import { useEffect, useState, useCallback, useRef } from 'react';
import ExpoOtpAutofillModule from './ExpoOtpAutofillModule';
export * from './ExpoOtpAutofill.types';

// Helper to extract OTP using regex patterns you mapped earlier in expo-sms-listener
export function extractOtp(
  text: string,
  options?: { length?: number | [number, number] }
): string | null {
  const minLength =
    typeof options?.length === 'number'
      ? options.length
      : options?.length?.[0] ?? 4;
  const maxLength =
    typeof options?.length === 'number'
      ? options.length
      : options?.length?.[1] ?? 8;

  const patterns = [
    // 1. Keyword-adjacent code with colon/equals e.g., "OTP: 123456"
    new RegExp(
      `(?:otp|code|pin|password|passcode|verification)[\\s:=]+([0-9]{${minLength},${maxLength}})(?![0-9])`,
      'i'
    ),
    // 2. Phrase pattern e.g., "is your verification code" -> the digits before
    new RegExp(
      `([0-9]{${minLength},${maxLength}})(?=[\\s\\.]*(?:is|as)\\s+(?:your|the)?\\s*(?:otp|code|pin|password|passcode|verification))`,
      'i'
    ),
    // 3. Fallback: Any standalone block of digits that fits the length
    new RegExp(`(?<![0-9])([0-9]{${minLength},${maxLength}})(?![0-9])`, 'i'),
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

export function stopSmsRetrieverAsync(): void {
  ExpoOtpAutofillModule.stopSmsRetrieverAsync();
}

/**
 * Opt-in hook that triggers the Play Services OTP Retriever and listens for the SMS.
 * Will resolve `otp` automatically from the captured text.
 * Requires ZERO Android permissions.
 */
export function useOtpAutoFill(options?: {
  length?: number | [number, number];
  timeout?: number;
}) {
  const [otp, setOtp] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    setOtp(null);
    setMessage(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    stopSmsRetrieverAsync();
  }, []);

  useEffect(() => {
    let isMounted = true;
    let subReceived: any = null;
    let subError: any = null;

    async function setup() {
      try {
        await startSmsRetrieverAsync();
        
        subReceived = ExpoOtpAutofillModule.addListener('onOtpReceived', (event) => {
          if (!isMounted) return;
          const msg = event.message;
          setMessage(msg);
          const detectedCode = extractOtp(msg, { length: options?.length });
          
          if (detectedCode) {
            setOtp(detectedCode);
            
            // Auto timeout reset
            const timeoutMs = options?.timeout ?? 30000;
            if (timeoutMs > 0) {
              if (timerRef.current) clearTimeout(timerRef.current);
              timerRef.current = setTimeout(() => {
                if (isMounted) clear();
              }, timeoutMs);
            }
          }
        });

        subError = ExpoOtpAutofillModule.addListener('onOtpError', () => {
          // Timeout from Google Play Services (5 mins elapsed with no SMS)
          stopSmsRetrieverAsync();
        });

      } catch (err) {
        console.warn('Failed to start SMS Retriever: ', err);
      }
    }

    setup();

    return () => {
      isMounted = false;
      subReceived?.remove();
      subError?.remove();
      clear();
    };
  }, []);

  return { otp, message, clear };
}
