package com.passwordkeeper.vault

object GoogleOAuthBridge {
    @JvmStatic
    external fun finishOAuth(resultJson: String?, error: String?)
}
