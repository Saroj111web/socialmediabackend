const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      replies: [
            {
                  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                  text: { type: String, required: true },
                  createdAt: { type: Date, default: Date.now },
            }
      ]
});

const postSchema = new mongoose.Schema(
      {
            user: {
                  type: mongoose.Schema.Types.ObjectId,
                  ref: "User", // ✅ must be string (your model name), not variable
                  required: true,
            },
            media: [
                  {
                        name: { type: String, required: true },
                        mediaType: { type: String, enum: ["image", "video"], required: true }
                  }
            ],
            caption: { type: String },
            image: {
                  type: String,
            },
            likes: [
                  {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User", // ✅ corrected
                  },
            ],
            tags: [{ type: String }],
            location: { type: String },
            comments: [commentSchema],
      },
      {
            timestamps: true,
      }
);

const Post = mongoose.model("Post", postSchema);

module.exports = Post;
