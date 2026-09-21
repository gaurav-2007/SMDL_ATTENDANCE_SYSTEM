const { verifyToken } = require('../utils/jwt');
const { supabaseAdmin } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  let token = req.headers.authorization;

  if (token && token.startsWith('Bearer ')) {
    token = token.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  const decoded = verifyToken(token);

  if (!decoded || !decoded.id) {
    res.status(401);
    throw new Error('Invalid token');
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, status, phone, created_at')
    .eq('id', decoded.id)
    .single();

  if (error || !user) {
    res.status(401);
    throw new Error('User not found');
  }

  if (user.status !== 'ACTIVE' && user.status !== 'PENDING') {
    res.status(401);
    throw new Error(`Account is ${user.status.toLowerCase()}. Contact admin.`);
  }

  req.user = {
    id: user.id,
    email: user.email,
    name: user.full_name,
    role: user.role,
    status: user.status,
    account_status: user.status,
    phone: user.phone,
    created_at: user.created_at,
  };
  next();

});

module.exports = protect;
