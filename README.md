# Collaborative Drawing Board Application

A real-time collaborative drawing application built with React, Vite, PouchDB, and Firebase. Users can create, share, and collaborate on drawing boards in real-time.

## Features

- Real-time collaborative drawing
- User authentication
- Shareable drawing boards
- Offline support with PouchDB
- Multi-tenant architecture
- Modern UI with Tailwind CSS

## Prerequisites

- Node.js (v18+) or Bun (v1.0+)
- Docker and Docker Compose (for containerized setup)

## Tech Stack

- Frontend: React 18 with TypeScript
- Build Tool: Vite
- Database: PouchDB (local) + CouchDB (remote sync)
- Authentication: Firebase
- UI Components: React Konva
- Styling: Tailwind CSS

## Local Development Setup

### Using Node.js

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Using Bun

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

The application will be available at `http://localhost:5173`

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_COUCHDB_URL=your_couchdb_url
```

## Docker Setup

The application can be run using Docker and Docker Compose. This setup includes both the frontend application and a CouchDB instance for data synchronization.

### Build and Run

```bash
# Build and start containers
docker-compose up -d

# Stop containers
docker-compose down
```

The application will be available at `http://localhost:8080`

## Production Build

```bash
# Create production build
npm run build
# or
bun run build

# Preview production build
npm run preview
# or
bun run preview
```

## Project Structure

```
src/
├── components/      # React components
├── contexts/        # React contexts
├── services/        # Database and API services
├── types/          # TypeScript type definitions
└── ...
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License
