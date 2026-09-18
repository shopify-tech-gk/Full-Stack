import { Router } from 'express';
import { OtpRequestBody, OtpVerifyBody } from '../otp/otp.schema';
import { requestOtp, verifyOtpCode } from '../otp/otp.service';

export const otpRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts) - no explicit try/catch + next(err) needed
// here, unlike Express 4.

otpRouter.post('/otp/request', async (req, res) => {
  const body = OtpRequestBody.parse(req.body);
  const result = await requestOtp(body);
  res.status(200).json(result);
});

otpRouter.post('/otp/verify', async (req, res) => {
  const body = OtpVerifyBody.parse(req.body);
  const result = await verifyOtpCode(body);
  res.status(200).json(result);
});
