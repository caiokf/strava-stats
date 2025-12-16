package com.caiokf.stravastats.data.api

import retrofit2.http.GET
import retrofit2.http.Path

interface StravaApiService {
    @GET("api/activities")
    suspend fun getActivities(): List<ActivityDto>

    @GET("api/activities/{id}")
    suspend fun getActivity(@Path("id") id: Long): ActivityDto
}

data class ActivityDto(
    val id: Long,
    val name: String,
    val type: String,
    val distance: Double,
    val movingTime: Int,
    val elapsedTime: Int,
    val totalElevationGain: Double,
    val startDate: String,
    val averageSpeed: Double,
    val maxSpeed: Double,
    val averageHeartrate: Double?,
    val maxHeartrate: Int?,
    val calories: Int?
)
