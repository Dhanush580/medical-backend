# Medico Backend

Express + MongoDB backend for the Medico (HealthConnect) frontend.

Folders:
- models: Mongoose models (User, Plan, Partner, Visit)
- controllers: route handlers
- routes: express routers
- middlewares: auth middleware
- config: database connection

.env required values (copy `.env.example` to `.env`):
- MONGODB_URI
- JWT_SECRET
- PORT (optional)

Scripts:
- npm run dev (requires nodemon)
- npm start

Endpoints:
- GET / -> health check
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me (requires Authorization: Bearer <token>)
- GET /api/plans
- GET /api/plans/:slug
- POST /api/plans
- POST /api/partners/verify
- POST /api/partners/visit
- GET /api/partners

File uploads
------------

Partner registration accepts multipart/form-data at POST /api/partners/register and stores uploaded files on local disk under `backend/uploads/partners/<partnerId>/`.

Uploaded fields handled: `passportPhoto` (single), `certificateFile` (single), `clinicPhotos` (multiple).

The Partner document stores relative paths to saved files in the fields `passportPhoto`, `certificateFile`, and `clinicPhotos`.

