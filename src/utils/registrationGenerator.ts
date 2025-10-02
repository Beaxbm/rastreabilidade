/**
 * Utility functions for generating automatic registration numbers and QR codes
 */

/**
 * Generate a unique medication registration number
 * Format: GAUGE-YYYY-NNNNNN (e.g., GAUGE-2025-000001)
 */
export function generateRegistrationNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const sequence = (timestamp % 1000000).toString().padStart(6, '0');
  
  return `GAUGE-${year}-${sequence}${random}`;
}

/**
 * Generate QR code data for a medication
 */
export function generateQRCodeData(medication: {
  id: string;
  name: string;
  registrationNumber?: string | null;
  batchNumber?: string | null;
  manufacturer?: string | null;
  dosage?: string | null;
  expirationDate?: Date | null;
  createdAt: Date;
}) {
  const qrData = {
    id: medication.id,
    registrationNumber: medication.registrationNumber || 'N/A',
    name: medication.name,
    batchNumber: medication.batchNumber || 'N/A',
    manufacturer: medication.manufacturer || 'N/A',
    dosage: medication.dosage || 'N/A',
    expirationDate: medication.expirationDate?.toISOString() || 'N/A',
    registeredAt: medication.createdAt.toISOString(),
    verificationUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/verify/${medication.id}`,
    system: 'GAUGE Pharmaceutical Traceability'
  };

  // Return base64 encoded JSON
  return Buffer.from(JSON.stringify(qrData, null, 2)).toString('base64');
}

/**
 * Create a data URL for QR code display
 */
export function createQRDataUrl(qrCodeData: string): string {
  return `data:text/plain;charset=utf-8;base64,${qrCodeData}`;
}

/**
 * Generate verification URL for a medication
 */
export function generateVerificationUrl(medicationId: string): string {
  return `${process.env.BASE_URL || 'http://localhost:3000'}/verify/${medicationId}`;
}