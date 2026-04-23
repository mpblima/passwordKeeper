package com.passwordkeeper.app

object GoogleOAuthBridge {
    @JvmStatic
    external fun finishOAuth(resultJson: String?, error: String?)
}
