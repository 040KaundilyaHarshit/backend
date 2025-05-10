const mongoose = require("mongoose");

const formSchema = new mongoose.Schema({
  courseId: {
    type: String,
    required: true,
    unique: true,
  },
  programType: {
    type: String,
    enum: ["UG", "PG"],
    default: null,
  },
  educationFields: {
    tenth: { type: Boolean, default: false },
    twelth: { type: Boolean, default: false },
    ug: { type: Boolean, default: false },
    pg: { type: Boolean, default: false },
  },
  sections: [
    {
      name: { type: String, required: true },
      fields: [
        {
          name: { type: String, required: true },
          type: { type: String, enum: ["text", "number", "date"], required: true },
          required: { type: Boolean, default: false },
        },
      ],
    },
  ],
  requiredAcademicFields: {
    type: [String],
    enum: ["tenth", "twelth", "graduation", "postgraduate"],
    default: [],
  },
  requiredAcademicSubfields: {
    tenth: {
      percentage: { type: Boolean, default: false },
      yearOfPassing: { type: Boolean, default: false },
      board: { type: Boolean, default: false },
      schoolName: { type: Boolean, default: false },
      customFields: [
        {
          name: { type: String, required: true },
          label: { type: String, required: true },
          type: { type: String, enum: ["text", "number", "date", "dropdown"], required: true },
          required: { type: Boolean, default: false },
          options: [{ type: String }], // Added options for dropdown
        },
      ],
    },
    twelth: {
      percentage: { type: Boolean, default: false },
      yearOfPassing: { type: Boolean, default: false },
      board: { type: Boolean, default: false },
      schoolName: { type: Boolean, default: false },
      customFields: [
        {
          name: { type: String, required: true },
          label: { type: String, required: true },
          type: { type: String, enum: ["text", "number", "date", "dropdown"], required: true },
          required: { type: Boolean, default: false },
          options: [{ type: String }], // Added options for dropdown
        },
      ],
    },
    graduation: {
      percentage: { type: Boolean, default: false },
      yearOfPassing: { type: Boolean, default: false },
      university: { type: Boolean, default: false },
      collegeName: { type: Boolean, default: false },
      customFields: [
        {
          name: { type: String, required: true },
          label: { type: String, required: true },
          type: { type: String, enum: ["text", "number", "date", "dropdown"], required: true },
          required: { type: Boolean, default: false },
          options: [{ type: String }], // Added options for dropdown
        },
      ],
    },
    postgraduate: {
      percentage: { type: Boolean, default: false },
      yearOfPassing: { type: Boolean, default: false },
      university: { type: Boolean, default: false },
      collegeName: { type: Boolean, default: false },
      customFields: [
        {
          name: { type: String, required: true },
          label: { type: String, required: true },
          type: { type: String, enum: ["text", "number", "date", "dropdown"], required: true },
          required: { type: Boolean, default: false },
          options: [{ type: String }], // Added options for dropdown
        },
      ],
    },
  },
  requiredDocuments: {
    type: [String],
    enum: [
      "10th Marksheet",
      "12th Marksheet",
      "Graduation Marksheet",
      "Postgraduate Marksheet",
      "Aadhaar",
      "PAN",
      "Driving License",
      "Image (Passport Photo)",
      "Signature",
    ],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Form", formSchema);