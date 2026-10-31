'use strict'

const swaggerUi = require('swagger-ui-express')
const env = require('../config/env')

/**
 * Swagger/OpenAPI 3.0 documentation for the Dorara backend API.
 * Auto-generated from this config; viewable at /docs.
 */

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Dorara Travel API',
    description:
      'Production-ready REST API for the Dorara travel recommendation platform. Handles user authentication, profile management, travel questionnaires, destination search, and AI-powered recommendations.',
    version: '1.0.0',
    contact: {
      name: 'Dorara Support',
      email: 'support@dorara.ai',
    },
  },
  servers: [
    {
      url: env.API_URL + env.API_PREFIX,
      description: 'Production Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token (sent via Authorization header or httpOnly cookie)',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'User ID' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phoneNumber: { type: 'string' },
          countryCode: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin'] },
          status: { type: 'string', enum: ['active', 'inactive', 'deleted'] },
          emailVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          lastLogin: { type: 'string', format: 'date-time' },
        },
      },
      TravelRequirement: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          user: { type: 'string' },
          vertical: { type: 'string', enum: ['travel', 'education', 'jobs', 'healthcare', 'business'] },
          answers: { type: 'object', description: 'Questionnaire answers' },
          status: { type: 'string', enum: ['pending', 'completed', 'archived'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Recommendation: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          travelRequirement: { type: 'string' },
          recommendedDestinations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                country: { type: 'string' },
                score: { type: 'number' },
                safetyIndex: { type: 'number' },
                avgTempC: { type: 'number' },
              },
            },
          },
          costEstimate: {
            type: 'object',
            properties: {
              low: { type: 'number' },
              mid: { type: 'number' },
              high: { type: 'number' },
              currency: { type: 'string' },
            },
          },
          confidenceScore: { type: 'number' },
          generatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Destination: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          country: { type: 'string' },
          city: { type: 'string' },
          slug: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          weather: { type: 'array', items: { type: 'string' } },
          safetyIndex: { type: 'number', minimum: 0, maximum: 100 },
          costFactor: { type: 'number' },
          avgTempC: { type: 'number' },
          image: { type: 'string', format: 'uri' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          code: { type: 'string' },
          data: { type: 'object' },
        },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  phoneNumber: { type: 'string' },
                  countryCode: { type: 'string' },
                },
                required: ['name', 'email', 'password'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Account created successfully' },
          400: { description: 'Invalid input' },
          409: { description: 'Email already exists' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Sign in with email and password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  remember: { type: 'boolean' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Signed in successfully' },
          401: { description: 'Invalid credentials' },
          429: { description: 'Too many attempts' },
        },
      },
    },
    '/users/me': {
      get: {
        tags: ['User Profile'],
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'User profile retrieved' },
          401: { description: 'Unauthorized' },
        },
      },
      patch: {
        tags: ['User Profile'],
        summary: 'Update user profile',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  bio: { type: 'string' },
                  location: { type: 'string' },
                  nationality: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Profile updated' },
          401: { description: 'Unauthorized' },
        },
      },
      delete: {
        tags: ['User Profile'],
        summary: 'Delete account',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  password: { type: 'string' },
                },
                required: ['password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Account deleted' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/travel/requirements': {
      post: {
        tags: ['Travel'],
        summary: 'Submit travel questionnaire',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  vertical: { type: 'string', enum: ['travel'] },
                  answers: { type: 'object' },
                },
                required: ['vertical', 'answers'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Requirement created; recommendations processing' },
          400: { description: 'Invalid input' },
        },
      },
      get: {
        tags: ['Travel'],
        summary: 'List travel requirements',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'vertical', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Requirements list' },
        },
      },
    },
    '/travel/destinations': {
      get: {
        tags: ['Travel'],
        summary: 'Search destinations',
        parameters: [
          { name: 'query', in: 'query', schema: { type: 'string' } },
          { name: 'tags', in: 'query', schema: { type: 'array', items: { type: 'string' } } },
          { name: 'safetyMin', in: 'query', schema: { type: 'integer', minimum: 0, maximum: 100 } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: { description: 'Destinations list' },
        },
      },
    },
  },
}

/**
 * Initialize and mount Swagger UI.
 * Displays at /docs and provides interactive API testing.
 */
function setupSwagger(app) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customCss: '' }))
  app.get('/docs.json', (_req, res) => {
    res.json(swaggerSpec)
  })
}

module.exports = { setupSwagger, swaggerSpec }
