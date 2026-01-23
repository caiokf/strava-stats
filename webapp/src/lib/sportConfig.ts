import type { Activity } from '@/types/activity'

/**
 * Sport-specific metric configurations.
 * Defines which metrics are relevant for each sport type.
 */
export interface SportMetricConfig {
  showDistance: boolean
  showElevation: boolean
  showPace: boolean
  showPower: boolean
  showHeartRate: boolean
  showCalories: boolean
  showCadence: boolean
  primaryMetrics: string[] // Order of importance
  unit?: string // Custom unit label
}

// Default config for sports not explicitly configured
const defaultConfig: SportMetricConfig = {
  showDistance: true,
  showElevation: true,
  showPace: true,
  showPower: false,
  showHeartRate: true,
  showCalories: true,
  showCadence: false,
  primaryMetrics: ['duration', 'distance', 'elevation'],
}

// Sport-specific configurations
const sportConfigs: Record<string, SportMetricConfig> = {
  Run: {
    showDistance: true,
    showElevation: true,
    showPace: true,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: true,
    primaryMetrics: ['distance', 'pace', 'duration', 'elevation'],
  },
  TrailRun: {
    showDistance: true,
    showElevation: true,
    showPace: true,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: true,
    primaryMetrics: ['distance', 'elevation', 'duration', 'pace'],
  },
  VirtualRun: {
    showDistance: true,
    showElevation: false,
    showPace: true,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: true,
    primaryMetrics: ['distance', 'pace', 'duration'],
  },
  Ride: {
    showDistance: true,
    showElevation: true,
    showPace: false, // Speed instead
    showPower: true,
    showHeartRate: true,
    showCalories: true,
    showCadence: true,
    primaryMetrics: ['distance', 'elevation', 'power', 'duration'],
    unit: 'km/h',
  },
  VirtualRide: {
    showDistance: true,
    showElevation: true,
    showPace: false,
    showPower: true,
    showHeartRate: true,
    showCalories: true,
    showCadence: true,
    primaryMetrics: ['power', 'distance', 'duration'],
    unit: 'km/h',
  },
  GravelRide: {
    showDistance: true,
    showElevation: true,
    showPace: false,
    showPower: true,
    showHeartRate: true,
    showCalories: true,
    showCadence: true,
    primaryMetrics: ['distance', 'elevation', 'power', 'duration'],
    unit: 'km/h',
  },
  MountainBikeRide: {
    showDistance: true,
    showElevation: true,
    showPace: false,
    showPower: true,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['distance', 'elevation', 'duration'],
    unit: 'km/h',
  },
  EBikeRide: {
    showDistance: true,
    showElevation: true,
    showPace: false,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['distance', 'elevation', 'duration'],
    unit: 'km/h',
  },
  Swim: {
    showDistance: true,
    showElevation: false,
    showPace: true,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false, // Stroke rate
    primaryMetrics: ['distance', 'duration', 'pace'],
    unit: '/100m',
  },
  Walk: {
    showDistance: true,
    showElevation: true,
    showPace: true,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['distance', 'duration', 'elevation'],
  },
  Hike: {
    showDistance: true,
    showElevation: true,
    showPace: true,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['distance', 'elevation', 'duration'],
  },
  RockClimbing: {
    showDistance: false,
    showElevation: true,
    showPace: false,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['duration', 'elevation', 'count'],
  },
  WeightTraining: {
    showDistance: false,
    showElevation: false,
    showPace: false,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['duration', 'count'],
  },
  Yoga: {
    showDistance: false,
    showElevation: false,
    showPace: false,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['duration', 'count'],
  },
  Workout: {
    showDistance: false,
    showElevation: false,
    showPace: false,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['duration', 'count'],
  },
  HighIntensityIntervalTraining: {
    showDistance: false,
    showElevation: false,
    showPace: false,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['duration', 'count'],
  },
  Crossfit: {
    showDistance: false,
    showElevation: false,
    showPace: false,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['duration', 'count'],
  },
  Pilates: {
    showDistance: false,
    showElevation: false,
    showPace: false,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['duration', 'count'],
  },
  AlpineSki: {
    showDistance: true,
    showElevation: true,
    showPace: false,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['elevation', 'duration', 'distance'],
  },
  BackcountrySki: {
    showDistance: true,
    showElevation: true,
    showPace: false,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['elevation', 'distance', 'duration'],
  },
  NordicSki: {
    showDistance: true,
    showElevation: true,
    showPace: true,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['distance', 'elevation', 'duration'],
  },
  Snowboard: {
    showDistance: true,
    showElevation: true,
    showPace: false,
    showPower: false,
    showHeartRate: false,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['elevation', 'duration'],
  },
  Kayaking: {
    showDistance: true,
    showElevation: false,
    showPace: true,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['distance', 'duration'],
  },
  Rowing: {
    showDistance: true,
    showElevation: false,
    showPace: true,
    showPower: true,
    showHeartRate: true,
    showCalories: true,
    showCadence: true,
    primaryMetrics: ['distance', 'duration', 'pace'],
  },
  StandUpPaddling: {
    showDistance: true,
    showElevation: false,
    showPace: true,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['distance', 'duration'],
  },
  Surfing: {
    showDistance: false,
    showElevation: false,
    showPace: false,
    showPower: false,
    showHeartRate: true,
    showCalories: true,
    showCadence: false,
    primaryMetrics: ['duration', 'count'],
  },
}

/**
 * Get the configuration for a specific sport type.
 */
export function getSportConfig(sportType: string): SportMetricConfig {
  return sportConfigs[sportType] || defaultConfig
}

/**
 * Calculate top sports by activity count from activity data.
 */
export function getTopSports(activities: Activity[], limit: number = 15): { sportType: string; count: number }[] {
  const sportCounts = new Map<string, number>()

  activities.forEach((activity) => {
    const sportType = activity.sport_type || activity.type
    if (sportType) {
      sportCounts.set(sportType, (sportCounts.get(sportType) || 0) + 1)
    }
  })

  return Array.from(sportCounts.entries())
    .map(([sportType, count]) => ({ sportType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/**
 * Check if a sport should show distance metrics.
 */
export function sportShowsDistance(sportType: string): boolean {
  return getSportConfig(sportType).showDistance
}

/**
 * Check if a sport should show elevation metrics.
 */
export function sportShowsElevation(sportType: string): boolean {
  return getSportConfig(sportType).showElevation
}

/**
 * Check if a sport should show pace metrics.
 */
export function sportShowsPace(sportType: string): boolean {
  return getSportConfig(sportType).showPace
}

/**
 * Check if a sport should show power metrics.
 */
export function sportShowsPower(sportType: string): boolean {
  return getSportConfig(sportType).showPower
}
