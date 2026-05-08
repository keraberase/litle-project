const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
 
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Game Backlog API',
            version: '1.0.0',
            description: 'REST API for a game backlog tracker with JWT authentication and IGDB game search.',
        },
        servers: [{ url: 'http://localhost:3000', description: 'Local dev' }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                Game: {
                    type: 'object',
                    properties: {
                        id:           { type: 'integer', example: 1 },
                        user_id:      { type: 'integer', example: 3 },
                        title:        { type: 'string',  example: 'The Witcher 3' },
                        platform:     { type: 'string',  example: 'PC, PS5' },
                        status:       { type: 'string',  enum: ['planned','playing','completed','dropped'], example: 'completed' },
                        rating:       { type: 'integer', minimum: 1, maximum: 5, example: 5 },
                        hours:        { type: 'number',  example: 120.5 },
                        tags:         { type: 'string',  example: 'RPG, Open World' },
                        cover_url:    { type: 'string',  example: 'https://images.igdb.com/...' },
                        added_at:     { type: 'string',  example: '01/05/2025' },
                        completed_at: { type: 'string',  example: '15/05/2025' },
                        updated_at:   { type: 'string',  example: '15/05/2025' },
                    },
                },
                GameInput: {
                    type: 'object',
                    required: ['title'],
                    properties: {
                        title:     { type: 'string',  example: 'Elden Ring' },
                        platform:  { type: 'string',  example: 'PC' },
                        status:    { type: 'string',  enum: ['planned','playing','completed','dropped'], default: 'planned' },
                        rating:    { type: 'integer', minimum: 1, maximum: 5 },
                        hours:     { type: 'number',  default: 0 },
                        tags:      { type: 'string',  example: 'Souls, RPG' },
                        cover_url: { type: 'string' },
                    },
                },
                AuthRequest: {
                    type: 'object',
                    required: ['username', 'password'],
                    properties: {
                        username: { type: 'string', example: 'player1' },
                        password: { type: 'string', example: 'secret123' },
                    },
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        token: { type: 'string', example: 'eyJhbGci...' },
                        user: {
                            type: 'object',
                            properties: {
                                id:       { type: 'integer', example: 1 },
                                username: { type: 'string',  example: 'player1' },
                            },
                        },
                    },
                },
                PaginatedGames: {
                    type: 'object',
                    properties: {
                        games: { type: 'array', items: { $ref: '#/components/schemas/Game' } },
                        pagination: {
                            type: 'object',
                            properties: {
                                page:  { type: 'integer' },
                                limit: { type: 'integer' },
                                total: { type: 'integer' },
                                pages: { type: 'integer' },
                            },
                        },
                        stats: {
                            type: 'object',
                            properties: {
                                total:       { type: 'integer' },
                                planned:     { type: 'integer' },
                                completed:   { type: 'integer' },
                                total_hours: { type: 'number' },
                            },
                        },
                    },
                },
                Error: {
                    type: 'object',
                    properties: { error: { type: 'string' } },
                },
            },
        },
        paths: {
// AUTH
            '/auth/register': {
                post: {
                    tags: ['Auth'],
                    summary: 'Register a new user',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRequest' } } },
                    },
                    responses: {
                        201: { description: 'Successfully registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
                        400: { description: 'Username already exists / invalid data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    },
                },
            },
            '/auth/login': {
                post: {
                    tags: ['Auth'],
                    summary: 'Login',
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthRequest' } } },
                    },
                    responses: {
                        200: { description: 'JWT token', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
                        401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    },
                },
            },
 
// GAMES
            '/games': {
                get: {
                    tags: ['Games'],
                    summary: 'Get list of games with filtering',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        { name: 'page',       in: 'query', schema: { type: 'integer', default: 1 } },
                        { name: 'limit',      in: 'query', schema: { type: 'integer', default: 9 } },
                        { name: 'status',     in: 'query', schema: { type: 'string', enum: ['planned','playing','completed','dropped'] } },
                        { name: 'search',     in: 'query', schema: { type: 'string' }, description: 'Search by title' },
                        { name: 'tags',       in: 'query', schema: { type: 'string' }, description: 'Filter by tags (comma-separated)' },
                        { name: 'sort_by',    in: 'query', schema: { type: 'string', enum: ['title','platform','rating','hours','added_at','completed_at'], default: 'added_at' } },
                        { name: 'sort_order', in: 'query', schema: { type: 'string', enum: ['asc','desc'], default: 'desc' } },
                    ],
                    responses: {
                        200: { description: 'List of games', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedGames' } } } },
                        401: { description: 'Unauthorized' },
                    },
                },
                post: {
                    tags: ['Games'],
                    summary: 'Add a new game',
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': { schema: { $ref: '#/components/schemas/GameInput' } },
                            'multipart/form-data': {
                                schema: {
                                    allOf: [
                                        { $ref: '#/components/schemas/GameInput' },
                                        { properties: { cover: { type: 'string', format: 'binary', description: 'Cover image upload' } } },
                                    ],
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'Game added', content: { 'application/json': { schema: { $ref: '#/components/schemas/Game' } } } },
                        400: { description: 'Validation error' },
                        401: { description: 'Unauthorized' },
                    },
                },
            },
            '/games/{id}': {
                get: {
                    tags: ['Games'],
                    summary: 'Get a game by ID',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                    responses: {
                        200: { description: 'Game found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Game' } } } },
                        404: { description: 'Not found' },
                    },
                },
                put: {
                    tags: ['Games'],
                    summary: 'Update a game',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                    requestBody: {
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/GameInput' } } },
                    },
                    responses: {
                        200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Game' } } } },
                        404: { description: 'Not found' },
                    },
                },
                delete: {
                    tags: ['Games'],
                    summary: 'Delete a game',
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
                    responses: {
                        200: { description: 'Deleted' },
                        404: { description: 'Not found' },
                    },
                },
            },
//IGDB 
            '/api/search-games': {
                get: {
                    tags: ['IGDB'],
                    summary: 'Search games via IGDB',
                    parameters: [
                        { name: 'query', in: 'query', required: true, schema: { type: 'string' }, description: 'Game title' },
                    ],
                    responses: {
                        200: {
                            description: 'Search results',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id:                 { type: 'integer' },
                                                name:               { type: 'string' },
                                                rating:             { type: 'number' },
                                                cover:              { type: 'string' },
                                                first_release_date: { type: 'integer', description: 'Unix timestamp' },
                                                platforms: {
                                                    type: 'array',
                                                    items: { type: 'object', properties: { name: { type: 'string' } } },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        400: { description: 'Query parameter missing' },
                        500: { description: 'IGDB error' },
                    },
                },
            },
        },
    },
    apis: [],
};
 
const swaggerSpec = swaggerJsdoc(options);
 

function setupSwagger(app) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: `
            .swagger-ui .topbar { background: #050510; border-bottom: 1px solid #ff00ff44; }
            .swagger-ui .topbar-wrapper img { display: none; }
            .swagger-ui .topbar-wrapper::before { content: '🎮 GAME BACKLOG API'; color: #ff00ff; font-weight: bold; }
        `,
        customSiteTitle: 'Game Backlog API Docs',
    }));
 
    // Separate endpoint for JSON schema (useful for Postman / Insomnia import)
    app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
 
    console.log('📖 Swagger UI: http://localhost:3000/api-docs');
    console.log('📄 OpenAPI JSON: http://localhost:3000/api-docs.json');
}
 
module.exports = { setupSwagger };