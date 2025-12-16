package com.caiokf.stravastats.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.caiokf.stravastats.ui.screens.AuthErrorScreen
import com.caiokf.stravastats.ui.screens.DashboardScreen
import com.caiokf.stravastats.ui.screens.LoginScreen

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object AuthError : Screen("auth_error")
}

@Composable
fun StravaNavHost() {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = Screen.Login.route
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onAuthError = {
                    navController.navigate(Screen.AuthError.route)
                }
            )
        }

        composable(Screen.Dashboard.route) {
            DashboardScreen()
        }

        composable(Screen.AuthError.route) {
            AuthErrorScreen(
                onRetry = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.AuthError.route) { inclusive = true }
                    }
                }
            )
        }
    }
}
