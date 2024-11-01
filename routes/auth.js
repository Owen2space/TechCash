const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { validateToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Deriv callback handler
router.post('/deriv-callback', async (req, res) => {
    try {
        const { code } = req.body;
        const response = await fetch('http://localhost:8000/deriv/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });

        const data = await response.json();
        
        // Check if user exists
        let user = await User.findOne({ derivId: data.deriv_id });
        
        if (!user) {
            // Generate a random password for first-time users
            const tempPassword = Math.random().toString(36).slice(-8);
            
            user = new User({
                fullName: data.name,
                email: data.email,
                derivId: data.deriv_id,
                password: tempPassword // This will be hashed by the pre-save hook
            });
            await user.save();
            
            // Send email to user with their temporary password
            // TODO: Implement email sending functionality
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                balance: user.balance,
                isNewUser: !user.password // Flag to indicate if user needs to set password
            }
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Regular login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                balance: user.balance
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Set/Update password
router.post('/set-password', validateToken, async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.password = password;
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Password update error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

module.exports = router; 