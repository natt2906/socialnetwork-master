const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
  username : { type : String },
  name        : { type : String },
  firstname      : { type : String },
  password     : { type : String },
  date    : { type : String },
  email     : { type : String }
}, { timestamps: { createdAt: 'created_at' }});

const User = mongoose.model('User', userSchema);
module.exports = User;