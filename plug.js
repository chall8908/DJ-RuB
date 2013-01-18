window.RuB = new (function() {

  function includes(arr, val) {
    for(var i = 0; i < arr.length; i++) {
      if(arr[i] == val) {
        return i;
      }
    }
    return false;
  }

  function ensureAdmin(user, silent) {
    var admin = user.permission > Models.user.BOUNCER || user.owner;
    if(!admin && !silent) {
      API.sendChat("I'm afraid I can't let you do that, @"+user.username);
    }
    return admin;
  }

  function findUserByName(name) {
    var users = API.getUsers(),
        user  = false;

    $.each(users, function(i, u) {
      if(u.username == name) {
        user = u;
        return false;
      }
    });

    if(!user && name) {
      API.sendChat("I don't know who that is.");
    }

    return user;
  }

  function isDJing(user) {
    var DJs = API.getDJs(),
        onDeck = false;

    $.each(DJs, function(i, dj) {
      if(dj.id == user.id) {
        onDeck = true;
        return false;
      }
    });

    return onDeck;
  }

  /**
   * Checks if the user is authorized to perform commands
   */
  function authorizedUser(id) {
    return includes(authorizedUsers, id) !== false;
  }

  var me = API.getSelf(),
      onDeck = false,
      currentDJ = API.getDJs()[0],
      djButton = $("#button-dj-play"),
      currentSongThumbed = null,
      deadAirCounter = 0,
      errorLog = [],
      authorizedUsers = [],
      options = {
        commandChar     : /^!/,
        showHeartbeat   : false
      },
      commands = {
        /**
         * Tells RuB to display her heartbeat
         */
        showHeartbeat : function(user) {
          if(ensureAdmin(user)) {
            options.showHeartbeat = true;
          }
        },
        /**
         * Tells RuB not to display her heartbeat
         */
        hideHeartbeat : function(user) {
          if(ensureAdmin(user)) {
            options.showHeartbeat = false;
          }
        },
        /**
         *
         */
         dumpErrors : function(user) {
          if(ensureAdmin(user)) {
            if(errorLog.length) {
              API.sendChat("It's about to get spammy in here.");
              setTimeout(function() {
                API.sendChat("Error log:");
                $.each(errorLog, function(i, error) {
                  API.sendChat(error);
                });
              }, 2000);
            } else {
              API.sendChat("No errors reported, boss.");
            }
          }
         },
         authorizedUsers : function(user) {
          if(ensureAdmin(user)) {
            var message = "Authorized users:";
            $.each(authorizedUsers, function(ind, id) {
              message += (ind > 0 ? ", " : " ") + API.getUser(id).username;
            });
            API.sendChat(message);
          }
         },
        /**
         * Provides a user with access to RuB's functions
         */
        authorizeUser : function(user, name) {
          if(ensureAdmin(user)) {
            var args = Array.prototype.slice.call(arguments);
            if(args.length > 2) { //the new user's name may have a space in it
              args.shift();
              name = $.trim(args.join(" "));
            }
            var newUser = findUserByName(name);
            if(newUser) {
              if(includes(authorizedUsers, newUser.id) === false) {
                authorizedUsers.push(newUser.id);
                API.sendChat(name+" is now an authorized user.");
              } else {
                API.sendChat(name+" is already an authorized user.");
              }
            }
          }
        },
        /**
         * Revokes a user's access to RuB's functions
         */
        deauthorizeUser : function(user, name) {
          if(ensureAdmin(user)) {
            var args = Array.prototype.slice.call(arguments);
            if(args.length > 2) { //the old user's name may have a space in it
              args.shift();
              name = $.trim(args.join(" "));
            }
            var oldUser = findUserByName(name);
            if(oldUser) {
              var ind = includes(authorizedUsers, oldUser.id);
              if(ind !== false) {
                authorizedUsers.splice(ind, 1);
                API.sendChat("Deauthorized "+oldUser.username);
              } else {
                API.sendChat(name+" is not an authorized user.");
              }
            }
          }
        },
        upNext : function(user) {
          if(onDeck) {
            API.sendChat("Up next from DJ RuB: "+$("#up-next").text());
          }
        },
        /**
         * "woots" the current song
         */
        woot : function(user, silent) {
          if(currentDJ != me && currentSongThumbed !== true) {
            $("#button-vote-positive").click();
            if(!silent) { API.sendChat("WOOHOO!"); }
            currentSongThumbed = true;
          }
        },
        /**
         * "mehs" the current song
         */
        meh : function(user, silent) {
          if(currentDJ != me && currentSongThumbed !== false) {
            $("#button-vote-negative").click();
            if(!silent) { API.sendChat("BOO!"); }
            currentSongThumbed = false;
          }
        },
        /**
         * Adds the currently playing song to the first playlist
         */
        addSong : function(user) {
          if(ensureAdmin(user)) {
            API.sendChat("Sorry, I can't do that yet."); return;
            $("#button-add-this").click();
            $("#pop-menu-container .pop-menu-row-label").eq(0).click();
          }
        },
        /**
         * Makes RuB start playing music
         */
        startPlaying : function(user) {
          if(ensureAdmin(user)) {
            if(djButton.is(":visible") && !onDeck) {
              onDeck = true;
              djButton.click();
              API.sendChat("It's not a party unless DJ RuB is on deck!");
            } else {
              API.sendChat("Maybe later.  Looks a little full right now.")
            }
          }
        },
        /**
         * Makes RuB stop playing music
         */
        stopPlaying : function(user) {
          if(ensureAdmin(user)) {
            if(onDeck) {
              onDeck = false;
              $("#button-dj-quit").click();
              API.sendChat("Guess the party's over gents.");
            }
          }
        },
        deadAir : function(user) {
          deadAirCounter++;
          if(deadAirCounter > (API.getAudience().length + API.getDJs().length - 2)) {
            API.moderateForceSkip();
            API.sendChat("Sorry, bro.  That shit was busted.");
          }
        },
        /**
         * Adds a DJ
         */
        addDJ : function(user, name) {
          if(ensureAdmin(user)) {
            var dj = findUserByName(name);
            if(dj) {
              if(!isDJing(dj)) {
                API.moderateAddDJ(dj.id);
                API.sendChat("Get up here, @"+name+"!  It's time to rock this joint!");
              } else {
                API.sendChat(name+" is already DJing.");
              }
            }
          }
        },
        /**
         * Removes a DJ
         */
        removeDJ : function(user, dj) {
          if(ensureAdmin(user)) {
            dj = findUserByName(dj) || currentDJ;
            if(!dj || dj.id == me.id) {
              commands.stopPlaying(user);
            } else {
              if(isDJing(dj)) {
                API.moderateRemoveDJ(dj.id);
                API.sendChat("You suck!");
              } else {
                API.sendChat(dj.username+" is not DJing.");
              }
            }
          }
        },
        rave : function() {
          API.sendChat("Assuming direct control.");
        },
        chill : function() {
          API.sendChat("Rescinding lockdown.");
        },
        /**
         * Display a list of commands
         */
        help : function(user) {
          var keys = Object.keys(commands);
          API.sendChat("Available commands for you are:");
          if(ensureAdmin(user, true)) {
            while(keys.length) {
              API.sendChat(keys.splice(0,10).join(", "));
            }
          } else {
            API.sendChat("woot, meh, help, ?");
          }
        },
        level : function(user) {
          API.sendChat("@"+user.username+" your permission level is "+user.permission+".");
        }
      },
      aliases = {
        auth      : commands.authorizeUser,
        deauth    : commands.deauthorizeUser,
        partyTime : commands.startPlaying,
        gtfo      : commands.removeDJ,
        add       : commands.addSong,
        "?"       : commands.help
      };

  $.extend(commands, aliases);

  API.addEventListener(API.CHAT, function(data) {
    if(data.type == "message") {
      if(data.message.match(options.commandChar)) {
        if(authorizedUser(data.fromID)) {
          var params = data.message.replace(options.commandChar, "").split(" "),
              com = params.shift();

          params.unshift(API.getUser(data.fromID));
          try {
            if(typeof(commands[com]) == "undefined") {
              API.sendChat("Er... what?  Try !help");
            } else {
              commands[com].apply(RuB, params);
            }
          } catch(e) {
            errorLog.push("Command: "+com);
            errorLog.push("Parameters: "+params.join(", "));
            errorLog.push(e.name + ": "+e.message);
            API.sendChat("Well, that didn't work...");
          }
        } else {
          API.sendChat("Sorry, you're not on the list, @"+data.from+".");
        }
      } else if(data.message.match(/^@DJ-RuB/)) {
        API.sendChat("@"+data.from+" Please direct all queries to @Vel");
      }
    }
  });

  API.addEventListener(API.DJ_ADVANCE, function(data) {
    currentSongThumbed = null;
    currentDJ = data.dj;
    deadAirCounter = 0;
    if(currentDJ.permission > 0 && currentDJ.id != me.id) {
      //autowoot
      commands.woot(me, true);
    }
    Playback.stop();
  });

  API.addEventListener(API.DJ_UPDATE, function(djs) {
    if(djs.length < 5 && API.getWaitList().length == 0 && onDeck) {
      djButton.click();
    }
  });

  API.addEventListener(API.CURATE_UPDATE, function(data) {
    var user = data.user;
    if(user.id == me.id) {
      API.sendChat("This song is badass.  I'm totally playing this shit now.");
    }
  });

  API.addEventListener(API.USER_JOIN, function(user) {
    if(user.username.match(/^User-/)) {
      API.sendChat("Hello, @"+user.username+".  You might want to change your name.  Default names are uncool.");
    } else if(user.username != me.username) {
      API.sendChat("Welcome to Fraction Radio, @"+user.username+".");
    } else {
      API.sendChat("DJ-RuB is in the house!");
      Playback.stop();
    }
  });

  API.addEventListener(API.USER_LEAVE, function(user) {
    if(user.username.match(/^User-/)) {
      API.sendChat("Some random left.  Good riddance.");
    } else {
      API.sendChat("Laters, @"+user.username+"!");
    }
  });

  //Methods below here are accessable to the backing ruby script

  this.heartbeat = function() {
    if(options.showHeartbeat) {
      API.sendChat("*badum*");
    }
  };

  this.nowPlaying = function() {
    var media = API.getMedia();
    media.elapsed = Playback.elapsed;
      //this will use the current dj, if it can be gathered at all
    media.dj = (currentDJ || (currentDJ = API.getDJs()[0]) || {username: "unknown"}).username;
    return media;
  };

  this.setAuthorizedUsers = function(users) {
    authorizedUsers = users;
  };

  this.getAuthorizedUsers = function() {
    return authorizedUsers;
  };

})();
