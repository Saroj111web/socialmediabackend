const mongoose = require("mongoose");

// Define the schema for messages
const messageSchema = new mongoose.Schema(
      {
            // The chat this message belongs to
            chatId: {
                  type: mongoose.Schema.Types.ObjectId,
                  ref: "Chat", // Reference to Chat model
                  required: true
            },

            // The sender of the message
            sender: {
                  type: mongoose.Schema.Types.ObjectId,
                  ref: "User", // Reference to User model
                  required: true
            },

            // The actual text content of the message
            content: {
                  type: String,
                  required: true
            },

            // Overall status of the message (useful for simple tracking)
            status: {
                  type: String,
                  enum: ["sent", "delivered", "seen"], // Allowed states
                  default: "sent",
            },

            // ✅ Delivery status for each user in the chat
            deliveryStatus: [
                  {
                        user: {
                              type: mongoose.Schema.Types.ObjectId,
                              ref: "User" // Reference to User model (so we can populate it)
                        },
                        status: {
                              type: String,
                              enum: ["sent", "delivered", "seen"], // State for this specific user
                              default: "sent",
                        },
                        deliveredAt: { type: Date }, // Timestamp when delivered
                        seenAt: { type: Date },      // Timestamp when seen
                  },
            ],
      },
      { timestamps: true } // Adds createdAt and updatedAt automatically
);

// Create the model
const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
