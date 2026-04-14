package com.passwordkeeper.app

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Helper HTTP chamado via JNI pelo Rust.
 * Usa HttpURLConnection do Android (DNS, TLS, etc. funcionam corretamente).
 * O NDK Rust não consegue fazer DNS/sockets diretamente no Android.
 *
 * Usa ConnectivityManager.getActiveNetwork() para vincular explicitamente
 * a conexão à rede ativa (necessário em MIUI e outros sistemas que
 * restringem acesso à internet para APKs de debug).
 */
object NativeHttp {

    @JvmStatic
    fun request(
        context: Context,
        method: String,
        url: String,
        headersJson: String,
        body: String,
        hasBody: Boolean,
    ): String {
        val conn = openConnection(context, url)
        conn.requestMethod = method
        conn.connectTimeout = 30_000
        conn.readTimeout    = 30_000
        conn.useCaches      = false
        conn.instanceFollowRedirects = true

        val headers = JSONObject(headersJson)
        for (key in headers.keys()) {
            conn.setRequestProperty(key, headers.getString(key))
        }

        if (hasBody) {
            conn.doOutput = true
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
        }

        val status = conn.responseCode
        val stream = if (status in 200..299) conn.inputStream
                     else (conn.errorStream ?: conn.inputStream)
        val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
        conn.disconnect()

        return JSONObject()
            .put("status", status)
            .put("body", text)
            .toString()
    }

    private fun openConnection(context: Context, url: String): HttpURLConnection {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        if (cm != null) {
            // Prefer a network that has INTERNET capability
            val network = cm.activeNetwork
                ?: cm.allNetworks.firstOrNull { net ->
                    val caps = cm.getNetworkCapabilities(net)
                    caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                }
            if (network != null) {
                return network.openConnection(URL(url)) as HttpURLConnection
            }
        }
        // Fallback: standard connection
        return URL(url).openConnection() as HttpURLConnection
    }
}
