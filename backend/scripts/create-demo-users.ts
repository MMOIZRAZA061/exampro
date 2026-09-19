import { pool } from "../src/database/index.js";
import bcrypt from "bcryptjs";

/**
 * Create a demo teacher and a demo student (idempotent).
 * Run with: npx tsx backend/scripts/create-demo-users.ts
 */
async function createDemoUsers() {
    const users = [
        {
            email: "teacher@proexam.local",
            password: "teacher123",
            fullName: "Demo Teacher",
            role: "teacher" as const,
            profile: {
                employee_id: "T-001",
                department: "Mathematics",
                specialization: "Algebra & Calculus",
            },
        },
        {
            email: "student@proexam.local",
            password: "student123",
            fullName: "Demo Student",
            role: "student" as const,
            profile: {
                student_id: "S-001",
                gender: "other" as const,
                phone: "+92-000-0000000",
            },
        },
    ];

    for (const u of users) {
        const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
            u.email,
        ]);

        if (existing.rows.length > 0) {
            console.log(`User already exists, skipping: ${u.email}`);
            continue;
        }

        const passwordHash = await bcrypt.hash(u.password, 12);

        const { rows } = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, role, status, is_active)
             VALUES ($1, $2, $3, $4, 'active', TRUE)
             RETURNING id`,
            [u.email, passwordHash, u.fullName, u.role]
        );

        const userId = rows[0].id;

        if (u.role === "teacher") {
            await pool.query(
                `INSERT INTO teacher_profiles
                   (user_id, employee_id, department, specialization, bio)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    userId,
                    u.profile.employee_id,
                    u.profile.department,
                    u.profile.specialization,
                    `${u.profile.department} teacher for ProExam demo.`,
                ]
            );
        } else {
            await pool.query(
                `INSERT INTO student_profiles
                   (user_id, student_id, gender, phone, address)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    userId,
                    u.profile.student_id,
                    u.profile.gender,
                    u.profile.phone,
                    "ProExam demo address",
                ]
            );
        }

        console.log(`Created ${u.role}:`);
        console.log(`  Email:    ${u.email}`);
        console.log(`  Password: ${u.password}`);
        console.log(`  User ID:  ${userId}`);
        console.log("");
    }

    console.log("Done.");
    await pool.end();
}

createDemoUsers().catch(async (err) => {
    console.error("Failed to create demo users:", err);
    await pool.end();
    process.exit(1);
});
