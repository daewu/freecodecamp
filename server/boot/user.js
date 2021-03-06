var _ = require('lodash'),
  R = require('ramda'),
  async = require('async'),
  crypto = require('crypto'),
  nodemailer = require('nodemailer'),
  passport = require('passport'),
  moment = require('moment'),
  express = require('express'),
  debug = require('debug')('freecc:cntr:userController'),

  User = require('../../common/models/User'),
  secrets = require('../../config/secrets'),
  resources = require('./../resources/resources');

var router = express.Router();
router.get('/login', function(req, res) {
  res.redirect(301, '/signin');
});
router.get('/logout', function(req, res) {
  res.redirect(301, '/signout');
});
router.get('/signin', getSignin);
router.post('/signin', postSignin);
router.get('/signout', signout);
router.get('/forgot', getForgot);
router.post('/forgot', postForgot);
router.get('/reset/:token', getReset);
router.post('/reset/:token', postReset);
router.get('/email-signup', getEmailSignup);
router.get('/email-signin', getEmailSignin);
router.post('/email-signup', postEmailSignup);
router.post('/email-signin', postSignin);
router.get('/account/api', getAccountAngular);
router.get('/api/checkUniqueUsername/:username', checkUniqueUsername);
router.get('/api/checkExistingUsername/:username', checkExistingUsername);
router.get('/api/checkUniqueEmail/:email', checkUniqueEmail);
router.post('/account/profile', postUpdateProfile);
router.post('/account/password', postUpdatePassword);
router.post('/account/delete', postDeleteAccount);
router.get('/account/unlink/:provider', getOauthUnlink);
router.get('/account', getAccount);
// Ensure this is the last route!
router.get('/:username', returnUser);

/**
 * GET /signin
 * Siginin page.
 */

function getSignin (req, res) {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('account/signin', {
    title: 'Free Code Camp Login'
  });
}

/**
 * POST /signin
 * Sign in using email and password.
 */

function postSignin (req, res, next) {
  req.assert('email', 'Email is not valid').isEmail();
  req.assert('password', 'Password cannot be blank').notEmpty();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/signin');
  }

  passport.authenticate('local', function(err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash('errors', { msg: info.message });
      return res.redirect('/signin');
    }
    req.logIn(user, function(err) {
      if (err) {
        return next(err);
      }
      req.flash('success', { msg: 'Success! You are logged in.' });
      if (/hotStories/.test(req.session.returnTo)) {
        return res.redirect('../news');
      }
      if (/field-guide/.test(req.session.returnTo)) {
        return res.redirect('../field-guide');
      }
      return res.redirect(req.session.returnTo || '/');
    });
  })(req, res, next);
}

/**
 * GET /signout
 * Log out.
 */

function signout (req, res) {
  req.logout();
  res.redirect('/');
}

/**
 * GET /email-signup
 * Signup page.
 */

function getEmailSignin (req, res) {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('account/email-signin', {
    title: 'Sign in to your Free Code Camp Account'
  });
}

/**
 * GET /signin
 * Signup page.
 */

function getEmailSignup (req, res) {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('account/email-signup', {
    title: 'Create Your Free Code Camp Account'
  });
}

/**
 * POST /email-signup
 * Create a new local account.
 */

function postEmailSignup (req, res, next) {
  req.assert('email', 'valid email required').isEmail();
  var errors = req.validationErrors();

  if (errors) {
      req.flash('errors', errors);
      return res.redirect('/email-signup');
  }

  var possibleUserData = req.body;

  if (possibleUserData.password.length < 8) {
    req.flash('errors', {
      msg: 'Your password is too short'
    });
    return res.redirect('email-signup');
  }

  if (possibleUserData.username.length < 5 || possibleUserData.length > 20) {
    req.flash('errors', {
      msg: 'Your username must be between 5 and 20 characters'
    });
    return res.redirect('email-signup');
  }


  var user = new User({
    email: req.body.email.trim(),
    password: req.body.password,
    profile: {
      username: req.body.username.trim(),
      picture:
        'https://s3.amazonaws.com/freecodecamp/camper-image-placeholder.png'
    }
  });

  User.findOne({ email: req.body.email }, function(err, existingEmail) {
    if (err) {
      return next(err);
    }

    if (existingEmail) {
      req.flash('errors', {
        msg: 'Account with that email address already exists.'
      });
      return res.redirect('/email-signup');
    }
    User.findOne(
      { 'profile.username': req.body.username },
      function(err, existingUsername) {
      if (err) {
        return next(err);
      }
      if (existingUsername) {
        req.flash('errors', {
          msg: 'Account with that username already exists.'
        });
        return res.redirect('/email-signup');
      }

      user.save(function(err) {
        if (err) { return next(err); }
        req.logIn(user, function(err) {
          if (err) { return next(err); }
          res.redirect('/email-signup');
        });
      });
      var transporter = nodemailer.createTransport({
        service: 'Mandrill',
        auth: {
          user: secrets.mandrill.user,
          pass: secrets.mandrill.password
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'Team@freecodecamp.com',
        subject: 'Welcome to Free Code Camp!',
        text: [
          'Greetings from San Francisco!\n\n',
          'Thank you for joining our community.\n',
          'Feel free to email us at this address if you have ',
          'any questions about Free Code Camp.\n',
          'And if you have a moment, check out our blog: ',
          'blog.freecodecamp.com.\n',
          'Good luck with the challenges!\n\n',
          '- the Free Code Camp Volunteer Team'
        ].join('')
      };
      transporter.sendMail(mailOptions, function(err) {
        if (err) { return err; }
      });
    });
  });
}

/**
 * GET /account
 * Profile page.
 */

function getAccount (req, res) {
  res.render('account/account', {
    title: 'Manage your Free Code Camp Account'
  });
}

/**
 * Angular API Call
 */

function getAccountAngular (req, res) {
  res.json({
    user: req.user
  });
}

/**
 * Unique username check API Call
 */

function checkUniqueUsername (req, res, next) {
  User.count(
    { 'profile.username': req.params.username.toLowerCase() },
    function (err, data) {
    if (err) { return next(err); }
    if (data === 1) {
      return res.send(true);
    } else {
      return res.send(false);
    }
  });
}

/**
 * Existing username check
 */

function checkExistingUsername (req, res, next) {
  User.count(
    { 'profile.username': req.params.username.toLowerCase() },
    function (err, data) {
      if (err) { return next(err); }
      if (data === 1) {
          return res.send(true);
      } else {
          return res.send(false);
      }
    }
  );
}

/**
 * Unique email check API Call
 */

function checkUniqueEmail (req, res, next) {
  User.count(
    { email: decodeURIComponent(req.params.email).toLowerCase() },
    function (err, data) {
      if (err) { return next(err); }
      if (data === 1) {
        return res.send(true);
      } else {
        return res.send(false);
      }
    }
  );
}


/**
 * GET /campers/:username
 * Public Profile page.
 */

function returnUser (req, res, next) {
  User.find(
    { 'profile.username': req.params.username.toLowerCase() },
    function(err, user) {
      if (err) {
        debug('Username err: ', err);
        return next(err);
      }
      if (user[0]) {
        user = user[0];

        user.progressTimestamps = user.progressTimestamps.sort(function(a, b) {
          return a - b;
        });

        var timeObject = Object.create(null);
        R.forEach(function(time) {
          timeObject[moment(time).format('YYYY-MM-DD')] = time;
        }, user.progressTimestamps);

        var tmpLongest = 1;
        var timeKeys = R.keys(timeObject);

        user.longestStreak = 0;
        for (var i = 1; i <= timeKeys.length; i++) {
          if (moment(timeKeys[i - 1]).add(1, 'd').toString()
            === moment(timeKeys[i]).toString()) {
            tmpLongest++;
            if (tmpLongest > user.longestStreak) {
              user.longestStreak = tmpLongest;
            }
          } else {
            tmpLongest = 1;
          }
        }

        timeKeys = timeKeys.reverse();
        tmpLongest = 1;

        user.currentStreak = 1;
        var today = moment(Date.now()).format('YYYY-MM-DD');

        if (
          moment(today).toString() === moment(timeKeys[0]).toString() ||
          moment(today).subtract(1, 'd').toString() ===
            moment(timeKeys[0]).toString()
        ) {
          for (var _i = 1; _i <= timeKeys.length; _i++) {

            if (
              moment(timeKeys[_i - 1]).subtract(1, 'd').toString() ===
                moment(timeKeys[_i]).toString()
            ) {

              tmpLongest++;

              if (tmpLongest > user.currentStreak) {
                user.currentStreak = tmpLongest;
              }
            } else {
              break;
            }
          }
        } else {
          user.currentStreak = 1;
        }

        user.save(function(err) {
          if (err) {
            return next(err);
          }

          var data = {};
          var progressTimestamps = user.progressTimestamps;
          progressTimestamps.forEach(function(timeStamp) {
            data[(timeStamp / 1000)] = 1;
          });

          user.currentStreak = user.currentStreak || 1;
          user.longestStreak = user.longestStreak || 1;
          var challenges = user.completedChallenges.filter(function ( obj ) {
            return obj.challengeType === 3 || obj.challengeType === 4;
          });

          res.render('account/show', {
            title: 'Camper ' + user.profile.username + '\'s portfolio',
            username: user.profile.username,
            name: user.profile.name,
            location: user.profile.location,
            githubProfile: user.profile.githubProfile,
            linkedinProfile: user.profile.linkedinProfile,
            codepenProfile: user.profile.codepenProfile,
            facebookProfile: user.profile.facebookProfile,
            twitterHandle: user.profile.twitterHandle,
            bio: user.profile.bio,
            picture: user.profile.picture,
            progressTimestamps: user.progressTimestamps,
            website1Link: user.portfolio.website1Link,
            website1Title: user.portfolio.website1Title,
            website1Image: user.portfolio.website1Image,
            website2Link: user.portfolio.website2Link,
            website2Title: user.portfolio.website2Title,
            website2Image: user.portfolio.website2Image,
            website3Link: user.portfolio.website3Link,
            website3Title: user.portfolio.website3Title,
            website3Image: user.portfolio.website3Image,
            challenges: challenges,
            bonfires: user.completedChallenges.filter(function(challenge) {
              return challenge.challengeType === 5;
            }),
            calender: data,
            moment: moment,
            longestStreak: user.longestStreak +
              (user.longestStreak === 1 ? ' day' : ' days'),
            currentStreak: user.currentStreak +
              (user.currentStreak === 1 ? ' day' : ' days')
          });
        });
      } else {
        req.flash('errors', {
          msg: "404: We couldn't find a page with that url. " +
            'Please double check the link.'
        });
        return res.redirect('/');
      }
    }
  );
}

/**
 * POST /account/profile
 * Update profile information.
 */

function postUpdateProfile (req, res, next) {

  User.findById(req.user.id, function(err) {
    if (err) { return next(err); }
    var errors = req.validationErrors();
    if (errors) {
      req.flash('errors', errors);
      return res.redirect('/account');
    }

    User.findOne({ email: req.body.email }, function(err, existingEmail) {
      if (err) {
        return next(err);
      }
      var user = req.user;
      if (existingEmail && existingEmail.email !== user.email) {
        req.flash('errors', {
          msg: 'An account with that email address already exists.'
        });
        return res.redirect('/account');
      }
      User.findOne(
        { 'profile.username': req.body.username },
        function(err, existingUsername) {
          if (err) {
            return next(err);
          }
          var user = req.user;
          if (
            existingUsername &&
            existingUsername.profile.username !== user.profile.username
          ) {
            req.flash('errors', {
              msg: 'An account with that username already exists.'
            });
            return res.redirect('/account');
          }
          user.email = req.body.email.trim() || '';
          user.profile.name = req.body.name.trim() || '';
          user.profile.username = req.body.username.trim() || '';
          user.profile.location = req.body.location.trim() || '';
          user.profile.githubProfile = req.body.githubProfile.trim() || '';
          user.profile.facebookProfile = req.body.facebookProfile.trim() || '';
          user.profile.linkedinProfile = req.body.linkedinProfile.trim() || '';
          user.profile.codepenProfile = req.body.codepenProfile.trim() || '';
          user.profile.twitterHandle = req.body.twitterHandle.trim() || '';
          user.profile.bio = req.body.bio.trim() || '';

          user.profile.picture = req.body.picture.trim() ||
            'https://s3.amazonaws.com/freecodecamp/' +
            'camper-image-placeholder.png';
          user.portfolio.website1Title = req.body.website1Title.trim() || '';
          user.portfolio.website1Link = req.body.website1Link.trim() || '';
          user.portfolio.website1Image = req.body.website1Image.trim() || '';
          user.portfolio.website2Title = req.body.website2Title.trim() || '';
          user.portfolio.website2Link = req.body.website2Link.trim() || '';
          user.portfolio.website2Image = req.body.website2Image.trim() || '';
          user.portfolio.website3Title = req.body.website3Title.trim() || '';
          user.portfolio.website3Link = req.body.website3Link.trim() || '';
          user.portfolio.website3Image = req.body.website3Image.trim() || '';


          user.save(function (err) {
            if (err) {
              return next(err);
            }
            resources.updateUserStoryPictures(
              user._id.toString(),
              user.profile.picture,
              user.profile.username,
              function(err) {
                if (err) { return next(err); }
                req.flash('success', {
                  msg: 'Profile information updated.'
                });
                res.redirect('/account');
              }
            );
          });
        }
      );
    });
  });
}

/**
 * POST /account/password
 * Update current password.
 */

function postUpdatePassword (req, res, next) {
  req.assert('password', 'Password must be at least 4 characters long').len(4);
  req.assert('confirmPassword', 'Passwords do not match')
    .equals(req.body.password);

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/account');
  }

  User.findById(req.user.id, function(err, user) {
    if (err) { return next(err); }

    user.password = req.body.password;

    user.save(function(err) {
      if (err) { return next(err); }

      req.flash('success', { msg: 'Password has been changed.' });
      res.redirect('/account');
    });
  });
}

/**
 * POST /account/delete
 * Delete user account.
 */

function postDeleteAccount (req, res, next) {
  User.remove({ _id: req.user.id }, function(err) {
    if (err) { return next(err); }
    req.logout();
    req.flash('info', { msg: 'Your account has been deleted.' });
    res.redirect('/');
  });
}

/**
 * GET /account/unlink/:provider
 * Unlink OAuth provider.
 */

function getOauthUnlink (req, res, next) {
  var provider = req.params.provider;
  User.findById(req.user.id, function(err, user) {
    if (err) { return next(err); }

    user[provider] = null;
    user.tokens =
      _.reject(user.tokens, function(token) {
        return token.kind === provider;
      });

    user.save(function(err) {
      if (err) { return next(err); }
      req.flash('info', { msg: provider + ' account has been unlinked.' });
      res.redirect('/account');
    });
  });
}

/**
 * GET /reset/:token
 * Reset Password page.
 */

function getReset (req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  User
    .findOne({ resetPasswordToken: req.params.token })
    .where('resetPasswordExpires').gt(Date.now())
    .exec(function(err, user) {
      if (err) { return next(err); }
      if (!user) {
        req.flash('errors', {
          msg: 'Password reset token is invalid or has expired.'
        });
        return res.redirect('/forgot');
      }
      res.render('account/reset', {
        title: 'Password Reset',
        token: req.params.token
      });
    });
}

/**
 * POST /reset/:token
 * Process the reset password request.
 */

function postReset (req, res, next) {
  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('back');
  }

  async.waterfall([
    function(done) {
      User
        .findOne({ resetPasswordToken: req.params.token })
        .where('resetPasswordExpires').gt(Date.now())
        .exec(function(err, user) {
          if (err) { return next(err); }
          if (!user) {
            req.flash('errors', {
              msg: 'Password reset token is invalid or has expired.'
            });
            return res.redirect('back');
          }

          user.password = req.body.password;
          user.resetPasswordToken = null;
          user.resetPasswordExpires = null;

          user.save(function(err) {
            if (err) { return done(err); }
            req.logIn(user, function(err) {
              done(err, user);
            });
          });
        });
    },
    function(user, done) {
      var transporter = nodemailer.createTransport({
        service: 'Mandrill',
        auth: {
          user: secrets.mandrill.user,
          pass: secrets.mandrill.password
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'Team@freecodecamp.com',
        subject: 'Your Free Code Camp password has been changed',
        text: [
          'Hello,\n\n',
          'This email is confirming that you requested to',
          'reset your password for your Free Code Camp account.',
          'This is your email:',
          user.email,
          '\n'
        ].join(' ')
      };
      transporter.sendMail(mailOptions, function(err) {
        if (err) { return done(err); }
        req.flash('success', {
          msg: 'Success! Your password has been changed.'
        });
        done();
      });
    }
  ], function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
}

/**
 * GET /forgot
 * Forgot Password page.
 */

function getForgot (req, res) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('account/forgot', {
    title: 'Forgot Password'
  });
}

/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 */

function postForgot (req, res, next) {
  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/forgot');
  }

  async.waterfall([
    function(done) {
      crypto.randomBytes(16, function(err, buf) {
        if (err) { return done(err); }
        var token = buf.toString('hex');
        done(null, token);
      });
    },
    function(token, done) {
      User.findOne({
        email: req.body.email.toLowerCase()
      }, function(err, user) {
        if (err) { return done(err); }
        if (!user) {
          req.flash('errors', {
            msg: 'No account with that email address exists.'
          });
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        // 3600000 = 1 hour
        user.resetPasswordExpires = Date.now() + 3600000;

        user.save(function(err) {
          if (err) { return done(err); }
          done(null, token, user);
        });
      });
    },
    function(token, user, done) {
      var transporter = nodemailer.createTransport({
        service: 'Mandrill',
        auth: {
          user: secrets.mandrill.user,
          pass: secrets.mandrill.password
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'Team@freecodecamp.com',
        subject: 'Reset your Free Code Camp password',
        text: [
          'You are receiving this email because you (or someone else)\n',
          'requested we reset your Free Code Camp account\'s password.\n\n',
          'Please click on the following link, or paste this into your\n',
          'browser to complete the process:\n\n',
          'http://',
          req.headers.host,
          '/reset/',
          token,
          '\n\n',
          'If you did not request this, please ignore this email and\n',
          'your password will remain unchanged.\n'
        ].join('')
      };
      transporter.sendMail(mailOptions, function(err) {
        if (err) { return done(err); }
        req.flash('info', {
          msg: 'An e-mail has been sent to ' +
          user.email +
          ' with further instructions.'
        });
        done(null, 'done');
      });
    }
  ], function(err) {
    if (err) { return next(err); }
    res.redirect('/forgot');
  });
}

module.exports = router;
