# @youmart/errors

Shared `AppError` class, `ApiError` envelope builder, and a ready-made Express
error-handler factory, used identically by every backend service (auth,
catalog, inventory, ...) so this logic isn't copy-pasted per service.

## Usage

```ts
import { AppError, createErrorHandler } from '@youmart/errors';

throw new AppError('NOT_FOUND', 404, 'Product not found');

// last middleware registered in createApp():
app.use(createErrorHandler({ isProd: config.nodeEnv === 'production' }));
```

Handles, in order: `AppError` (its own code/status), `ZodError` (400
`VALIDATION_ERROR` with issues), malformed JSON body (400), anything else
(500, message hidden when `isProd`).
