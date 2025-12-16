package com.caiokf.stravastats.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.caiokf.stravastats.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<LoginUiState>(LoginUiState.Idle)
    val uiState: StateFlow<LoginUiState> = _uiState

    companion object {
        private const val ALLOWED_EMAIL = "caiokf@gmail.com"
    }

    init {
        checkExistingSession()
    }

    private fun checkExistingSession() {
        viewModelScope.launch {
            if (authRepository.hasStoredCredentials()) {
                _uiState.value = LoginUiState.BiometricPrompt
            }
        }
    }

    fun signInWithGoogle() {
        viewModelScope.launch {
            _uiState.value = LoginUiState.Loading
            // TODO: Implement actual Google Sign-In
            // This will be triggered from the UI with the Google Sign-In intent
        }
    }

    fun handleGoogleSignInResult(email: String?, idToken: String?) {
        viewModelScope.launch {
            when {
                email == null -> {
                    _uiState.value = LoginUiState.Error("Sign-in failed")
                }
                email != ALLOWED_EMAIL -> {
                    _uiState.value = LoginUiState.Unauthorized
                }
                else -> {
                    idToken?.let { authRepository.saveCredentials(email, it) }
                    _uiState.value = LoginUiState.Success
                }
            }
        }
    }

    fun promptBiometric() {
        // Biometric prompt will be handled in the UI
        // On success, this will be called:
        viewModelScope.launch {
            _uiState.value = LoginUiState.Success
        }
    }

    fun onBiometricSuccess() {
        _uiState.value = LoginUiState.Success
    }

    fun onBiometricError(message: String) {
        _uiState.value = LoginUiState.Error(message)
    }
}
