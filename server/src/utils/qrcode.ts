import QRCode from "qrcode";

/**
 * Generate a QR code as a base64 encoded image
 * @param data - The data to encode in the QR code (typically a verification URL)
 * @returns Base64 encoded QR code image
 */
export const generateQRCode = async (data: string): Promise<string> => {
  try {
    // Generate QR code as data URL (base64)
    const qrCodeDataURL = await QRCode.toDataURL(data, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 300,
      margin: 2,
    });

    return qrCodeDataURL;
  } catch (error) {
    throw new Error(
      `Failed to generate QR code: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Generate a verification URL for a booking
 * @param verificationToken - The unique verification token
 * @param baseUrl - The base URL of the application (e.g., https://app.powermysport.com)
 * @returns Full verification URL
 */
export const generateVerificationURL = (
  verificationToken: string,
  baseUrl: string = process.env.APP_BASE_URL || "http://localhost:3000",
): string => {
  return `${baseUrl}/verify?token=${verificationToken}`;
};
