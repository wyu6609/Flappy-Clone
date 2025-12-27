# Flappy Bird Clone

## Overview

This is a fully functional Flappy Bird clone built as a full-stack web application. The game features classic Flappy Bird mechanics including bird physics with gravity and flap impulse, randomly generated pipe obstacles, collision detection, and score tracking with localStorage persistence. The project uses a React frontend with Canvas 2D rendering for the game graphics and an Express backend for serving the application.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with hot module replacement
- **Styling**: Tailwind CSS with CSS variables for theming
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **State Management**: Zustand with selector subscriptions for game state and audio state
- **Game Rendering**: HTML5 Canvas 2D API for all game graphics (bird, pipes, background, ground)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with tsx for TypeScript execution
- **Build Process**: esbuild for server bundling, Vite for client bundling
- **Development**: Vite dev server with HMR proxied through Express

### Project Structure
- `/client` - React frontend application
  - `/src/components` - React components including game and UI components
  - `/src/lib/stores` - Zustand stores for global state (useGame, useAudio)
- `/server` - Express backend
  - `routes.ts` - API route definitions
  - `storage.ts` - Data storage interface (currently in-memory)
  - `vite.ts` - Vite development server integration
- `/shared` - Shared code between client and server (schema definitions)

### Game Implementation
The game is implemented as a single React component (`FlappyBird.tsx`) using Canvas 2D for rendering. Key design decisions:
- Physics constants are defined at the top for easy tuning
- Game state managed through local component state for game-specific data
- Global state (Zustand) for cross-component concerns like audio muting
- Web Audio API for sound effects (generated programmatically, no external files)
- localStorage for persisting best score and audio preferences

### Data Storage
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema Location**: `/shared/schema.ts`
- **Current Implementation**: In-memory storage class with interface for future database migration
- **Database Config**: Drizzle Kit configured with `DATABASE_URL` environment variable

## External Dependencies

### Database
- PostgreSQL (via Drizzle ORM) - configured but using in-memory storage currently
- Schema migrations stored in `/migrations` directory

### Key Frontend Libraries
- `@tanstack/react-query` - Server state management
- `@radix-ui/*` - Accessible UI primitives
- `zustand` - Client state management
- `tailwindcss` - Utility-first CSS framework
- `lucide-react` - Icon library

### Key Backend Libraries
- `express` - Web server framework
- `drizzle-orm` - TypeScript ORM
- `connect-pg-simple` - PostgreSQL session store (available for session management)

### Build Tools
- `vite` - Frontend build and dev server
- `esbuild` - Server bundling for production
- `tsx` - TypeScript execution for development