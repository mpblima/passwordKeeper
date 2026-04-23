package com.passwordkeeper.app

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import net.openid.appauth.AppAuthConfiguration
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.ResponseTypeValues

object GoogleOAuthManager {
    private const val TAG = "PasswordKeeperOAuth"
    private const val AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
    private const val TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

    @Volatile
    private var authService: AuthorizationService? = null

    @Volatile
    private var isPending = false

    @JvmStatic
    fun start(
        context: Context,
        clientId: String,
        redirectUri: String,
        scopes: String,
        forceConsent: Boolean,
    ) {
        Log.d(TAG, "start: redirectUri=$redirectUri scopes=$scopes forceConsent=$forceConsent")
        if (isPending) {
            throw IllegalStateException("Ja existe uma autenticacao em andamento.")
        }

        val appContext = context.applicationContext
        val serviceConfig = AuthorizationServiceConfiguration(
            Uri.parse(AUTH_ENDPOINT),
            Uri.parse(TOKEN_ENDPOINT),
        )
        val service = AuthorizationService(
            appContext,
            AppAuthConfiguration.Builder().build(),
        )
        authService?.dispose()
        authService = service

        val additionalParams = linkedMapOf("access_type" to "offline")

        val builder = AuthorizationRequest.Builder(
            serviceConfig,
            clientId,
            ResponseTypeValues.CODE,
            Uri.parse(redirectUri),
        ).setScopes(*scopes.split(" ").filter { it.isNotBlank() }.toTypedArray())

        if (forceConsent) {
            builder.setPrompt("consent")
        }

        if (additionalParams.isNotEmpty()) {
            builder.setAdditionalParameters(additionalParams)
        }

        val request = builder.build()
        Log.d(TAG, "start: auth request built, redirect=${request.redirectUri}")
        val completionIntent = Intent(appContext, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            action = "${appContext.packageName}.GOOGLE_AUTH_COMPLETE"
        }
        val cancelIntent = Intent(appContext, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            action = "${appContext.packageName}.GOOGLE_AUTH_CANCEL"
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_MUTABLE
            } else {
                0
            }

        isPending = true
        Log.d(TAG, "start: launching authorization request")
        service.performAuthorizationRequest(
            request,
            PendingIntent.getActivity(appContext, 2001, completionIntent, flags),
            PendingIntent.getActivity(appContext, 2002, cancelIntent, flags),
        )
    }

    @JvmStatic
    fun handleIntent(context: Context, intent: Intent?): Boolean {
        Log.d(TAG, "handleIntent: pending=$isPending action=${intent?.action} data=${intent?.data} extras=${intent?.extras?.keySet()?.joinToString()}")
        if (!isPending || intent == null) return false

        if (intent.action == "${context.packageName}.GOOGLE_AUTH_CANCEL") {
            finish(error = "Autenticacao do Google cancelada.")
            return true
        }

        val response = AuthorizationResponse.fromIntent(intent)
        val error = AuthorizationException.fromIntent(intent)
        if (response == null && error == null) {
            Log.d(TAG, "handleIntent: no AppAuth response/error found")
            return false
        }

        val service = authService ?: AuthorizationService(context.applicationContext)

        if (error != null) {
            Log.e(TAG, "handleIntent: authorization error ${error.toJsonString()}")
            finish(error = error.errorDescription ?: error.toJsonString())
            return true
        }

        Log.d(TAG, "handleIntent: authorization response received, exchanging token")
        service.performTokenRequest(response!!.createTokenExchangeRequest()) { tokenResponse, tokenError ->
            if (tokenError != null) {
                Log.e(TAG, "token exchange error ${tokenError.toJsonString()}")
                finish(error = tokenError.errorDescription ?: tokenError.toJsonString())
                return@performTokenRequest
            }

            if (tokenResponse == null || tokenResponse.accessToken.isNullOrBlank()) {
                Log.e(TAG, "token exchange returned empty token")
                finish(error = "Token do Google nao foi retornado.")
                return@performTokenRequest
            }

            val accessToken = tokenResponse.accessToken ?: ""
            val expiresAt = tokenResponse.accessTokenExpirationTime?.takeIf { it > 0 }
                ?: (System.currentTimeMillis() + 3600_000L)
            val payload = """
                {
                  "access_token": ${jsonString(accessToken)},
                  "refresh_token": ${jsonNullable(tokenResponse.refreshToken)},
                  "expires_at": $expiresAt,
                  "token_type": ${jsonString(tokenResponse.tokenType ?: "Bearer")}
                }
            """.trimIndent()

            Log.d(TAG, "token exchange success, finishing OAuth")
            finish(resultJson = payload)
        }

        return true
    }

    private fun finish(resultJson: String? = null, error: String? = null) {
        Log.d(TAG, "finish: success=${resultJson != null} error=${error != null}")
        isPending = false
        authService?.dispose()
        authService = null
        GoogleOAuthBridge.finishOAuth(resultJson, error)
    }

    private fun jsonString(value: String): String = "\"" + value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"") + "\""

    private fun jsonNullable(value: String?): String = value?.let(::jsonString) ?: "null"
}
