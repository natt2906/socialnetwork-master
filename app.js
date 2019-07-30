'use strict';

const express = require('express');
const app = express();
const http = require('http').Server(app);
const pug = require('pug');
const bodyParser = require('body-parser');
const passport = require('passport');
const session = require('express-session');
const crypto = require('crypto');
const LocalStrategy = require('passport-local').Strategy;
const io = require('socket.io')(http);

const mongo = require('./db');
const email = require('./email');

const PORT = 8881;

app.set('view engine', 'pug');
app.use(express.static('public'));
app.use('/user', express.static('public'));
app.use('/recommend', express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(session({
    secret: 'socialnetworkSecret',
    name: 'socialnetwork',
    resave: true,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
    {
        passReqToCallback : true
    }, (req, username, password, done) => {
    mongo.loginFind(username, password, (err, result) => {
        if(err) return done(err);
        if(!result) return done(null, false);
        return done(null, result.username);

    });
}));
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.get('/', (req, res, next) => {
    const user = req.user;
    
    if(!user) {
        return res.render('index', {
            header: 'Hey You!',
            title: 'Home'
        });
    }
    return mongo.getAnalytics((err, analytics) => {
        if(err) return next(err);
        return res.render('indexAuth', {
            header: `Hello, ${user}!`,
            title: 'Home',
            analytics
        });
    });
});
app.get('/users', ensureAuthenticated, (req, res, next) => {
    return mongo.getUsers((err, result) => {
        if(err) return next(err);
        const users = result.reduce((acc, user) => {
            acc.push(user.username);
            return acc;
        }, []);

        return res.render('users', {
            header: 'Users',
            title: 'Users',
            members: users
        });
    });
});

app.get('/friends', ensureAuthenticated, (req, res, next) => {
    const user = req.user;
    return mongo.getUserSocials(user, (err, result) => {
        if(err) return next(err);
        const friends = result.profile.friends;

        return res.render('friends', {
            header: 'My friends',
            title: 'Friends',
            friends
        });
    });
});

app.get('/friend/:sender/:receiver', ensureAuthenticated, (req, res, next) => {
    const {sender, receiver} = req.params;
    return mongo.getUserSocials(sender, (err, result) => {
        if(err) return next(err);
        const friends = result.profile.friends;

        if(friends.includes(receiver)) return res.redirect(`/user/${receiver}`);
        return mongo.addFriend(sender, receiver, (err) => {
            if(err) return next(err);
            return res.redirect(`/user/${receiver}`);
        });
    });
});

app.get('/recommend/:recommended/', ensureAuthenticated, (req, res, next) => {
    const recommended = req.params.recommended;
    return mongo.getUserSocials(req.user, (err, result) => {
        if(err) return next(err);
        const friends = result.profile.friends;
        const isRec = friends.indexOf(recommended);
        if(isRec !== -1) friends.splice(isRec, 1);

        return res.render('recommend', {
            header: `Recommend ${recommended} to a friend`,
            title: 'Recommend a friend',
            recommended,
            friends
        });
    });
});

app.get('/recommend/:recommended/:friend',
        ensureAuthenticated,
        (req, res, next) => {
            const {params: {recommended, friend}, user} = req;
            const comment = `Hey! ${user} thinks that you and
            ${friend} should be friends. Go checkout their profile!`;

            return mongo.addUserComment(
                recommended,
                'socialnetwork',
                comment,
                (err) => {
                    if(err) return next(err);
                    return res.redirect(`/user/${recommended}`);
            });
});

app.get('/user/:user', ensureAuthenticated, (req, res, next) => {
    const user = req.params.user;
    return mongo.getUserSocials(user, (err, userProfileResult) => {
        if(err) return next(err);
        if(!userProfileResult) return res.redirect('/');
        const comments = formatDates(userProfileResult.profile.comments);

        return mongo.getUserSocials(req.user, (err, userResult) => {
            if(err) return next(err);
            if(!userResult) return res.redirect('/');
            const friends = userResult.profile.friends;
            const friend = user === req.user ? true : friends.includes(user);

            return res.render('profile', {
                header: `${user}'s profile`,
                title: user,
                friend,
                sender: req.user,
                receiver: user,
                comments
            });
        });
    });
});

app.post('/user/:user', ensureAuthenticated, (req, res, next) => {
    const receiver = req.params.user;
    const sender = req.user;
    const comment = req.body.comment;

    return mongo.addUserComment(receiver, sender, comment, (err) => {
        if(err) return next(err);
        res.redirect(`/user/${receiver}`);
        return mongo.getUserCommentEmail(receiver, (err, receiverMail) => {
            if(err) return next(err);
            return email.send(sender, receiver, receiverMail, next);
        });
    });
});

app.get('/chat', ensureAuthenticated, (req, res, next) => {
    return mongo.getChatHistory((err, messages) => {
        if(err) return next(err);
        return mongo.getOnlineChatUsers((err, result) => {
            if(err) return next(err);
            const onlineUsers = result.map(onlineUser => onlineUser.username);
            return res.render('chat', {
                user: req.user,
                time: Date.now(),
                messages,
                onlineUsers
            });
        });
    });
});

app.get('/chat/:sender/:receiver', ensureAuthenticated, (req, res, next) => {
    const {sender, receiver} = req.params;
    if(sender === receiver) res.redirect('/');

    return mongo.checkChatRoom([sender, receiver], uniqueId(), 'EMPTYSOCKET', (err, roomId) => {
        if(err) return next(err);
        return mongo.getPrivateChatHistory(roomId, (err, messages) => {
            if(err) return next(err);

            return res.render('privateChat', {
                user: req.user,
                time: Date.now(),
                messages,
                sender,
                receiver
            });
        });
    });
});

app.get('/login', (req, res) => {
    res.render('login', {
        title: 'login'
    });
});

app.post('/login', passport.authenticate('local',
    {
        successRedirect: '/',
        failureRedirect: '/loginFailed'
    })
);

app.get('/loginFailed', (req, res) => {
    res.render('loginFailed', {
        title: 'login'
    });
});

app.post('/loginFailed', passport.authenticate('local',
    {
        successRedirect: '/',
        failureRedirect: '/loginFailed',
    })
);

app.get('/register', (req, res) => {
    res.render('register', {
        title: 'register'
    });
});

app.post('/register', (req, res, next) => {
  const {username, name, firstname, password, date, email} = req.body;
  mongo.addUser(username, name, firstname, password, date, email, (err) => {
    if(err) next(err);

    res.render('index', {
      header: `Registered! Please log in with your new account.`,
      title: 'Registered'
    });
  });
});

app.get('/logout', (req, res, next) => {
    return req.session.destroy((err) => {
        if(err) return next(err);
        return mongo.userConnectionStatus(req.user, false, (err) => {
            if(err) console.log(err);
            return res.redirect('/');
        });
    });
});

app.all('*', (req, res) => {
    return res.send('404 - Page not found.');
});

io.on('connection', function(socket){
    socket.on('authenticate', (user) => {
        mongo.userConnectionStatus(user, true, (err) => {
            if(err) console.log(err);
        });

        socket.on('chat message', (message) => {
            io.emit('chat message', message);
            return mongo.addChatMessage(message, (err) => {
                if(err) throw new Error('Message could not be stored');
            });
        });
        socket.on('room', (room) => {
            const {users, sockets} = room;
            sockets.push(socket.id);

            return mongo.checkChatRoom(users, socket.id, uniqueId(), (err, roomId) => {
                if(err) console.log(err);

                socket.join(roomId);
                return socket.emit('room', roomId);
            });
        });

        socket.on('private message', (content) => {
            const {user: sender, time, message, roomId} = content;
            io.sockets.in(roomId).emit('private message', content);
            return mongo.addPrivateMessage(roomId, content, (err) => {
                if(err) console.log(new Error('Private message could not be stored'));
                return mongo.getUserEmail(sender, roomId, (err, receiverInfo) => {
                    const {receiver, receiverEmail} = receiverInfo;
                    return email.send(sender, receiver, receiverEmail, (err) => {
                        if(err) console.log(err);
                    });
                });
            });
        });
        socket.on('disconnect', () => {
            return mongo.userConnectionStatus(user, false, (err) => {
                if(err) console.log(err);
            });
        });
    });
});

http.listen(process.env.PORT || PORT, () => {
    console.log('listening');
});

function ensureAuthenticated(req, res, next){
    if(!req.isAuthenticated()) return res.send('ERROR401 - Not authenticated.');
    return next();

}

function uniqueId(){
    return crypto.randomBytes(10).toString('hex');
}

function formatDates(comments){
    comments.forEach((comment) => {
        comment.written = new Date(comment.written)
            .toISOString()
            .slice(0, 16)
            .replace('T', ' ');
    });
    return comments.reverse();
}
