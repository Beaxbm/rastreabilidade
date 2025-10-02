import express from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { authenticate } from '../middleware/auth.js';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { PrismaClient } from '@prisma/client';
import { generateRegistrationNumber } from '../utils/registrationGenerator.js';

const prisma = new PrismaClient();
const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

// Python service URL (adjust if running on different port)
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Manual drug entry endpoint
router.post('/manual', authenticate, async (req, res, next) => {
  try {
    const { name, batchNumber, manufacturer, dosage, expirationDate, storageLocation } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Drug name is required'
      });
    }

    // Generate automatic registration number
    const registrationNumber = generateRegistrationNumber();

    // Parse expiration date if provided
    const expDate = expirationDate ? new Date(expirationDate) : null;

    // Create medication record with ALL fields
    const medication = await prisma.medication.create({
      data: {
        name,
        anvisaCode: registrationNumber, // Registration number
        batchNumber: batchNumber || null,
        manufacturer: manufacturer || null,
        dosage: dosage || null,
        expirationDate: expDate,
        storageLocation: storageLocation || null,
        createdBy: req.user?.id || null
      }
    });

    // Generate enhanced QR code with registration number
    const enhancedQrData = {
      id: medication.id,
      registrationNumber: medication.anvisaCode, // Using anvisaCode as registration number
      name: medication.name,
      batchNumber: batchNumber || 'N/A',
      manufacturer: manufacturer || 'N/A',
      dosage: dosage || 'N/A',
      expirationDate: expirationDate || 'N/A',
      storageLocation: storageLocation || 'N/A',
      registeredAt: medication.createdAt.toISOString(),
      verificationUrl: `http://localhost:3000/verify/${medication.id}`,
      system: 'GAUGE Pharmaceutical Traceability'
    };

    const qrCodeData = Buffer.from(JSON.stringify(enhancedQrData, null, 2)).toString('base64');
    const qrDataUrl = `data:text/plain;charset=utf-8;base64,${qrCodeData}`;

    logger.info('Manual drug entry created', {
      medicationId: medication.id,
      registrationNumber: medication.anvisaCode,
      userId: req.user?.id,
      name: medication.name
    });

    return res.json({
      success: true,
      message: 'Drug information created successfully with automatic registration number and QR code',
      data: {
        medication: {
          id: medication.id,
          name: medication.name,
          registrationNumber: medication.anvisaCode, // Using anvisaCode as registration number
          createdAt: medication.createdAt
        },
        qrCode: {
          data: qrCodeData,
          dataUrl: qrDataUrl,
          verificationUrl: enhancedQrData.verificationUrl
        },
        inputData: {
          batchNumber: batchNumber || null,
          manufacturer: manufacturer || null,
          dosage: dosage || null,
          expirationDate: expirationDate || null,
          storageLocation: storageLocation || null
        }
      }
    });

  } catch (error) {
    logger.error('Manual drug entry error:', error);
    return next(createError('Failed to create drug entry', 500));
  }
});

/**
 * @route POST /api/drugs/extract-from-image
 * @desc Extract drug information from image and generate QR code
 * @access Private
 */
router.post('/extract-from-image', authenticate, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw createError('No image file provided', 400);
    }

    logger.info('Processing drug specification image', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      userId: req.user?.id
    });

    // Create form data for Python service
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    // Call Python service
    const response = await axios.post(`${PYTHON_SERVICE_URL}/extract-drug-info`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 30000, // 30 second timeout
    });

    const { drug_info, extracted_text } = response.data;

    // Save extracted drug information to database with basic fields only
    const medication = await prisma.medication.create({
      data: {
        name: drug_info.name || 'Unknown',
        createdBy: req.user?.id || null
      },
    });

    // Log the creation in audit trail
    try {
      await prisma.auditLog.create({
        data: {
          action: 'CREATE_MEDICATION_FROM_IMAGE',
          userId: req.user!.id,
          entityType: 'Medication',
          entityId: medication.id
        },
      });
    } catch (logError) {
      console.error('Failed to create audit log:', logError);
    }

    // Generate simple QR code
    const qrData = {
      id: medication.id,
      name: medication.name,
      createdAt: medication.createdAt.toISOString()
    };
    const qrCodeData = Buffer.from(JSON.stringify(qrData)).toString('base64');

    res.status(201).json({
      success: true,
      message: 'Drug information extracted successfully',
      data: {
        medication: {
          id: medication.id,
          name: medication.name,
          createdAt: medication.createdAt,
        },
        qrCodeData,
        extractedInfo: drug_info,
        rawText: extracted_text,
      },
    });

  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        logger.error('Python service is not available', { error: error.message });
        throw createError('Image processing service is temporarily unavailable. Please try again later.', 503);
      }
      
      const status = error.response?.status || 500;
      const message = error.response?.data?.detail || 'Error processing image';
      throw createError(message, status);
    }
    
    logger.error('Error in drug extraction endpoint', { error: (error as Error).message });
    next(error);
  }
});

/**
 * @route GET /api/drugs/:id/qr
 * @desc Get QR code for a specific medication
 * @access Private
 */
router.get('/:id/qr', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw createError('Medication ID is required', 400);
    }

    const medication = await prisma.medication.findUnique({
      where: { id },
    });

    if (!medication) {
      throw createError('Medication not found', 404);
    }

    // Generate enhanced QR code
    const enhancedQrData = {
      id: medication.id,
      registrationNumber: medication.anvisaCode, // Using anvisaCode as registration number
      name: medication.name,
      createdAt: medication.createdAt.toISOString(),
      verificationUrl: `http://localhost:3000/verify/${medication.id}`,
      system: 'GAUGE Pharmaceutical Traceability'
    };

    const qrCodeData = Buffer.from(JSON.stringify(enhancedQrData, null, 2)).toString('base64');
    const qrDataUrl = `data:text/plain;charset=utf-8;base64,${qrCodeData}`;

    res.json({
      success: true,
      data: {
        qrCode: qrCodeData,
        qrDataUrl: qrDataUrl,
        verificationUrl: enhancedQrData.verificationUrl,
        medication: {
          id: medication.id,
          name: medication.name,
          registrationNumber: medication.anvisaCode
        },
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/drugs
 * @desc Get all medications with optional filtering
 * @access Private
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search } = req.query;

    const where: any = {};

    // Basic filtering removed since we only have basic fields

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { anvisaCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const medications = await prisma.medication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        anvisaCode: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
      },
    });

    res.json({
      success: true,
      data: medications,
      count: medications.length,
    });

  } catch (error) {
    next(error);
  }
});

export default router;