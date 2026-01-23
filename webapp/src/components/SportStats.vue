<script setup lang="ts">
import { computed } from 'vue'
import { getSportConfig } from '@/lib/sportConfig'
import { formatDistance, formatDuration, formatElevation, formatPace } from '@/lib/aggregations'
import type { Activity } from '@/types/activity'

interface Props {
  activity: Activity
  variant?: 'inline' | 'grid' | 'compact'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'inline',
})

const sportType = computed(() => props.activity.sport_type || props.activity.type || 'Run')
const config = computed(() => getSportConfig(sportType.value))

// Helper to check if a stat should be shown based on sport config and data availability
const showDistance = computed(
  () => config.value.showDistance && props.activity.distance && props.activity.distance > 0,
)

const showElevation = computed(
  () =>
    config.value.showElevation &&
    props.activity.total_elevation_gain &&
    props.activity.total_elevation_gain > 0,
)

const showPace = computed(
  () => config.value.showPace && props.activity.average_speed && props.activity.average_speed > 0,
)

const showPower = computed(
  () =>
    config.value.showPower &&
    (props.activity.average_watts || props.activity.weighted_average_watts),
)

const showHeartRate = computed(
  () =>
    config.value.showHeartRate &&
    props.activity.average_heartrate &&
    props.activity.average_heartrate > 0,
)

const showCalories = computed(
  () => config.value.showCalories && props.activity.calories && props.activity.calories > 0,
)

const showCadence = computed(
  () =>
    config.value.showCadence &&
    props.activity.average_cadence &&
    props.activity.average_cadence > 0,
)

// Get formatted values
const formattedDistance = computed(() =>
  props.activity.distance ? formatDistance(props.activity.distance) : '',
)

const formattedDuration = computed(() =>
  props.activity.moving_time ? formatDuration(props.activity.moving_time) : '',
)

const formattedElevation = computed(() =>
  props.activity.total_elevation_gain ? formatElevation(props.activity.total_elevation_gain) : '',
)

const formattedPace = computed(() => {
  if (!props.activity.average_speed) return ''
  // For cycling sports, show speed in km/h instead of pace
  if (config.value.unit === 'km/h') {
    const kmh = props.activity.average_speed * 3.6
    return `${kmh.toFixed(1)} km/h`
  }
  return formatPace(props.activity.average_speed)
})

const paceLabel = computed(() => (config.value.unit === 'km/h' ? 'Speed' : 'Pace'))

const formattedPower = computed(() => {
  const power = props.activity.weighted_average_watts || props.activity.average_watts
  return power ? `${Math.round(power)}W` : ''
})

const formattedHeartRate = computed(() =>
  props.activity.average_heartrate ? `${Math.round(props.activity.average_heartrate)} bpm` : '',
)

const formattedCalories = computed(() =>
  props.activity.calories ? `${props.activity.calories} cal` : '',
)

const formattedCadence = computed(() => {
  if (!props.activity.average_cadence) return ''
  // Different unit labels based on sport
  const cadence = Math.round(props.activity.average_cadence)
  if (sportType.value === 'Run' || sportType.value === 'TrailRun' || sportType.value === 'Walk') {
    return `${cadence} spm` // steps per minute
  }
  if (sportType.value.includes('Ride') || sportType.value.includes('Bike')) {
    return `${cadence} rpm` // revolutions per minute
  }
  if (sportType.value === 'Swim') {
    return `${cadence} strokes/min`
  }
  return `${cadence}`
})

// Build ordered stats based on primary metrics
const orderedStats = computed(() => {
  const stats: Array<{
    key: string
    value: string
    label: string
    show: boolean
  }> = []

  // Add stats in the order defined by primaryMetrics
  for (const metric of config.value.primaryMetrics) {
    switch (metric) {
      case 'duration':
        stats.push({
          key: 'duration',
          value: formattedDuration.value,
          label: 'Time',
          show: !!props.activity.moving_time,
        })
        break
      case 'distance':
        stats.push({
          key: 'distance',
          value: formattedDistance.value,
          label: 'Distance',
          show: !!showDistance.value,
        })
        break
      case 'elevation':
        stats.push({
          key: 'elevation',
          value: formattedElevation.value,
          label: 'Elevation',
          show: !!showElevation.value,
        })
        break
      case 'pace':
        stats.push({
          key: 'pace',
          value: formattedPace.value,
          label: paceLabel.value,
          show: !!showPace.value,
        })
        break
      case 'power':
        stats.push({
          key: 'power',
          value: formattedPower.value,
          label: 'Power',
          show: !!showPower.value,
        })
        break
      case 'count':
        // For activities like yoga, weight training - show duration and count
        stats.push({
          key: 'count',
          value: '1',
          label: 'Session',
          show: true,
        })
        break
    }
  }

  // Add secondary stats not in primary metrics
  if (!config.value.primaryMetrics.includes('duration') && props.activity.moving_time) {
    stats.push({ key: 'duration', value: formattedDuration.value, label: 'Time', show: true })
  }

  if (showHeartRate.value && !config.value.primaryMetrics.includes('heartrate')) {
    stats.push({ key: 'heartrate', value: formattedHeartRate.value, label: 'Avg HR', show: true })
  }

  if (showPower.value && !config.value.primaryMetrics.includes('power')) {
    stats.push({ key: 'power', value: formattedPower.value, label: 'Power', show: true })
  }

  if (showCadence.value) {
    stats.push({ key: 'cadence', value: formattedCadence.value, label: 'Cadence', show: true })
  }

  if (showCalories.value) {
    stats.push({ key: 'calories', value: formattedCalories.value, label: 'Calories', show: true })
  }

  return stats.filter((s) => s.show)
})
</script>

<template>
  <div class="sport-stats" :class="[`variant-${variant}`]">
    <template v-if="variant === 'compact'">
      <span v-for="(stat, index) in orderedStats.slice(0, 3)" :key="stat.key" class="compact-stat">
        <span class="stat-value">{{ stat.value }}</span>
        <span v-if="index < Math.min(orderedStats.length, 3) - 1" class="stat-separator">·</span>
      </span>
    </template>

    <template v-else>
      <div v-for="stat in orderedStats" :key="stat.key" class="stat-item">
        <span class="stat-value">{{ stat.value }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sport-stats {
  display: flex;
  flex-wrap: wrap;
}

.variant-inline {
  gap: 2rem;
}

.variant-grid {
  gap: 1rem;
}

.variant-compact {
  gap: 0.25rem;
  align-items: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.variant-grid .stat-item {
  background: #f9f9f9;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  min-width: 100px;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a1a2e;
}

.variant-compact .stat-value {
  font-size: 0.875rem;
  font-weight: 600;
}

.stat-label {
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
}

.compact-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.stat-separator {
  color: #999;
  margin: 0 0.25rem;
}

@media (max-width: 768px) {
  .variant-inline {
    gap: 1rem;
  }

  .stat-value {
    font-size: 1rem;
  }
}
</style>
