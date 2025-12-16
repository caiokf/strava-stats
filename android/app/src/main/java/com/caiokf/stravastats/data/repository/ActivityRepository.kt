package com.caiokf.stravastats.data.repository

import com.caiokf.stravastats.data.api.StravaApiService
import com.caiokf.stravastats.data.api.ActivityDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ActivityRepository @Inject constructor(
    private val apiService: StravaApiService
) {
    suspend fun getActivities(): List<ActivityDto> {
        return apiService.getActivities()
    }

    suspend fun getActivity(id: Long): ActivityDto {
        return apiService.getActivity(id)
    }
}
