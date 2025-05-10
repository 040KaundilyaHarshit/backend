const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Optional, if you want to show who posted it
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date, // Optional field to auto-hide notices after a date
  },
  targetRoles: {
    type: [String], // ["student", "content_admin", "admin"]
    default: ["student", "content_admin", "admin"],
  },
});

module.exports = mongoose.model("Notice", noticeSchema);
