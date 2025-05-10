const mongoose = require("mongoose");

const ApplicationFormSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course ID is required"],
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student ID is required"],
    },
    formData: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Form data is required"],
      validate: {
        validator: function (v) {
          // Relax validation for draft forms
          if (this.status === "draft") return true;
          if (!v.documents || !Array.isArray(v.documents)) return false;
          return v.documents.every((doc) =>
            doc.type &&
            doc.filename &&
            doc.path &&
            doc.originalName &&
            doc.mimetype &&
            doc.size
          );
        },
        message: "Documents must include type, filename, path, originalName, mimetype, and size for submitted forms",
      },
    },
    educationDetails: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Education details are required"],
    },
    programType: {
      type: String,
      enum: ["UG", "PG"],
      required: [true, "Program type is required"],
    },
    assignedOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["draft", "pending", "rejected", "verified"],
      default: "draft", // Default to draft for partial forms
    },
    lastActiveSection: {
      type: Number,
      default: 0, // Store the last active section index
    },

    //comments passed by verification officer
    fieldComments: {
      type: Map,
      of: String,
      default: {},
    },
    commentsRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

ApplicationFormSchema.index({ courseId: 1 });
ApplicationFormSchema.index({ studentId: 1 });

const ApplicationForm = mongoose.model("ApplicationForm", ApplicationFormSchema);
module.exports = ApplicationForm;