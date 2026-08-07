import { act, renderHook } from '@testing-library/react-native';

import { ExpoOtpAutofillModuleEvents } from '../ExpoOtpAutofill.types';
import ExpoOtpAutofillModule from '../ExpoOtpAutofillModule';
import { useOtpAutoFill } from '../index';

// `isAndroid` is a platform-split constant, so it resolves differently in each of
// the four jest projects. A live getter lets every test pin it explicitly and
// behave identically everywhere.
let mockIsAndroid = true;
jest.mock('../isAndroid', () => ({
  get isAndroid() {
    return mockIsAndroid;
  },
}));

type Listener = (event: { message: string }) => void;

const listeners: Record<string, Set<Listener>> = {};
const removeSpies: jest.Mock[] = [];

jest.mock('../ExpoOtpAutofillModule', () => ({
  __esModule: true,
  default: {
    addListener: jest.fn(),
    getAppHashAsync: jest.fn(),
    startSmsRetrieverAsync: jest.fn(),
    stopSmsRetrieverAsync: jest.fn(),
  },
}));

const mockModule = ExpoOtpAutofillModule as unknown as {
  addListener: jest.Mock;
  getAppHashAsync: jest.Mock;
  startSmsRetrieverAsync: jest.Mock;
  stopSmsRetrieverAsync: jest.Mock;
};

/** Dispatches a native event to every listener registered for it. */
function emit(eventName: keyof ExpoOtpAutofillModuleEvents, message: unknown) {
  const registered = listeners[eventName];
  if (!registered) return;
  for (const listener of [...registered]) {
    listener({ message } as { message: string });
  }
}

/** Lets queued promise callbacks run without leaving fake timers. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useOtpAutoFill', () => {
  // These hooks must stay nested inside a `describe`, not at file scope. React
  // Native Testing Library registers its own auto-cleanup `afterEach` at import
  // time, so a file-scope `afterEach` would run *after* it — leaving fake timers
  // installed during cleanup, whose `act()` then deadlocks under jsdom (the Web
  // project). Nesting makes this hook run first and restore real timers.
  beforeEach(() => {
    mockIsAndroid = true;
    for (const key of Object.keys(listeners)) delete listeners[key];
    removeSpies.length = 0;

    jest.useFakeTimers();

    mockModule.addListener.mockImplementation((eventName: string, listener: Listener) => {
      (listeners[eventName] ??= new Set()).add(listener);
      const remove = jest.fn(() => {
        listeners[eventName]?.delete(listener);
      });
      removeSpies.push(remove);
      return { remove };
    });
    mockModule.startSmsRetrieverAsync.mockResolvedValue(true);
    mockModule.stopSmsRetrieverAsync.mockResolvedValue(undefined);
    mockModule.getAppHashAsync.mockResolvedValue('AB12cd3Efgh');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('setup', () => {
    it('starts the retriever and subscribes to both events on mount', async () => {
      renderHook(() => useOtpAutoFill());
      await flush();

      expect(mockModule.startSmsRetrieverAsync).toHaveBeenCalledTimes(1);
      expect(mockModule.addListener).toHaveBeenCalledWith(
        'onOtpReceived',
        expect.any(Function),
      );
      expect(mockModule.addListener).toHaveBeenCalledWith(
        'onOtpError',
        expect.any(Function),
      );
    });

    it('starts with null state', () => {
      const { result } = renderHook(() => useOtpAutoFill());

      expect(result.current.otp).toBeNull();
      expect(result.current.message).toBeNull();
    });

    it('swallows a retriever start failure instead of throwing', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockModule.startSmsRetrieverAsync.mockRejectedValue(new Error('no play services'));

      expect(() => renderHook(() => useOtpAutoFill())).not.toThrow();
      await flush();

      expect(warn).toHaveBeenCalledWith(
        'Failed to start SMS Retriever: ',
        expect.any(Error),
      );
      warn.mockRestore();
    });
  });

  describe('receiving an OTP', () => {
    it('exposes the extracted code and the raw message', async () => {
      const { result } = renderHook(() => useOtpAutoFill({ length: 6 }));
      await flush();

      act(() => emit('onOtpReceived', 'Your code is 123456. AB12cd3Efgh'));

      expect(result.current.otp).toBe('123456');
      expect(result.current.message).toBe('Your code is 123456. AB12cd3Efgh');
    });

    it('keeps the raw message but leaves otp null when nothing matches', async () => {
      const { result } = renderHook(() => useOtpAutoFill({ length: 6 }));
      await flush();

      act(() => emit('onOtpReceived', 'Welcome back!'));

      expect(result.current.otp).toBeNull();
      expect(result.current.message).toBe('Welcome back!');
    });

    it('re-arms the retriever after each message so consecutive codes are caught', async () => {
      const { result } = renderHook(() => useOtpAutoFill({ length: 4 }));
      await flush();
      expect(mockModule.startSmsRetrieverAsync).toHaveBeenCalledTimes(1);

      act(() => emit('onOtpReceived', 'Your code is 1111'));
      await flush();
      expect(mockModule.startSmsRetrieverAsync).toHaveBeenCalledTimes(2);

      act(() => emit('onOtpReceived', 'Your code is 2222'));
      await flush();
      expect(mockModule.startSmsRetrieverAsync).toHaveBeenCalledTimes(3);
      expect(result.current.otp).toBe('2222');
    });

    it('re-arms the retriever after a Play Services timeout', async () => {
      renderHook(() => useOtpAutoFill());
      await flush();
      expect(mockModule.startSmsRetrieverAsync).toHaveBeenCalledTimes(1);

      act(() => emit('onOtpError', 'Timeout waiting for SMS'));
      await flush();

      expect(mockModule.startSmsRetrieverAsync).toHaveBeenCalledTimes(2);
    });

    // Regression: the payload was passed straight to extractOtp, so a non-string
    // body threw a TypeError out of the event handler.
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['a number', 123456],
    ])('ignores a %s message payload', async (_desc, payload) => {
      const { result } = renderHook(() => useOtpAutoFill());
      await flush();

      expect(() => act(() => emit('onOtpReceived', payload))).not.toThrow();
      expect(result.current.otp).toBeNull();
      expect(result.current.message).toBeNull();
    });
  });

  describe('timeout', () => {
    it('clears the otp after the configured timeout', async () => {
      const { result } = renderHook(() => useOtpAutoFill({ length: 6, timeout: 5000 }));
      await flush();

      act(() => emit('onOtpReceived', 'Your code is 123456'));
      expect(result.current.otp).toBe('123456');

      act(() => jest.advanceTimersByTime(4999));
      expect(result.current.otp).toBe('123456');

      act(() => jest.advanceTimersByTime(1));
      expect(result.current.otp).toBeNull();
      expect(result.current.message).toBeNull();
    });

    it('defaults to 30 seconds', async () => {
      const { result } = renderHook(() => useOtpAutoFill({ length: 6 }));
      await flush();

      act(() => emit('onOtpReceived', 'Your code is 123456'));
      act(() => jest.advanceTimersByTime(29999));
      expect(result.current.otp).toBe('123456');

      act(() => jest.advanceTimersByTime(1));
      expect(result.current.otp).toBeNull();
    });

    it('never auto-clears when timeout is 0', async () => {
      const { result } = renderHook(() => useOtpAutoFill({ length: 6, timeout: 0 }));
      await flush();

      act(() => emit('onOtpReceived', 'Your code is 123456'));
      act(() => jest.advanceTimersByTime(10 * 60 * 1000));

      expect(result.current.otp).toBe('123456');
    });

    it('restarts the countdown when a second code arrives', async () => {
      const { result } = renderHook(() => useOtpAutoFill({ length: 4, timeout: 5000 }));
      await flush();

      act(() => emit('onOtpReceived', 'Your code is 1111'));
      act(() => jest.advanceTimersByTime(4000));

      act(() => emit('onOtpReceived', 'Your code is 2222'));
      act(() => jest.advanceTimersByTime(4000));
      // The first timer would have fired by now had it not been replaced.
      expect(result.current.otp).toBe('2222');

      act(() => jest.advanceTimersByTime(1000));
      expect(result.current.otp).toBeNull();
    });
  });

  // Regression: the effect subscribed once with [] deps but read `options`
  // directly, pinning length/timeout to their first-render values.
  describe('regression: option changes take effect without resubscribing', () => {
    it('uses the latest length', async () => {
      const { result, rerender } = renderHook(
        (props: { length: number }) => useOtpAutoFill({ length: props.length }),
        { initialProps: { length: 4 } },
      );
      await flush();

      rerender({ length: 6 });
      act(() => emit('onOtpReceived', 'Your code is 123456'));

      expect(result.current.otp).toBe('123456');
      // Still only the original pair of subscriptions.
      expect(mockModule.addListener).toHaveBeenCalledTimes(2);
    });

    it('uses the latest timeout', async () => {
      const { result, rerender } = renderHook(
        (props: { timeout: number }) =>
          useOtpAutoFill({ length: 6, timeout: props.timeout }),
        { initialProps: { timeout: 30000 } },
      );
      await flush();

      rerender({ timeout: 1000 });
      act(() => emit('onOtpReceived', 'Your code is 123456'));
      expect(result.current.otp).toBe('123456');

      act(() => jest.advanceTimersByTime(1000));
      expect(result.current.otp).toBeNull();
    });
  });

  describe('clear', () => {
    it('resets otp and message', async () => {
      const { result } = renderHook(() => useOtpAutoFill({ length: 6 }));
      await flush();

      act(() => emit('onOtpReceived', 'Your code is 123456'));
      expect(result.current.otp).toBe('123456');

      act(() => result.current.clear());

      expect(result.current.otp).toBeNull();
      expect(result.current.message).toBeNull();
    });

    it('keeps listening after clearing', async () => {
      const { result } = renderHook(() => useOtpAutoFill({ length: 4 }));
      await flush();

      act(() => emit('onOtpReceived', 'Your code is 1111'));
      act(() => result.current.clear());
      act(() => emit('onOtpReceived', 'Your code is 2222'));

      expect(result.current.otp).toBe('2222');
    });

    it('cancels a pending auto-clear timer', async () => {
      const { result } = renderHook(() => useOtpAutoFill({ length: 4, timeout: 5000 }));
      await flush();

      act(() => emit('onOtpReceived', 'Your code is 1111'));
      act(() => result.current.clear());
      act(() => emit('onOtpReceived', 'Your code is 2222'));

      // The first message's timer must not fire and wipe the second code.
      act(() => jest.advanceTimersByTime(4000));
      expect(result.current.otp).toBe('2222');
    });
  });

  describe('unmount', () => {
    it('removes both subscriptions and stops the retriever', async () => {
      const { unmount } = renderHook(() => useOtpAutoFill());
      await flush();

      unmount();

      expect(removeSpies).toHaveLength(2);
      expect(removeSpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
      expect(mockModule.stopSmsRetrieverAsync).toHaveBeenCalledTimes(1);
    });

    it('does not update state after unmounting', async () => {
      const { result, unmount } = renderHook(() => useOtpAutoFill({ length: 6 }));
      await flush();

      unmount();
      act(() => emit('onOtpReceived', 'Your code is 123456'));

      expect(result.current.otp).toBeNull();
    });

    it('does not fire a pending auto-clear timer after unmounting', async () => {
      const { unmount } = renderHook(() => useOtpAutoFill({ length: 6, timeout: 5000 }));
      await flush();

      act(() => emit('onOtpReceived', 'Your code is 123456'));
      unmount();

      expect(() => jest.advanceTimersByTime(10000)).not.toThrow();
    });

    // Regression: stopSmsRetrieverAsync resolves a promise natively but was
    // called bare, so a rejection surfaced as an unhandled rejection.
    it('handles a rejection from stopSmsRetrieverAsync', async () => {
      mockModule.stopSmsRetrieverAsync.mockRejectedValue(new Error('already stopped'));
      const unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);

      const { unmount } = renderHook(() => useOtpAutoFill());
      await flush();

      expect(() => unmount()).not.toThrow();
      await flush();

      // Node reports unhandled rejections on a macrotask boundary, so step off
      // fake timers before waiting for one. `setTimeout` rather than
      // `setImmediate`, which jsdom does not provide.
      jest.useRealTimers();
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 0);
      });

      expect(unhandled).not.toHaveBeenCalled();
      process.off('unhandledRejection', unhandled);
    });
  });

  describe('non-Android platforms', () => {
    beforeEach(() => {
      mockIsAndroid = false;
    });

    it('never touches the native module', async () => {
      renderHook(() => useOtpAutoFill());
      await flush();

      expect(mockModule.startSmsRetrieverAsync).not.toHaveBeenCalled();
      expect(mockModule.addListener).not.toHaveBeenCalled();
      expect(mockModule.stopSmsRetrieverAsync).not.toHaveBeenCalled();
    });

    it('returns inert null state and a callable clear', async () => {
      const { result, unmount } = renderHook(() => useOtpAutoFill());
      await flush();

      expect(result.current.otp).toBeNull();
      expect(result.current.message).toBeNull();
      expect(() => act(() => result.current.clear())).not.toThrow();
      expect(() => unmount()).not.toThrow();
    });
  });
});
