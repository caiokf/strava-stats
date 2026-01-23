/**
 * Aggregation utilities for activity data
 *
 * Functions for grouping, summarizing, and analyzing activity data
 * for dashboard visualizations.
 */

import type { Activity } from '@/types'

export interface DayActivity {
  date: string
  activities: Activity[]
  totalDistance: number
  totalDuration: number
  totalElevation: number
  activityCount: number
}

export interface WeekSummary {
  weekStart: string // Monday of the week
  weekEnd: string
  days: DayActivity[]
  totalDistance: number
  totalDuration: number
  totalElevation: number
  activityCount: number
  intensity: number // Calculated intensity score
}

export interface MonthSummary {
  month: string // YYYY-MM
  year: number
  monthNum: number
  weeks: WeekSummary[]
  totalDistance: number
  totalDuration: number
  totalElevation: number
  activityCount: number
}

export interface SportStats {
  sportType: string
  activityCount: number
  totalDistance: number
  totalDuration: number
  totalElevation: number
  averageDistance: number
  averageDuration: number
  bestEfforts: {
    longestActivity?: Activity
    fastestPace?: Activity
    highestElevation?: Activity
    longestDuration?: Activity
  }
}

export interface Streak {
  startDate: string
  endDate: string
  days: number
  activityCount: number
}

/**
 * Get the ISO week start (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get the week end (Sunday) for a given date
 */
export function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return end
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? date.toISOString().substring(0, 10)
}

/**
 * Group activities by date
 */
export function groupByDate(activities: Activity[]): Map<string, Activity[]> {
  const grouped = new Map<string, Activity[]>()

  activities.forEach((activity) => {
    const date = (activity.start_date_local ?? activity.start_date).split('T')[0]
    if (date) {
      const existing = grouped.get(date)
      if (existing) {
        existing.push(activity)
      } else {
        grouped.set(date, [activity])
      }
    }
  })

  return grouped
}

/**
 * Group activities by week
 */
export function groupByWeek(activities: Activity[]): WeekSummary[] {
  const byDate = groupByDate(activities)
  const weekMap = new Map<string, WeekSummary>()

  byDate.forEach((dayActivities, dateStr) => {
    const date = new Date(dateStr)
    const weekStart = getWeekStart(date)
    const weekKey = formatDate(weekStart)

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        weekStart: weekKey,
        weekEnd: formatDate(getWeekEnd(date)),
        days: [],
        totalDistance: 0,
        totalDuration: 0,
        totalElevation: 0,
        activityCount: 0,
        intensity: 0,
      })
    }

    const week = weekMap.get(weekKey)!
    const dayStats: DayActivity = {
      date: dateStr,
      activities: dayActivities,
      totalDistance: dayActivities.reduce((sum, a) => sum + (a.distance ?? 0), 0),
      totalDuration: dayActivities.reduce((sum, a) => sum + (a.moving_time ?? 0), 0),
      totalElevation: dayActivities.reduce((sum, a) => sum + (a.total_elevation_gain ?? 0), 0),
      activityCount: dayActivities.length,
    }

    week.days.push(dayStats)
    week.totalDistance += dayStats.totalDistance
    week.totalDuration += dayStats.totalDuration
    week.totalElevation += dayStats.totalElevation
    week.activityCount += dayStats.activityCount
  })

  // Calculate intensity for each week
  const weeks = Array.from(weekMap.values())
  weeks.forEach((week) => {
    week.intensity = calculateWeeklyIntensity(week)
  })

  // Sort by week start date descending
  return weeks.sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())
}

/**
 * Group activities by month
 */
export function groupByMonth(activities: Activity[]): MonthSummary[] {
  const monthMap = new Map<string, MonthSummary>()

  activities.forEach((activity) => {
    const date = new Date(activity.start_date_local ?? activity.start_date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthKey,
        year: date.getFullYear(),
        monthNum: date.getMonth() + 1,
        weeks: [],
        totalDistance: 0,
        totalDuration: 0,
        totalElevation: 0,
        activityCount: 0,
      })
    }

    const month = monthMap.get(monthKey)!
    month.totalDistance += activity.distance ?? 0
    month.totalDuration += activity.moving_time ?? 0
    month.totalElevation += activity.total_elevation_gain ?? 0
    month.activityCount += 1
  })

  return Array.from(monthMap.values()).sort(
    (a, b) => new Date(b.month).getTime() - new Date(a.month).getTime(),
  )
}

/**
 * Calculate weekly intensity score
 * Combines duration, distance, and elevation into a single score
 */
export function calculateWeeklyIntensity(week: WeekSummary): number {
  // Normalize factors (adjust these based on typical training)
  const durationFactor = week.totalDuration / 3600 // hours
  const distanceFactor = week.totalDistance / 1000 // km
  const elevationFactor = week.totalElevation / 100 // hundreds of meters
  const frequencyFactor = week.days.length // days active

  // Weighted combination
  const intensity =
    durationFactor * 0.3 + distanceFactor * 0.3 + elevationFactor * 0.2 + frequencyFactor * 0.2

  return Math.round(intensity * 10) / 10
}

/**
 * Calculate sports breakdown
 */
export function calculateSportBreakdown(activities: Activity[]): SportStats[] {
  const sportMap = new Map<string, SportStats>()

  activities.forEach((activity) => {
    const sport = activity.sport_type ?? activity.type ?? 'Unknown'

    if (!sportMap.has(sport)) {
      sportMap.set(sport, {
        sportType: sport,
        activityCount: 0,
        totalDistance: 0,
        totalDuration: 0,
        totalElevation: 0,
        averageDistance: 0,
        averageDuration: 0,
        bestEfforts: {},
      })
    }

    const stats = sportMap.get(sport)!
    stats.activityCount += 1
    stats.totalDistance += activity.distance ?? 0
    stats.totalDuration += activity.moving_time ?? 0
    stats.totalElevation += activity.total_elevation_gain ?? 0

    // Track best efforts
    if (
      !stats.bestEfforts.longestActivity ||
      (activity.distance ?? 0) > (stats.bestEfforts.longestActivity.distance ?? 0)
    ) {
      stats.bestEfforts.longestActivity = activity
    }

    if (
      !stats.bestEfforts.longestDuration ||
      (activity.moving_time ?? 0) > (stats.bestEfforts.longestDuration.moving_time ?? 0)
    ) {
      stats.bestEfforts.longestDuration = activity
    }

    if (
      !stats.bestEfforts.highestElevation ||
      (activity.total_elevation_gain ?? 0) >
        (stats.bestEfforts.highestElevation.total_elevation_gain ?? 0)
    ) {
      stats.bestEfforts.highestElevation = activity
    }

    // Best pace (highest average speed)
    if (
      activity.average_speed &&
      (!stats.bestEfforts.fastestPace ||
        activity.average_speed > (stats.bestEfforts.fastestPace.average_speed ?? 0))
    ) {
      stats.bestEfforts.fastestPace = activity
    }
  })

  // Calculate averages
  sportMap.forEach((stats) => {
    stats.averageDistance = stats.activityCount > 0 ? stats.totalDistance / stats.activityCount : 0
    stats.averageDuration = stats.activityCount > 0 ? stats.totalDuration / stats.activityCount : 0
  })

  // Sort by total duration (most time spent)
  return Array.from(sportMap.values()).sort((a, b) => b.totalDuration - a.totalDuration)
}

/**
 * Calculate activity streaks (consecutive days with activities)
 */
export function calculateStreaks(activities: Activity[]): Streak[] {
  const byDate = groupByDate(activities)
  const dates = Array.from(byDate.keys()).sort()

  if (dates.length === 0) return []

  const streaks: Streak[] = []
  let currentStreak: Streak | null = null

  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i]
    if (!dateStr) continue

    const date = new Date(dateStr)
    const activities = byDate.get(dateStr) ?? []

    if (i === 0) {
      currentStreak = {
        startDate: dateStr,
        endDate: dateStr,
        days: 1,
        activityCount: activities.length,
      }
      continue
    }

    const prevDateStr = dates[i - 1]
    if (!prevDateStr) continue

    const prevDate = new Date(prevDateStr)
    const daysDiff = Math.round((date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff === 1 && currentStreak) {
      // Continue streak
      currentStreak.endDate = dateStr
      currentStreak.days += 1
      currentStreak.activityCount += activities.length
    } else {
      // End current streak, start new one
      if (currentStreak) {
        streaks.push(currentStreak)
      }
      currentStreak = {
        startDate: dateStr,
        endDate: dateStr,
        days: 1,
        activityCount: activities.length,
      }
    }
  }

  if (currentStreak) {
    streaks.push(currentStreak)
  }

  // Sort by streak length descending
  return streaks.sort((a, b) => b.days - a.days)
}

/**
 * Get current active streak (if today or yesterday has activity)
 */
export function getCurrentStreak(activities: Activity[]): Streak | null {
  const streaks = calculateStreaks(activities)
  if (streaks.length === 0) return null

  const today = formatDate(new Date())
  const yesterday = formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000))

  // Find streak that ends today or yesterday
  return (
    streaks.find((streak) => streak.endDate === today || streak.endDate === yesterday) ?? null
  )
}

/**
 * Calculate training calendar data (for heatmap visualization)
 */
export interface CalendarDay {
  date: string
  activityCount: number
  totalDuration: number
  totalDistance: number
  intensity: number // 0-4 scale for heatmap coloring
}

export function calculateCalendarData(
  activities: Activity[],
  startDate: Date,
  endDate: Date,
): CalendarDay[] {
  const byDate = groupByDate(activities)
  const calendar: CalendarDay[] = []

  // Find max values for normalization
  let maxDuration = 0
  byDate.forEach((acts) => {
    const duration = acts.reduce((sum, a) => sum + (a.moving_time ?? 0), 0)
    if (duration > maxDuration) maxDuration = duration
  })

  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate)
    const dayActivities = byDate.get(dateStr) ?? []

    const totalDuration = dayActivities.reduce((sum, a) => sum + (a.moving_time ?? 0), 0)
    const totalDistance = dayActivities.reduce((sum, a) => sum + (a.distance ?? 0), 0)

    // Calculate intensity level (0-4)
    let intensity = 0
    if (dayActivities.length > 0) {
      const normalizedDuration = maxDuration > 0 ? totalDuration / maxDuration : 0
      intensity = Math.min(4, Math.ceil(normalizedDuration * 4))
      if (intensity === 0 && dayActivities.length > 0) intensity = 1
    }

    calendar.push({
      date: dateStr,
      activityCount: dayActivities.length,
      totalDuration,
      totalDistance,
      intensity,
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return calendar
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Format distance in meters to human-readable string
 */
export function formatDistance(meters: number, unit: 'km' | 'mi' = 'km'): string {
  if (unit === 'mi') {
    const miles = meters / 1609.34
    return `${miles.toFixed(1)} mi`
  }
  const km = meters / 1000
  return `${km.toFixed(1)} km`
}

/**
 * Format pace (min/km or min/mi)
 */
export function formatPace(speedMs: number, unit: 'km' | 'mi' = 'km'): string {
  if (speedMs <= 0) return '--:--'

  const paceSeconds = unit === 'mi' ? 1609.34 / speedMs : 1000 / speedMs
  const minutes = Math.floor(paceSeconds / 60)
  const seconds = Math.floor(paceSeconds % 60)

  return `${minutes}:${seconds.toString().padStart(2, '0')} /${unit}`
}

/**
 * Format elevation in meters
 */
export function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`
}

/**
 * Get activity type icon name
 */
export function getActivityTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    Run: 'running',
    Ride: 'bicycle',
    Swim: 'swimmer',
    Walk: 'walking',
    Hike: 'hiking',
    VirtualRide: 'bicycle',
    VirtualRun: 'running',
    WeightTraining: 'dumbbell',
    Workout: 'dumbbell',
    Yoga: 'yoga',
    MountainBikeRide: 'bicycle',
    GravelRide: 'bicycle',
    EBikeRide: 'bicycle',
    TrailRun: 'running',
  }

  return icons[type] ?? 'activity'
}
