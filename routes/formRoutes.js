const express = require("express");
const router = express.Router();
const Form = require("../models/Form");
const Course = require("../models/Course");
const { auth, authorize } = require("../middleware/auth");

// Save or update form structure (Only Content Admin)
router.post("/save-form-structure", auth, authorize(["content_admin"]), async (req, res) => {
  try {
    const { courseId, educationFields, sections, requiredAcademicFields, requiredAcademicSubfields, requiredDocuments, programType } = req.body;
    console.log("Received save-form-structure request:", req.body);

    // Validate inputs
    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    // Check if the course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Check if form structure exists
    let form = await Form.findOne({ courseId });
    if (form) {
      // Update existing form
      form.programType = programType || form.programType;
      form.educationFields = educationFields || form.educationFields;
      form.sections = sections || form.sections;
      form.requiredAcademicFields = requiredAcademicFields || form.requiredAcademicFields;
      form.requiredAcademicSubfields = requiredAcademicSubfields || form.requiredAcademicSubfields;
      form.requiredDocuments = requiredDocuments || form.requiredDocuments;
      await form.save();
      console.log("Updated form with subfields:", form.requiredAcademicSubfields);
      return res.status(200).json({ message: "Form structure updated successfully", form });
    }

    // Create new form structure
    form = new Form({
      courseId,
      programType,
      educationFields: educationFields || { tenth: false, twelfth: false, ug: false, pg: false },
      sections: sections || [],
      requiredAcademicFields: requiredAcademicFields || [],
      requiredAcademicSubfields: requiredAcademicSubfields || {
        tenth: {
          percentage: false,
          yearOfPassing: false,
          board: false,
          schoolName: false,
          customFields: [],
        },
        twelth: {
          percentage: false,
          yearOfPassing: false,
          board: false,
          schoolName: false,
          customFields: [],
        },
        graduation: {
          percentage: false,
          yearOfPassing: false,
          university: false,
          collegeName: false,
          customFields: [],
        },
        postgraduate: {
          percentage: false,
          yearOfPassing: false,
          university: false,
          collegeName: false,
          customFields: [],
        },
      },
      requiredDocuments: requiredDocuments || [],
    });
    await form.save();
    console.log("Created new form with subfields:", form.requiredAcademicSubfields);
    res.status(201).json({ message: "Form structure saved successfully", form });
  } catch (error) {
    console.error("Error saving form structure:", error);
    res.status(500).json({ message: "Server error while saving form structure", error: error.message });
  }
});

// Get form structure (Content Admin or Student)
// Get form structure (Content Admin or Student)
router.get("/get-form-structure/:courseId", auth, async (req, res) => {
  try {
    const courseId = req.params.courseId;
    console.log(`Fetching form structure for courseId: ${courseId}`);
    const form = await Form.findOne({ courseId });
    if (!form) {
      console.log(`No form found for courseId: ${courseId}`);
      return res.status(404).json({ message: "Form structure not found" });
    }

    // Return the full form structure for both content admins and students
    res.status(200).json({
      programType: form.programType,
      educationFields: form.educationFields || { tenth: false, twelfth: false, ug: false, pg: false },
      sections: form.sections || [],
      requiredAcademicFields: form.requiredAcademicFields || [],
      requiredAcademicSubfields: form.requiredAcademicSubfields || {
        tenth: {
          percentage: false,
          yearOfPassing: false,
          board: false,
          schoolName: false,
          customFields: [],
        },
        twelth: {
          percentage: false,
          yearOfPassing: false,
          board: false,
          schoolName: false,
          customFields: [],
        },
        graduation: {
          percentage: false,
          yearOfPassing: false,
          university: false,
          collegeName: false,
          customFields: [],
        },
        postgraduate: {
          percentage: false,
          yearOfPassing: false,
          university: false,
          collegeName: false,
          customFields: [],
        },
      },
      requiredDocuments: form.requiredDocuments || [],
    });
  } catch (error) {
    console.error("Error fetching form structure:", error);
    res.status(500).json({ message: "Server error while fetching form structure" });
  }
});

module.exports = router;