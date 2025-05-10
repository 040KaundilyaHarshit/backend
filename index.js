const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
require("dotenv").config();
const UserModel = require("./models/User");
const CourseModel = require("./models/Course");
const courseRoutes = require("./routes/courseRoutes");
const formRoutes = require("./routes/formRoutes");
const noticeRoutes = require("./routes/noticeRoutes");
const facultyRoutes = require("./routes/faculty");
const studentRoutes = require("./routes/student");
const verificationOfficerRoutes = require("./routes/VerificationOfficerRoutes");
const verificationAdminRoutes = require("./routes/VerificationAdminRoutes");
const studentNotificationRoutes = require("./routes/StudentNotificationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const ApplicationForm = require("./models/ApplicationForm");
const FormModel = require("./models/Form");
const { auth, authorize } = require("./middleware/auth");
const listEndpoints = require("express-list-endpoints");
const path = require('path');
const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    credentials: true,
  })
);
app.options("*", cors());

app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.url}`);
  res.on("finish", () => {
    console.log(`Response Headers for ${req.url}:`, res.getHeaders());
  });
  next();
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";

// Mount routes
app.use("/api/courses", courseRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/applications", require("./routes/applicationRoutes"));
app.use("/api/verification-admin", verificationAdminRoutes);
app.use("/api/verification-officer", verificationOfficerRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/student-notifications", studentNotificationRoutes);

// Serve static files from the uploads directory
app.use('/api/uploads', express.static(path.join(__dirname, 'Uploads')));

// Log registered routes
console.log("Registered Routes:");
console.log(listEndpoints(app));

const authorizeAdminOrVerificationAdmin = (req, res, next) => {
  console.log("User role:", req.user.role);
  if (!["admin", "verification_admin"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Admins or Verification Admins only." });
  }
  next();
};

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const userRole = "student";

  try {
    const user = await UserModel.findOne({ email });
    if (user) {
      return res.status(400).json("Already registered");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await UserModel.create({
      name,
      email,
      password: hashedPassword,
      role: userRole,
    });

    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to Our Platform!",
      html: `
        <h2>Hi ${name},</h2>
        <p>Thank you for registering on our platform! 🎉</p>
        <p>You can now log in using your registered email.</p>
        <p><strong>Happy Learning! 🚀</strong></p>
        <br>
        <p>Best Regards,</p>
        <p><strong>Your Team</strong></p>
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email:", err);
      } else {
        console.log("Email sent:", info.response);
      }
    });

    res.status(201).json({
      userId: newUser._id,
      token,
      role: newUser.role,
      message: `Registered successfully as ${newUser.role}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/users/create", auth, authorizeAdminOrVerificationAdmin, async (req, res) => {
  const { name, email, password, role, courseId } = req.body;
  const allowedRolesForAdmin = ["admin", "content_admin", "verification_admin", "student", "faculty"];
  const allowedRolesForVerificationAdmin = ["verification_officer"];

  // Log incoming request body for debugging
  console.log("Received /api/users/create request:", { name, email, password, role, courseId });

  try {
    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required." });
    }

    // Determine allowed roles based on the requester's role
    const requesterRole = req.user.role;
    const allowedRoles = requesterRole === "admin" ? allowedRolesForAdmin : allowedRolesForVerificationAdmin;

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Allowed roles: ${allowedRoles.join(", ")}` });
    }

    // Check for existing user
    const user = await UserModel.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already registered." });
    }

    // Require courseId for verification_admin creating verification_officer
    let validatedCourseId = null;
    if (requesterRole === "verification_admin" && role === "verification_officer") {
      if (!courseId) {
        return res.status(400).json({ message: "Course ID is required for creating a verification officer." });
      }
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ message: "Invalid course ID format." });
      }
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found." });
      }
      validatedCourseId = courseId;
    } else if (courseId) {
      // Optional courseId validation for admin
      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ message: "Invalid course ID format." });
      }
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found." });
      }
      validatedCourseId = courseId;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await UserModel.create({
      name,
      email,
      password: hashedPassword,
      role,
      courses: validatedCourseId ? [validatedCourseId] : [],
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to Our Platform!",
      html: `
        <h2>Hi ${name},</h2>
        <p>You have been registered as a ${role}${validatedCourseId ? ` for course ID ${validatedCourseId}` : ""} on our platform! 🎉</p>
        <p>Please log in using your email and the provided password.</p>
        <p><strong>Best Regards,</strong></p>
        <p><strong>Your Team</strong></p>
      `,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email:", err);
      } else {
        console.log("Email sent:", info.response);
      }
    });

    res.status(201).json({ message: `User created successfully as ${role}` });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Failed to create user", error: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "No user found with this email" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password" });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    console.log("Generated JWT Token:", token);
    return res.status(200).json({ token, userId: user._id, role: user.role, jwt_token: token });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login error", error });
  }
});

app.get("/api/users", auth, authorize(["admin"]), async (req, res) => {
  try {
    const users = await UserModel.find();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users", error });
  }
});

app.get("/api/users/:id", auth, async (req, res) => {
  const { id } = req.params;

  console.log(`Fetching user ${id} - Requested by ${req.user.userId} (Role: ${req.user.role})`);

  try {
    if (req.user.role === "admin" || req.user.userId === id) {
      const user = await UserModel.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.json(user);
    }

    return res.status(403).json({ message: "Access denied." });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Error fetching user", error });
  }
});

app.delete("/api/users/:id", auth, authorize(["admin"]), async (req, res) => {
  const { id } = req.params;

  try {
    const user = await UserModel.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Error deleting user", error });
  }
});

app.get("/api/applications", auth, authorize(["admin"]), async (req, res) => {
  try {
    const applications = await ApplicationForm.find();
    res.json(applications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ message: "Error fetching applications", error });
  }
});

app.get("/api/application/:id", auth, async (req, res) => {
  const { id } = req.params;
  try {
    const application = await ApplicationForm.findById(id);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }
    res.json(application);
  } catch (error) {
    console.error("Error fetching application:", error);
    res.status(500).json({ message: "Error fetching application", error });
  }
});

app.delete("/api/application/:id", auth, authorize(["admin"]), async (req, res) => {
  const { id } = req.params;
  try {
    const application = await ApplicationForm.findByIdAndDelete(id);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }
    res.json({ message: "Application deleted successfully" });
  } catch (error) {
    console.error("Error deleting application:", error);
    res.status(500).json({ message: "Error deleting application", error });
  }
});

app.post("/api/forms/create", auth, async (req, res) => {
  if (req.user.role !== "content_admin") {
    return res.status(403).json({ message: "Access denied. Content admins only." });
  }

  try {
    const { courseId, fields } = req.body;

    if (!courseId || !fields || !Array.isArray(fields)) {
      return res.status(400).json({ message: "Invalid form data." });
    }

    const newForm = new FormModel({
      courseId,
      createdBy: req.user.userId,
      fields,
    });

    await newForm.save();
    res.status(201).json({ message: "Form created successfully!", form: newForm });
  } catch (error) {
    console.error("Error creating form:", error);
    res.status(500).json({ message: "Error creating form", error: error.message });
  }
});

app.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "New passwords do not match." });
    }

    const userId = req.user.userId;

    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password changed successfully!" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Something went wrong. Try again later." });
  }
});

app.listen(3001, () => {
  console.log("Server listening on http://127.0.0.1:3001");
});