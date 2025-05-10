const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["student", "admin", "content_admin", "faculty", "verification_admin", "verification_officer"],
    default: "student",
  },
  verified: { type: Boolean, default: false },

  // Extra fields for faculty
  department: String,
  contact: String,
  bio: String,

  // Basic profile information
  profileImage: { type: String, default: null },
  registrationNumber: { type: String, default: null },
  phoneNumber: { type: String, default: null },

  // Academic information
  cgpa: { type: Number, default: 0 },
  lastGpa: { type: Number, default: 0 },
  semester: { type: Number, default: 1 },

  // Course information (multiple courses)
  courses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course"
  }],
  // Legacy field for backward compatibility
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    default: null,
  },

  // Dashboard data
  dashboardData: {
    courses: { type: [String], default: [] },
    cgpa: { type: String, default: "" },
    lastGpa: { type: String, default: "" },
    assignments: { type: [String], default: [] },
    schedule: { type: [String], default: [] },
    announcements: { type: String, default: "" },
    activity: { type: String, default: "" },
  },

  schedule: [{
    day: { type: String },
    time: { type: String },
    course: { type: String },
    location: { type: String }
  }],

  announcements: [{
    title: { type: String },
    message: { type: String },
    date: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
  }],

  activities: [{
    type: { type: String },
    description: { type: String },
    date: { type: Date, default: Date.now }
  }],


  // Add this field to User.js schema
verifiedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null,
},


  // Officer assignment field - which officer is assigned to this student
  // assignedOfficer: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "User",
  //   default: null,
  // },


  // Payment history
  payments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payment",
  }],
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);