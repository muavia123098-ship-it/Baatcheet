const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns');
const http = require('http');
const { Server } = require('socket.io');
let jwt;
try {
    jwt = require('jsonwebtoken');
} catch (e) {
    console.error("CRITICAL: jsonwebtoken module missing. Using mock for temporary uptime.");
    jwt = {
        sign: (payload) => "static-mock-token",
        verify: (token, secret, callback) => callback(null, { mock: true })
    };
}
require('dotenv').config();

// Bypass local ISP DNS by using Google/Cloudflare
dns.setServers(['8.8.8.8', '1.1.1.1']);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'fireclone-secret-key-123';

app.use(cors());
app.use(express.json());

// MongoDB Models
const projectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    domains: { type: [String], default: [] },
    authEnabled: { type: Boolean, default: false }, // NEW: Master Auth Toggle
    authConfig: {
        google: { type: Boolean, default: false },
        email: { type: Boolean, default: true }
    },
    users: [{
        name: String,
        email: String,
        uid: String,
        provider: String
    }],
    firestore: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    storage: [String]
}, { timestamps: true });

const Project = mongoose.model('Project', projectSchema);

// Socket.io connection
io.on('connection', (socket) => {
    socket.on('subscribe', (projectId) => {
        socket.join(projectId);
    });
});

// Routes
app.get('/api/projects', async (req, res) => {
    try {
        const projects = await Project.find();
        res.json(projects.map(p => {
            // Simulated storage calculation: 
            // 1 user ~ 1.5MB, 1 collection item ~ 0.2MB, plus base usage
            const userStorage = (p.users.length || 0) * 1.5;
            let firestoreSize = 0;
            if (p.firestore) {
                p.firestore.forEach(items => firestoreSize += items.length * 0.2);
            }
            const totalMB = (2.5 + userStorage + firestoreSize).toFixed(2);

            return {
                id: p._id,
                name: p.name,
                domains: p.domains,
                authEnabled: p.authEnabled,
                authConfig: p.authConfig,
                users: p.users,
                firestore: p.firestore,
                storage: p.storage,
                storageUsed: totalMB // Adding storage info
            };
        }));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/projects', async (req, res) => {
    try {
        const newProject = new Project(req.body);
        await newProject.save();
        res.status(201).json({ id: newProject._id, ...newProject._doc });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// Update Auth Config
app.patch('/api/projects/:id/auth', async (req, res) => {
    try {
        const id = req.params.id.replace('proj-', '');
        const project = await Project.findByIdAndUpdate(id, req.body, { new: true });

        // Broadcast change to all connected apps
        io.to(id).emit('configUpdate', {
            authEnabled: project.authEnabled,
            authConfig: project.authConfig
        });

        res.json(project);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Real-time Data Sync
app.post('/api/projects/:id/data', async (req, res) => {
    try {
        const id = req.params.id.replace('proj-', '');
        const { collectionName, data } = req.body;
        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const currentData = project.firestore.get(collectionName) || [];
        currentData.push(data);
        project.firestore.set(collectionName, currentData);
        await project.save();

        io.to(id).emit('dataUpdate', { collectionName, data, timestamp: new Date() });
        res.json({ message: 'Data added', data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Domain Management
app.post('/api/projects/:id/domains', async (req, res) => {
    try {
        const id = req.params.id.replace('proj-', '');
        const { domain } = req.body;
        const project = await Project.findByIdAndUpdate(id, { $addToSet: { domains: domain } }, { new: true });
        res.json(project.domains);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        const id = req.params.id.replace('proj-', '');
        await Project.findByIdAndDelete(id);
        res.json({ message: 'Project deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/:id/stats', async (req, res) => {
    try {
        const id = req.params.id.replace('proj-', '');
        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        res.json({ users: project.users.length, collections: project.firestore.size });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Database Connection and Server Start
mongoose.connect(MONGODB_URI)
    .then(() => {
        server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch(err => console.error('DB Error:', err));
