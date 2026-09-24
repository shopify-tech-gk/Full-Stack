# Notification Contract (events, channels, templates)

**FROZEN as of `chapter-6-complete` (2026-09-24).** This is the stable
surface other services build against. Changes after this freeze must be
additive where possible or require a version bump communicated to all
consumers.

## Shape

`notification-service` (`@youmart/notification-service`, port **4012**)
exposes NO public HTTP surface at all - it is a pure BullMQ queue consumer,
NOT routed through the gateway (Ch6.6 deliberately excludes it - nothing
for a frontend to call). Every OTHER service enqueues notifications via
`@youmart/notifications-client`'s `enqueueNotification({channel, to,
templateKey, data, userId?})` - fire-and-forget, never throws (a queue
outage must never block the caller's real business action).

## Channels

`WHATSAPP` and `EMAIL` only (Ch6.2b, locked). `SMS` provider code exists
(Msg91SmsProvider, registered) but nothing routes to it - a documented,
deliberate "kept but unused" state.

## Templates (`TemplateKey`)

| Key                | Enqueued by                                                | WhatsApp param order                                                                             |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `OTP`              | auth-service (`requestOtp`)                                | `{{1}}`=code (AUTHENTICATION category - separate approved template + "copy code" button payload) |
| `ORDER_PLACED`     | order-service (`confirmOrder`)                             | `{{1}}`=customerName, `{{2}}`=orderNumber, `{{3}}`=amount                                        |
| `ORDER_SHIPPED`    | logistics-service (`createShipment`)                       | `{{1}}`=customerName, `{{2}}`=orderNumber, `{{3}}`=awb, `{{4}}`=carrier                          |
| `ORDER_DELIVERED`  | logistics-service (`applyShipmentStatus`, on -> DELIVERED) | `{{1}}`=customerName, `{{2}}`=orderNumber                                                        |
| `REFUND_PROCESSED` | returns-service (`processRefund`)                          | `{{1}}`=customerName, `{{2}}`=amount, `{{3}}`=orderNumber                                        |

Every WhatsApp template NAME comes from env (a rename is an env change,
never a code change). `OTP`'s `code` field is the ONE sensitive field in
this repo - it is redacted (`[REDACTED]`) before ever being written to
`notification_log.payload`, and (Ch6.2b) is no longer logged anywhere in
plaintext at all (a prior dev-only "log the code" stub is retired).

## Simulate mode (`NOTIFICATIONS_ENABLED=false`, current dev default)

No real provider call is made - the job is marked `SENT` with
`simulated: true` and logging stops BEFORE template rendering (so not even
a redacted rendered body is produced). This is the state real Razorpay/
MSG91/Zoho credentials being pending affects: **the code paths are
proven** (queue -> render -> provider dispatch -> log, verified structurally
and via real enqueue/consume in the Ch6.8 integration), but live external
delivery to a real phone/inbox awaits Vijesh's real MSG91 authkey +
approved WhatsApp templates and Zoho refresh token.

## Login-safety fallback (Ch6.2b)

If the OTP template's primary WhatsApp leg exhausts retries AND the
enqueuing service supplied `data.fallbackEmail`, a one-off email OTP send
is attempted as a side effect - a user must never be silently unable to
log in solely because WhatsApp delivery failed.

## Verified live (Ch6.8 end-to-end integration)

Real order flow produced exactly 3 `notification_log` rows for one
customer, in order: `ORDER_PLACED` (checkout->confirm), `ORDER_SHIPPED`
(shipment created), `ORDER_DELIVERED` (marked delivered) - all `WHATSAPP`,
all `status=SENT` (simulated, `NOTIFICATIONS_ENABLED=false`). No `EMAIL`
row for this test user, correctly - the test account has no email on file
(the `if (contact.email)` guard skipped it, not a bug).
