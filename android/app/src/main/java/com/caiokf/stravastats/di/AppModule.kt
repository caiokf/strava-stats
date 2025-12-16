package com.caiokf.stravastats.di

import android.content.Context
import com.caiokf.stravastats.data.api.StravaApiService
import com.caiokf.stravastats.data.repository.AuthRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(authRepository: AuthRepository): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor { chain ->
                val token = authRepository.getStoredToken()
                val request = chain.request().newBuilder()
                    .apply {
                        token?.let { addHeader("Authorization", "Bearer $it") }
                    }
                    .build()
                chain.proceed(request)
            }
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl("https://backend-one-cyan-57.vercel.app/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideStravaApiService(retrofit: Retrofit): StravaApiService {
        return retrofit.create(StravaApiService::class.java)
    }
}
