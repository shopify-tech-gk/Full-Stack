import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { deviceLabel } from './device-label';
import { issueSession, type SessionResult } from './session.service';

// QR sign-in (WhatsApp Web / Amazon style). The website creates a short-lived session and shows its
// `code` as a QR; a signed-in YouMart app user scans it, sees which browser is asking, and confirms
// (the app guards that with Face ID / fingerprint); the website - and ONLY the browser that created
// it, proven by its `browserKey` - then claims a normal session, once.
//
// Only hashes are stored. Every state change is a conditional update on the expected previous state,
// so racing scans / claims can't both win.

const TTL_MS = 2 * 60 * 1000;
/** What the QR encodes. A link (not a bare code) so a phone camera opens youmart.in, where the page
 * tells people to scan with the app instead. The app reads the `c` parameter. */
const QR_LINK = 'https://youmart.in/qr-login?c=';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type QrStatus = 'PENDING' | 'SCANNED' | 'APPROVED' | 'USED' | 'REJECTED' | 'EXPIRED';

export interface CreatedQrLogin {
  sessionId: string;
  /** Render this as the QR. */
  qrValue: string;
  /** Keep in the browser; send as `x-qr-browser-key` to poll and claim. Never shown. */
  browserKey: string;
  expiresAt: string;
}

/** Website: a new QR for this browser. Also clears out long-dead rows (housekeeping). */
export async function createQrLogin(meta: {
  userAgent?: string;
  ipAddress?: string;
}): Promise<CreatedQrLogin> {
  const code = secret();
  const browserKey = secret();
  const expiresAt = new Date(Date.now() + TTL_MS);
  const row = await prisma.qrLoginSession.create({
    data: {
      codeHash: sha256(code),
      browserKeyHash: sha256(browserKey),
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
      ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
      expiresAt,
    },
  });
  await prisma.qrLoginSession
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    .catch(() => undefined);
  return {
    sessionId: row.id,
    qrValue: `${QR_LINK}${code}`,
    browserKey,
    expiresAt: expiresAt.toISOString(),
  };
}

async function loadForBrowser(sessionId: string, browserKey: string) {
  const row = await prisma.qrLoginSession.findFirst({ where: { id: sessionId, deletedAt: null } });
  if (!row || !browserKey || !sameHash(row.browserKeyHash, sha256(browserKey))) {
    throw new AppError('NOT_FOUND', 404, 'QR code not found');
  }
  return row;
}

function effectiveStatus(row: { status: string; expiresAt: Date }): QrStatus {
  const live = row.status === 'PENDING' || row.status === 'SCANNED' || row.status === 'APPROVED';
  return live && row.expiresAt.getTime() < Date.now() ? 'EXPIRED' : (row.status as QrStatus);
}

/** "+91 ••••• 30079" / "j•••@gmail.com" - who scanned, shown on the website while it waits. */
function maskContact(user: { phone: string | null; email: string | null; name: string | null }) {
  if (user.phone) return `${user.phone.slice(0, 3)} ••••• ${user.phone.slice(-5)}`;
  if (user.email) {
    const [local, domain] = user.email.split('@');
    return `${local?.slice(0, 1) ?? ''}•••@${domain ?? ''}`;
  }
  return user.name ?? 'a YouMart customer';
}

export interface QrPollView {
  status: QrStatus;
  expiresAt: string;
  /** Once scanned: who is confirming (masked). */
  scannedBy: string | null;
}

/** Website: poll the QR's state (every ~2 s). */
export async function pollQrLogin(sessionId: string, browserKey: string): Promise<QrPollView> {
  const row = await loadForBrowser(sessionId, browserKey);
  let scannedBy: string | null = null;
  if (row.userId && (row.status === 'SCANNED' || row.status === 'APPROVED')) {
    const user = await prisma.user.findFirst({ where: { id: row.userId, deletedAt: null } });
    if (user) scannedBy = maskContact(user);
  }
  return { status: effectiveStatus(row), expiresAt: row.expiresAt.toISOString(), scannedBy };
}

/** Website: exchange an APPROVED QR for a session - once. */
export async function claimQrLogin(
  sessionId: string,
  browserKey: string,
  userAgent?: string,
): Promise<SessionResult> {
  const row = await loadForBrowser(sessionId, browserKey);
  const status = effectiveStatus(row);
  if (status !== 'APPROVED' || !row.userId) {
    throw new AppError('CONFLICT', 409, `This QR code is ${status.toLowerCase()}`, { status });
  }
  const claimed = await prisma.qrLoginSession.updateMany({
    where: { id: row.id, status: 'APPROVED', expiresAt: { gt: new Date() } },
    data: { status: 'USED', usedAt: new Date() },
  });
  if (claimed.count === 0) {
    throw new AppError('CONFLICT', 409, 'This QR code was already used', { status: 'USED' });
  }
  return issueSession(row.userId, userAgent);
}

export interface QrScanView {
  requestId: string;
  /** The browser asking to sign in, e.g. "Chrome · Windows". */
  device: string;
  /** When the website showed the QR. */
  requestedAt: string;
  expiresAt: string;
}

/** Reads the code out of what the camera saw: the YouMart QR link (or a bare code). */
export function codeFromQr(value: string): string | null {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (!/(^|\.)youmart\.in$/i.test(url.hostname) || !url.pathname.startsWith('/qr-login'))
      return null;
    return url.searchParams.get('c');
  } catch {
    return /^[A-Za-z0-9_-]{30,60}$/.test(trimmed) ? trimmed : null;
  }
}

async function loadByCode(code: string) {
  const row = await prisma.qrLoginSession.findFirst({
    where: { codeHash: sha256(code), deletedAt: null },
  });
  if (!row) throw new AppError('NOT_FOUND', 404, 'This QR code is not valid');
  return row;
}

/** App (signed in): the user scanned a website QR - claim it for them and describe the browser. */
export async function scanQrLogin(userId: string, code: string): Promise<QrScanView> {
  const row = await loadByCode(code);
  const status = effectiveStatus(row);
  if (status === 'EXPIRED') {
    throw new AppError('CONFLICT', 409, 'This QR code has expired. Refresh it on the website.');
  }
  if (status === 'PENDING') {
    const marked = await prisma.qrLoginSession.updateMany({
      where: { id: row.id, status: 'PENDING' },
      data: { status: 'SCANNED', userId, scannedAt: new Date() },
    });
    if (marked.count === 0) return scanQrLogin(userId, code);
  } else if (status !== 'SCANNED' || row.userId !== userId) {
    throw new AppError(
      'CONFLICT',
      409,
      'This QR code was already used. Refresh it on the website.',
    );
  }
  return {
    requestId: row.id,
    device: deviceLabel(row.userAgent).label,
    requestedAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

/** App: confirm (or cancel) the sign-in the user scanned. */
export async function decideQrLogin(
  userId: string,
  code: string,
  approve: boolean,
): Promise<{ status: QrStatus }> {
  const row = await loadByCode(code);
  if (row.userId !== userId || effectiveStatus(row) !== 'SCANNED') {
    throw new AppError('CONFLICT', 409, 'This sign-in request is no longer waiting for you');
  }
  const next = approve ? 'APPROVED' : 'REJECTED';
  const updated = await prisma.qrLoginSession.updateMany({
    where: { id: row.id, status: 'SCANNED', userId, expiresAt: { gt: new Date() } },
    data: approve ? { status: next, approvedAt: new Date() } : { status: next },
  });
  if (updated.count === 0) {
    throw new AppError('CONFLICT', 409, 'This sign-in request has expired');
  }
  return { status: next };
}
