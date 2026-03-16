package expo.modules.otpautofill

import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import java.security.MessageDigest

/**
 * Computes the 11-character app hash used with the Android SMS Retriever API.
 *
 * The hash is derived from the package name + signing certificate and must be
 * appended to server-sent OTP SMS messages so Android automatically routes
 * them to this app without requiring SMS permissions.
 *
 * Reference: https://developers.google.com/identity/sms-retriever/overview
 */
internal class AppHashHelper(
    private val packageName: String,
    private val packageManager: PackageManager
) {
    fun getHash(): String {
        val certHex = getCertHexString() ?: return ""
        // Official algorithm (Google developer docs):
        //   Base64( SHA-256( "<packageName> <hexCert>" ) ).take(11)
        //
        // Steps:
        //   1. Concatenate package name + " " + lowercase hex cert
        //   2. SHA-256 the bytes → 32-byte digest
        //   3. Base64-encode ALL 32 bytes (NO truncation before Base64)
        //   4. Take the first 11 characters of the base64 string
        val appInfo = "$packageName $certHex"
        val sha256 = MessageDigest.getInstance("SHA-256").apply {
            update(appInfo.toByteArray()) // default charset = UTF-8; cert+pkgName are ASCII
        }.digest() // 32 bytes
        return Base64.encodeToString(sha256, Base64.NO_PADDING or Base64.NO_WRAP).take(11)
    }

    private fun getCertHexString(): String? {
        return try {
            val certBytes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val info = packageManager.getPackageInfo(
                    packageName,
                    PackageManager.GET_SIGNING_CERTIFICATES
                )
                val signingInfo = info.signingInfo ?: return null
                val signatures = if (signingInfo.hasMultipleSigners()) {
                    signingInfo.apkContentsSigners
                } else {
                    signingInfo.signingCertificateHistory
                }
                signatures?.firstOrNull()?.toByteArray() ?: return null
            } else {
                @Suppress("DEPRECATION")
                packageManager.getPackageInfo(
                    packageName,
                    PackageManager.GET_SIGNATURES
                ).signatures?.firstOrNull()?.toByteArray() ?: return null
            }
            // Convert cert bytes to hex string (matches sig.toCharsString())
            certBytes.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            null
        }
    }
}
