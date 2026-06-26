import { addListener, extractOtp } from '../index';
import ExpoOtpAutofillModule from '../ExpoOtpAutofillModule';

jest.mock('../ExpoOtpAutofillModule', () => {
  return {
    addListener: jest.fn().mockImplementation((event, callback) => {
      return {
        remove: jest.fn(),
      };
    }),
  };
});

describe('ExpoOtpAutofill', () => {
  describe('extractOtp', () => {
    it('extracts standard 6-digit OTP code', () => {
      const text = 'Your verification code is 123456. HashExample';
      const otp = extractOtp(text, { length: 6 });
      expect(otp).toBe('123456');
    });

    it('returns null if no code matches the pattern', () => {
      const text = 'Hello world';
      const otp = extractOtp(text);
      expect(otp).toBeNull();
    });
  });

  describe('addListener', () => {
    it('proxies subscription to the native module', () => {
      const callback = jest.fn();
      const subscription = addListener('onOtpReceived', callback);

      expect(ExpoOtpAutofillModule.addListener).toHaveBeenCalledWith(
        'onOtpReceived',
        callback
      );
      expect(subscription).toBeDefined();
      expect(typeof subscription.remove).toBe('function');
    });
  });
});
