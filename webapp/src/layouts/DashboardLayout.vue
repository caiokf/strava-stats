<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const sidebarOpen = ref(true)
const mobileMenuOpen = ref(false)

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: 'home' },
  { name: 'Activities', path: '/activities', icon: 'list' },
  { name: 'Training Log', path: '/training-log', icon: 'calendar' },
  { name: 'Weekly Intensity', path: '/weekly-intensity', icon: 'chart-bar' },
  { name: 'Monthly Fitness', path: '/monthly-fitness', icon: 'heart' },
  { name: 'Power Chart', path: '/power-chart', icon: 'bolt' },
  { name: 'Sports', path: '/sports', icon: 'trophy' },
]

const currentNavItem = computed(() => {
  return navItems.find((item) => route.path === item.path)?.name ?? 'Dashboard'
})

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

function navigate(path: string) {
  router.push(path)
  mobileMenuOpen.value = false
}

async function handleSignOut() {
  await auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div class="dashboard-layout">
    <!-- Mobile Header -->
    <header class="mobile-header">
      <button class="menu-toggle" @click="toggleMobileMenu" aria-label="Toggle menu">
        <span class="menu-icon">{{ mobileMenuOpen ? '✕' : '☰' }}</span>
      </button>
      <h1 class="mobile-title">{{ currentNavItem }}</h1>
      <div class="mobile-user">
        <img
          v-if="auth.userPhotoURL"
          :src="auth.userPhotoURL"
          :alt="auth.userDisplayName ?? 'User'"
          class="user-avatar-small"
        />
      </div>
    </header>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ collapsed: !sidebarOpen, 'mobile-open': mobileMenuOpen }">
      <div class="sidebar-header">
        <h2 class="logo">Strava Stats</h2>
        <button class="collapse-btn" @click="toggleSidebar" aria-label="Toggle sidebar">
          {{ sidebarOpen ? '◀' : '▶' }}
        </button>
      </div>

      <nav class="sidebar-nav">
        <button
          v-for="item in navItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
          @click="navigate(item.path)"
        >
          <span class="nav-icon">{{ getIcon(item.icon) }}</span>
          <span v-if="sidebarOpen" class="nav-label">{{ item.name }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div v-if="sidebarOpen" class="user-info">
          <img
            v-if="auth.userPhotoURL"
            :src="auth.userPhotoURL"
            :alt="auth.userDisplayName ?? 'User'"
            class="user-avatar"
          />
          <div class="user-details">
            <span class="user-name">{{ auth.userDisplayName }}</span>
            <span class="user-email">{{ auth.userEmail }}</span>
          </div>
        </div>
        <button class="sign-out-btn" @click="handleSignOut">
          <span class="nav-icon">🚪</span>
          <span v-if="sidebarOpen" class="nav-label">Sign Out</span>
        </button>
      </div>
    </aside>

    <!-- Mobile Overlay -->
    <div v-if="mobileMenuOpen" class="mobile-overlay" @click="toggleMobileMenu"></div>

    <!-- Main Content -->
    <main class="main-content" :class="{ 'sidebar-collapsed': !sidebarOpen }">
      <slot></slot>
    </main>
  </div>
</template>

<script lang="ts">
function getIcon(iconName: string): string {
  const icons: Record<string, string> = {
    home: '🏠',
    list: '📋',
    calendar: '📅',
    'chart-bar': '📊',
    heart: '❤️',
    bolt: '⚡',
    trophy: '🏆',
  }
  return icons[iconName] ?? '📍'
}
</script>

<style scoped>
.dashboard-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f5f5;
}

/* Mobile Header */
.mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: #1a1a2e;
  color: #fff;
  padding: 0 1rem;
  align-items: center;
  justify-content: space-between;
  z-index: 100;
}

.menu-toggle {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
}

.mobile-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.user-avatar-small {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

/* Sidebar */
.sidebar {
  width: 250px;
  background: #1a1a2e;
  color: #fff;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 50;
}

.sidebar.collapsed {
  width: 70px;
}

.sidebar-header {
  padding: 1.5rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fc4c02;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
}

.sidebar.collapsed .logo {
  display: none;
}

.collapse-btn {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 0.5rem;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.collapse-btn:hover {
  opacity: 1;
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.875rem 1rem;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-item.active {
  background: rgba(252, 76, 2, 0.2);
  color: #fc4c02;
  border-right: 3px solid #fc4c02;
}

.nav-icon {
  font-size: 1.25rem;
  min-width: 24px;
  text-align: center;
}

.nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.user-details {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-name {
  font-weight: 600;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.75rem;
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sign-out-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
}

.sign-out-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Mobile Overlay */
.mobile-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 40;
}

/* Main Content */
.main-content {
  flex: 1;
  margin-left: 250px;
  padding: 1.5rem;
  transition: margin-left 0.3s ease;
  min-height: 100vh;
}

.main-content.sidebar-collapsed {
  margin-left: 70px;
}

/* Responsive */
@media (max-width: 768px) {
  .mobile-header {
    display: flex;
  }

  .sidebar {
    transform: translateX(-100%);
    width: 280px;
  }

  .sidebar.mobile-open {
    transform: translateX(0);
  }

  .sidebar.collapsed {
    width: 280px;
  }

  .collapse-btn {
    display: none;
  }

  .mobile-overlay {
    display: block;
  }

  .main-content {
    margin-left: 0;
    margin-top: 56px;
    padding: 1rem;
  }

  .main-content.sidebar-collapsed {
    margin-left: 0;
  }
}
</style>
