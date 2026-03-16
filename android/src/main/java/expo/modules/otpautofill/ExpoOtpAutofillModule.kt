package expo.modules.otpautofill

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoOtpAutofillModule : Module() {

  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoOtpAutofill")

    Events("onOtpReceived", "onOtpError")

    // Returns the 11-char app hash your server must append at the end of the OTP SMS
    AsyncFunction("getAppHashAsync") {
      val context = appContext.reactContext ?: return@AsyncFunction ""
      AppHashHelper(context.packageName, context.packageManager).getHash()
    }

    // Triggers Google Play Services to listen for one incoming SMS (up to 5 min).
    // Uses explicit Promise callback — the correct pattern for async callbacks in Expo Modules API.
    AsyncFunction("startSmsRetrieverAsync") { promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.reject("ERR_NO_CONTEXT", "React context is not available", null)
        return@AsyncFunction
      }

      SmsRetriever.getClient(context).startSmsRetriever()
        .addOnSuccessListener {
          registerReceiver()
          promise.resolve(true)
        }
        .addOnFailureListener { e ->
          promise.reject("ERR_START_RETRIEVER", e.message ?: "Failed to start SMS Retriever", e)
        }
    }

    // Stops the native broadcast receiver (called automatically on hook unmount)
    AsyncFunction("stopSmsRetrieverAsync") {
      unregisterReceiver()
    }

    OnDestroy {
      unregisterReceiver()
    }
  }

  // ─── BroadcastReceiver ────────────────────────────────────────────────────

  private fun registerReceiver() {
    val context = appContext.reactContext ?: return
    unregisterReceiver() // prevent double-register

    receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context, intent: Intent) {
        if (SmsRetriever.SMS_RETRIEVED_ACTION != intent.action) return

        val status = intent.extras?.get(SmsRetriever.EXTRA_STATUS) as? Status
        when (status?.statusCode) {
          CommonStatusCodes.SUCCESS -> {
            val message = intent.extras?.get(SmsRetriever.EXTRA_SMS_MESSAGE) as? String
            if (message != null) sendEvent("onOtpReceived", mapOf("message" to message))
          }
          CommonStatusCodes.TIMEOUT -> {
            sendEvent("onOtpError", mapOf("message" to "Timeout waiting for SMS"))
          }
        }
      }
    }

    val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, SmsRetriever.SEND_PERMISSION, null, Context.RECEIVER_EXPORTED)
    } else {
      context.registerReceiver(receiver, filter, SmsRetriever.SEND_PERMISSION, null)
    }
  }

  private fun unregisterReceiver() {
    val context = appContext.reactContext ?: return
    receiver?.let {
      try { context.unregisterReceiver(it) } catch (_: Exception) {}
      receiver = null
    }
  }
}
