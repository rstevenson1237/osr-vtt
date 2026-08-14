# Runbook — Blaze upgrade, App Check enforcement, and the billing backstop

**`[HUMAN]` throughout.** Nothing in this file is delegable and nothing in this
repository performs it: every step is Firebase/Google Cloud console work, which is
exactly the category RULE-010's second clause contemplates. An agent may read this
runbook; it may not do it.

Cited by SPEC-034 §3.3 and RULE-010's Blaze clauses. Read
`docs/spec/SPEC-034.md` first if you have not — it is short, and it states why the
three layers below are ordered the way they are.

---

## Why this exists

On **Spark**, quota exhaustion denies requests rather than generating a bill. The
downside of abuse is an outage for the group, not a charge, and every containment
decision in the app was taken under that premise.

On **Blaze** the premise inverts. Usage bills. Cloud Storage bills per byte stored
_and_ per byte served, and it is not the only exposure: Firestore reads and RTDB
bandwidth bill too, so RULE-012's "the roomId is the capability" hands a cost lever
to anyone holding a leaked room id the moment the project is on Blaze —
independently of whether uploads are ever switched on.

**GCP has no hard spend ceiling.** A budget alert notifies; it does not cap. Early
warning is what this runbook buys. That is the honest description and it should not
be softened when someone asks "so we're protected, right?"

---

## Order of operations

The order is load-bearing. Do not skip ahead to step 4.

### 1. Upgrade the project to Blaze

Firebase console → **Usage and billing** → **Modify plan** → Blaze. This attaches a
Cloud Billing account, and from that moment the economic premise above has changed
for the whole project, uploads or no uploads.

### 2. Set a Cloud Billing budget with alerts — before anything can write

Google Cloud console → **Billing** → **Budgets & alerts** → **Create budget**.

- Scope it to this project alone, not to the whole billing account.
- Pick a monthly amount you would be **annoyed but not hurt** to pay. The number's
  job is to fire early, not to be accurate.
- Alert thresholds at **50%, 90%, 100%** of the budget, and tick **forecasted
  spend** as well as actual — a forecast alert is the one that arrives while there
  is still time to act.
- Send alerts to an address a human reads on a phone. An alert in an inbox nobody
  opens on a Saturday is not a backstop.

Do this **before** step 3, so the alerting exists before the bucket does.

### 3. Enable App Check enforcement

App Check is already wired in the client (`packages/shared/src/firebase-config.ts`,
SPEC-025 §2) and inert only because no reCAPTCHA site key is configured. On Blaze it
stops being optional (RULE-010): it is the highest-value lever available against an
outsider holding a leaked room id, and it is the only one that acts before a request
costs anything.

1. Firebase console → **App Check** → register the web app with the **reCAPTCHA v3**
   provider. Copy the site key.
2. Set `VITE_FIREBASE_APPCHECK_SITE_KEY` in the deploy environment and redeploy.
   Confirm real traffic is showing as **verified** in the App Check dashboard before
   going on — enforcing while traffic is still unverified locks out your own
   players.
3. Once verified requests dominate, **enforce** on Cloud Storage, Firestore and
   Realtime Database. Enforcement is per-service and each is a separate toggle.

Debug tokens bypass attestation entirely. `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` must
never be set on a production build.

### 4. Only now: switch uploads on

Set `VITE_ENABLE_STORAGE_UPLOADS=true` and redeploy. That single flag gives the
client a Cloud Storage handle, which is what makes `FirebaseStorageAssetStore` the
app's `AssetStore` **and** what lets `CampaignStore.deleteRoom` sweep a deleted
room's objects (SPEC-034 §4). They are deliberately the same switch: a build that
uploads objects nothing ever deletes is the failure this ordering exists to prevent.

Deploy `firebase/storage.rules` with it — `firebase deploy --only storage` — and
check the console shows the deployed rules, not the default template. The default
template denies everything after 30 days, which fails closed but looks like a bug.

---

## What is and is not enforced, once all four steps are done

**Enforced, per write, by `firebase/storage.rules`:**

- one object ≤ 5 MB;
- content type in `image/png`, `image/jpeg`, `image/webp`, `image/gif` (SVG is
  deliberately excluded — a script-bearing document is not inert pixels);
- path shape `rooms/{roomId}/uploads/{uid}/{objectId}`, so every object is
  attributable and deletable with its room;
- the uploader holds a seat in that room;
- the uploader owns the uid segment they are writing under.

**Enforced on the bucket, by the console:** App Check.

**Not enforced by anything, and it must not be described as though it were:** the
per-room usage readout and its soft cap in the Assets activity. That is client-side
friction, the same status `MAX_ROOMS_SOFT` carries. An aggregate quota — bytes per
room, bytes per user, objects per day — and any rate limit both need a running total,
a running total needs a trusted writer, and RULE-010 forbids the only mechanism that
could be one. If one of those becomes genuinely necessary, it is a second RULE-010
amendment, not a wider `storage.rules` (SPEC-034 §5).

---

## When a budget alert fires

Work down this list. Steps 1–3 stop the bleeding within minutes; the rest is
diagnosis.

1. **Read the alert before reacting.** A 50% forecast alert three days into the
   month is information. A 100% actual alert is an incident.
2. **Cheapest real brake first: App Check.** If it is registered but not enforced on
   some service, enforce it now. If it is already enforced, check the App Check
   dashboard for a spike in _unverified_ requests — that is an outsider, not your
   table.
3. **If it is an incident, cut the write path.** Redeploy with
   `VITE_ENABLE_STORAGE_UPLOADS` unset, or deploy a `storage.rules` whose write
   clauses are `if false`. Reads keep working; the app degrades to the Spark-era
   behaviour rather than breaking.
4. **Find out which service is spending.** Google Cloud console → **Billing** →
   **Reports**, grouped by SKU. Storage bytes served, Firestore document reads, and
   RTDB bandwidth look nothing alike in that view, and the answer decides the
   remedy.
5. **If it is Storage:** Firebase console → **Storage** → browse
   `rooms/{roomId}/uploads/`. Every object carries its room and its uploader in the
   path. Delete the offending room's objects, or the room (which now sweeps them,
   SPEC-034 §4).
6. **If it is Firestore or RTDB:** the room id has probably leaked. There is no
   in-app remedy — that is RULE-012's stated open risk. Delete the room and issue a
   new one; membership-gated reads are open work in `DECISIONS.md` → Postponed.
7. **If the abuser is identifiable:** room creation requires a non-anonymous
   provider (SPEC-025 §1), so the creator has a real Google account. Disable that
   user in Firebase console → **Authentication**.
8. **Afterwards, revisit the budget number**, and log anything the incident taught
   as a new intake item in `INTAKE.md`. Do not fix the app from inside the incident.

---

## What NOT to do

- **Do not add a Cloud Function** to meter, cap, or scan. RULE-010 forbids it, and
  the no-Cloud-Functions clause survived the WI-065 amendment unchanged (DEC-049,
  answered (c)). Wanting one is a rule-amendment conversation, held in the open,
  before any code.
- **Do not raise the soft cap and call it containment.** It is friction. Raising it
  changes nothing about what is enforceable.
- **Do not add `image/svg+xml`** to the allowlist to make someone's map work. Point
  them at the "By URL" tab instead.
- **Do not set a "spend cap" and assume it holds.** There isn't one. Automated
  billing shutoff via a Pub/Sub-triggered function is the usual workaround, and it is
  a Cloud Function — see the first bullet.
