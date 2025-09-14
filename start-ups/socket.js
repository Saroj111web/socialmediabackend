const jwt = require('jsonwebtoken')

const Chat = require('../models/chats')
const Message = require('../models/messages')

module.exports = function (io) {
      const onlineUsers = new Map()

      // socket.io middleware to authenticate user with JWT
      io.use((socket, next) => {
            const token = socket.handshake.auth.token
            if (!token) {
                  return next(new Error("Authentication error token required!"))
            }
            try {
                  const user = jwt.verify(token, process.env.JWT_KEY)
                  socket.user = user
                  console.log("Socket user", socket.user)
                  next();
            } catch (error) {
                  return next(new Error("Authentication error token required!"))
            }
      })


      io.on("connection", (socket) => {
            console.log("A user connected")
            const userId = socket.user._id

            // send back user data on connection
            socket.emit("userData", socket.user);

            if (!onlineUsers.has(userId)) {
                  onlineUsers.set(userId, new Set())
            }
            onlineUsers.get(userId).add(socket.id)

            console.log("online users", onlineUsers)

            // mark all private (1-to-1) messages as delivered
            socket.on("markMessagesAsDelivered", async () => {
                  // Find all the chat messages in which our user is available
                  const chatIds = await Chat.find({
                        participants: userId,
                        isGroup: false
                  }).distinct('_id')

                  const undeliveredmessages = await Message.find({
                        chatId: { $in: chatIds },
                        status: 'sent',
                        sender: { $ne: userId }
                  }).select("_id chatId sender")

                  if (undeliveredmessages.length > 0) {
                        await Message.updateMany(
                              { _id: { $in: undeliveredmessages.map((msg) => msg._id) } },
                              { $set: { status: "delivered" } }
                        )
                  }

                  // step1: Group chatId's by sender
                  const groupChatIds = undeliveredmessages.reduce((acc, msg) => {
                        if (!acc[msg.sender]) {
                              acc[msg.sender] = new Set()
                        }
                        acc[msg.sender].add(msg.chatId.toString())
                        return acc
                  }, {})

                  // convert Set to array
                  for (const sender in groupChatIds) {
                        groupChatIds[sender] = [...groupChatIds[sender]]
                  }

                  // step2: send event to online users only
                  for (const sender in groupChatIds) {
                        const sockets = onlineUsers.get(sender)   // use sender instead of senderId
                        if (sockets) {
                              sockets.forEach((socketId) => {
                                    io.to(socketId).emit("messageStatusUpdated", { chatIds });
                              });
                        }
                  }
            })

            // mark all group messages as delivered
            socket.on("markGroupMessagesAsDelivered", async () => {
                  const chatIds = await Chat.find({
                        participants: userId,
                        isGroup: true
                  }).distinct("_id")

                  const undeliveredMessage = await Message.find({
                        chatId: { $in: chatIds },
                        sender: { $ne: userId },
                        deliveryStatus: {
                              $elemMatch: {
                                    user: userId,
                                    status: "sent"
                              }
                        }
                  }).select("_id chatId sender deliveryStatus")

                  if (undeliveredMessage.length > 0) {
                        for (const message of undeliveredMessage) {
                              await Message.updateOne(
                                    { _id: message._id, "deliveryStatus.user": userId },
                                    {
                                          $set: {
                                                "deliveryStatus.$.status": "delivered",
                                                "deliveryStatus.$.deliveredAt": new Date(),
                                          }
                                    })
                        }

                        // step1: Group chatId's by sender
                        // ❌ FIX: was `undeliveredmessages` (undefined), corrected to `undeliveredMessage`
                        const groupChatIds = undeliveredMessage.reduce((acc, msg) => {
                              if (!acc[msg.sender]) {
                                    acc[msg.sender] = new Set()
                              }
                              acc[msg.sender].add(msg.chatId.toString())
                              return acc
                        }, {})

                        // convert Set to array
                        for (const sender in groupChatIds) {
                              groupChatIds[sender] = [...groupChatIds[sender]]
                        }

                        // step2: send event to online users only
                        for (const sender in groupChatIds) {
                              const sockets = onlineUsers.get(sender)
                              if (sockets) {
                                    sockets.forEach((socketId) => {
                                          io.to(socketId).emit("messageStatusUpdated", { chatIds });
                                    });
                              }
                        }
                  }
            })

            // mark 1-to-1 messages as seen
            socket.on("markMessagesAsSeen", async (chatId) => {
                  const unSeenMessages = await Message.find({
                        chatId: chatId,
                        sender: { $ne: userId },
                        status: "delivered",
                  }).select("_id sender")

                  if (unSeenMessages.length > 0) {
                        await Message.updateMany({
                              chatId: chatId,
                              sender: { $ne: userId },
                              status: "delivered"
                        }, { $set: { status: "seen" } })

                        const senderIds = [...new Set(unSeenMessages.map((msg) => msg.sender.toString()))]

                        for (const sender of senderIds) {
                              const sockets = onlineUsers.get(sender)
                              if (sockets) {
                                    sockets.forEach(socketId => {
                                          io.to(socketId).emit("messageSeen", {
                                                chatId: chatId,
                                                seenBy: userId
                                          })
                                    })
                              }
                        }
                  }
            })

            // mark group messages as seen
            socket.on("markGroupMessagesAsSeen", async (chatId) => {
                  const unseenMessages = await Message.find({
                        chatId: chatId,
                        sender: { $ne: userId },
                        deliveryStatus: {
                              $elemMatch: {
                                    user: userId,
                                    status: { $ne: "seen" },
                              }
                        }
                  }).select("_id chatId sender deliveryStatus")

                  if (unseenMessages.length > 0) {
                        for (const message of unseenMessages) {
                              await Message.updateOne(
                                    { _id: message._id, "deliveryStatus.user": userId },
                                    {
                                          $set: {
                                                "deliveryStatus.$.status": "seen",
                                                "deliveryStatus.$.seenAt": new Date(),
                                          }
                                    })
                        }
                  }

                  // ❌ FIX: was using `unSeenMessages` (undefined), corrected to `unseenMessages`
                  const senderIds = [...new Set(unseenMessages.map((msg) => msg.sender.toString()))]

                  for (const sender of senderIds) {
                        const sockets = onlineUsers.get(sender)
                        if (sockets) {
                              sockets.forEach(socketId => {
                                    io.to(socketId).emit("messageSeen", {
                                          chatId: chatId,
                                          seenBy: userId
                                    })
                              })
                        }
                  }
            })

            // join chat room
            socket.on("joinRoom", (chatId) => {
                  socket.join(chatId)
                  console.log(`User ${socket.id} joined room: ${chatId}`)
            })

            // typing indicator
            socket.on("typing", ({ chatId }) => {
                  socket.to(chatId).emit("showTyping", `${socket.user.username} is typing...`)
            })

            socket.on("stopTyping", ({ chatId }) => {
                  socket.to(chatId).emit("hideTyping", socket.user.username)
            })

            // send message event
            socket.on("sendMessage", async ({ chatId, content }) => {
                  const userId = socket.user._id;

                  if (!content) {
                        socket.emit("error in send message", "Content (message text) is required!")
                        return;
                  }

                  const chat = await Chat.findById(chatId);
                  if (!chat || !chat.participants.includes(userId)) {
                        socket.emit("error in send message", "access denied")
                        return;
                  }

                  const receipients = chat.participants.filter((id) => id.toString() != userId);

                  let deliveryStatus
                  if (chat.isGroup) {
                        deliveryStatus = receipients.map(user => {
                              const online = onlineUsers.has(user)
                              return {
                                    user: user,
                                    status: online ? new Date() : null
                              }
                        })
                  }

                  const newMessage = new Message({
                        chatId: chat._id,
                        sender: userId,
                        content,
                        status: onlineUsers.has(receipients[0].toString()) ? 'delivered' : 'sent',
                        deliveryStatus: deliveryStatus
                  });
                  await newMessage.save();

                  chat.lastMessage = newMessage._id;
                  await chat.save();

                  const populateMessage = await Message.findById(newMessage._id)
                        .populate("sender", "_id username")
                        .populate("deliveryStatus.user", "_id username")

                  // emit message to room
                  io.to(chatId).emit("getMessage", populateMessage);
            });

            // disconnect event
            socket.on("disconnect", () => {
                  onlineUsers.get(userId).delete(socket.id)

                  if (onlineUsers.get(userId).size === 0) {
                        onlineUsers.delete(userId)
                  }

                  console.log("online users", onlineUsers)
            })
      })
}