const express = require("express");
const UserModel = require("../models/User");
const { authenticate, authorizeAdmin } = require("../middleware/auth");

const router = express.Router();

// Fetch all users (Admin only)
router.get("/", authenticate, authorizeAdmin, async (req, res) => {
  try {
    const users = await UserModel.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

// Fetch a specific user by ID
router.get("/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  
  try {
    if (req.user.role === "admin" || req.user.userId === id) {
      const user = await UserModel.findById(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      return res.json(user);
    }
    res.status(403).json({ message: "Access denied." });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user" });
  }
});

// Delete user (Admin only)
router.delete("/:id", authenticate, authorizeAdmin, async (req, res) => {
  try {
    const user = await UserModel.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user" });
  }
});

module.exports = router;
