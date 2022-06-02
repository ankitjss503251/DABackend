const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        unique: true
    },
    image: {
        type: String,
        require: true
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
    },
    createdOn: {
        type: Date,
        default: Date.now,
    },
    lastUpdatedBy: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
    },
    lastUpdatedOn: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Category', categorySchema);