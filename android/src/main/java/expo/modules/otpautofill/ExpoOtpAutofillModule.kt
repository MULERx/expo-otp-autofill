package expo.modules.otpautofill

import android.content.ActivityNotFoundException
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoOtpAutofillModule : Module() {

  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoOtpAutofill")

    Events("onOtpReceived", "onOtpError")

    AsyncFunction("getAppHashAsync") {
      val context = appContext.reactContext ?: return@AsyncFunction ""
      val helper = AppHashHelper(context.packageName, context.packageManager)
      return@AsyncFunction helper.getHash()
    }

    AsyncFunction("startSmsRetrieverAsync") { promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext ?: run {
        promise.reject("ERR_NO_CONTEXT", "React context is not available", null)
        return@AsyncFunction
      }

      // Start the SMS Retriever API
      val client = SmsRetriever.getClient(context)
      val task = client.startSmsRetriever()

      task.addOnSuccessListener {
        // Successfully started retriever, now listen for the broadcast
        registerReceiver()
        promise.resolve(true)
      }

      task.addOnFailureListener { e ->
        promise.reject("ERR_START_RETRIEVER", "Failed to start SMS Retriever", e)
      }
    }

    AsyncFunction("stopSmsRetrieverAsync") {
      unregisterReceiver()
    }
    
    OnDestroy {
      unregisterReceiver()
    }
  }

  private fun registerReceiver() {
    val context = appContext.reactContext ?: return
    
    // Prevent double registration
    unregisterReceiver()

    receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context, intent: Intent) {
        if (SmsRetriever.SMS_RETRIEVED_ACTION == intent.action) {
          val extras = intent.extras
          val smsRetrieverStatus = extras?.get(SmsRetriever.EXTRA_STATUS) as? Status

          when (smsRetrieverStatus?.statusCode) {
            CommonStatusCodes.SUCCESS -> {
              // Get SMS message contents
              val message = extras.get(SmsRetriever.EXTRA_SMS_MESSAGE) as? String
              if (message != null) {
                sendEvent("onOtpReceived", mapOf("message" to message))
              }
            }
            CommonStatusCodes.TIMEOUT -> {
              // Time out occurred, waiting for SMS to arrive (5 minutes max)
              sendEvent("onOtpError", mapOf("message" to "Timeout waiting for SMS"))
            }
          }
        }
      }
    }

    val intentFilter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, intentFilter, SmsRetriever.SEND_PERMISSION, null, Context.RECEIVER_EXPORTED)
    } else {
      context.registerReceiver(receiver, intentFilter, SmsRetriever.SEND_PERMISSION, null)
    }
  }

  private fun unregisterReceiver() {
    val context = appContext.reactContext ?: return
    receiver?.let {
      try {
        context.unregisterReceiver(it)
      } catch (e: Exception) {
        // Ignore unregister errors if not registered
      }
      receiver = null
    }
  }
}
