# DMS — Drawing Management System for Power Plant Operations

A full-stack web application for managing engineering drawings across power plant departments and components.

## Features

- **Role-based access control**: Admin, Supervisor, and Plant Operator interfaces
- **User lifecycle management**: Create, edit, deactivate users with role/department assignments
- **Department management**: Civil, Mechanical, Electrical, Instrumentation, Chemical
- **Plant & Component management**: Hierarchical plant → component structure
- **Drawing lifecycle**: Upload PDF drawings, edit metadata, archive, delete
- **Grouped views**: Browse drawings grouped by plant component
- **Search & filter**: Filter drawings by plant, department, component, status, or keyword
- **PDF viewer**: In-browser PDF viewing with authenticated download

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router v6, Axios |
| Backend | Node.js, Express 4 |
| Database | MySQL 8 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| File Upload | Multer (PDF only, 50 MB limit) |

## Project Structure

```
DMS/
├── client/          # React frontend (Vite)
│   ├── src/
│   │   ├── context/     # Auth context (JWT, roles)
│   │   ├── services/    # Axios API client
│   │   ├── components/  # Layout, PrivateRoute
│   │   └── pages/       # Login, Dashboard, Drawings, Admin pages
│   └── .env.example
├── server/          # Express REST API
│   ├── src/
│   │   ├── config/      # MySQL connection pool
│   │   ├── middleware/  # JWT auth, Multer upload
│   │   └── routes/      # auth, users, departments, plants, components, drawings
│   ├── uploads/         # PDF storage (git-ignored)
│   ├── init.sql         # Database schema + seed data
│   └── .env.example
└── README.md
```

## Setup

### Prerequisites
- Node.js 18+
- MySQL 8.0+

### 1. Database

```bash
# Log into MySQL and run the init script
mysql -u root -p < server/init.sql
```

This creates the `dms_db` database with schema and seed data (departments, plants, components).

### 2. Backend

```bash
cd server
cp .env.example .env
# Edit .env — set DB_PASSWORD and JWT_SECRET
npm install
npm run dev     # development (nodemon)
# or
npm start       # production
```

The API server starts on **http://localhost:5000**.

### 3. Frontend

```bash
cd client
cp .env.example .env    # optional, defaults to http://localhost:5000/api
npm install
npm run dev             # development
# or
npm run build && npx serve dist   # production preview
```

The frontend dev server starts on **http://localhost:5173**.

### 4. Create Admin User

After starting the server, register the first admin:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@plant.com","password":"Admin123!","role":"admin"}'
```

> **Note:** The first `POST /api/auth/register` call is open. Subsequent registrations require an `admin` JWT.

## API Overview

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | `/api/auth/login` | Login, get JWT | Public |
| POST | `/api/auth/register` | Register user | Admin (or first user) |
| GET | `/api/auth/me` | Current user | Authenticated |
| GET | `/api/users` | List users | Admin, Supervisor |
| POST/PUT/DELETE | `/api/users` | Manage users | Admin |
| GET | `/api/departments` | List departments | Authenticated |
| POST/PUT/DELETE | `/api/departments` | Manage departments | Admin |
| GET | `/api/plants` | List plants | Authenticated |
| GET | `/api/plants/:id/components` | Components in plant | Authenticated |
| POST/PUT/DELETE | `/api/plants` | Manage plants | Admin |
| GET | `/api/components` | List components | Authenticated |
| POST/PUT | `/api/components` | Manage components | Admin, Supervisor |
| DELETE | `/api/components/:id` | Delete component | Admin |
| GET | `/api/drawings` | List/filter drawings | Authenticated |
| GET | `/api/drawings/by-component` | Drawings grouped by component | Authenticated |
| POST | `/api/drawings` | Upload drawing (PDF) | Admin, Supervisor |
| PUT | `/api/drawings/:id` | Update drawing metadata | Admin, Supervisor |
| DELETE | `/api/drawings/:id` | Delete drawing | Admin, Supervisor |
| GET | `/api/drawings/:id/download` | Download PDF | Authenticated |

## User Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access: manage users, departments, plants, components, drawings |
| **Supervisor** | Manage drawings and components in their department |
| **Operator** | Browse, search, and view/download drawings |

## Environment Variables

### Server (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | API server port |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | *(required)* | MySQL password |
| `DB_NAME` | `dms_db` | Database name |
| `JWT_SECRET` | *(required)* | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | `24h` | Token expiry |

### Client (`client/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:5000/api` | Backend API URL |
