// Load environment variables from .env file
require('dotenv').config()

// Import required modules
const express = require('express')
const { Server } = require('socket.io')
const http = require('http')

// Initialize express app
const app = express()

// Render provides its own PORT in process.env.PORT
// Fallback to 3000 when running locally
const PORT = process.env.PORT || 3000

// Create HTTP server to work with both Express and Socket.io
const server = http.createServer(app)

// Initialize Socket.io server with CORS enabled
const io = new Server(server, {
      cors: {
            origin: "*",            // Allow all origins (adjust if needed for security)
            methods: ["GET", "POST"] // Allow GET and POST requests
      }
});

// Import startup configurations
// Database connection
require('./start-ups/db')()

// Production-related middleware (helmet, compression, etc.)
require('./start-ups/prod')(app)

// Routes setup
require('./start-ups/routes')(app)

// Socket.io event handling
require('./start-ups/socket')(io)

// Start server
// IMPORTANT: Use "0.0.0.0" instead of default localhost
// This allows Render (and other hosting platforms) to detect and access the port
server.listen(PORT, "0.0.0.0", () => {
      console.log(` Server is running on port ${PORT}...`)
})
