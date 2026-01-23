/**
 * Banister Impulse-Response Fitness Model
 *
 * This module implements the Banister model for calculating fitness (CTL),
 * fatigue (ATL), and form (TSB) from training data.
 *
 * The model is isolated and designed to be easily replaceable with alternative
 * implementations (e.g., PMC, custom models).
 *
 * References:
 * - Banister et al., 1975 - Original impulse-response model
 * - Coggan's PMC (Performance Manager Chart)
 */

export interface DailyTrainingLoad {
  date: string // ISO date string (YYYY-MM-DD)
  load: number // Training load for that day (TSS, TRIMP, or similar)
}

export interface FitnessMetrics {
  date: string
  ctl: number // Chronic Training Load (Fitness)
  atl: number // Acute Training Load (Fatigue)
  tsb: number // Training Stress Balance (Form)
  load: number // Daily training load
}

export interface FitnessModelConfig {
  ctlTimeConstant: number // CTL decay time constant in days (default: 42)
  atlTimeConstant: number // ATL decay time constant in days (default: 7)
  initialCtl: number // Starting CTL value (default: 0)
  initialAtl: number // Starting ATL value (default: 0)
}

const DEFAULT_CONFIG: FitnessModelConfig = {
  ctlTimeConstant: 42,
  atlTimeConstant: 7,
  initialCtl: 0,
  initialAtl: 0,
}

/**
 * Calculate exponential decay factor for a given time constant
 */
function decayFactor(timeConstant: number): number {
  return Math.exp(-1 / timeConstant)
}

/**
 * Calculate fitness metrics using Banister's impulse-response model
 *
 * CTL (Chronic Training Load / Fitness):
 *   CTL_today = CTL_yesterday * exp(-1/τ_CTL) + load_today * (1 - exp(-1/τ_CTL))
 *
 * ATL (Acute Training Load / Fatigue):
 *   ATL_today = ATL_yesterday * exp(-1/τ_ATL) + load_today * (1 - exp(-1/τ_ATL))
 *
 * TSB (Training Stress Balance / Form):
 *   TSB = CTL - ATL
 */
export function calculateFitnessMetrics(
  dailyLoads: DailyTrainingLoad[],
  config: Partial<FitnessModelConfig> = {},
): FitnessMetrics[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  if (dailyLoads.length === 0) {
    return []
  }

  // Sort by date
  const sortedLoads = [...dailyLoads].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )

  const ctlDecay = decayFactor(cfg.ctlTimeConstant)
  const atlDecay = decayFactor(cfg.atlTimeConstant)
  const ctlGain = 1 - ctlDecay
  const atlGain = 1 - atlDecay

  const results: FitnessMetrics[] = []
  let ctl = cfg.initialCtl
  let atl = cfg.initialAtl

  // Create a map for quick lookup
  const loadMap = new Map<string, number>()
  sortedLoads.forEach((l) => loadMap.set(l.date, l.load))

  // Fill in gaps between dates
  const firstLoad = sortedLoads[0]
  const lastLoad = sortedLoads[sortedLoads.length - 1]
  if (!firstLoad || !lastLoad) {
    return results
  }

  const startDate = new Date(firstLoad.date)
  const endDate = new Date(lastLoad.date)

  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const isoString = currentDate.toISOString()
    const dateStr = isoString.split('T')[0] ?? isoString.substring(0, 10)
    const load = loadMap.get(dateStr) ?? 0

    // Update CTL and ATL using exponential moving average
    ctl = ctl * ctlDecay + load * ctlGain
    atl = atl * atlDecay + load * atlGain

    const tsb = ctl - atl

    results.push({
      date: dateStr,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      load,
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return results
}

/**
 * Calculate training load from heart rate data using TRIMP
 * (Training Impulse) method.
 *
 * TRIMP = duration (minutes) × HRR × 0.64e^(1.92 × HRR)
 * where HRR = (avgHR - restHR) / (maxHR - restHR)
 */
export function calculateTRIMP(
  durationMinutes: number,
  avgHeartRate: number,
  restingHeartRate: number,
  maxHeartRate: number,
  gender: 'male' | 'female' = 'male',
): number {
  if (maxHeartRate <= restingHeartRate || avgHeartRate < restingHeartRate) {
    return 0
  }

  const hrr = (avgHeartRate - restingHeartRate) / (maxHeartRate - restingHeartRate)
  const clampedHrr = Math.max(0, Math.min(1, hrr))

  // Gender-specific coefficients (Banister, 1991)
  const y = gender === 'male' ? 1.92 : 1.67

  const trimp = durationMinutes * clampedHrr * 0.64 * Math.exp(y * clampedHrr)
  return Math.round(trimp)
}

/**
 * Calculate Training Stress Score (TSS) from power data.
 *
 * TSS = (duration_seconds × NP × IF) / (FTP × 3600) × 100
 * where IF = NP / FTP (Intensity Factor)
 */
export function calculateTSS(
  durationSeconds: number,
  normalizedPower: number,
  ftp: number,
): number {
  if (ftp <= 0 || durationSeconds <= 0) {
    return 0
  }

  const intensityFactor = normalizedPower / ftp
  const tss = ((durationSeconds * normalizedPower * intensityFactor) / (ftp * 3600)) * 100

  return Math.round(tss)
}

/**
 * Estimate training load from Strava's suffer_score
 * This is a simplified approach when HR/power data isn't available
 */
export function estimateLoadFromSufferScore(
  sufferScore: number | null,
  durationMinutes: number,
): number {
  if (sufferScore && sufferScore > 0) {
    // Strava suffer score is roughly comparable to TRIMP
    return sufferScore
  }

  // Fallback: estimate based on duration alone (assumes moderate intensity)
  // ~1 TSS per minute of moderate activity
  return Math.round(durationMinutes * 0.5)
}

/**
 * Convert activity data to daily training loads
 */
export interface ActivityForLoad {
  start_date: string
  moving_time: number | null
  average_heartrate: number | null
  suffer_score: number | null
  average_watts: number | null
  weighted_average_watts: number | null
}

export function activitiesToDailyLoads(
  activities: ActivityForLoad[],
  options: {
    restingHeartRate?: number
    maxHeartRate?: number
    ftp?: number
    gender?: 'male' | 'female'
  } = {},
): DailyTrainingLoad[] {
  const { restingHeartRate = 60, maxHeartRate = 190, ftp = 200, gender = 'male' } = options

  // Group activities by date
  const dailyActivities = new Map<string, ActivityForLoad[]>()

  activities.forEach((activity) => {
    const dateParts = activity.start_date.split('T')
    const date = dateParts[0] ?? activity.start_date.substring(0, 10)
    const existing = dailyActivities.get(date)
    if (existing) {
      existing.push(activity)
    } else {
      dailyActivities.set(date, [activity])
    }
  })

  // Calculate total daily load
  const dailyLoads: DailyTrainingLoad[] = []

  dailyActivities.forEach((dayActivities, date) => {
    let totalLoad = 0

    dayActivities.forEach((activity) => {
      const durationMinutes = (activity.moving_time || 0) / 60

      if (activity.weighted_average_watts || activity.average_watts) {
        // Power-based TSS
        const np = activity.weighted_average_watts || activity.average_watts || 0
        const durationSeconds = activity.moving_time || 0
        totalLoad += calculateTSS(durationSeconds, np, ftp)
      } else if (activity.average_heartrate) {
        // HR-based TRIMP
        totalLoad += calculateTRIMP(
          durationMinutes,
          activity.average_heartrate,
          restingHeartRate,
          maxHeartRate,
          gender,
        )
      } else {
        // Fallback to suffer score or duration estimate
        totalLoad += estimateLoadFromSufferScore(activity.suffer_score, durationMinutes)
      }
    })

    dailyLoads.push({ date, load: totalLoad })
  })

  return dailyLoads.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * Get current fitness score (most recent CTL)
 */
export function getCurrentFitness(metrics: FitnessMetrics[]): number {
  const last = metrics[metrics.length - 1]
  return last?.ctl ?? 0
}

/**
 * Get current form (most recent TSB)
 */
export function getCurrentForm(metrics: FitnessMetrics[]): number {
  const last = metrics[metrics.length - 1]
  return last?.tsb ?? 0
}

/**
 * Get fitness trend (change over specified days)
 */
export function getFitnessTrend(metrics: FitnessMetrics[], days = 7): number {
  if (metrics.length < 2) return 0

  const recent = metrics[metrics.length - 1]
  const daysAgo = Math.max(0, metrics.length - 1 - days)
  const past = metrics[daysAgo]

  if (!recent || !past) return 0

  return Math.round((recent.ctl - past.ctl) * 10) / 10
}
