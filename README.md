# SkyJo Online 🎴

A real-time multiplayer card game inspired by SkyJo, playable online with friends like Jackbox games!

## How to Play

1. **Create or Join a Game**: Enter your name and create a new game or join with a room code
2. **Share the Code**: Give the 4-letter code to friends so they can join
3. **Goal**: Get the **lowest score** by the end of the game

### Game Rules

- Each player has a 3x4 grid of 12 cards (face-down)
- Cards range from **-2** to **12**
- At the start, flip 2 cards to reveal them
- On your turn:
  - Draw from the **deck** or **discard pile**
  - Either **swap** it with any of your cards (reveals it)
  - Or **discard** it and flip one of your hidden cards
- **Match 3 cards** in a column to eliminate them (good!)
- When one player reveals all their cards, others get **one more turn**
- The player who ended the round gets **double points** if they don't have the lowest score

### Winning

- Rounds continue until someone reaches 100 points
- The player with the **lowest total score** wins!

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
cd skyjoonline
npm install
npm run dev
```

This starts:
- Frontend: http://localhost:5173
- Backend WebSocket server: http://localhost:3001

## Production Deployment

### Option 1: Docker (Recommended)

```bash
# Build and run with Docker Compose
npm run docker:up

# View logs
npm run docker:logs

# Stop
npm run docker:down
```

Or manually:

```bash
# Build the image
docker build -t skyjo-online .

# Run the container
docker run -d -p 3001:3001 --name skyjo skyjo-online
```

The app will be available at `http://localhost:3001`

### Option 2: Manual Build

```bash
# Build frontend and server
npm run build

# Start production server
npm start
```

### Reverse Proxy (nginx)

For production with a domain, use nginx:

```nginx
server {
    server_name skyjo.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Zustand
- **Backend**: Node.js, Express, Socket.IO
- **Styling**: CSS Modules with custom properties

## Features

- ✅ Real-time multiplayer with WebSockets
- ✅ Room-based sessions with shareable codes
- ✅ Automatic reconnection support
- ✅ Session persistence (rejoin if you refresh)
- ✅ Beautiful, responsive UI (mobile-first)
- ✅ Full SkyJo rules implementation
- ✅ Column matching elimination
- ✅ Score tracking across rounds
- ✅ TV/Display mode for spectators
- ✅ Background music toggle
- ✅ Host can kick players
- ✅ Docker support for easy deployment
