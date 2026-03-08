const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dns = require('dns');
require('dotenv').config();

// Bypass local ISP DNS by using Google/Cloudflare
dns.setServers(['8.8.8.8', '1.1.1.1']);

const DB_PATH = path.join(__dirname, 'db.json');
const MONGODB_URI = process.env.MONGODB_URI;

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    users: [{
        name: String,
        email: String,
        role: String
    }],
    firestore: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    storage: [String]
}, { timestamps: true });

const Project = mongoose.model('Project', projectSchema);

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        // Forcing IPv4 and simplified options
        await mongoose.connect(MONGODB_URI, {
            family: 4,
            connectTimeoutMS: 30000,
            socketTimeoutMS: 45000,
        });
        console.log('Connected!');

        if (!fs.existsSync(DB_PATH)) {
            console.log('db.json not found, skipping migration.');
            process.exit(0);
        }

        const dbContent = fs.readFileSync(DB_PATH, 'utf8');
        const dbData = JSON.parse(dbContent);
        const projects = dbData.projects || {};
        const projectIds = Object.keys(projects);

        console.log(`Found ${projectIds.length} projects to migrate.`);

        for (const id of projectIds) {
            const p = projects[id];

            // Check if already exists to avoid duplicates
            const exists = await Project.findOne({ name: p.name });
            if (!exists) {
                const newProject = new Project({
                    name: p.name,
                    users: p.users,
                    firestore: p.firestore,
                    storage: p.storage
                });
                await newProject.save();
                console.log(`Migrated: ${p.name}`);
            } else {
                console.log(`Skipped (already exists): ${p.name}`);
            }
        }

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        if (err.message.includes('ECONNREFUSED')) {
            console.log('\nHINT: DNS issues detected. Try changing your laptop DNS to 8.8.8.8 (Google) or 1.1.1.1 (Cloudflare).');
        }
        process.exit(1);
    }
}

migrate();
