import type { Activity } from '@/types/activity'
import { getPowerStreamsForActivities, type PowerStreamData } from '@/services/activitiesService'

export interface PowerCurvePoint {
  duration: number // seconds
  durationLabel: string
  power: number // watts
  activityId: number
  activityName: string
  activityDate: string
  fromStream: boolean // true if calculated from actual stream data
}

export interface PowerCurve {
  points: PowerCurvePoint[]
  period: string
}

// Standard power curve intervals (in seconds)
export const POWER_CURVE_INTERVALS = [
  { seconds: 5, label: '5s' },
  { seconds: 15, label: '15s' },
  { seconds: 30, label: '30s' },
  { seconds: 60, label: '1m' },
  { seconds: 120, label: '2m' },
  { seconds: 180, label: '3m' },
  { seconds: 300, label: '5m' },
  { seconds: 480, label: '8m' },
  { seconds: 600, label: '10m' },
  { seconds: 900, label: '15m' },
  { seconds: 1200, label: '20m' },
  { seconds: 1800, label: '30m' },
  { seconds: 2700, label: '45m' },
  { seconds: 3600, label: '1hr' },
  { seconds: 7200, label: '2hr' },
]

/**
 * Calculate the best average power for a given duration using a sliding window.
 * Uses the time stream to find windows of the target duration.
 */
function calculateBestPowerForDuration(
  timeData: number[],
  powerData: number[],
  targetDurationSeconds: number,
): number | null {
  if (timeData.length < 2 || powerData.length < 2) return null

  const firstTime = timeData[0]
  const lastTime = timeData[timeData.length - 1]
  if (firstTime === undefined || lastTime === undefined) return null

  const totalDuration = lastTime - firstTime
  if (totalDuration < targetDurationSeconds) return null

  let bestAvgPower = 0
  let windowStart = 0

  // Sliding window approach using time-based windows
  for (let windowEnd = 0; windowEnd < timeData.length; windowEnd++) {
    const windowEndTime = timeData[windowEnd]
    if (windowEndTime === undefined) continue

    const targetStartTime = windowEndTime - targetDurationSeconds

    // Move windowStart forward until we're within the target duration
    while (windowStart < windowEnd) {
      const startTime = timeData[windowStart]
      if (startTime === undefined || startTime >= targetStartTime) break
      windowStart++
    }

    // Calculate the actual window duration
    const windowStartTime = timeData[windowStart]
    if (windowStartTime === undefined) continue

    const windowDuration = windowEndTime - windowStartTime

    // Only consider windows that are at least the target duration
    // Allow a small tolerance (within 10% of target or at least close)
    if (windowDuration >= targetDurationSeconds * 0.9) {
      // Calculate average power in this window
      let powerSum = 0
      let validSamples = 0

      for (let i = windowStart; i <= windowEnd; i++) {
        const power = powerData[i]
        if (power !== null && power !== undefined && power >= 0) {
          powerSum += power
          validSamples++
        }
      }

      if (validSamples > 0) {
        const avgPower = powerSum / validSamples
        if (avgPower > bestAvgPower) {
          bestAvgPower = avgPower
        }
      }
    }
  }

  return bestAvgPower > 0 ? Math.round(bestAvgPower) : null
}

/**
 * Estimate best power for a given duration based on activity-level data.
 * Used as fallback when stream data is not available.
 */
function estimateBestPowerForDuration(
  activity: Activity,
  durationSeconds: number,
): number | null {
  const activityDuration = activity.moving_time || 0
  const avgPower = activity.weighted_average_watts || activity.average_watts
  const maxPower = activity.max_watts

  if (!avgPower) return null

  // If the activity is shorter than the requested duration, skip it
  if (activityDuration < durationSeconds) return null

  // For very short intervals (< 60s), estimate from max power if available
  if (durationSeconds <= 60 && maxPower) {
    // Interpolate between max and average based on duration
    const factor = Math.pow(durationSeconds / activityDuration, 0.1)
    return Math.round(maxPower * (1 - factor) + avgPower * factor)
  }

  // For longer intervals, use weighted average as the best estimate
  // Apply a small factor for intervals shorter than the full activity
  if (durationSeconds < activityDuration * 0.5) {
    // Assume power for shorter segments is slightly higher
    const factor = 1 + (0.1 * (1 - durationSeconds / activityDuration))
    return Math.round(avgPower * Math.min(factor, 1.15))
  }

  return Math.round(avgPower)
}

// Cycling sport types
const CYCLING_SPORT_TYPES = [
  'Ride',
  'VirtualRide',
  'GravelRide',
  'MountainBikeRide',
  'EBikeRide',
]

function isCyclingActivity(activity: Activity): boolean {
  return (
    activity.type === 'Ride' ||
    (activity.sport_type !== null && CYCLING_SPORT_TYPES.includes(activity.sport_type))
  )
}

function hasPowerData(activity: Activity): boolean {
  return !!(activity.average_watts || activity.weighted_average_watts)
}

/**
 * Calculate the power curve for a set of activities.
 * Fetches power streams and calculates best efforts using actual data.
 * Falls back to estimation for activities without stream data.
 */
export async function calculatePowerCurve(
  activities: Activity[],
  periodLabel: string = 'All Time',
): Promise<PowerCurve> {
  // Filter to cycling activities with power data
  const cyclingActivities = activities.filter(
    (a) => isCyclingActivity(a) && hasPowerData(a),
  )

  if (cyclingActivities.length === 0) {
    return { points: [], period: periodLabel }
  }

  // Fetch power streams for all cycling activities
  const activityIds = cyclingActivities.map((a) => a.id)
  let powerStreams: PowerStreamData[] = []

  try {
    powerStreams = await getPowerStreamsForActivities(activityIds)
  } catch (error) {
    console.warn('Failed to fetch power streams, falling back to estimation:', error)
  }

  // Create a map for quick lookup
  const streamsByActivityId = new Map<number, PowerStreamData>()
  for (const stream of powerStreams) {
    streamsByActivityId.set(stream.activityId, stream)
  }

  // Create activity lookup map
  const activitiesById = new Map<number, Activity>()
  for (const activity of cyclingActivities) {
    activitiesById.set(activity.id, activity)
  }

  const points: PowerCurvePoint[] = []

  for (const interval of POWER_CURVE_INTERVALS) {
    let bestPower = 0
    let bestActivity: Activity | null = null
    let fromStream = false

    // First, try to find best power from activities with stream data
    for (const stream of powerStreams) {
      const power = calculateBestPowerForDuration(
        stream.timeData,
        stream.powerData,
        interval.seconds,
      )

      if (power && power > bestPower) {
        bestPower = power
        bestActivity = activitiesById.get(stream.activityId) || null
        fromStream = true
      }
    }

    // Also check activities without stream data using estimation
    for (const activity of cyclingActivities) {
      // Skip if we already processed this activity with stream data
      if (streamsByActivityId.has(activity.id)) continue

      const power = estimateBestPowerForDuration(activity, interval.seconds)
      if (power && power > bestPower) {
        bestPower = power
        bestActivity = activity
        fromStream = false
      }
    }

    if (bestActivity && bestPower > 0) {
      points.push({
        duration: interval.seconds,
        durationLabel: interval.label,
        power: bestPower,
        activityId: bestActivity.id,
        activityName: bestActivity.name,
        activityDate: bestActivity.start_date,
        fromStream,
      })
    }
  }

  return { points, period: periodLabel }
}

/**
 * Synchronous version that only uses estimation (no stream data).
 * Useful for initial render while async calculation is loading.
 */
export function calculatePowerCurveSync(
  activities: Activity[],
  periodLabel: string = 'All Time',
): PowerCurve {
  // Filter to cycling activities with power data
  const cyclingActivities = activities.filter(
    (a) => isCyclingActivity(a) && hasPowerData(a),
  )

  const points: PowerCurvePoint[] = []

  for (const interval of POWER_CURVE_INTERVALS) {
    let bestPower = 0
    let bestActivity: Activity | null = null

    for (const activity of cyclingActivities) {
      const power = estimateBestPowerForDuration(activity, interval.seconds)
      if (power && power > bestPower) {
        bestPower = power
        bestActivity = activity
      }
    }

    if (bestActivity && bestPower > 0) {
      points.push({
        duration: interval.seconds,
        durationLabel: interval.label,
        power: bestPower,
        activityId: bestActivity.id,
        activityName: bestActivity.name,
        activityDate: bestActivity.start_date,
        fromStream: false,
      })
    }
  }

  return { points, period: periodLabel }
}

/**
 * Filter activities by time period.
 */
export function filterActivitiesByPeriod(
  activities: Activity[],
  period: 'all' | '1y' | '6m' | '3m' | '90d' | '30d',
): Activity[] {
  if (period === 'all') return activities

  const now = new Date()
  let cutoffDate: Date

  switch (period) {
    case '1y':
      cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      break
    case '6m':
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
      break
    case '3m':
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      break
    case '90d':
      cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    default:
      return activities
  }

  return activities.filter((a) => new Date(a.start_date) >= cutoffDate)
}

/**
 * Filter activities by year.
 */
export function filterActivitiesByYear(
  activities: Activity[],
  year: number,
): Activity[] {
  return activities.filter((a) => {
    const date = new Date(a.start_date)
    return date.getFullYear() === year
  })
}

/**
 * Estimate FTP (Functional Threshold Power) from the power curve.
 * Uses 95% of 20-minute power as the standard estimate.
 */
export function estimateFTP(curve: PowerCurve): number | null {
  const point20min = curve.points.find((p) => p.duration === 1200)
  if (point20min) {
    return Math.round(point20min.power * 0.95)
  }

  // Fallback: use 60-minute power if available
  const point60min = curve.points.find((p) => p.duration === 3600)
  if (point60min) {
    return point60min.power
  }

  return null
}
