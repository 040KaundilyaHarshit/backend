const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  details: { type: String },
  fee: { type: Number, required: true },
  contact: { type: String, required: true },
  requirement: { type: String, required: true },
  subjectCode: { type: String, required: true },
  assignedTo: { type: String, required: true }, // New field for content admin email
  programDescription: { type: String },
  image1: { type: String },
  image2: { type: String },
  vision: { type: String },
  mission: { type: String },
  yearsOfDepartment: { type: Number },
  syllabus: [
    {
      semester: { type: String },
      subjects: [{ type: String }],
    },
  ],
  programEducationalObjectives: [{ type: String }],
  programOutcomes: [{ type: String }],
  programType: {
    type: String,
    enum: ["UG", "PG",null],
    default: null,
  },
});

module.exports = mongoose.model("Course", courseSchema, "courses");