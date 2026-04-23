package com.passwordkeeper.app

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.core.view.WindowCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    WindowCompat.setDecorFitsSystemWindows(window, true)
    Log.d("PasswordKeeperOAuth", "MainActivity.onCreate action=${intent?.action} data=${intent?.data}")
    GoogleOAuthManager.handleIntent(this, intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    Log.d("PasswordKeeperOAuth", "MainActivity.onNewIntent action=${intent.action} data=${intent.data}")
    GoogleOAuthManager.handleIntent(this, intent)
  }
}
