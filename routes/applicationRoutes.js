const express = require("express");
const router = express.Router();
const ApplicationForm = require("../models/ApplicationForm");
const Course = require("../models/Course");
const { auth, authorize } = require("../middleware/auth");
const { body, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "Uploads/applications";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
  fileFilter: (req, file, cb) => {
    console.log("File received:", file); // Log incoming files for debugging
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG, PNG, and PDF files are allowed"));
  },
});

// Dynamic multer middleware to set max file count based on programType
const dynamicUpload = (req, res, next) => {
  const maxFiles = req.body.programType === "UG" ? 10 : 10; // Allow up to 10 files for testing
  upload.array("documents", maxFiles)(req, res, next);
};

// Middleware to log request details
const logRequest = (req, res, next) => {
  console.log("Received files:", req.files);
  console.log("Received body:", req.body);
  next();
};

// Error handling middleware for Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("Multer error:", err);
    return res.status(400).json({
      message: `File upload error: ${err.message}`,
      field: err.field || "unknown",
      code: err.code,
    });
  }
  next(err);
};

// Save draft application
router.post(
  "/save-draft",
  auth,
  authorize(["student"]),
  dynamicUpload,
  handleMulterError,
  logRequest,
  [
    body("courseId").notEmpty().withMessage("Course ID is required"),
    body("studentId").notEmpty().withMessage("Student ID is required"),
    body("formData").custom((value) => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        throw new Error("Form data must be a valid JSON object");
      }
    }),
    body("educationDetails").custom((value) => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        throw new Error("Education details must be a valid JSON object");
      }
    }),
    body("programType").isIn(["UG", "PG"]).withMessage("Program type must be UG or PG"),
    body("lastActiveSection").isInt({ min: 0 }).withMessage("Last active section must be a non-negative integer"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { courseId, studentId, programType, lastActiveSection } = req.body;
      const formData = JSON.parse(req.body.formData);
      const educationDetails = JSON.parse(req.body.educationDetails);

      // Check if the course exists
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Process uploaded files (if any)
      let documents = [];
      if (req.files && req.files.length > 0) {
        documents = req.files.map((file, index) => {
          if (!formData.documents[index]?.type) {
            throw new Error(`Document type missing for file at index ${index}`);
          }
          return {
            type: formData.documents[index].type,
            filename: file.filename,
            path: file.path,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          };
        });
      }
      formData.documents = documents;

      // Check for existing draft or submitted application
      let application = await ApplicationForm.findOne({ studentId, courseId });
      if (application && application.status !== "draft") {
        return res.status(400).json({ message: "An application for this course has already been submitted" });
      }

      if (application) {
        // Update existing draft
        application.formData = formData;
        application.educationDetails = educationDetails;
        application.programType = programType;
        application.lastActiveSection = lastActiveSection;
        application.status = "draft";
      }  else {
        // Create new draft
        application = new ApplicationForm({
          courseId,
          studentId,
          formData,
          educationDetails,
          programType,
          lastActiveSection,
          status: "draft",
        });
      }

      await application.save();
      res.status(200).json({ message: "Draft saved successfully" });
    } catch (error) {
      console.error("Error saving draft:", error);
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ message: `File upload error: ${error.message}` });
      }
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Submit application (Only authenticated students)
router.post(
  "/submit-application",
  auth,
  authorize(["student"]),
  dynamicUpload, // Use dynamic upload middleware
  handleMulterError, // Handle Multer errors
  logRequest, // Log request details
  [
    body("courseId").notEmpty().withMessage("Course ID is required"),
    body("studentId").notEmpty().withMessage("Student ID is required"),
    body("formData").custom((value) => {
      try {
        const parsed = JSON.parse(value);
        if (!parsed.aadhaarNumber || !/^\d{12}$/.test(parsed.aadhaarNumber)) {
          throw new Error("Valid 12-digit Aadhaar number is required");
        }
        if (!parsed.email || !/\S+@\S+\.\S+/.test(parsed.email)) {
          throw new Error("Valid email is required");
        }
        return true;
      } catch {
        throw new Error("Form data must be a valid JSON object");
      }
    }),
    body("educationDetails").custom((value) => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        throw new Error("Education details must be a valid JSON object");
      }
    }),
    body("programType").isIn(["UG", "PG"]).withMessage("Program type must be UG or PG"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { courseId, studentId, programType } = req.body;
      const formData = JSON.parse(req.body.formData);
      const educationDetails = JSON.parse(req.body.educationDetails);

      // Additional checks for aadhaarNumber and email
      if (!formData.aadhaarNumber || !/^\d{12}$/.test(formData.aadhaarNumber)) {
        return res.status(400).json({ message: "Valid 12-digit Aadhaar number is required" });
      }
      if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
        return res.status(400).json({ message: "Valid email is required" });
      }

      // Check if the course exists
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Process uploaded files
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }
      if (!formData.documents || !Array.isArray(formData.documents)) {
        return res.status(400).json({ message: "Documents array is missing or invalid" });
      }
      if (req.files.length !== formData.documents.length) {
        return res.status(400).json({
          message: `Expected ${formData.documents.length} files, but received ${req.files.length}`,
        });
      }

      const documents = req.files.map((file, index) => {
        if (!formData.documents[index]?.type) {
          throw new Error(`Document type missing for file at index ${index}`);
        }
        return {
          type: formData.documents[index].type,
          filename: file.filename,
          path: file.path,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        };
      });

      formData.documents = documents;

      // Check for existing application
      let application = await ApplicationForm.findOne({ studentId, courseId });
      if (application && application.status !== "draft") {
        return res.status(400).json({ message: "An application for this course has already been submitted" });
      }

      if (application) {
        // Update existing draft to submitted
        application.formData = formData;
        application.educationDetails = educationDetails;
        application.programType = programType;
        application.status = "pending";
        application.lastActiveSection = 0; // Reset on submission
      } else {
        // Create new application
        application = new ApplicationForm({
          courseId,
          studentId,
          formData,
          educationDetails,
          programType,
          status: "pending",
        });
      }

      await application.save();
      res.status(201).json({ message: "Application submitted successfully" });
    } catch (error) {
      console.error("Error submitting application:", error);
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ message: `File upload error: ${error.message}` });
      }
      if (error.name === "ValidationError") {
        const validationErrors = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json({ message: "Validation error", errors: validationErrors });
      }
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Get submitted or draft application for a student
router.get("/get-application/:studentId/:courseId", auth, async (req, res) => {
  try {
    const { studentId, courseId } = req.params;

    // Check if the course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Fetch the application (draft or submitted)
    const application = await ApplicationForm.findOne({ studentId, courseId });
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.status(200).json(application);
  } catch (error) {
    console.error("Error fetching application:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Serve uploaded files
router.get("/uploads/applications/:filename", auth, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "..", "Uploads", "applications", filename);
    console.log(`Attempting to serve file at: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`File not found at ${filePath}`);
      return res.status(404).json({ message: "File not found" });
    }

    console.log(`Serving file: ${filePath}`);
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error("Error sending file:", err);
        res.status(500).json({ message: "Error serving file" });
      }
    });
  } catch (error) {
    console.error("Error serving file:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;