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
        description TEXT,
        category VARCHAR(50),
        password VARCHAR(255) NOT NULL,
        cover_image VARCHAR(500),
        created_by INT REFERENCES profile(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    
    // Ensure all columns exist in case table was created before
    await pool.query(`
      ALTER TABLE communities 
      ADD COLUMN IF NOT EXISTS description TEXT
    `);
    await pool.query(`
      ALTER TABLE communities 
      ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General'
    `);
    await pool.query(`
      ALTER TABLE communities 
      ADD COLUMN IF NOT EXISTS password VARCHAR(255)
    `);
    await pool.query(`
      ALTER TABLE communities 
      ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500)
    `);
    await pool.query(`
      ALTER TABLE communities 
      ADD COLUMN IF NOT EXISTS created_by INT REFERENCES profile(id)
    `);
    await pool.query(`
      ALTER TABLE communities 
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    
    console.log("✅ Communities table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS community_members (
        id SERIAL PRIMARY KEY,
        community_id INT REFERENCES communities(id) ON DELETE CASCADE,
        user_id INT REFERENCES profile(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(community_id, user_id)
      )`
    );
    console.log("✅ Community Members table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS community_posts (
        id SERIAL PRIMARY KEY,
        community_id INT REFERENCES communities(id) ON DELETE CASCADE,
        user_id INT REFERENCES profile(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        post_type VARCHAR(50) DEFAULT 'post',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Community Posts table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS caf_forms (
        id SERIAL PRIMARY KEY,
        college_id INT REFERENCES profile(id) ON DELETE CASCADE,
        company_name VARCHAR(200) NOT NULL,
        company_email VARCHAR(100),
        company_phone VARCHAR(20),
        job_role VARCHAR(200),
        job_description TEXT,
        eligibility_criteria TEXT,
        salary_package VARCHAR(100),
        application_deadline DATE,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ CAF Forms table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(20),
        website VARCHAR(200),
        industry VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Companies table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        job_type VARCHAR(50),
        location VARCHAR(200),
        salary VARCHAR(100),
        requirements TEXT,
        posted_by INT REFERENCES profile(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Jobs table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        event_date DATE,
        event_time TIME,
        location VARCHAR(200),
        organizer_id INT REFERENCES profile(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Events table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        file_url VARCHAR(500),
        uploaded_by INT REFERENCES profile(id),
        document_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Documents table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        student_id INT REFERENCES profile(id) ON DELETE CASCADE,
        company_name VARCHAR(200) NOT NULL,
        role VARCHAR(200) NOT NULL,
        applied_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(50) DEFAULT 'applied',
        location VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Applications table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS student_profiles (
        id SERIAL PRIMARY KEY,
        student_id INT REFERENCES profile(id) ON DELETE CASCADE UNIQUE,
        resume_uploaded BOOLEAN DEFAULT false,
        resume_url VARCHAR(500),
        skills TEXT,
        course VARCHAR(100),
        profile_completion INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Student Profiles table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS placement_events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        event_type VARCHAR(50),
        event_date DATE,
        event_time TIME,
        location VARCHAR(200),
        is_online BOOLEAN DEFAULT false,
        organizer_id INT REFERENCES profile(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Placement Events table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES profile(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        message TEXT,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Notifications table ready");

    // Placement Tracking Tables
    await pool.query(
      `CREATE TABLE IF NOT EXISTS student_placements (
        id SERIAL PRIMARY KEY,
        student_id INT UNIQUE REFERENCES profile(id) ON DELETE CASCADE,
        cgpa DECIMAL(3,2),
        eligibility_status VARCHAR(50) DEFAULT 'Eligible',
        companies_applied INT DEFAULT 0,
        current_status VARCHAR(50) DEFAULT 'Not Applied',
        offer_count INT DEFAULT 0,
        package_offered DECIMAL(10,2),
        graduation_year INT,
        is_placed BOOLEAN DEFAULT false,
        placement_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Student Placements table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS company_drives (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(200) NOT NULL,
        job_role VARCHAR(200),
        package_offered DECIMAL(10,2),
        drive_date DATE,
        drive_mode VARCHAR(50) DEFAULT 'Online',
        eligibility_criteria TEXT,
        students_applied INT DEFAULT 0,
        students_shortlisted INT DEFAULT 0,
        students_selected INT DEFAULT 0,
        drive_status VARCHAR(50) DEFAULT 'Upcoming',
        college_id INT REFERENCES profile(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Company Drives table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS offer_letters (
        id SERIAL PRIMARY KEY,
        student_id INT REFERENCES profile(id) ON DELETE CASCADE,
        company_name VARCHAR(200) NOT NULL,
        offer_type VARCHAR(50) DEFAULT 'Full-time',
        package_amount DECIMAL(10,2),
        file_url TEXT,
        verification_status VARCHAR(50) DEFAULT 'Pending',
        verified_by INT REFERENCES profile(id),
        verification_date TIMESTAMP,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Offer Letters table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS internships (
        id SERIAL PRIMARY KEY,
        student_id INT REFERENCES profile(id) ON DELETE CASCADE,
        company_name VARCHAR(200) NOT NULL,
        stipend DECIMAL(10,2),
        start_date DATE,
        end_date DATE,
        has_ppo BOOLEAN DEFAULT false,
        ppo_converted BOOLEAN DEFAULT false,
        ppo_package DECIMAL(10,2),
        internship_status VARCHAR(50) DEFAULT 'Ongoing',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log("✅ Internships table ready");

    await pool.query(
      `CREATE TABLE IF NOT EXISTS drive_applications (
        id SERIAL PRIMARY KEY,
        drive_id INT REFERENCES company_drives(id) ON DELETE CASCADE,
        student_id INT REFERENCES profile(id) ON DELETE CASCADE,
        application_status VARCHAR(50) DEFAULT 'Applied',
        interview_date TIMESTAMP,
        is_selected BOOLEAN DEFAULT false,
        offer_package DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(drive_id, student_id)
      )`
    );
    console.log("✅ Drive Applications table ready");

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
    const validRoles = ['student', 'college', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
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
// Get all communities with member count
app.get("/communities", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
             p.name as creator_name, 
             p.role as creator_role,
             COUNT(cm.id) as member_count
      FROM communities c
      LEFT JOIN profile p ON c.created_by = p.id
      LEFT JOIN community_members cm ON c.id = cm.community_id
      GROUP BY c.id, p.name, p.role
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch communities error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch communities" });
  }
});

// Get single community details
app.get("/communities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT c.*, 
             p.name as creator_name, 
             p.role as creator_role,
             COUNT(cm.id) as member_count
      FROM communities c
      LEFT JOIN profile p ON c.created_by = p.id
      LEFT JOIN community_members cm ON c.id = cm.community_id
      WHERE c.id = $1
      GROUP BY c.id, p.name, p.role
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Fetch community error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch community" });
  }
});

// Create a new community
app.post("/communities", async (req, res) => {
  try {
    const { name, description, category, password, cover_image, created_by } = req.body;
    if (!name || !password || !created_by) {
      return res.status(400).json({ error: "Name, password, and creator are required" });
    }

    const existing = await pool.query("SELECT * FROM communities WHERE name=$1", [name]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Community already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO communities (name, description, category, password, cover_image, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, category, cover_image, created_by, created_at`,
      [name, description || "", category || "General", hashedPassword, cover_image || null, created_by]
    );
    
    // Auto-join creator to community
    await pool.query(
      "INSERT INTO community_members (community_id, user_id) VALUES ($1, $2)",
      [result.rows[0].id, created_by]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create community error:", err);
    res.status(500).json({ error: err.message || "Failed to create community" });
  }
});

// Join community with password
app.post("/communities/:id/join", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, password } = req.body;
    
    if (!user_id || !password) {
      return res.status(400).json({ error: "User ID and password are required" });
    }

    // Get community
    const community = await pool.query("SELECT * FROM communities WHERE id=$1", [id]);
    if (community.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }

    // Check if already a member
    const existing = await pool.query(
      "SELECT * FROM community_members WHERE community_id=$1 AND user_id=$2",
      [id, user_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Already a member of this community" });
    }

    // Verify password
    const match = await bcrypt.compare(password, community.rows[0].password);
    if (!match) {
      return res.status(400).json({ error: "Invalid community password" });
    }

    // Add member
    await pool.query(
      "INSERT INTO community_members (community_id, user_id) VALUES ($1, $2)",
      [id, user_id]
    );

    res.json({ message: "Successfully joined community" });
  } catch (err) {
    console.error("Join community error:", err);
    res.status(500).json({ error: err.message || "Failed to join community" });
  }
});

// Check if user is member
app.get("/communities/:id/is-member/:userId", async (req, res) => {
  try {
    const { id, userId } = req.params;
    const result = await pool.query(
      "SELECT * FROM community_members WHERE community_id=$1 AND user_id=$2",
      [id, userId]
    );
    res.json({ isMember: result.rows.length > 0 });
  } catch (err) {
    console.error("Check membership error:", err);
    res.status(500).json({ error: err.message || "Failed to check membership" });
  }
});

// Get community members
app.get("/communities/:id/members", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT p.id, p.name, p.email, p.role, cm.joined_at
      FROM community_members cm
      JOIN profile p ON cm.user_id = p.id
      WHERE cm.community_id = $1
      ORDER BY cm.joined_at DESC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch members error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch members" });
  }
});

// Get community posts
app.get("/communities/:id/posts", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT cp.*, p.name as author_name, p.role as author_role
      FROM community_posts cp
      JOIN profile p ON cp.user_id = p.id
      WHERE cp.community_id = $1
      ORDER BY cp.created_at DESC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch posts error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch posts" });
  }
});

// Create community post
app.post("/communities/:id/posts", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, content, post_type } = req.body;
    
    if (!user_id || !content) {
      return res.status(400).json({ error: "User ID and content are required" });
    }

    // Check if user is member
    const member = await pool.query(
      "SELECT * FROM community_members WHERE community_id=$1 AND user_id=$2",
      [id, user_id]
    );
    if (member.rows.length === 0) {
      return res.status(403).json({ error: "Must be a member to post" });
    }

    const result = await pool.query(
      `INSERT INTO community_posts (community_id, user_id, content, post_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, user_id, content, post_type || 'post']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ error: err.message || "Failed to create post" });
  }
});

// Delete community (admin/creator only)
app.delete("/communities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    
    // Check if user is creator or admin
    const community = await pool.query("SELECT * FROM communities WHERE id=$1", [id]);
    if (community.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }
    
    const user = await pool.query("SELECT * FROM profile WHERE id=$1", [user_id]);
    if (community.rows[0].created_by !== user_id && user.rows[0].role !== 'admin') {
      return res.status(403).json({ error: "Only creator or admin can delete community" });
    }

    await pool.query("DELETE FROM communities WHERE id=$1", [id]);
    res.json({ message: "Community deleted successfully" });
  } catch (err) {
    console.error("Delete community error:", err);
    res.status(500).json({ error: err.message || "Failed to delete community" });
  }
});

// Remove member (admin/creator only)
app.delete("/communities/:id/members/:userId", async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { requester_id } = req.body;
    
    // Check if requester is creator or admin
    const community = await pool.query("SELECT * FROM communities WHERE id=$1", [id]);
    const user = await pool.query("SELECT * FROM profile WHERE id=$1", [requester_id]);
    
    if (community.rows[0].created_by !== requester_id && user.rows[0].role !== 'admin') {
      return res.status(403).json({ error: "Only creator or admin can remove members" });
    }

    await pool.query(
      "DELETE FROM community_members WHERE community_id=$1 AND user_id=$2",
      [id, userId]
    );
    res.json({ message: "Member removed successfully" });
  } catch (err) {
    console.error("Remove member error:", err);
    res.status(500).json({ error: err.message || "Failed to remove member" });
  }
});

// ===== CAF FORMS (College Application Forms) =====
// Get all CAF forms (for admin) or college-specific forms
app.get("/caf-forms", async (req, res) => {
  try {
    const { college_id } = req.query;
    let query = "SELECT * FROM caf_forms ORDER BY created_at DESC";
    let params = [];
    
    if (college_id) {
      query = "SELECT * FROM caf_forms WHERE college_id=$1 ORDER BY created_at DESC";
      params = [college_id];
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch CAF forms error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch CAF forms" });
  }
});

// Create CAF form
app.post("/caf-forms", async (req, res) => {
  try {
    const { college_id, company_name, company_email, company_phone, job_role, job_description, eligibility_criteria, salary_package, application_deadline } = req.body;
    
    if (!college_id || !company_name || !job_role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO caf_forms (college_id, company_name, company_email, company_phone, job_role, job_description, eligibility_criteria, salary_package, application_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [college_id, company_name, company_email, company_phone, job_role, job_description, eligibility_criteria, salary_package, application_deadline]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create CAF form error:", err);
    res.status(500).json({ error: err.message || "Failed to create CAF form" });
  }
});

// Update CAF form
app.put("/caf-forms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, company_email, company_phone, job_role, job_description, eligibility_criteria, salary_package, application_deadline, status } = req.body;
    
    const result = await pool.query(
      `UPDATE caf_forms 
       SET company_name=$1, company_email=$2, company_phone=$3, job_role=$4, job_description=$5, 
           eligibility_criteria=$6, salary_package=$7, application_deadline=$8, status=$9
       WHERE id=$10
       RETURNING *`,
      [company_name, company_email, company_phone, job_role, job_description, eligibility_criteria, salary_package, application_deadline, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "CAF form not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update CAF form error:", err);
    res.status(500).json({ error: err.message || "Failed to update CAF form" });
  }
});

// Delete CAF form
app.delete("/caf-forms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM caf_forms WHERE id=$1 RETURNING *", [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "CAF form not found" });
    }
    
    res.json({ message: "CAF form deleted successfully" });
  } catch (err) {
    console.error("Delete CAF form error:", err);
    res.status(500).json({ error: err.message || "Failed to delete CAF form" });
  }
});

// ===== STUDENTS INFO (for college dashboard) =====
app.get("/students", async (req, res) => {
  try {
    const { college } = req.query;
    let query = "SELECT id, name, email, college, pass_out_year, created_at FROM profile WHERE role='student' ORDER BY created_at DESC";
    let params = [];
    
    if (college) {
      query = "SELECT id, name, email, college, pass_out_year, created_at FROM profile WHERE role='student' AND college=$1 ORDER BY created_at DESC";
      params = [college];
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch students error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch students" });
  }
});

// ===== ADMIN STATS =====
app.get("/admin/stats", async (req, res) => {
  try {
    // Total users
    const totalUsers = await pool.query("SELECT COUNT(*) FROM profile");
    
    // Total students
    const totalStudents = await pool.query("SELECT COUNT(*) FROM profile WHERE role='student'");
    
    // Total colleges
    const totalColleges = await pool.query("SELECT COUNT(*) FROM profile WHERE role='college'");
    
    // Total communities
    const totalCommunities = await pool.query("SELECT COUNT(*) FROM communities");
    
    // Total CAF forms
    const totalCAFForms = await pool.query("SELECT COUNT(*) FROM caf_forms");
    
    // Total companies
    const totalCompanies = await pool.query("SELECT COUNT(*) FROM companies");
    
    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count),
      totalStudents: parseInt(totalStudents.rows[0].count),
      totalColleges: parseInt(totalColleges.rows[0].count),
      totalCommunities: parseInt(totalCommunities.rows[0].count),
      totalCAFForms: parseInt(totalCAFForms.rows[0].count),
      totalCompanies: parseInt(totalCompanies.rows[0].count),
    });
  } catch (err) {
    console.error("Fetch admin stats error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch admin stats" });
  }
});

// ===== GET ALL COLLEGES =====
app.get("/colleges", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, college, department, phone, created_at FROM profile WHERE role='college' ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch colleges error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch colleges" });
  }
});

// ===== COMPANIES =====
app.get("/companies", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM companies ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch companies error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch companies" });
  }
});

app.post("/companies", async (req, res) => {
  try {
    const { name, email, phone, website, industry, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Company name is required" });
    }

    const result = await pool.query(
      `INSERT INTO companies (name, email, phone, website, industry, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email, phone, website, industry, description]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create company error:", err);
    res.status(500).json({ error: err.message || "Failed to create company" });
  }
});

// ===== EVENTS =====
app.get("/events", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM events ORDER BY event_date DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch events error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch events" });
  }
});

app.post("/events", async (req, res) => {
  try {
    const { title, description, event_date, event_time, location, organizer_id } = req.body;
    
    if (!title || !event_date) {
      return res.status(400).json({ error: "Title and event date are required" });
    }

    const result = await pool.query(
      `INSERT INTO events (title, description, event_date, event_time, location, organizer_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description, event_date, event_time, location, organizer_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ error: err.message || "Failed to create event" });
  }
});

// ===== DOCUMENTS =====
app.get("/documents", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM documents ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch documents error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch documents" });
  }
});

app.post("/documents", async (req, res) => {
  try {
    const { title, description, file_url, uploaded_by, document_type } = req.body;
    
    if (!title || !file_url) {
      return res.status(400).json({ error: "Title and file URL are required" });
    }

    const result = await pool.query(
      `INSERT INTO documents (title, description, file_url, uploaded_by, document_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, description, file_url, uploaded_by, document_type]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create document error:", err);
    res.status(500).json({ error: err.message || "Failed to create document" });
  }
});

// ===== STUDENT DASHBOARD STATS =====
app.get("/student/dashboard-stats/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Get applications count
    const totalApplications = await pool.query("SELECT COUNT(*) FROM applications WHERE student_id=$1", [studentId]);
    const shortlisted = await pool.query("SELECT COUNT(*) FROM applications WHERE student_id=$1 AND status='shortlisted'", [studentId]);
    const interviews = await pool.query("SELECT COUNT(*) FROM applications WHERE student_id=$1 AND status='interview'", [studentId]);
    const offers = await pool.query("SELECT COUNT(*) FROM applications WHERE student_id=$1 AND status='selected'", [studentId]);
    
    // Get total jobs and internships available
    const totalJobs = await pool.query("SELECT COUNT(*) FROM jobs");
    
    // Get student profile
    const profile = await pool.query("SELECT * FROM student_profiles WHERE student_id=$1", [studentId]);
    
    res.json({
      totalJobs: parseInt(totalJobs.rows[0].count),
      totalInternships: parseInt(totalJobs.rows[0].count), // Same as jobs for now
      applicationsSubmitted: parseInt(totalApplications.rows[0].count),
      shortlisted: parseInt(shortlisted.rows[0].count),
      upcomingInterviews: parseInt(interviews.rows[0].count),
      offers: parseInt(offers.rows[0].count),
      profileCompletion: profile.rows[0]?.profile_completion || 0,
      resumeUploaded: profile.rows[0]?.resume_uploaded || false,
    });
  } catch (err) {
    console.error("Fetch student stats error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch student stats" });
  }
});

// ===== APPLICATIONS =====
app.get("/applications/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const result = await pool.query(
      "SELECT * FROM applications WHERE student_id=$1 ORDER BY applied_date DESC",
      [studentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch applications error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch applications" });
  }
});

app.post("/applications", async (req, res) => {
  try {
    const { student_id, company_name, role, location, status } = req.body;
    
    if (!student_id || !company_name || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      `INSERT INTO applications (student_id, company_name, role, location, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [student_id, company_name, role, location || null, status || 'applied']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create application error:", err);
    res.status(500).json({ error: err.message || "Failed to create application" });
  }
});

// ===== STUDENT PROFILE =====
app.get("/student-profile/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    let result = await pool.query("SELECT * FROM student_profiles WHERE student_id=$1", [studentId]);
    
    if (result.rows.length === 0) {
      // Create default profile if doesn't exist
      result = await pool.query(
        "INSERT INTO student_profiles (student_id) VALUES ($1) RETURNING *",
        [studentId]
      );
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Fetch student profile error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch student profile" });
  }
});

app.put("/student-profile/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const { resume_uploaded, resume_url, skills, course, profile_completion } = req.body;
    
    const result = await pool.query(
      `UPDATE student_profiles 
       SET resume_uploaded=$1, resume_url=$2, skills=$3, course=$4, profile_completion=$5
       WHERE student_id=$6
       RETURNING *`,
      [resume_uploaded, resume_url, skills, course, profile_completion, studentId]
    );
    
    if (result.rows.length === 0) {
      // Create if doesn't exist
      const newResult = await pool.query(
        `INSERT INTO student_profiles (student_id, resume_uploaded, resume_url, skills, course, profile_completion)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [studentId, resume_uploaded, resume_url, skills, course, profile_completion]
      );
      return res.json(newResult.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update student profile error:", err);
    res.status(500).json({ error: err.message || "Failed to update student profile" });
  }
});

// ===== PLACEMENT EVENTS =====
app.get("/placement-events", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM placement_events WHERE event_date >= CURRENT_DATE ORDER BY event_date ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch placement events error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch placement events" });
  }
});

app.post("/placement-events", async (req, res) => {
  try {
    const { title, description, event_type, event_date, event_time, location, is_online, organizer_id } = req.body;
    
    if (!title || !event_date) {
      return res.status(400).json({ error: "Title and event date are required" });
    }

    const result = await pool.query(
      `INSERT INTO placement_events (title, description, event_type, event_date, event_time, location, is_online, organizer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, description, event_type, event_date, event_time, location, is_online, organizer_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create placement event error:", err);
    res.status(500).json({ error: err.message || "Failed to create placement event" });
  }
});

// ===== NOTIFICATIONS =====
app.get("/notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10",
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch notifications error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch notifications" });
  }
});

app.post("/notifications", async (req, res) => {
  try {
    const { user_id, title, message } = req.body;
    
    if (!user_id || !title) {
      return res.status(400).json({ error: "User ID and title are required" });
    }

    const result = await pool.query(
      `INSERT INTO notifications (user_id, title, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id, title, message]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create notification error:", err);
    res.status(500).json({ error: err.message || "Failed to create notification" });
  }
});

app.put("/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE notifications SET is_read=true WHERE id=$1 RETURNING *",
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Mark notification read error:", err);
    res.status(500).json({ error: err.message || "Failed to mark notification as read" });
  }
});

// ===== COLLEGE ANALYTICS =====
app.get("/college/analytics", async (req, res) => {
  try {
    const totalStudents = await pool.query("SELECT COUNT(*) FROM profile WHERE role='student'");
    const totalCompanies = await pool.query("SELECT COUNT(*) FROM companies");
    const totalOffers = await pool.query("SELECT COUNT(*) FROM applications WHERE status='selected'");
    const totalPlacements = await pool.query("SELECT COUNT(DISTINCT student_id) FROM applications WHERE status='selected'");
    
    const placementPercentage = totalStudents.rows[0].count > 0 
      ? ((parseInt(totalPlacements.rows[0].count) / parseInt(totalStudents.rows[0].count)) * 100).toFixed(2)
      : 0;

    res.json({
      totalStudents: parseInt(totalStudents.rows[0].count),
      totalCompanies: parseInt(totalCompanies.rows[0].count),
      totalOffers: parseInt(totalOffers.rows[0].count),
      totalPlacements: parseInt(totalPlacements.rows[0].count),
      placementPercentage: parseFloat(placementPercentage),
    });
  } catch (err) {
    console.error("Fetch college analytics error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch college analytics" });
  }
});

// ===== TEST ROUTE =====
app.get("/", (req, res) => {
  res.send("Alumni Connect Backend is running!");
});

// ===== PLACEMENT TRACKING APIs =====

// Get placement overview statistics
app.get("/placement/overview/:collegeId", async (req, res) => {
  try {
    const { collegeId } = req.params;
    
    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT sp.student_id) as total_students,
        COUNT(DISTINCT CASE WHEN sp.eligibility_status = 'Eligible' THEN sp.student_id END) as eligible_students,
        COUNT(DISTINCT CASE WHEN sp.is_placed = true THEN sp.student_id END) as students_placed,
        COUNT(DISTINCT CASE WHEN sp.is_placed = false AND sp.eligibility_status = 'Eligible' THEN sp.student_id END) as students_unplaced,
        COUNT(DISTINCT CASE WHEN sp.offer_count > 1 THEN sp.student_id END) as multiple_offers,
        ROUND(AVG(CASE WHEN sp.is_placed = true THEN sp.package_offered END), 2) as avg_package,
        MAX(sp.package_offered) as highest_package
      FROM student_placements sp
      JOIN profile p ON sp.student_id = p.id
      WHERE p.college = (SELECT college FROM profile WHERE id = $1)
    `, [collegeId]);
    
    const result = stats.rows[0];
    const placementPercentage = result.eligible_students > 0 
      ? ((result.students_placed / result.eligible_students) * 100).toFixed(2)
      : 0;
    
    res.json({ ...result, placement_percentage: placementPercentage });
  } catch (err) {
    console.error("Placement overview error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get detailed placement tracking
app.get("/placement/tracking/:collegeId", async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { department, status, cgpaMin, cgpaMax, year } = req.query;
    
    let query = `
      SELECT 
        p.id, p.name, p.department, p.pass_out_year,
        sp.cgpa, sp.eligibility_status, sp.companies_applied,
        sp.current_status, sp.offer_count, sp.package_offered, sp.is_placed
      FROM profile p
      LEFT JOIN student_placements sp ON p.id = sp.student_id
      WHERE p.role = 'student' AND p.college = (SELECT college FROM profile WHERE id = $1)
    `;
    
    const params = [collegeId];
    let paramCount = 1;
    
    if (department) {
      paramCount++;
      query += ` AND p.department = $${paramCount}`;
      params.push(department);
    }
    
    if (status) {
      paramCount++;
      query += ` AND sp.current_status = $${paramCount}`;
      params.push(status);
    }
    
    if (cgpaMin) {
      paramCount++;
      query += ` AND sp.cgpa >= $${paramCount}`;
      params.push(cgpaMin);
    }
    
    if (cgpaMax) {
      paramCount++;
      query += ` AND sp.cgpa <= $${paramCount}`;
      params.push(cgpaMax);
    }
    
    if (year) {
      paramCount++;
      query += ` AND p.pass_out_year = $${paramCount}`;
      params.push(year);
    }
    
    query += ` ORDER BY p.name`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Placement tracking error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get department-wise statistics
app.get("/placement/department-stats/:collegeId", async (req, res) => {
  try {
    const { collegeId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        p.department,
        COUNT(DISTINCT p.id) as total_students,
        COUNT(DISTINCT CASE WHEN sp.eligibility_status = 'Eligible' THEN p.id END) as eligible_students,
        COUNT(DISTINCT CASE WHEN sp.is_placed = true THEN p.id END) as students_placed,
        ROUND(AVG(CASE WHEN sp.is_placed = true THEN sp.package_offered END), 2) as avg_package,
        MAX(sp.package_offered) as highest_package
      FROM profile p
      LEFT JOIN student_placements sp ON p.id = sp.student_id
      WHERE p.role = 'student' AND p.college = (SELECT college FROM profile WHERE id = $1)
      GROUP BY p.department
      ORDER BY p.department
    `, [collegeId]);
    
    const stats = result.rows.map(row => ({
      ...row,
      placement_percentage: row.eligible_students > 0 
        ? ((row.students_placed / row.eligible_students) * 100).toFixed(2)
        : 0
    }));
    
    res.json(stats);
  } catch (err) {
    console.error("Department stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get yearly placement trend
app.get("/placement/yearly-trend/:collegeId", async (req, res) => {
  try {
    const { collegeId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        p.pass_out_year as year,
        COUNT(DISTINCT p.id) as total_students,
        COUNT(DISTINCT CASE WHEN sp.eligibility_status = 'Eligible' THEN p.id END) as eligible_students,
        COUNT(DISTINCT CASE WHEN sp.is_placed = true THEN p.id END) as students_placed,
        ROUND(AVG(CASE WHEN sp.is_placed = true THEN sp.package_offered END), 2) as avg_package
      FROM profile p
      LEFT JOIN student_placements sp ON p.id = sp.student_id
      WHERE p.role = 'student' AND p.college = (SELECT college FROM profile WHERE id = $1)
        AND p.pass_out_year IS NOT NULL
      GROUP BY p.pass_out_year
      ORDER BY p.pass_out_year DESC
      LIMIT 5
    `, [collegeId]);
    
    const trend = result.rows.map(row => ({
      ...row,
      placement_percentage: row.eligible_students > 0 
        ? ((row.students_placed / row.eligible_students) * 100).toFixed(2)
        : 0
    }));
    
    res.json(trend);
  } catch (err) {
    console.error("Yearly trend error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Company Drives APIs
app.get("/company-drives/:collegeId", async (req, res) => {
  try {
    const { collegeId } = req.params;
    const result = await pool.query(`
      SELECT * FROM company_drives 
      WHERE college_id = $1 
      ORDER BY drive_date DESC
    `, [collegeId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch drives error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/company-drives", async (req, res) => {
  try {
    const { company_name, job_role, package_offered, drive_date, drive_mode, eligibility_criteria, college_id } = req.body;
    
    const result = await pool.query(`
      INSERT INTO company_drives 
      (company_name, job_role, package_offered, drive_date, drive_mode, eligibility_criteria, college_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [company_name, job_role, package_offered, drive_date, drive_mode, eligibility_criteria, college_id]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create drive error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/company-drives/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { drive_status, students_applied, students_shortlisted, students_selected } = req.body;
    
    const result = await pool.query(`
      UPDATE company_drives 
      SET drive_status = $1, students_applied = $2, students_shortlisted = $3, 
          students_selected = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [drive_status, students_applied, students_shortlisted, students_selected, id]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update drive error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Offer Letter Verification APIs
app.get("/offer-letters/:collegeId", async (req, res) => {
  try {
    const { collegeId } = req.params;
    const result = await pool.query(`
      SELECT ol.*, p.name as student_name, p.department
      FROM offer_letters ol
      JOIN profile p ON ol.student_id = p.id
      WHERE p.college = (SELECT college FROM profile WHERE id = $1)
      ORDER BY ol.created_at DESC
    `, [collegeId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch offers error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/offer-letters/:id/verify", async (req, res) => {
  try {
    const { id } = req.params;
    const { verification_status, verified_by, rejection_reason } = req.body;
    
    const result = await pool.query(`
      UPDATE offer_letters 
      SET verification_status = $1, verified_by = $2, rejection_reason = $3, 
          verification_date = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [verification_status, verified_by, rejection_reason, id]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Verify offer error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Internship Tracking APIs
app.get("/internships/:collegeId", async (req, res) => {
  try {
    const { collegeId } = req.params;
    const result = await pool.query(`
      SELECT i.*, p.name as student_name, p.department
      FROM internships i
      JOIN profile p ON i.student_id = p.id
      WHERE p.college = (SELECT college FROM profile WHERE id = $1)
      ORDER BY i.start_date DESC
    `, [collegeId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch internships error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/internships", async (req, res) => {
  try {
    const { student_id, company_name, stipend, start_date, end_date, has_ppo } = req.body;
    
    const result = await pool.query(`
      INSERT INTO internships 
      (student_id, company_name, stipend, start_date, end_date, has_ppo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [student_id, company_name, stipend, start_date, end_date, has_ppo]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create internship error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/internships/:id/ppo", async (req, res) => {
  try {
    const { id } = req.params;
    const { ppo_converted, ppo_package } = req.body;
    
    const result = await pool.query(`
      UPDATE internships 
      SET ppo_converted = $1, ppo_package = $2
      WHERE id = $3
      RETURNING *
    `, [ppo_converted, ppo_package, id]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update PPO error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Update student placement data
app.post("/placement/student", async (req, res) => {
  try {
    const { student_id, cgpa, eligibility_status, companies_applied, current_status, offer_count, package_offered, is_placed, graduation_year } = req.body;
    
    const result = await pool.query(`
      INSERT INTO student_placements 
      (student_id, cgpa, eligibility_status, companies_applied, current_status, offer_count, package_offered, is_placed, graduation_year)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (student_id) 
      DO UPDATE SET 
        cgpa = $2, eligibility_status = $3, companies_applied = $4, 
        current_status = $5, offer_count = $6, package_offered = $7, 
        is_placed = $8, graduation_year = $9, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [student_id, cgpa, eligibility_status, companies_applied, current_status, offer_count, package_offered, is_placed, graduation_year]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update placement error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
});
