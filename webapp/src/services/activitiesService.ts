import { supabase } from '@/lib/supabase'
import type { Activity, ActivityFilters, ActivitySummary } from '@/types'

const DEFAULT_PAGE_SIZE = 50

export interface PaginatedResult<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  hasMore: boolean
}

export async function getActivities(
  filters: ActivityFilters = {},
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<PaginatedResult<ActivitySummary>> {
  let query = supabase
    .from('activities')
    .select(
      `
      id,
      name,
      type,
      sport_type,
      start_date,
      start_date_local,
      distance,
      moving_time,
      elapsed_time,
      total_elevation_gain,
      average_speed,
      average_heartrate,
      suffer_score,
      kudos_count,
      map_summary_polyline
    `,
      { count: 'exact' },
    )
    .order('start_date', { ascending: false })

  // Apply filters
  if (filters.sportType) {
    const types = Array.isArray(filters.sportType) ? filters.sportType : [filters.sportType]
    query = query.in('sport_type', types)
  }

  if (filters.dateFrom) {
    query = query.gte('start_date', filters.dateFrom.toISOString())
  }

  if (filters.dateTo) {
    query = query.lte('start_date', filters.dateTo.toISOString())
  }

  if (filters.minDistance !== undefined) {
    query = query.gte('distance', filters.minDistance)
  }

  if (filters.maxDistance !== undefined) {
    query = query.lte('distance', filters.maxDistance)
  }

  if (filters.minDuration !== undefined) {
    query = query.gte('moving_time', filters.minDuration)
  }

  if (filters.maxDuration !== undefined) {
    query = query.lte('moving_time', filters.maxDuration)
  }

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }

  // Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Failed to fetch activities: ${error.message}`)
  }

  return {
    data: (data as ActivitySummary[]) || [],
    count: count || 0,
    page,
    pageSize,
    hasMore: count ? from + pageSize < count : false,
  }
}

export async function getActivityById(id: number): Promise<Activity | null> {
  const { data, error } = await supabase.from('activities').select('*').eq('id', id).single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    throw new Error(`Failed to fetch activity: ${error.message}`)
  }

  return data as Activity
}

export async function getAllActivities(): Promise<Activity[]> {
  const allActivities: Activity[] = []
  let page = 1
  const pageSize = 1000

  while (true) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('start_date', { ascending: false })
      .range(from, to)

    if (error) {
      throw new Error(`Failed to fetch activities: ${error.message}`)
    }

    if (!data || data.length === 0) {
      break
    }

    allActivities.push(...(data as Activity[]))

    if (data.length < pageSize) {
      break
    }

    page++
  }

  return allActivities
}

export async function getActivitiesByDateRange(
  startDate: Date,
  endDate: Date,
): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .gte('start_date', startDate.toISOString())
    .lte('start_date', endDate.toISOString())
    .order('start_date', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch activities: ${error.message}`)
  }

  return (data as Activity[]) || []
}

export async function getActivitiesBySport(sportType: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('sport_type', sportType)
    .order('start_date', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch activities: ${error.message}`)
  }

  return (data as Activity[]) || []
}

export async function getDistinctSportTypes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('sport_type')
    .not('sport_type', 'is', null)

  if (error) {
    throw new Error(`Failed to fetch sport types: ${error.message}`)
  }

  const sportTypes = new Set<string>()
  data?.forEach((row) => {
    if (row.sport_type) {
      sportTypes.add(row.sport_type)
    }
  })

  return Array.from(sportTypes).sort()
}

export async function getActivityCount(): Promise<number> {
  const { count, error } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })

  if (error) {
    throw new Error(`Failed to get activity count: ${error.message}`)
  }

  return count || 0
}

export interface PowerStreamData {
  activityId: number
  timeData: number[]
  powerData: number[]
}

/**
 * Get power streams for cycling activities.
 * Returns time and watts stream data for activities that have power data.
 */
export async function getPowerStreamsForActivities(
  activityIds: number[],
): Promise<PowerStreamData[]> {
  if (activityIds.length === 0) return []

  // Fetch time and watts streams for the activities
  const { data, error } = await supabase
    .from('activity_streams')
    .select('activity_id, stream_type, data')
    .in('activity_id', activityIds)
    .in('stream_type', ['time', 'watts'])

  if (error) {
    throw new Error(`Failed to fetch power streams: ${error.message}`)
  }

  if (!data || data.length === 0) return []

  // Group by activity_id
  const streamsByActivity = new Map<number, { time?: number[]; watts?: number[] }>()

  for (const row of data) {
    const activityId = row.activity_id
    if (!streamsByActivity.has(activityId)) {
      streamsByActivity.set(activityId, {})
    }
    const streams = streamsByActivity.get(activityId)!
    if (row.stream_type === 'time') {
      streams.time = row.data as number[]
    } else if (row.stream_type === 'watts') {
      streams.watts = row.data as number[]
    }
  }

  // Convert to PowerStreamData, only including activities with both time and watts
  const result: PowerStreamData[] = []
  for (const [activityId, streams] of streamsByActivity) {
    if (streams.time && streams.watts && streams.time.length === streams.watts.length) {
      result.push({
        activityId,
        timeData: streams.time,
        powerData: streams.watts,
      })
    }
  }

  return result
}
