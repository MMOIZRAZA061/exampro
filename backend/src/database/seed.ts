import { pool } from "./index.js";
import bcrypt from "bcryptjs";

async function seed() {
    console.log("Seeding database with initial admin user...");

    // Create a default admin user
    const adminEmail = "admin@proexam.local";
    const adminPassword = "admin123";

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [adminEmail]);

    if (existing.rows.length > 0) {
        console.log("Admin user already exists. Skipping seed.");
        await pool.end();
        return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, status, is_active)
     VALUES ($1, $2, $3, 'admin', 'active', TRUE)`,
        [adminEmail, passwordHash, "System Administrator"]
    );

    console.log("Created default admin user:");
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log("You can change this password after logging in.");

    await pool.end();
}

seed();
