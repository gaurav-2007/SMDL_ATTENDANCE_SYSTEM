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
  course_id: z.string().uuid('Valid course_id required').optional().nullable(),
  division_id: z.string().uuid('Valid division_id required').optional().nullable(),
  class: z.string().optional(),
  division: z.string().optional(),
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
}).refine((data) => Boolean((data.name || data.full_name)?.trim()), {
  message: 'Name is required',
  path: ['name'],
});


const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email or username is required').max(255),
  password: z.string().min(1, 'Password is required').max(100),
});

module.exports = {
  registerStudentSchema,
  registerTeacherSchema,
  loginSchema,
};
