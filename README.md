# Flappy Bird Clone

A fully functional Flappy Bird clone built with React and Canvas 2D rendering.

## Play

- **Desktop**: Press Space, Up Arrow, or click to flap
- **Mobile**: Tap anywhere to flap

## Features

- Classic Flappy Bird gameplay with authentic physics
- Bird physics: gravity, flap impulse, terminal velocity, rotation
- Randomly generated pipe obstacles with variable gap positions
- Accurate collision detection for pipes, ground, and ceiling
- Score tracking with best score persistence (localStorage)
- Web Audio API sound effects (flap, score, hit, die)
- Mute/unmute toggle with preference persistence
- High-DPI display support
- Parallax scrolling ground
- Responsive design

## Game States

- **READY**: Start screen with instructions
- **PLAYING**: Active gameplay
- **GAME OVER**: Final score display with best score

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for development and building
- HTML5 Canvas 2D for game rendering
- Tailwind CSS for styling

### Backend
- Express.js with TypeScript
- Node.js runtime

## Project Structure

```
/client
  /src
    /components
      FlappyBird.tsx    # Main game component
    App.tsx             # Root component
/server
  index.ts              # Express server
  routes.ts             # API routes
/shared
  schema.ts             # Shared types
```

## Running Locally

```bash
npm install
npm run dev
```

The game will be available at http://localhost:5000

## Controls

| Input | Action |
|-------|--------|
| Space | Flap |
| Up Arrow | Flap |
| Mouse Click | Flap |
| Touch | Flap |

## Physics Constants

The game physics can be tuned by modifying constants in `FlappyBird.tsx`:

- `GRAVITY`: 0.5 (pixels per frame squared)
- `FLAP_IMPULSE`: -8 (upward velocity on flap)
- `TERMINAL_VELOCITY`: 12 (max falling speed)
- `PIPE_SPEED`: 3 (horizontal movement speed)
- `PIPE_GAP`: 150 (vertical gap between pipes)
