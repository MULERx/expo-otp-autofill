import { extractOtp, OtpLength } from '../index';

jest.mock('../ExpoOtpAutofillModule', () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    getAppHashAsync: jest.fn(),
    startSmsRetrieverAsync: jest.fn(),
    stopSmsRetrieverAsync: jest.fn(),
  },
}));

type Case = [description: string, text: string, expected: string | null];

describe('extractOtp', () => {
  describe('keyword before the code', () => {
    const cases: Case[] = [
      ['colon separator', 'OTP: 445566', '445566'],
      ['equals separator', 'Your code = 1234', '1234'],
      ['"is" between keyword and code', 'Your OTP is 123456. Do not share.', '123456'],
      ['two-word keyword phrase', 'Your verification code is 123456.', '123456'],
      ['bare keyword then code', 'Use code 8899 to log in.', '8899'],
      ['passcode keyword', 'Your passcode is 987654', '987654'],
      ['pin keyword', 'PIN 4455 for your booking', '4455'],
      ['token keyword', 'Your one-time token is 778899', '778899'],
      ['password keyword', 'Your temporary password is 5150', '5150'],
    ];

    it.each(cases)('%s', (_desc, text, expected) => {
      expect(extractOtp(text)).toBe(expected);
    });
  });

  describe('code before the keyword (reverse phrasing)', () => {
    const cases: Case[] = [
      ['plain reverse', '123456 is your verification code', '123456'],
      [
        'reverse with filler words',
        'G-483920 is your Google verification code.',
        '483920',
      ],
      ['reverse with "as"', '4321 as your login code', '4321'],
    ];

    it.each(cases)('%s', (_desc, text, expected) => {
      expect(extractOtp(text)).toBe(expected);
    });
  });

  describe('real-world SMS bodies', () => {
    const cases: Case[] = [
      [
        'SMS Retriever <#> prefix and trailing app hash',
        '<#> Your code is 5678\nFA+9qCX9VSu',
        '5678',
      ],
      [
        'trailing app hash on its own line',
        'Verification code: 135790\n\nAB12cd3Efgh',
        '135790',
      ],
      [
        'trailing unsubscribe shortcode must not win',
        'Your Uber code is 4321. Reply STOP to 12345 to unsubscribe.',
        '4321',
      ],
      [
        'trailing expiry year must not win',
        'Your login code is 246810. Expires 2026.',
        '246810',
      ],
    ];

    it.each(cases)('%s', (_desc, text, expected) => {
      expect(extractOtp(text)).toBe(expected);
    });
  });

  // Regression: the keyword patterns previously did not handle "<keyword> is
  // <digits>", so these fell through to the catch-all and returned the first
  // run of digits in the message — the order/ticket number, not the OTP.
  describe('regression: unrelated number before the code', () => {
    it('does not return the order number', () => {
      expect(extractOtp('Order #987654 confirmed. Your OTP is 1234')).toBe('1234');
    });

    it('does not return the order number when length is pinned', () => {
      expect(extractOtp('Order #987654: your OTP is 123456', { length: 6 })).toBe(
        '123456',
      );
    });

    it('does not return the ticket number', () => {
      expect(extractOtp('Ticket 55512345 closed. Your verification code is 4444')).toBe(
        '4444',
      );
    });
  });

  describe('length option', () => {
    it('matches an exact length when given a number', () => {
      expect(extractOtp('Your code is 123456', { length: 6 })).toBe('123456');
    });

    it('rejects a code shorter than the exact length', () => {
      expect(extractOtp('Your code is 1234', { length: 6 })).toBeNull();
    });

    it('matches within an explicit [min, max] range', () => {
      expect(extractOtp('Your code is 12345', { length: [4, 6] })).toBe('12345');
    });

    it('rejects a code outside an explicit range', () => {
      expect(extractOtp('Your code is 123', { length: [4, 6] })).toBeNull();
    });

    it('defaults to 4-8 digits', () => {
      expect(extractOtp('Your code is 12')).toBeNull();
      expect(extractOtp('Your code is 1234')).toBe('1234');
      expect(extractOtp('Your code is 12345678')).toBe('12345678');
    });
  });

  // Regression: `length` is interpolated into a RegExp quantifier. Unvalidated
  // values could throw (reversed range) or inject regex syntax.
  describe('regression: malformed length must not throw', () => {
    const text = 'Your code is 123456';

    it('tolerates a reversed range', () => {
      expect(() => extractOtp(text, { length: [6, 4] })).not.toThrow();
      expect(extractOtp(text, { length: [6, 4] })).toBe('123456');
    });

    it('floors a fractional length', () => {
      expect(extractOtp(text, { length: 6.5 })).toBe('123456');
    });

    it.each([
      ['negative', -1],
      ['zero', 0],
      ['NaN', NaN],
      ['Infinity', Infinity],
    ])('falls back to the default range for %s', (_desc, length) => {
      expect(extractOtp(text, { length: length as number })).toBe('123456');
    });

    it('clamps an absurdly large length instead of building a huge quantifier', () => {
      expect(() => extractOtp(text, { length: 1e9 })).not.toThrow();
      expect(extractOtp(text, { length: 1e9 })).toBeNull();
    });

    it.each([
      ['a regex-injection string', '4}|(.*)|{1'],
      ['an object', {}],
      ['a string pair', ['4}|(.*)|{1', 8]],
    ])('ignores %s and uses the defaults', (_desc, length) => {
      expect(() =>
        extractOtp(text, { length: length as unknown as OtpLength }),
      ).not.toThrow();
      expect(extractOtp(text, { length: length as unknown as OtpLength })).toBe('123456');
    });
  });

  // Regression: the native event payload was trusted without a type check, so a
  // non-string body threw a TypeError out of the onOtpReceived handler.
  describe('regression: non-string input must not throw', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['a number', 123456],
      ['an object', {}],
      ['an empty string', ''],
    ])('returns null for %s', (_desc, value) => {
      expect(() => extractOtp(value as unknown as string)).not.toThrow();
      expect(extractOtp(value as unknown as string)).toBeNull();
    });
  });

  describe('no match', () => {
    it('returns null when the message has no digits', () => {
      expect(extractOtp('Hello world, nothing here')).toBeNull();
    });

    it('returns null when every digit run is too short', () => {
      expect(extractOtp('Meet at 7 or 12 today')).toBeNull();
    });
  });
});
