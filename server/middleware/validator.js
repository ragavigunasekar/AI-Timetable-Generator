import { body, validationResult } from 'express-validator';
import logger from '../utils/logger.js';

export function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`Validation failed: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
}

export const authValidation = {
  register: [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .trim()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    validateRequest,
  ],
  login: [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .trim()
      .notEmpty()
      .withMessage('Password is required'),
    validateRequest,
  ],
};

export const teacherValidation = {
  create: [
    body('code').trim().notEmpty().withMessage('Teacher code is required'),
    body('name').trim().notEmpty().withMessage('Teacher name is required'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('workload').trim().isNumeric().withMessage('Workload must be a number'),
    validateRequest,
  ],
  update: [
    body('code').trim().optional(),
    body('name').trim().optional(),
    body('subject').trim().optional(),
    body('workload').trim().optional().isNumeric().withMessage('Workload must be a number'),
    validateRequest,
  ],
};

export const subjectValidation = {
  create: [
    body('name').trim().notEmpty().withMessage('Subject name is required'),
    body('periodsPerWeek').trim().isNumeric().withMessage('Periods per week must be a number'),
    validateRequest,
  ],
  update: [
    body('name').trim().optional(),
    body('periodsPerWeek').trim().optional().isNumeric().withMessage('Periods per week must be a number'),
    validateRequest,
  ],
};

export const classValidation = {
  create: [
    body('className').trim().notEmpty().withMessage('Class name is required'),
    body('section').trim().notEmpty().withMessage('Section is required'),
    validateRequest,
  ],
  update: [
    body('className').trim().optional(),
    body('section').trim().optional(),
    validateRequest,
  ],
};

export const allocationValidation = {
  create: [
    body('classId').trim().notEmpty().withMessage('Class ID is required'),
    body('subjectId').trim().notEmpty().withMessage('Subject ID is required'),
    body('teacherId').trim().optional(),
    body('periods').trim().isInt({ min: 1 }).withMessage('Periods must be a positive integer'),
    validateRequest,
  ],
  update: [
    body('classId').trim().optional(),
    body('subjectId').trim().optional(),
    body('teacherId').trim().optional(),
    body('periods').trim().optional().isInt({ min: 1 }).withMessage('Periods must be a positive integer'),
    validateRequest,
  ],
};

export const settingsValidation = {
  update: [
    body('schoolName').trim().notEmpty().withMessage('School name is required'),
    body('startTime').trim().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid start time format (HH:MM)'),
    body('endTime').trim().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid end time format (HH:MM)'),
    body('periodsPerDay').trim().isInt({ min: 1, max: 15 }).withMessage('Periods per day must be between 1 and 15'),
    body('periodDuration').trim().isInt({ min: 1, max: 120 }).withMessage('Period duration must be between 1 and 120 minutes'),
    body('workingDays').trim().optional(),
    body('lunchDuration').trim().optional().isInt({ min: 0 }).withMessage('Lunch duration must be a non-negative integer'),
    validateRequest,
  ],
};
