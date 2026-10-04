const { z } = require('zod');

const email = z.string().trim().toLowerCase().email('Invalid email format').max(255);
const password = z.string().min(6, 'Password must be at least 6 characters').max(100);
const name = z.string().trim().min(2, 'Name must be at least 2 characters').max(100);
const phone = z.string().regex(/^[0-9+\-\s]{7,20}$/, 'Invalid phone number').optional().or(z.literal(''));

const registerStudentSchema = z.object({
  name: name.optional(),
  full_name: name.optional(),
  email,
  password,
  phone,
  roll_number: z.string().trim().min(2, 'Roll number required').max(50),
  course_id: z.string().optional().nullable().or(z.literal('')),
  division_id: z.string().optional().nullable().or(z.literal('')),
  branch: z.string().optional(),
  department: z.string().optional(),
  class: z.string().optional(),
  division: z.string().optional(),
  otp: z.string().optional(),
  otp_token: z.string().optional(),
}).refine((data) => Boolean((data.name || data.full_name)?.trim()), {
  message: 'Name is required',
  path: ['name'],
});

const registerTeacherSchema = z.object({
  name: name.optional(),
  full_name: name.optional(),
  email,
  password,
  phone,
  employee_id: z.string().trim().min(2, 'Employee ID required').max(50),
  department: z.string().trim().min(2, 'Department required').max(100),
  designation: z.string().trim().max(100).optional(),
  otp: z.string().optional(),
  otp_token: z.string().optional(),
}).refine((data) => Boolean((data.name || data.full_name)?.trim()), {
  message: 'Name is required',
  path: ['name'],
});

const sendOtpSchema = z.object({
  email,
  role: z.enum(['student', 'teacher']).default('student'),
  roll_number: z.string().optional(),
  employee_id: z.string().optional(),
});

const verifyOtpSchema = z.object({
  email,
  otp: z.string().trim().min(4, 'OTP code required').max(10),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email format').max(255),
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Reset token required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  confirm_password: z.string().min(8, 'Confirm password required').max(100),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email, roll number, or username is required').max(255),
  password: z.string().min(1, 'Password is required').max(100),
  branch: z.string().optional(),
  course_id: z.string().optional(),
});

module.exports = {
  registerStudentSchema,
  registerTeacherSchema,
  sendOtpSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  loginSchema,
};
