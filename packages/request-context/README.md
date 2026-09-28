# @youmart/request-context

Cross-cutting request-id correlation for backend services (Ch7.3).

- `requestIdMiddleware` - mount first in every service's Express app. Picks
  up the gateway's `x-request-id` header (or generates one if missing),
  stamps it on `req.requestId`, echoes it on the response, and runs the
  rest of the request inside an `AsyncLocalStorage` context.
- `genRequestId` - pass as pino-http's `genReqId` option so the service's
  own log `req.id` field equals the correlated request-id.
- `getRequestId()` - read the current request's id from anywhere (used by
  `@youmart/service-client` to forward it on outbound service-to-service
  calls, without threading it through every function signature).

This lets a single customer request be traced across gateway -> service A
-> service B log lines by grepping one id, without changing any business
logic.
