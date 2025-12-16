package com.caiokf.stravastats.data.api

import com.google.gson.annotations.SerializedName
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface StravaApiService {
    @GET("api/activities")
    suspend fun getActivities(
        @Query("athlete_id") athleteId: Long = 34048034,
        @Query("limit") limit: Int = 50
    ): List<ActivityDto>

    @GET("api/activities/{id}")
    suspend fun getActivity(@Path("id") id: Long): ActivityDto
}

data class ActivityDto(
    val id: Long,
    val name: String,
    val type: String,
    @SerializedName("sport_type")
    val sportType: String?,
    val distance: Double,
    @SerializedName("moving_time")
    val movingTime: Int,
    @SerializedName("elapsed_time")
    val elapsedTime: Int,
    @SerializedName("total_elevation_gain")
    val totalElevationGain: Double?,
    @SerializedName("start_date")
    val startDate: String,
    @SerializedName("start_date_local")
    val startDateLocal: String?,
    @SerializedName("average_speed")
    val averageSpeed: Double?,
    @SerializedName("max_speed")
    val maxSpeed: Double?,
    @SerializedName("average_heartrate")
    val averageHeartrate: Double?,
    @SerializedName("max_heartrate")
    val maxHeartrate: Int?,
    val calories: Int?,
    @SerializedName("kudos_count")
    val kudosCount: Int?,
    @SerializedName("suffer_score")
    val sufferScore: Int?
)
