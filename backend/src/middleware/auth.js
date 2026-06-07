const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Keycloak JWKS client
const client = jwksClient({
  jwksUri: `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
});

// Helper to get signing key
const getKey = (header, callback) => {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
};

/**
 * Middleware to authenticate requests using Keycloak JWT
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required',
    });
  }

  jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    req.user = {
      user_id: user.sub,
      email: user.email,
      name: user.name,
      roles: user.realm_access?.roles || [],
    };

    next();
  });
};

/**
 * Middleware to check user roles
 * @param {Array<string>} allowedRoles - Array of roles allowed to access the route
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
};

// Apply authentication to all routes in this router
router.use(authenticateToken);

// Token introspection endpoint (optional)
router.post('/introspect', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token required',
      });
    }

    // In production, verify with Keycloak introspection endpoint
    // For now, just decode and return
    const decoded = jwt.decode(token);

    res.json({
      success: true,
      active: !!decoded,
      token_info: decoded,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
module.exports.checkRole = checkRole;
