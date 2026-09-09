# @youmart/shared-utils

Generic, dependency-light utilities shared across YouMart backend services.

## Hard rule: all money math goes through `@youmart/shared-utils/money`

Our `Money` type (from `@youmart/shared-types`) is a decimal string, never a JS number - floats
cannot represent currency exactly. **Never use raw JavaScript number arithmetic (`+`, `-`, `*`)
on money.** Every financial calculation (commission, TCS/TDS, settlement, refunds, order totals)
must use the helpers in `src/money.ts`, which do all arithmetic through
[decimal.js](https://mikemcl.github.io/decimal.js/) and round `ROUND_HALF_UP`.

This package holds only generic arithmetic primitives - no commission, tax, or other domain
rules. Those rules live in their own chapters and call these primitives.
