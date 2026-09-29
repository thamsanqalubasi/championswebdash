# Paimbabook — Full Subscription & Account Lifecycle Implementation Plan

## Summary of Changes

### 1. Stripe Recurring Subscription Setup (Monthly Auto-Debit)
| File | Change |
|------|--------|
| `web/api/create-stripe-payment.ts` | Add `mode: "subscription"` with Stripe trial period, create Customer object, save payment method for future off-session charging |
| `web/api/stripe-webhook.ts` | Handle `customer.subscription.created`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted` |
| `web/src/lib/packages.ts` | Add `TRIAL_PERIOD_DAYS` constant (easy-change variable), add `cancelSubscription()`, extend `CompanySubscription` type |
| Supabase migration | Add `stripe_price_id`, `trial_ends_at`, `cancelled_at`, `cancel_reason` columns to `company_subscriptions` |

### 2. Free 3-Month Trial with Card Upfront
- **Flow**: User clicks "Start Free Trial" → chooses package → enters card details → Stripe `SetupIntent` (saves card, $0 charge) → trial starts, billing deducted after trial period
- `TRIAL_PERIOD_DAYS = 90` variable in `packages.ts` — clearly commented for easy change (1 week, 1 month, 4 months, etc.)
- Trial users see all features of their chosen package tier, locked to that tier (no higher access)

### 3. New UI Components
| Component | Purpose |
|-----------|---------|
| `trial-onboarding-modal.tsx` | 3-step trial flow: Welcome → Choose Package → Enter Card Details |
| `cancel-subscription-modal.tsx` | Cancellation with confirmation, warns access locks after 60 days |
| `delete-account-modal.tsx` | User account deletion with 30-day freeze countdown |
| `delete-company-modal.tsx` | Super admin only — deletes company, sends staff emails, 30-day freeze |
| `account-frozen-banner.tsx` | Shows when company is deleted and staff account is on 30-day hold |
| `unsubscribed-gateway-modal.tsx` | Fullscreen modal when subscription cancelled — reactivation prompt, 60-day warning |

### 4. Account & Company Deletion Lifecycle
```
User clicks Delete → 30-day freeze → can reactivate by logging in
                  → after 30 days → permanent deletion (cron job / backend admin trigger)

Company deletion (super admin):
  → freeze company + all staff → send email to all staff members
  → staff see "company deleted" screen with countdown
  → after 30 days → delete company data + staff affiliations
  → customer accounts NOT affected
```

### 5. Unsubscription Lifecycle
```
Cancel subscription:
  → subscription cancelled on Stripe → features locked → reactivation modal shows
  → 60 days inactive → account frozen (can't login)
  → 60-90 days → flagged in admin dashboard for permanent deletion
  → after 90 days → auto-deleted by system
```

### 6. Database Columns Added (migration)
```sql
-- company_subscriptions
trial_ends_at timestamptz,
stripe_price_id text,
cancelled_at timestamptz,
cancel_reason text,
is_setup_intent_only boolean default false,  -- true = card saved, no charge yet (trial)

-- companies  
deleted_at timestamptz,         -- 30-day freeze start for company
deletion_reason text,

-- auth/company_users (staff)
account_frozen_at timestamptz,  -- when staff account was frozen due to company deletion
company_deleted_notice_sent boolean default false,
```

### 7. TRIAL_PERIOD_DAYS Variable (packages.ts)
```typescript
// ============================================================
// TRIAL PERIOD CONFIGURATION
// ============================================================
// CHANGE THIS VALUE TO ADJUST TRIAL LENGTH FOR ALL SUBSCRIPTIONS.
// Future agents and admins: this single variable controls the trial.
// Examples:
//   7  = 1 week trial
//   30 = 1 month trial (recommended for soft launch)
//   90 = 3 months trial (current marketing offer)
//  120 = 4 months trial
// Can also be overridden per-plan or via a backend admin UI in future.
// ============================================================
export const TRIAL_PERIOD_DAYS = 90; // 3-month free trial (no charge until day 91)
```

## File-by-file Implementation

### Phase 1 — Backend API & Webhooks
1. `web/api/create-stripe-payment.ts` — add `setup_intent` mode (saves card, no charge) + `subscription` mode
2. `web/api/stripe-webhook.ts` — handle all subscription lifecycle events
3. `web/api/cancel-subscription.ts` — new endpoint to cancel Stripe subscription
4. `web/api/delete-account.ts` — soft-delete user (freeze 30 days, send email)
5. `web/api/delete-company.ts` — soft-delete company + notify all staff

### Phase 2 — packages.ts Updates
- Add `TRIAL_PERIOD_DAYS` constant
- Extend `CompanySubscription` type with `trialEndsAt`, `cancelledAt`, `stripeSubscriptionId`, `isFrozen`, `frozenAt`
- Add `cancelSubscription()`, `freezeAccount()`, `reactivateAccount()` functions

### Phase 3 — New UI Components
- `trial-onboarding-modal.tsx` — 3-step trial flow
- `cancel-subscription-modal.tsx`
- `delete-account-modal.tsx`
- `delete-company-modal.tsx`  
- `unsubscribed-gateway-modal.tsx` — full lock screen after cancellation
- `account-frozen-banner.tsx` — for staff after company deletion

### Phase 4 — Settings Page Integration
- Add "Cancel Subscription" button in billing section
- Add "Delete My Account" button (all users)
- Add "Delete Company" button (super admin only)
- Show trial countdown with "You will be charged on [date]" message

### Phase 5 — Database Migration
- New SQL migration: `20260927_subscription_lifecycle.sql`

> [!IMPORTANT]
> Stripe Recurring Subscriptions require **Stripe Price IDs** to be created in your Stripe Dashboard.
> Go to: Stripe Dashboard → Products → Create Product → Add Recurring Price → Copy `price_xxx` ID.
> Add these IDs to Vercel environment variables:
> - `STRIPE_PRICE_STARTER` = `price_xxx`
> - `STRIPE_PRICE_STANDARD` = `price_xxx`
> - `STRIPE_PRICE_PRO` = `price_xxx`
> - `STRIPE_PRICE_ENTERPRISE` = `price_xxx`

> [!NOTE]
> **Admin Dashboard TODOs** (flagged for future control panel agent):
> - Show companies flagged for deletion (60+ days unsubscribed)
> - Manual "Permanently Delete" button per company
> - After 90 days of no subscription + no manual deletion → auto-delete cron fires
> - Show frozen staff accounts waiting to join new companies
