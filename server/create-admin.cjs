// import 'dotenv/config';import mysql from 'mysql2/promise';import bcrypt from 'bcryptjs';
// const {ADMIN_EMAIL,ADMIN_PASSWORD,DB_HOST,DB_PORT,DB_USER,DB_PASSWORD,DB_NAME}=process.env;
// if(!ADMIN_EMAIL||!ADMIN_PASSWORD||ADMIN_PASSWORD.length<12)throw Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in server/.env');
// const db=await mysql.createConnection({host:DB_HOST,port:Number(DB_PORT||3306),user:DB_USER,password:DB_PASSWORD,database:DB_NAME});
// await db.execute('INSERT INTO admins(email,password_hash) VALUES(?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)',[ADMIN_EMAIL,await bcrypt.hash(ADMIN_PASSWORD,12)]);await db.end();console.log('Admin account configured:',ADMIN_EMAIL);



require("dotenv").config();

const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const readline = require("node:readline/promises");

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let connection;

  try {
    const email = (
      await rl.question("Admin email: ")
    ).trim().toLowerCase();

    const password = await rl.question(
      "New admin password: "
    );

    if (!email || password.length < 12) {
      throw new Error(
        "Enter an email and a password of at least 12 characters."
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    const [result] = await connection.execute(
      `INSERT INTO admins (email, password_hash)
       VALUES (?, ?)`,
      [email, passwordHash]
    );

    console.log(
      `Admin created successfully. ID: ${result.insertId}`
    );
  } catch (error) {
    console.error("Failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
    rl.close();
  }
}

main();
