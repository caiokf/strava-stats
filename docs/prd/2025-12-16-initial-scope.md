# Strava Activity Tracker - Product Requirements Document

## Overview

A personal Strava activity tracking system consisting of:
- **Kotlin Android app** with Google Sign-In (restricted to `caiokf@gmail.com`)
- **Rust backend** deployed on Vercel receiving Strava webhooks
- **Supabase database** for activity storage

---

## Project Structure (Monorepo)

```
strava-stats/
├── android/          # Kotlin Android app
├── backend/          # Rust API (Vercel Functions)
├── supabase/         # Database migrations & config
├── docs/             # Documentation
└── .github/          # CI/CD workflows
```

---

## 1. Backend Tasks (Rust)

### Setup & Configuration
| Task | Scope | Description |
|------|-------|-------------|
| Initialize Rust project with Cargo | Small | Create `backend/` with proper structure for Vercel |
| Configure Vercel Rust runtime | Small | Set up `vercel.json` for Rust serverless functions |
| Set up environment variables | Small | Strava API keys, Supabase URL/key, secrets |

### Strava Integration
| Task | Scope | Description |
|------|-------|-------------|
| Implement webhook verification endpoint | Small | `GET /api/webhook` - Strava subscription validation |
| Implement webhook receiver | Medium | `POST /api/webhook` - Receive activity events |
| Create Strava API client | Medium | OAuth token management, API calls |
| Implement activity fetch logic | Medium | Fetch full activity data when webhook fires |
| Implement FIT file download | Medium | Download and store activity FIT files |
| Handle webhook event types | Small | Filter for activity creates/updates |

### Database Integration
| Task | Scope | Description |
|------|-------|-------------|
| Add Supabase Rust client | Small | Configure `postgrest-rs` or Supabase SDK |
| Implement activity storage | Medium | Save activity JSON to Supabase |
| Implement FIT file storage | Medium | Store FIT files in Supabase Storage |

### API Endpoints
| Task | Scope | Description |
|------|-------|-------------|
| Create activities list endpoint | Small | `GET /api/activities` - For mobile app |
| Create activity detail endpoint | Small | `GET /api/activities/:id` |
| Add authentication middleware | Medium | Verify requests from mobile app |

---

## 2. Android App Tasks (Kotlin)

### Project Setup
| Task | Scope | Description |
|------|-------|-------------|
| Create Android project | Small | New Kotlin project with Jetpack Compose |
| Configure Gradle dependencies | Small | Retrofit, Hilt, Compose, Biometric, Google Auth |
| Set up app architecture | Medium | MVVM with Repository pattern |

### Authentication
| Task | Scope | Description |
|------|-------|-------------|
| Implement Google Sign-In | Medium | Firebase Auth or Google Identity Services |
| Email whitelist validation | Small | Only allow `caiokf@gmail.com` |
| Auth error screen | Small | Show error + retry link for unauthorized emails |
| Implement biometric auth | Medium | AndroidX Biometric for fingerprint |
| Secure credential storage | Medium | EncryptedSharedPreferences for tokens |
| Session persistence | Small | Auto-login on app launch |

### UI Screens
| Task | Scope | Description |
|------|-------|-------------|
| Login screen | Medium | Google Sign-In button, app branding |
| Dashboard screen | Medium | Recent activities list |
| Activity detail screen | Small | Show full activity data |
| Auth error screen | Small | Error message + retry navigation |

### Data Layer
| Task | Scope | Description |
|------|-------|-------------|
| Create Retrofit API client | Small | Connect to Rust backend |
| Create Activity repository | Small | Fetch/cache activities |
| Implement offline caching | Medium | Room database for activities |

### Navigation
| Task | Scope | Description |
|------|-------|-------------|
| Set up Navigation Compose | Small | Auth flow + main app flow |
| Auth state navigation | Small | Auto-route based on login state |

---

## 3. Database Tasks (Supabase)

### Schema Design
| Task | Scope | Description |
|------|-------|-------------|
| Design activities table | Small | All Strava activity fields |
| Design users table | Small | Link Strava athlete to app user |
| Design fit_files table | Small | Metadata for stored FIT files |
| Create indexes | Small | Query optimization |

### Setup
| Task | Scope | Description |
|------|-------|-------------|
| Create Supabase project | Small | New project in Supabase dashboard |
| Configure Storage bucket | Small | For FIT file storage |
| Set up Row Level Security | Medium | Secure data access policies |
| Create database migrations | Small | Version-controlled schema changes |

### Integration
| Task | Scope | Description |
|------|-------|-------------|
| Generate TypeScript types | Small | For type safety (optional) |
| Set up API keys | Small | Service role for backend, anon for app |

---

## 4. Deployment & CI/CD Tasks

### Vercel Setup
| Task | Scope | Description |
|------|-------|-------------|
| Create Vercel project | Small | Link to GitHub repo |
| Configure Rust build | Medium | Custom build settings for Rust |
| Set environment variables | Small | Production secrets |
| Configure custom domain | Small | Optional |

### Strava Webhook
| Task | Scope | Description |
|------|-------|-------------|
| Register Strava webhook | Small | Point to Vercel endpoint |
| Verify webhook subscription | Small | Complete Strava verification |

### CI/CD Pipelines
| Task | Scope | Description |
|------|-------|-------------|
| Backend CI workflow | Medium | Rust build, test, deploy |
| Android CI workflow | Medium | Build APK, run tests |
| Android release workflow | Medium | Signed release builds |

### App Distribution
| Task | Scope | Description |
|------|-------|-------------|
| Configure app signing | Small | Keystore setup |
| Set up Firebase App Distribution | Small | Or alternative for APK delivery |

---

## Execution Order (Recommended)

### Phase 1: Foundation
1. Supabase project & schema
2. Rust backend project setup
3. Android project setup

### Phase 2: Backend Core
4. Strava webhook endpoints
5. Strava API integration
6. Database storage implementation

### Phase 3: Mobile Core
7. Google Sign-In + email validation
8. Biometric authentication
9. Credential storage

### Phase 4: Features
10. Dashboard UI + API integration
11. Activity detail views
12. Offline caching

### Phase 5: Deployment
13. Vercel deployment
14. Strava webhook registration
15. CI/CD pipelines

---

## Task Summary

| Component | Small | Medium | Large | Total |
|-----------|-------|--------|-------|-------|
| Backend (Rust) | 7 | 6 | 0 | 13 |
| Android (Kotlin) | 8 | 7 | 0 | 15 |
| Database (Supabase) | 7 | 1 | 0 | 8 |
| Deployment (CI/CD) | 5 | 3 | 0 | 8 |
| **Total** | **27** | **17** | **0** | **44** |

---

## Technical Specifications

### Authentication Flow
1. User opens app → Check for stored credentials
2. If credentials exist → Prompt biometric auth → Dashboard
3. If no credentials → Show Google Sign-In
4. On Google Sign-In success:
   - If email == `caiokf@gmail.com` → Store credentials securely → Dashboard
   - If email != `caiokf@gmail.com` → Auth Error screen with retry option

### Webhook Flow
1. User uploads activity to Strava
2. Strava sends webhook to `POST /api/webhook`
3. Backend validates webhook signature
4. Backend fetches full activity via Strava API
5. Backend downloads FIT file (if available)
6. Backend stores activity + FIT file in Supabase

### Security Considerations
- Biometric credentials stored in EncryptedSharedPreferences
- Backend validates all incoming webhooks
- Supabase Row Level Security for data isolation
- Environment variables for all secrets
