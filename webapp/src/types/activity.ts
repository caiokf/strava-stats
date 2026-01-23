export interface Activity {
  id: number
  user_id: string | null
  strava_athlete_id: number
  name: string
  type: string
  sport_type: string | null
  distance: number | null
  moving_time: number | null
  elapsed_time: number | null
  total_elevation_gain: number | null
  start_date: string
  start_date_local: string | null
  timezone: string | null
  start_latlng: [number, number] | null
  end_latlng: [number, number] | null
  achievement_count: number | null
  kudos_count: number | null
  comment_count: number | null
  athlete_count: number | null
  photo_count: number | null
  map_polyline: string | null
  map_summary_polyline: string | null
  trainer: boolean | null
  commute: boolean | null
  manual: boolean | null
  private: boolean | null
  flagged: boolean | null
  gear_id: string | null
  average_speed: number | null
  max_speed: number | null
  average_cadence: number | null
  average_watts: number | null
  weighted_average_watts: number | null
  kilojoules: number | null
  device_watts: boolean | null
  has_heartrate: boolean | null
  average_heartrate: number | null
  max_heartrate: number | null
  calories: number | null
  suffer_score: number | null
  description: string | null
  workout_type: number | null
  raw_data: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export type StreamType =
  | 'time'
  | 'latlng'
  | 'distance'
  | 'altitude'
  | 'velocity_smooth'
  | 'heartrate'
  | 'cadence'
  | 'watts'
  | 'temp'
  | 'moving'
  | 'grade_smooth'

export interface ActivityStream {
  activity_id: number
  stream_type: StreamType
  data: number[] | [number, number][]
  series_type?: string
  original_size?: number
  resolution?: string
}

export interface LatLng {
  lat: number
  lng: number
}

export interface Lap {
  id: number
  name: string
  elapsed_time: number
  moving_time: number
  start_date: string
  distance: number
  start_index: number
  end_index: number
  total_elevation_gain: number
  average_speed: number
  max_speed: number
  average_cadence?: number
  average_watts?: number
  average_heartrate?: number
  max_heartrate?: number
  lap_index: number
  pace_zone?: number
}

export interface Split {
  distance: number
  elapsed_time: number
  elevation_difference: number
  moving_time: number
  split: number
  average_speed: number
  average_heartrate?: number
  pace_zone?: number
}

export interface Zone {
  score?: number
  distribution_buckets?: {
    max: number
    min: number
    time: number
  }[]
  type?: string
  resource_state?: number
  sensor_based?: boolean
  custom_zones?: boolean
  points?: number
}

export interface ActivityWithDetails extends Activity {
  laps?: Lap[]
  splits_metric?: Split[]
  splits_standard?: Split[]
  zones?: {
    heart_rate?: Zone
    power?: Zone
  }
  streams?: Record<StreamType, ActivityStream>
}

export type SportType =
  | 'Run'
  | 'Ride'
  | 'Swim'
  | 'Walk'
  | 'Hike'
  | 'AlpineSki'
  | 'BackcountrySki'
  | 'Canoeing'
  | 'Crossfit'
  | 'EBikeRide'
  | 'Elliptical'
  | 'Golf'
  | 'GravelRide'
  | 'Handcycle'
  | 'HighIntensityIntervalTraining'
  | 'IceSkate'
  | 'InlineSkate'
  | 'Kayaking'
  | 'Kitesurf'
  | 'MountainBikeRide'
  | 'NordicSki'
  | 'Pilates'
  | 'RockClimbing'
  | 'RollerSki'
  | 'Rowing'
  | 'Sail'
  | 'Skateboard'
  | 'Snowboard'
  | 'Snowshoe'
  | 'Soccer'
  | 'StairStepper'
  | 'StandUpPaddling'
  | 'Surfing'
  | 'Tennis'
  | 'TrailRun'
  | 'Velomobile'
  | 'VirtualRide'
  | 'VirtualRun'
  | 'WeightTraining'
  | 'Wheelchair'
  | 'Windsurf'
  | 'Workout'
  | 'Yoga'

export interface ActivityFilters {
  sportType?: SportType | SportType[]
  dateFrom?: Date
  dateTo?: Date
  minDistance?: number
  maxDistance?: number
  minDuration?: number
  maxDuration?: number
  search?: string
}

export interface ActivitySummary {
  id: number
  name: string
  type: string
  sport_type: string | null
  start_date: string
  start_date_local: string | null
  distance: number | null
  moving_time: number | null
  elapsed_time: number | null
  total_elevation_gain: number | null
  average_speed: number | null
  average_heartrate: number | null
  suffer_score: number | null
  kudos_count: number | null
  map_summary_polyline: string | null
}
