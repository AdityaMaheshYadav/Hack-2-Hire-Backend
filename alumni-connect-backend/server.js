// server.js
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const PORT = 8000;

// PostgreSQL pool
const pool = new Pool({
  user: "postgres",          // your DB username
  host: "127.0.0.1",
  database: "information",     // your DB name
  password: "root",          // your DB password
  port: 5432,
});

// Middleware
app.use(cors({ origin: "http://localhost:3000" })); // allow frontend
app.use(express.json());

// JWT secret
const JWT_SECRET = "supersecretkey";

// ===== CREATE TABLES IF NOT EXISTS =====
(async () => {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS profile (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'student',
        college VARCHAR(100),
        pass_out_year INT,
        department VARCHAR(100),
        phone VARCHAR(20),
        password VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Profile table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS communities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT
      )`
    );
    console.log("✅ Communities table ready");
  } catch (err) {
    console.error("❌ Error creating tables:", err);
  }
})();

// ===== REGISTER =====
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, college, pass_out_year, password, role, department, phone } = req.body;
    
    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate role
    const validRoles = ['student', 'college'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role. Only student and college registration allowed." });
    }

    // Role-specific validation
    if (role === 'student' && !pass_out_year) {
      return res.status(400).json({ error: "Pass out year is required for students" });
    }

    if (role === 'college' && !department) {
      return res.status(400).json({ error: "Department is required for college users" });
    }

    const existingUser = await pool.query("SELECT * FROM profile WHERE email=$1", [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO profile (name, email, role, college, pass_out_year, department, phone, password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, email, role, college, pass_out_year, department, phone`,
      [name, email, role, college || null, pass_out_year || null, department || null, phone || null, hashedPassword]
    );

    res.json({ message: "User registered successfully", user: result.rows[0] });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// ===== LOGIN =====
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

    const userResult = await pool.query("SELECT * FROM profile WHERE email=$1", [email]);
    const user = userResult.rows[0];
    if (!user) return res.status(400).json({ error: "User not found" });

    // Verify role matches if provided
    if (role && user.role !== role) {
      return res.status(400).json({ error: `Invalid credentials for ${role} login` });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Incorrect password" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "1h" });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        college: user.college,
        pass_out_year: user.pass_out_year,
        department: user.department,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: err.message || "Login failed" });
  }
});

// ===== FETCH PROFILE =====
app.get("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT id, name, email, role, college, pass_out_year, department, phone FROM profile WHERE id=$1", 
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Profile not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch profile" });
  }
});

// ===== COMMUNITIES =====
// Get all communities
app.get("/communities", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM communities ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch communities error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch communities" });
  }
});

// Create a new community
app.post("/communities", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Community name is required" });

    const existing = await pool.query("SELECT * FROM communities WHERE name=$1", [name]);
    if (existing.rows.length > 0) return res.status(400).json({ error: "Community already exists" });

    const result = await pool.query(
      "INSERT INTO communities (name, description) VALUES ($1, $2) RETURNING id, name, description",
      [name, description || ""]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create community error:", err);
    res.status(500).json({ error: err.message || "Failed to create community" });
  }
});

// ===== TEST ROUTE =====
app.get("/", (req, res) => {
  res.send("Alumni Connect Backend is running!");
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
});
