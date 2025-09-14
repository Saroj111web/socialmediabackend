const auth = require("../middleware/auth");
const Chat = require('../models/chats');
const Message = require('../models/messages'); // you forgot to require this
const router = require('express').Router();

// Get all chats
router.get("/", auth, async (req, res) => {
      const userId = req.user._id;

      const chats = await Chat.find({ participants: userId })
            .populate("participants", "_id username")
            .populate({
                  path: "lastMessage",
                  select: "sender content createdAt",
                  populate: {
                        path: "sender",
                        select: "username",
                  }
            })
            .sort({ updatedAt: -1 });

      return res.json({ chats });
});

// Get messages in a chat with pagination
router.get("/:chatId/messages", auth, async (req, res) => {
      const { chatId } = req.params;

      let { page = 1, limit = 10 } = req.query;
      page = parseInt(page);
      limit = parseInt(limit);

      const messages = await Message.find({ chatId })
            .populate("sender", "_id username")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

      const hasPreviousMessages = messages.length === limit;

      res.json({ messages, hasPreviousMessages, page, limit });
});

// Create chat
router.post("/createchat", auth, async (req, res) => {
      const userId = req.user._id;
      const { receiverId } = req.body; // ✅ fixed destructuring

      if (!receiverId) {
            return res.status(400).json({ message: "Receiver required!" });
      }

      let chat = await Chat.findOne({ // ✅ use Chat model
            participants: { $all: [userId, receiverId], $size: 2 }
      });

      if (!chat) {
            chat = new Chat({
                  participants: [userId, receiverId]
            });
            await chat.save();
      }

      res.status(201).json(chat);
});

// Send message in chat
router.post("/sendMessages", auth, async (req, res) => {
      const userId = req.user._id;
      // const { chatId } = req.params;
      const { content, chatId } = req.body;

      if (!content) {
            return res.status(400).json({ message: "Content (message text) is required!" });
      }

      const chat = await Chat.findById(chatId);
      if (!chat || !chat.participants.includes(userId)) {
            return res.status(403).json({ message: "Access denied!" });
      }

      const newMessage = new Message({
            chatId: chat._id,
            sender: userId,
            content
      });
      await newMessage.save();

      chat.lastMessage = newMessage._id;
      await chat.save();
      const populateMessage = await Message.findById(newMessage._id).populate(
            "sender",
            "_id username"
      );
      return res.status(201).json({ newMessage: populateMessage });
});

router.post("/createGroup", auth, async (req, res) => {
      const userId = req.user._id;
      const { participants, groupName } = req.body; // ✅ fixed destructuring

      if (!participants)
            return res.status(400).json({ message: "Participants are required!" });
      const chat = new Chat({
            participants: [...participants, userId],
            groupName: groupName,
            isGroup: true,
            admins: [userId],
      });
      await chat.save();

      res.status(201).json(chat);
});

module.exports = router;
