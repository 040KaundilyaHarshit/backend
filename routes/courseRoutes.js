const express = require("express");
const CourseModel = require("../models/Course");
const FormModel = require("../models/Form");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

// Fetch all courses (filtered for content admins by assignedTo email, requires authentication)
router.get("/", auth, async (req, res) => {
  try {
    let courses;
    if (req.user.role === "content_admin") {
      // Filter courses where assignedTo matches the content admin's email
      courses = await CourseModel.find({ assignedTo: req.user.email });
    } else if (req.user.role === "admin" || req.user.role === "student" || req.user.role === "verification_admin") {
      // Return all courses for admins and students
      courses = await CourseModel.find();
    } else {
      return res.status(403).json({ message: "Access denied. Invalid role." });
    }
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ message: "Error fetching courses", error: error.message });
  }
});

// Fetch a course by ID (no auth required)
router.get("/:courseId", async (req, res) => {
  const { courseId } = req.params;

  try {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json(course);
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ message: "Error fetching course", error: error.message });
  }
});

// Fetch course description (Content Admin only)
router.get("/:courseId/description", auth, authorize(["content_admin"]), async (req, res) => {
  const { courseId } = req.params;

  try {
    const course = await CourseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    if (course.assignedTo !== req.user.email) {
      return res.status(403).json({ message: "Access denied. You are not assigned to this course." });
    }

    res.status(200).json({
      title: course.title || "", // Added course title
      description: course.description || "", // Added course description
      programDescription: course.programDescription || "",
      image1: course.image1 || "",
      image2: course.image2 || "",
      vision: course.vision || "",
      mission: course.mission || "",
      yearsOfDepartment: course.yearsOfDepartment || "",
      syllabus: course.syllabus || [{ semester: "", subjects: [] }],
      programEducationalObjectives: course.programEducationalObjectives || [],
      programOutcomes: course.programOutcomes || [],
      programType: course.programType || "",
    });
  } catch (error) {
    console.error("Error fetching course description:", error);
    res.status(500).json({ message: "Error fetching course description", error: error.message });
  }
});

// Admin adds a course
router.post("/newCourse", auth, authorize(["admin"]), async (req, res) => {
  const { title, description, duration, fee, requirement, contact, subjectCode, assignedTo } = req.body;

  // Log the received data for debugging
  console.log("Received course data:", req.body);

  // Validate required fields
  const missingFields = [];
  if (!title?.trim()) missingFields.push("title");
  if (!description?.trim()) missingFields.push("description");
  if (!duration || isNaN(duration) || Number(duration) <= 0) missingFields.push("duration");
  if (!fee || isNaN(fee) || Number(fee) <= 0) missingFields.push("fee");
  if (!requirement?.trim()) missingFields.push("requirement");
  if (!contact?.trim()) missingFields.push("contact");
  if (!subjectCode?.trim()) missingFields.push("subjectCode");
  if (!assignedTo?.trim()) missingFields.push("assignedTo");

  if (missingFields.length > 0) {
    console.log("Missing or invalid fields:", missingFields);
    return res.status(400).json({
      message: "All fields are required",
      missingFields,
    });
  }

  try {
    // Create new course with validated data, omitting programType to use schema default
    const newCourse = new CourseModel({
      title: title.trim(),
      description: description.trim(),
      duration: Number(duration),
      fee: Number(fee),
      requirement: requirement.trim(),
      contact: contact.trim(),
      subjectCode: subjectCode.trim(),
      assignedTo: assignedTo.trim(),
    });

    // Log the newCourse object to confirm programType is not set
    console.log("newCourse object before save:", newCourse.toObject());

    // Save the course
    await newCourse.save();
    console.log("New course saved:", newCourse);

    res.status(201).json({
      message: "Course added successfully",
      newCourse,
    });
  } catch (error) {
    console.error("Error adding course:", error);
    // Log detailed validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => err.message);
      console.log("Validation errors:", validationErrors);
      return res.status(400).json({
        message: "Validation error",
        errors: validationErrors,
      });
    }
    // Handle duplicate key errors (e.g., unique subjectCode if enforced)
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Duplicate field value",
        field: Object.keys(error.keyValue)[0],
      });
    }
    // Generic error
    res.status(500).json({
      message: "Error adding course",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Edit a course (Admin only)
router.put("/:courseId", auth, authorize(["admin"]), async (req, res) => {
  const { courseId } = req.params;
  const { title, description, duration, fee, requirement, contact, subjectCode, assignedTo } = req.body;

  // Log request body for debugging
  console.log("PUT /api/courses/:courseId - Request Body:", req.body);

  // Check for missing fields
  const missingFields = [];
  if (!title) missingFields.push("title");
  if (!description) missingFields.push("description");
  if (!duration) missingFields.push("duration");
  if (!fee) missingFields.push("fee");
  if (!requirement) missingFields.push("requirement");
  if (!contact) missingFields.push("contact");
  if (!subjectCode) missingFields.push("subjectCode");
  if (!assignedTo) missingFields.push("assignedTo");

  if (missingFields.length > 0) {
    console.log("Missing fields:", missingFields);
    return res.status(400).json({ message: `All fields are required. Missing: ${missingFields.join(", ")}` });
  }

  try {
    const course = await CourseModel.findByIdAndUpdate(
      courseId,
      { title, description, duration, fee, requirement, contact, subjectCode, assignedTo },
      { new: true }
    );
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json({ message: "Course updated successfully", course });
  } catch (error) {
    console.error("Error updating course:", error);
    res.status(500).json({ message: "Error updating course", error: error.message });
  }
});

// Delete a course (Admin only)
router.delete("/:courseId", auth, authorize(["admin"]), async (req, res) => {
  const { courseId } = req.params;

  try {
    const course = await CourseModel.findByIdAndDelete(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ message: "Error deleting course", error: error.message });
  }
});

// Content admin adds course description and program type
router.post("/:courseId/add-description", auth, authorize(["content_admin"]), async (req, res) => {
  const { courseId } = req.params;
  const {
    programDescription,
    image1,
    image2,
    vision,
    mission,
    yearsOfDepartment,
    syllabus,
    programEducationalObjectives,
    programOutcomes,
    programType,
  } = req.body;

  if (
    !programDescription ||
    !image1 ||
    !image2 ||
    !vision ||
    !mission ||
    !yearsOfDepartment ||
    !syllabus ||
    !programEducationalObjectives ||
    !programOutcomes ||
    !programType
  ) {
    return res.status(400).json({ message: "All fields, including program type, are required" });
  }

  try {
    // Verify that the course is assigned to the content admin
    const course = await CourseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    if (course.assignedTo !== req.user.email) {
      return res.status(403).json({ message: "Access denied. You are not assigned to this course." });
    }

    // Update course description
    course.programDescription = programDescription;
    course.image1 = image1;
    course.image2 = image2;
    course.vision = vision;
    course.mission = mission;
    course.yearsOfDepartment = yearsOfDepartment;
    course.syllabus = syllabus;
    course.programEducationalObjectives = programEducationalObjectives;
    course.programOutcomes = programOutcomes;
    course.programType = programType;

    await course.save();

    // Save or update program type in Form model
    let form = await FormModel.findOne({ courseId });
    if (form) {
      form.programType = programType;
      await form.save();
    } else {
      form = new FormModel({
        courseId,
        programType,
      });
      await form.save();
    }

    res.status(200).json({ message: "Course description and program type added successfully!", course, form });
  } catch (error) {
    console.error("Error adding course description and program type:", error);
    res.status(500).json({ message: "Error adding course description and program type", error: error.message });
  }
});

// Verify course code (Content Admin only)
router.post("/verify-code", auth, authorize(["content_admin"]), async (req, res) => {
  const { subjectCode } = req.body;

  if (!subjectCode) {
    return res.status(400).json({ message: "Course code is required" });
  }

  try {
    // Case-insensitive search for subjectCode
    const course = await CourseModel.findOne({ 
      subjectCode: { $regex: `^${subjectCode}$`, $options: "i" }
    });
    if (!course) {
      return res.status(404).json({ message: "Invalid course code" });
    }

    res.status(200).json({ courseId: course._id });
  } catch (error) {
    console.error("Error verifying course code:", error);
    res.status(500).json({ message: "Error verifying course code", error: error.message });
  }
});

module.exports = router;