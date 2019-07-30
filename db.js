'use strict';

const MongoClient = require('mongodb').MongoClient;
const MONGO_PATH = 'mongodb://localhost:27017/socialnetwork';

function mongoResults(protocol, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('users')[protocol]({}).toArray((err, result) => {
            if(err) return done(err);
            return done(null, result);
        });
    });
}

function mongoResult(protocol, username, password, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('users')[protocol]({
            username,
            password
        }, (err, result) => {
            if(err) return done(err);
            return done(null, result);
        });
    });
}

function mongoProfile(protocol, username, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('users')[protocol]({
            username
        }, (err, result) => {
            if(err) return done(err);
            return done(null, result);
        });
    });
}

function mongoAddComment(protocol, receiver, sender, comment, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('users')[protocol]({
            username: receiver
        }, {
            $push: {'profile.comments': {
                user: sender,
                written: Date.now(),
                content: comment
                }
            }
        }, (err) => {
            if(err) return done(err);
            return done();
        });
    });
}

function mongoAdd(protocol, username, name, firstname, password, date, email, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('users')[protocol]({
            username,
            name,
            firstname,
            password,
            date,
            email,
            authority: 1,
            profile: {comments: [], friends: []},
            chat: {loggedIn: false, rooms: []}
        }, done);
    });
}

function mongoAddFriend(protocol, sender, receiver, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('users')[protocol]({
            username: sender
        }, {
            $push: {
                'profile.friends': receiver
            }
        }, done);
    });
}

function mongoGetChatHistory(protocol, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('chat')[protocol]({}).toArray(done);
    });
}

function mongoAddChatMessage(protocol, message, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('chat')[protocol](message, done);
    });
}

function mongoUserConnectionStatus(protocol, username, status, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('users')[protocol]({
            username
        }, {
            $set: {
                'chat.loggedIn': status
            }
        }, done);
    });
}

function mongoGetOnlineChatUsers(protocol, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('users')[protocol]({
            'chat.loggedIn': true
        }).toArray(done);
    });
}

function mongoGetChatRoom(protocol, users, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('rooms')[protocol]({
            users: {$all: users}
        }).toArray(done);
    });
}

function mongoAddChatRoom(protocol, users, socketId, roomId, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('rooms')[protocol]({
            users,
            id: roomId,
            sockets: [socketId],
            messages: []
        }, (err) => {
            if(err) return done(err);
            return done(null, roomId);
        });
    });
}

function mongoModifyChatRoom(protocol, socketId, roomId, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('rooms')[protocol]({
            id: roomId
        }, {
            $push: {
                sockets: socketId
            }
        }, (err) => {
            if(err) return done(err);
            return done(null, roomId);
        });
    });
}

function mongoGetPrivateChatHistory(protocol, id, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('rooms')[protocol]({id}, (err, res) => {
            if(err) return done(err);
            return done(null, res.messages);
        });
    });
}

function mongoAddPrivateMessage(protocol, id, message, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('rooms')[protocol]({id}, {
            $push: {messages: message}
        }, done);
    });
}

function mongoGetUserEmail(protocol, sender, roomId, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('rooms')[protocol]({id: roomId}, (err, room) => {
            if(err) return done(err);
            room.users.forEach((user) => {
                if(user !== sender){
                    return db.collection('users')[protocol]({
                        username: user
                    }, (err, userObj) => {
                        if(err) return done(err);
                        const receiverInfo = {receiver: userObj.username, receiverEmail: userObj.email};
                        return done(null, receiverInfo);
                    });
                }
            });
        });
    });
}

function mongoGetUserCommentEmail(protocol, receiver, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('users')[protocol]({username: receiver}, (err, userObj) => {
            if(err) return done(err);
            return done(null, userObj.email);
        });
    });
}

function mongoGetAnalytics(protocol, done){
    return MongoClient.connect(MONGO_PATH, (err, db) => {
        return db.collection('users')[protocol]({'chat.loggedIn': true}).toArray((err, connectedUsers) => {
            if(err) return done(err);
            const users = connectedUsers.map(connectedUser => connectedUser.username);
            return db.collection('chat')[protocol]({}).count((err, chatMessages) => {
                if(err) return done(err);
                return done(null, {users, chatMessages});
            });
        });
    });
}

module.exports = {
    loginFind: (username, password, done) => {
        return mongoResult('findOne', username, password, (err, result) => {
            if(err) return done(err);
            return done(null, result);
        });
    },
    addUser: (username, name, firstname, password, date, email, done) => {
        return mongoAdd('insertOne', username, name, firstname, password, date, email, done);
    },
    getUserSocials: (username, done) => {
        return mongoProfile('findOne', username, (err, result) => {
            if(err) return done(err);
            return done(null, result);
        });
    },
    addUserComment: (receiver, sender, comment, done) => {
        return mongoAddComment('update', receiver, sender, comment, done);
    },
    getUsers: (done) => {
        return mongoResults('find', (err, result) => {
            if(err) return done(err);
            return done(null, result);
        });
    },
    addFriend: (sender, receiver, done) => {
        return mongoAddFriend('update', sender, receiver, done);
    },
    getChatHistory: (done) => {
        return mongoGetChatHistory('find', done);
    },
    addChatMessage: (message, done) => {
        return mongoAddChatMessage('insertOne', message, done);
    },
    userConnectionStatus: (username, status, done) => {
        return mongoUserConnectionStatus('update', username, status, done);
    },
    getOnlineChatUsers: (done) => {
        return mongoGetOnlineChatUsers('find', done);
    },
    checkChatRoom: (users, socketId, id, done) => {
        return mongoGetChatRoom('find', users, (err, room) => {
            if(err) return done(err);
            if(room.length){
                const roomId = room[0].id;
                return mongoModifyChatRoom('update', socketId, roomId, done);
            }
            return mongoAddChatRoom('insertOne', users, socketId, id, done);
        });
    },
    getPrivateChatHistory: (roomId, done) => {
        return mongoGetPrivateChatHistory('findOne', roomId, done);
    },
    addPrivateMessage: (roomId, message, done) => {
        return mongoAddPrivateMessage('update', roomId, message, done);
    },
    getUserEmail: (sender, roomId, done) => {
        return mongoGetUserEmail('findOne', sender, roomId, done);
    },
    getUserCommentEmail: (receiver, done) => {
        return mongoGetUserCommentEmail('findOne', receiver, done);
    },
    getAnalytics: (done) => {
        return mongoGetAnalytics('find', done);
    }
};
