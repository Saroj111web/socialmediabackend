const mongoose = require('mongoose')

const ChatSchema = new mongoose.Schema({
      participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      lastMessage: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
      isGroup: { type: Boolean, default: false },
      admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      groupName: { type: String },
      groupImage: { type: String }
}, { timestamps: true });

const Chat = mongoose.model("Chat", ChatSchema)

module.exports = Chat