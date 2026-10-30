// Core encoder only: no filesystem, streams, canvas or native Node APIs.
import QRCode from "qrcode/lib/core/qrcode.js";
export function certificateQr(url: string) { return QRCode.create(url,{errorCorrectionLevel:"M"}).modules; }
