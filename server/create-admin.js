import 'dotenv/config';import mysql from 'mysql2/promise';import bcrypt from 'bcryptjs';
const {ADMIN_EMAIL,ADMIN_PASSWORD,DB_HOST,DB_PORT,DB_USER,DB_PASSWORD,DB_NAME}=process.env;
if(!ADMIN_EMAIL||!ADMIN_PASSWORD||ADMIN_PASSWORD.length<12)throw Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in server/.env');
const db=await mysql.createConnection({host:DB_HOST,port:Number(DB_PORT||3306),user:DB_USER,password:DB_PASSWORD,database:DB_NAME});
await db.execute('INSERT INTO admins(email,password_hash) VALUES(?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)',[ADMIN_EMAIL,await bcrypt.hash(ADMIN_PASSWORD,12)]);await db.end();console.log('Admin account configured:',ADMIN_EMAIL);
