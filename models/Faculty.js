const mongoose = require("mongoose");

const facultySchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  department: String,
  contact: String,
  bio: String,
});

module.exports = mongoose.model("Faculty", facultySchema);