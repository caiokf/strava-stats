package com.caiokf.stravastats.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.caiokf.stravastats.data.repository.ActivityRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val activityRepository: ActivityRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState

    init {
        loadActivities()
    }

    fun loadActivities() {
        viewModelScope.launch {
            _uiState.value = DashboardUiState.Loading
            try {
                val activities = activityRepository.getActivities()
                _uiState.value = DashboardUiState.Success(
                    activities.map { activity ->
                        ActivityUiModel(
                            id = activity.id,
                            name = activity.name,
                            type = activity.sportType ?: activity.type,
                            distance = formatDistance(activity.distance),
                            duration = formatDuration(activity.movingTime),
                            elevation = formatElevation(activity.totalElevationGain),
                            date = formatDate(activity.startDateLocal ?: activity.startDate)
                        )
                    }
                )
            } catch (e: Exception) {
                _uiState.value = DashboardUiState.Error(
                    e.message ?: "Failed to load activities"
                )
            }
        }
    }

    private fun formatDistance(meters: Double): String {
        val km = meters / 1000
        return String.format("%.2f km", km)
    }

    private fun formatDuration(seconds: Int): String {
        val hours = seconds / 3600
        val minutes = (seconds % 3600) / 60
        return if (hours > 0) {
            "${hours}h ${minutes}m"
        } else {
            "${minutes}m"
        }
    }

    private fun formatElevation(meters: Double?): String {
        return if (meters != null && meters > 0) {
            String.format("%.0f m", meters)
        } else {
            "-"
        }
    }

    private fun formatDate(isoDate: String): String {
        return try {
            val parsed = ZonedDateTime.parse(isoDate)
            val formatter = DateTimeFormatter.ofPattern("MMM d, yyyy")
            parsed.format(formatter)
        } catch (e: Exception) {
            isoDate.take(10)
        }
    }
}
