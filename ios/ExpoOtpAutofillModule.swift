import ExpoModulesCore

/**
 * iOS no-op implementation.
 *
 * This library wraps Android's Google SMS Retriever API, which has no iOS
 * counterpart: iOS autofills one-time codes itself from the QuickType bar when a
 * text field declares `textContentType="oneTimeCode"`, with no native module
 * involved.
 *
 * The module still declares the full API surface — same function names and the
 * same events as the Android and web implementations — so that shared JS calling
 * `useOtpAutoFill()` unconditionally (as the Rules of Hooks require) resolves
 * harmlessly instead of throwing on a missing function or an undeclared event.
 */
public class ExpoOtpAutofillModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoOtpAutofill")

    // Declared so `addListener` has a valid event to attach to. Never emitted.
    Events("onOtpReceived", "onOtpError")

    // No signing-certificate hash applies on iOS.
    AsyncFunction("getAppHashAsync") { () -> String in
      return ""
    }

    // `false` signals to the caller that no retriever was started.
    AsyncFunction("startSmsRetrieverAsync") { () -> Bool in
      return false
    }

    AsyncFunction("stopSmsRetrieverAsync") {
      // no-op
    }
  }
}
