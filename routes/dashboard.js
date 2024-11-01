const express = require('express');
const router = express.Router();
const { validateToken } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Get user dashboard data
router.get('/summary', validateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate({
                path: 'transactions',
                options: { sort: { createdAt: -1 }, limit: 5 }
            });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Calculate total deposits and withdrawals
        const transactions = await Transaction.find({ user: req.user.id });
        const stats = transactions.reduce((acc, transaction) => {
            if (transaction.type === 'deposit') {
                acc.totalDeposits += transaction.amount;
            } else {
                acc.totalWithdrawals += transaction.amount;
            }
            return acc;
        }, { totalDeposits: 0, totalWithdrawals: 0 });

        res.json({
            user: {
                fullName: user.fullName,
                email: user.email,
                balance: user.balance
            },
            stats: {
                totalDeposits: stats.totalDeposits,
                totalWithdrawals: stats.totalWithdrawals,
                totalTransactions: transactions.length
            },
            recentTransactions: user.transactions
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Handle deposit request
router.post('/deposit', validateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create new transaction
        const transaction = new Transaction({
            user: req.user.id,
            type: 'deposit',
            amount: amount,
            status: 'pending',
            description: 'Deposit from Deriv'
        });

        // Update user balance and add transaction
        user.balance += amount;
        user.transactions.push(transaction._id);

        await Promise.all([
            transaction.save(),
            user.save()
        ]);

        res.json({
            message: 'Deposit initiated successfully',
            transaction: transaction,
            newBalance: user.balance
        });
    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ error: 'Failed to process deposit' });
    }
});

// Handle withdrawal request
router.post('/withdraw', validateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Create new transaction
        const transaction = new Transaction({
            user: req.user.id,
            type: 'withdrawal',
            amount: amount,
            status: 'pending',
            description: 'Withdrawal to Deriv'
        });

        // Update user balance and add transaction
        user.balance -= amount;
        user.transactions.push(transaction._id);

        await Promise.all([
            transaction.save(),
            user.save()
        ]);

        res.json({
            message: 'Withdrawal initiated successfully',
            transaction: transaction,
            newBalance: user.balance
        });
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ error: 'Failed to process withdrawal' });
    }
});

// Get transaction history
router.get('/transactions', validateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const transactions = await Transaction.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Transaction.countDocuments({ user: req.user.id });

        res.json({
            transactions,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalTransactions: total
            }
        });
    } catch (error) {
        console.error('Transaction history error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

module.exports = router; 