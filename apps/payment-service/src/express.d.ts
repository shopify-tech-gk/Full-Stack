declare global {
  namespace Express {
    interface Request {
      /** The exact raw request body bytes, captured by express.json's
       * `verify` callback (see app.ts) - needed to verify the Razorpay
       * webhook's HMAC signature, since JSON.parse discards the original
       * byte-for-byte representation the signature was computed over. */
      rawBody?: Buffer;
    }
  }
}

export {};
