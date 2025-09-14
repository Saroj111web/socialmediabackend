require('dotenv').config()
const express = require('express')
const { Server } = require('socket.io')
const http = require('http')

const app = express()
const PORT = process.env.PORT || 3000
const server = http.createServer(app)
const io = new Server(server, {
      cors: {
            origin: "*",
            methods: ["GET", "POST"]
      }
});

require('./start-ups/db')()
require('./start-ups/prod')(app)
require('./start-ups/routes')(app)
require('./start-ups/socket')(io)


server.listen(PORT, () => console.log(`server is running on port ${PORT}...`))
