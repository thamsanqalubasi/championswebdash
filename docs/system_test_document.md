# Paimbabook Enterprise Platform: Comprehensive System Test Document & Quality Assurance Plan
**Version:** 2.4 | **Target System:** Multi-Company Commercial Property & Hospitality Suite

---

## 1. Test Strategy & Quality Objectives

### 1.1 Scope
This document specifies the verification criteria, test steps, expected outcomes, and edge-case validations for all functional modules of Paimbabook.

### 1.2 Testing Levels
- **Unit / Functional Testing**: Component-level field validation, mandatory checks, and math calculations.
- **Integration Testing**: Inter-departmental workflows (e.g. Procurement &rarr; Finance Approval &rarr; Stores Delivery; Check-in &rarr; Housekeeping turnover &rarr; Finance Journal).
- **Security & Authorization Testing**: Role-Based Access Control (RBAC), multi-tenant isolation (`company_id`), password verification on destructive actions, and staff invitation eligibility gates.
- **Performance & Usability Testing**: 5-second carousel auto-rotation, paginated table views (10/50/100), and mobile responsiveness.

---

## 2. Test Execution Matrix

### Suite 01: Multi-Tenancy, Organization & Super Admin Setup

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ORG-01** | Create new company organization | Unauthenticated or New User | 1. Navigate to `/signup`<br>2. Fill Company Name ("Miola Real Estate"), slug, admin email, password<br>3. Submit | Organization record created in `companies`; user appointed `super_admin` in `company_users`; default starter trial initiated. | |
| **TC-ORG-02** | Multi-tenant data isolation | Two organizations exist (Company A & B) | 1. Log in as staff of Company A<br>2. Attempt to query properties, bookings, or staff of Company B via UI or API | Only records matching Company A's `company_id` are returned. Zero cross-company leakage. | |
| **TC-ORG-03** | Company deletion 30-day freeze | Super Admin logged in | 1. Settings &rarr; Delete Company<br>2. Type company name and valid Super Admin password<br>3. Submit | Company marked with `deleted_at`; staff accounts put on 30-day hold; notification emails dispatched; customer records preserved. | |
| **TC-ORG-04** | Company deletion wrong password | Super Admin logged in | 1. Settings &rarr; Delete Company<br>2. Type company name, enter incorrect password<br>3. Submit | Deletion rejected with "Incorrect password". Company remains active. | |

---

### Suite 02: Authentication, Password Setup & Email Verification

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-01** | Staff first-time password setup (Valid) | Staff user created by admin in `company_users` with `password_initialized: false` | 1. Open invitation link `/set-password?email=staff@company.com`<br>2. Enter matching passwords (min 6 chars)<br>3. Agree to terms & Submit | Pre-flight check confirms eligibility; password set; `company_users.permissions.password_initialized` set to `true`; auto-logs into dashboard. | |
| **TC-AUTH-02** | Random email password setup rejection | Email not registered in `company_users` | 1. Open `/set-password`<br>2. Enter `random@external.com`<br>3. Attempt to submit | Blocked by pre-flight check with error: "This email does not belong to an invited, newly added staff member". Submit button disabled. | |
| **TC-AUTH-03** | Existing account password setup rejection | Staff account already activated (`password_initialized: true`) | 1. Open `/set-password?email=active@company.com`<br>2. Enter email | Pre-flight check flags "Account Already Active". Directs user to Sign In or Reset Password. | |
| **TC-AUTH-04** | Unconfirmed email detection on login | User signed up but has not confirmed email | 1. Navigate to `/login`<br>2. Enter unconfirmed credentials | Login rejected with "Email not confirmed". "Confirm Email &bull; Send Verification Link" button displayed. | |
| **TC-AUTH-05** | Password reset recovery flow | Registered staff member forgot password | 1. Navigate to `/auth/reset-password`<br>2. Enter email and submit<br>3. Click recovery email link | Redirects to set new password form; password updated via `supabase.auth.updateUser`; redirects to login. | |

---

### Suite 03: Top-Bar Rapid Actions

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ACT-01** | Instant walk-in check-in | Lodge property has available rooms | 1. Click "Check In" on header<br>2. Select property & room 204<br>3. Choose 1 night, Bed & Breakfast (R1,300)<br>4. Enter guest details<br>5. Enter exact payment & complete | Unique booking code generated (`BK-xxxx`); room marked occupied; booking appears on live roster and Front Desk calendar. | |
| **TC-ACT-02** | Check-in underpayment validation | Available room selected | 1. Enter payable R1,300, collect R1,200<br>2. Attempt submit without reason<br>3. Enter explanation & submit | Step 2 blocks submission. Step 3 allows check-in with discrepancy note saved to folio for auditing. | |
| **TC-ACT-03** | Rent payment recording & POP upload | Tenant assigned to Westly Bachelor flat (R4,500/mo) | 1. Click "Record Rent Payment"<br>2. Select Chriss<br>3. Enter R4,500 via Bank Transfer<br>4. Upload POP receipt PDF<br>5. Submit | Payment recorded; receipt generated; POP linked to ledger; monthly status changes from Arrears to Settled. | |
| **TC-ACT-04** | Duplicate rent prevention | Tenant already settled for current month | 1. Attempt to record another regular payment for same tenant and month | Blocked: "Monthly Rent for Sep 2026 is Fully Paid. Recording additional regular rent for this month is prohibited." | |
| **TC-ACT-05** | Advance rent recording | Tenant wants to pay next month | 1. Check "Advance Payment"<br>2. Select Oct 2026<br>3. Enter payment & submit | Advance payment recorded successfully under October billing cycle without conflicting with current month. | |
| **TC-ACT-06** | Payment suppression & restoration | Active payment record on file | 1. Click "Suppress" on transaction<br>2. Confirm suppression<br>3. Click "Restore" | Suppression soft-voids payment and reopens tenant balance; Restoration reinstates the settled state with full audit trail. | |
| **TC-ACT-07** | Leave request submission | Authenticated staff member | 1. Click "Request Leave"<br>2. Select "Annual Leave", date range, reason<br>3. Attach proof PDF & submit | Application saved; routed to HR & Payroll approval queue; staff notified. | |
| **TC-ACT-08** | Emergency procurement requisition | Authenticated staff member | 1. Click "Procure"<br>2. Select "Tools & Hardware", Urgency: "Emergency"<br>3. Select "Self-Approval"<br>4. Submit | Requisition created; logged with emergency priority; bypasses initial supervisor queue straight to purchasing. | |

---

### Suite 04: Rooms & Commercial Lodging Sub-Management

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ROOM-01** | Create room without property | No accommodation property selected | 1. Rooms & Pricing &rarr; Add New Room | System prevents creation: "All rooms must belong to an accommodation property". | |
| **TC-ROOM-02** | Room creation with mandatory photo | Hotel property selected | 1. Fill room name, category, 4-tier rates<br>2. Leave photos empty & try to save<br>3. Upload 1 photo & save | Step 2 blocks save: "A room photo is strictly mandatory". Step 3 saves room to directory. | |
| **TC-ROOM-03** | Uniform meal board pricing | Hotel has multiple rooms | 1. Click "Uniform & Board Pricing"<br>2. Set Room Only (R900), B&B (R1,200), Full Board (R1,800)<br>3. Apply | Flat pricing successfully applied across all rooms in that property in one click. | |
| **TC-ROOM-04** | Housekeeping turnover timer | Room checked out | 1. Room status changed to "cleaning needed"<br>2. Schedule cleaning task (Target: 30 mins)<br>3. Let timer exceed 30 mins | Live timer turns red to flag overdue turnover. Before/after photo audit enabled. | |
| **TC-ROOM-05** | Room service butler dispatch | Active in-house guest | 1. Click "New Room Service Order"<br>2. Select Room 204, Breakfast Delivery, 20-min window<br>3. Dispatch | Order appears in live queue with countdown timer; butler assigned; charges appended to room folio. | |

---

### Suite 05: Operations & Maintenance

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-MAINT-01** | Create and dispatch work order | Property registered | 1. Create Work Order<br>2. Category: Plumbing, Priority: Urgent<br>3. Assign to Paul Kipi<br>4. Set Estimated Cost: R500<br>5. Save | Work order logged; status "Open"; contractor notified; reflects on Maintenance Dashboard. | |
| **TC-MAINT-02** | Complete work order & cost audit | Work order in progress | 1. Mark work order Completed<br>2. Enter Actual Cost: R650<br>3. Submit | Variance calculated (+R150 over estimate); reflected on maintenance expense analytics. | |
| **TC-MAINT-03** | Preventive maintenance schedule | Property registered | 1. Create Task &rarr; "Carpet Shampoo"<br>2. Frequency: Monthly, Due: 1st of month<br>3. Save | Task schedules automatically; generates reminder when approaching due date. | |
| **TC-MAINT-04** | Inventory sync with Stores | Item added to maintenance inventory | 1. Add "LED Light Bulbs", Qty: 50 in Maintenance Inventory<br>2. Navigate to `/stores` | Item immediately visible in Central Stores with matching quantity and valuation. | |

---

### Suite 06: Procurement 12-Stage Engine & Stores

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-PROC-01** | Multi-quote supplier comparison | Procurement requisition approved | 1. Upload 3 supplier quotation PDFs<br>2. Input quote totals and delivery days<br>3. Select winning quote & approve | Selected quote highlighted; escalated to Accounts department for fund disbursement. | |
| **TC-PROC-02** | Accounts fund approval | Requisition waiting for funding | 1. Finance Manager opens Procurement Tab<br>2. Authorizes payment via EFT<br>3. Attach bank POP | Status advances to "Order Placed / In Transit". Ledger entry created. | |
| **TC-PROC-03** | Stores receipt & inspection | Delivery arrives at warehouse | 1. Stores Receiver inspects delivery<br>2. Verifies packing slip and logs physical count<br>3. Advance to "Delivered to Stores" | Stock catalog updated; requesting department notified that items are ready for pickup. | |

---

### Suite 07: Customer Portal, Showcases & Agent Mode

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-PORT-01** | Public showcase publishing | Lodging room configured | 1. Showcase &rarr; Add Room Type<br>2. Upload minimum 2 photos<br>3. Set pricing & Toggle "Visible on portal"<br>4. Save | Room listing appears on `paimbabook.com` under "Book a Room". | |
| **TC-PORT-02** | 24-Hour CRM ticket auto-close | Open customer enquiry | 1. Customer submits question on portal<br>2. Staff does not respond for > 24 hours | Background cron / query automatically marks ticket "Closed" due to 24h inactivity. | |
| **TC-PORT-03** | Agent Mode residential publishing | Residential property in portfolio | 1. Agent Portal &rarr; Select from system properties<br>2. Verify agent profile has WhatsApp & phone<br>3. Upload minimum 4 photos<br>4. Toggle "Showing on Index" | Property appears on public front portal with verified agent badge and direct chat link. | |

---

### Suite 08: Marketing, Ads & Listing Boosting

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-MKT-01** | Front portal ads alternating carousel | More than 4 active ads in `marketing_ads` | 1. Open `paimbabook.com`<br>2. Observe top "Featured Highlights" banner for 10 seconds | Max 4 ads shown simultaneously; slides alternate automatically every 5 seconds; page indicator updates. | |
| **TC-MKT-02** | Ad click conversion tracking | Active ad displayed | 1. Click CTA button on ad card | Ad click event inserted into `marketing_ad_events`; CTR recalculates on Marketing Hub. | |
| **TC-MKT-03** | Listing boost purchase & audit | Published room or rental | 1. Select listing &rarr; Boost Tier: Featured (+20)<br>2. Set 8 days, complete test payment<br>3. Verify portal | Listing displays golden border & "Featured" badge; payment recorded in `payment_transactions`. | |

---

### Suite 09: Dynamic Lease Agreements & Contracts

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-CONT-01** | Contract creation without Landlord info | Landlord details not saved | 1. Contracts &rarr; Draft Contract | System requires setting Contract Landlord Information before agreement drafting can proceed. | |
| **TC-CONT-02** | 11-Clause legal blueprint generation | Landlord info configured | 1. Draft contract for tenant Chriss<br>2. Select Westly Bachelor flat<br>3. Review 11 clauses (Rent, deposit, 10% penalty, maintenance)<br>4. Execute | Contract active; PDF generated with witness & signature blocks; expiration countdown starts. | |
| **TC-CONT-03** | Contract document sharing | Active contract | 1. Click Share &rarr; Email / WhatsApp | Dispatches branded lease agreement copy to tenant email or WhatsApp number. | |

---

### Suite 10: IT, Organogram & Forensic Audit Compliance

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-AUD-01** | Immutable activity logging | Operator performs actions | 1. Navigate screens, click buttons, create tasks<br>2. Open Audit Department | Every button click, modal open, and transaction recorded with exact timestamp and operator identity. | |
| **TC-AUD-02** | Visual user journey & click map | Operator navigated routes | 1. Open Visual User Journey tab | Traversed pathways displayed (e.g. `/room-management` &rarr; `/commercial-bookings`); top routes ranked. | |
| **TC-AUD-03** | Audit table pagination | Audit trail has 200+ events | 1. Toggle rows selector: 10 &rarr; 50 &rarr; 100<br>2. Test vertical scroll container | Table resizes dynamically without infinite screen overflow. Vertical scrolling operates smoothly. | |
| **TC-AUD-04** | Organogram role enforcement | User assigned "Front Desk - Receptionist" | 1. Log in as Receptionist<br>2. Attempt to access `/settings` or `/finance/accounts` | Access blocked. Sidebar and top profile hide restricted modules in accordance with organogram clearance. | |

---

### Suite 11: Settings, Subscription Billing, Quota Limits & Inquiries

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-SET-01** | Package quota enforcement (Starter tier) | Active on Starter Package ($5: 1 prop, 5 rooms, 15 tenants, 2 staff) | 1. Already have 1 property created<br>2. Attempt to create a 2nd property | Creation blocked with quota upgrade modal: "Starter package limit reached (Max 1 Property). Upgrade plan to add more properties." | |
| **TC-SET-02** | Package mode plan switching | Super Admin logged in | 1. Open Settings &rarr; Subscription Packages<br>2. Click "Standard Package ($20)"<br>3. Confirm switch | Plan updates immediately; quota caps automatically expand to 5 props, 25 rooms, 60 tenants, 6 staff. | |
| **TC-SET-03** | Bespoke Enterprise inquiry dispatch | Super Admin viewing plans | 1. Click "Contact Our Sales Agent" under Bespoke Scale<br>2. Fill name, email, phone, subject, business needs, and estimated counts<br>3. Submit | Inquiry successfully stored in `sales_package_enquiries`; confirmation alert displayed; control admins can review lead in central dash. | |
| **TC-SET-04** | 90-day free trial card verification | New registration | 1. Register new company<br>2. Provide card details for verification<br>3. Submit | Trial initialized with 90-day expiration timestamp; full package capabilities unlocked without immediate standard charge. | |
| **TC-SET-05** | Company profile branding & URL slug | Super Admin in Settings | 1. Update company name to "Grand Champions Lodge" and slug to "grand-champions"<br>2. Save changes<br>3. Visit `/c/grand-champions/login` | Header updates branding; custom login route successfully renders corporate-branded manager sign-in screen. | |
| **TC-SET-06** | Financial tax & bank details persistence | Super Admin in Settings | 1. Set VAT to 15%, Currency to ZAR (R)<br>2. Enter FNB bank account details<br>3. Save & generate an invoice | Invoice renders 15% VAT breakdown and displays FNB bank details in the payment instructions footer. | |

---

### Suite 12: 4-Digit Security PIN, Digital Signatures & Danger Zone Freeze

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-SEC-01** | 4-Digit PIN prompt on property deletion | Property exists in portfolio | 1. Click Trash icon on Property row<br>2. Observe prompt<br>3. Enter default `1234`<br>4. Confirm | Security PIN modal prompts; entering `1234` authorizes deletion; property removed and audit event recorded. | |
| **TC-SEC-02** | Invalid 4-Digit PIN rejection | Room exists in inventory | 1. Click Trash icon on Room row<br>2. Enter incorrect PIN `9999`<br>3. Confirm | Deletion rejected with "Invalid Security PIN" alert; room remains intact; failed attempt logged. | |
| **TC-SEC-03** | Staff PIN reset by Super Admin | Staff member forgot PIN | 1. Users Management &rarr; Click KeyRound icon on staff row<br>2. Confirm reset | Staff member's PIN reset to default `1234`; success notification displayed; staff can now authorize actions with `1234`. | |
| **TC-SEC-04** | Corporate digital signature stamping | Super Admin in Settings | 1. Upload signature PNG image<br>2. Navigate to Contracts & generate lease document<br>3. View agreement | Uploaded digital signature appears automatically stamped in the Landlord Execution block of the document. | |
| **TC-SEC-05** | Personal account deletion (30-day freeze) | Authenticated user | 1. Settings &rarr; Danger Zone &rarr; Delete Account<br>2. Type `"delete"` and valid password<br>3. Submit | Account deactivated and placed in 30-day soft freeze; session terminated; logging in within 30 days prompts cancellation & restore. | |
| **TC-SEC-06** | Company deletion with password gate | Super Admin logged in | 1. Settings &rarr; Danger Zone &rarr; Delete Company<br>2. Type exact company name and valid Super Admin password<br>3. Submit | Company marked deleted with 30-day freeze; email notifications dispatched to all staff; customer tenant records protected. | |

---

### Suite 13: Table Row Icon Operations & Contextual Modal Verification

| Test Case ID | Test Objective | Pre-conditions | Test Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ROW-01** | Property row check-in icon (`KeyRound`) | Commercial lodge property | 1. In Properties table, click `KeyRound` icon on lodge row | Check-in modal opens with Property pre-selected and room dropdown filtered specifically to vacant rooms of that lodge. | |
| **TC-ROW-02** | Property row portal publishing (`Globe`/`EyeOff`) | Rental property with &ge; 4 photos | 1. In Properties table, click `Globe` icon on rental row | Visibility toggled; listing status changes to "Published"; listing appears immediately on `paimbabook.com` index. | |
| **TC-ROW-03** | Users management row activity icon (`Activity`) | Active staff member | 1. In Users Management, click `Activity` icon on staff row | Modal opens displaying staff member's live login state, recent click pathways, and session history. | |
| **TC-ROW-04** | Users management appoint Super Admin (`Crown`) | Authenticated Super Admin | 1. Click `Crown` icon on Admin row<br>2. Enter current Super Admin password<br>3. Confirm | User role promoted to Super Admin in `company_users`; audit event recorded; target user receives elevated clearance. | |
| **TC-ROW-05** | Users management rights matrix (`ShieldCheck`) | Authenticated manager/admin | 1. Click `ShieldCheck` icon on staff row<br>2. Toggle specific permission checkboxes (e.g., Allow Rent Recording)<br>3. Save | Updated permissions persist in `company_users.permissions`; target user's interface updates on next screen render. | |
| **TC-ROW-06** | Dynamic contract row document actions | Active lease contract | 1. Test `Eye` (View), `Download` (PDF), `Printer` (Print), `Mail` (Email), `MessageCircle` (WhatsApp) | View displays formatted modal; Download produces PDF; Print triggers print sheet; Email dispatches attachment; WhatsApp opens chat link. | |
| **TC-ROW-07** | Contract row suppress & restore | Active contract | 1. Click `ShieldAlert` (Suppress)<br>2. Confirm<br>3. Click `RefreshCw` (Restore) | Step 1 soft-voids agreement and halts rent accrual; Step 3 reinstates active legal status without losing audit records. | |
| **TC-ROW-08** | Invoices row actions | Unpaid invoice on file | 1. Click `Eye` (inspect), `CheckCircle` (mark paid), `ShieldAlert` (void) | Folio renders with corporate branding; Mark Paid updates ledger balance to R0; Void cancels invoice accrual. | |

---

## 3. QA Sign-Off Criteria

1. **Zero High/Critical Severity Bugs**: All core financial and booking flows must pass without unhandled exceptions.
2. **Strict Multi-Tenant Isolation**: No data from one organization may ever appear in another organization's session.
3. **Audit Neutrality**: Every financial transaction, suppression, check-in discrepancy, and user right adjustment must leave an immutable record in the database.
4. **Responsive Experience**: Clean rendering across desktop, tablet, and mobile devices with appropriate popup modal transitions.

