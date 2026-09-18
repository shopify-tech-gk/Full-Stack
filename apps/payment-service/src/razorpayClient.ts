import Razorpay from 'razorpay';
import { config } from './config';

export const razorpay = new Razorpay({
  key_id: config.razorpayKeyId,
  key_secret: config.razorpayKeySecret,
});
