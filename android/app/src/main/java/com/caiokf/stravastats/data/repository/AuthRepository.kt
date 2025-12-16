package com.caiokf.stravastats.data.repository

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences = EncryptedSharedPreferences.create(
        context,
        "strava_stats_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    companion object {
        private const val KEY_EMAIL = "user_email"
        private const val KEY_TOKEN = "auth_token"
    }

    fun hasStoredCredentials(): Boolean {
        return sharedPreferences.getString(KEY_EMAIL, null) != null &&
                sharedPreferences.getString(KEY_TOKEN, null) != null
    }

    fun saveCredentials(email: String, token: String) {
        sharedPreferences.edit()
            .putString(KEY_EMAIL, email)
            .putString(KEY_TOKEN, token)
            .apply()
    }

    fun getStoredEmail(): String? {
        return sharedPreferences.getString(KEY_EMAIL, null)
    }

    fun getStoredToken(): String? {
        return sharedPreferences.getString(KEY_TOKEN, null)
    }

    fun clearCredentials() {
        sharedPreferences.edit()
            .remove(KEY_EMAIL)
            .remove(KEY_TOKEN)
            .apply()
    }
}
