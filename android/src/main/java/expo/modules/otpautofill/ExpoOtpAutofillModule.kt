package expo.modules.otpautofill

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import com.google.android.gms.tasks.await
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoOtpAutofillModule : Module() {

  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoOtpAutofill")

    Events("onOtpReceived", "onOtpError")

    // Returns the 11-char app hash needed by your server to address SMS to this app
    AsyncFunction("getAppHashAsync") {
      val context = appContext.reactContext ?: return@AsyncFunction ""
      AppHashHelper(context.packageName, context.packageManager).getHash()
    }

    // Starts the Google Play Services SMS Retriever — listens for up to 5 minutes.
    AsyncFunction("startSmsRetrieverAsync") {
      val context = appContext.reactContext
        ?: throw Exception("React context is not available")
      SmsRetriever.getClient(context).startSmsRetriever().await()
      registerReceiver()
      true
    }

    // Stop the native broadcast receiver manually
    AsyncFunction("stopSmsRetrieverAsync") {
      unregisterReceiver()
    }

    OnDestroy {
      unregisterReceiver()
    }
  }

  // ─── BroadcastReceiver management ─────────────────────────────────────────

  private fun registerReceiver() {
    val context = appContext.reactContext ?: return
    unregisterReceiver() // prevent double registration

    receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context, intent: Intent) {
        if (SmsRetriever.SMS_RETRIEVED_ACTION != intent.action) return

        val status = intent.extras?.get(SmsRetriever.EXTRA_STATUS) as? Status
        when (status?.statusCode) {
          CommonStatusCodes.SUCCESS -> {
            val message = intent.extras?.get(SmsRetriever.EXTRA_SMS_MESSAGE) as? String
            if (message != null) {
              sendEvent("onOtpReceived", mapOf("message" to message))
            }
          }
          CommonStatusCodes.TIMEOUT -> {
            sendEvent("onOtpError", mapOf("message" to "Timeout waiting for SMS"))
          }
        }
      }
    }

    val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(
        receiver, filter,
        SmsRetriever.SEND_PERMISSION, null,
        Context.RECEIVER_EXPORTED
      )
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
