window.RuB = new (function() {

  var me                = API.getSelf(),
      restartRequested  = false,
      onDeck            = isDJing(me),
      currentDJ         = API.getDJs()[0],
      upVoteButton      = $("#button-vote-positive"),
      downVoteButton    = $("#button-vote-negative"),
      deadAirCounter    = 0,
      errorLog          = [],
      consoleLog        = [],
      chatLog           = [],
      authorizedUsers   = [],
      fakeService       = { onResult: $.noop, onFailure: $.noop },
      options = {
        commandChar     : /^!/,
        showHeartbeat   : false
      },
      commands = {
        version : function(user) {
          API.sendChat("plug.js version - 1.0.0");
        },
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
                $.each(errorLog.splice(0), function(i, error) {
                  API.sendChat(error);
                });
              }, 2000);
            } else {
              API.sendChat("No errors reported, boss.");
            }
          }
         },
         //I should probably combine dumpErrors and showLog.  They're pretty much the same.
         /**
          *
          */
        showLog : function(user) {
          if(ensureAdmin(user)) {
            if(consoleLog.length) {
              API.sendChat("It's about to get spammy in here.");
              setTimeout(function() {
                API.sendChat("Console log:");
                $.each(consoleLog.splice(0), function(i, entry) {
                  API.sendChat(entry);
                });
              }, 2000);
            } else {
              API.sendChat("Log's empty, boss.");
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
          } else {
            API.sendChat("I'm not playing anything right now.");
          }
        },
        /**
         * "woots" the current song
         */
        woot : function(user, silent) {
          if(!upVoteButton.css("background-image").match(/Selected/) || silent == "force") {
            vote('up');
            if(silent !== true) { API.sendChat("WOOHOO!"); }
          }
        },
        /**
         * "mehs" the current song
         */
        meh : function(user, silent) {
          if(!downVoteButton.css("background-image").match(/Selected/) || silent == "force") {

            vote('down');

            if(silent !== true) { API.sendChat("BOO!"); }
          }
        },
        /**
         * Adds the currently playing song to the first playlist
         */
        addSong : function(user) {
          if(ensureAdmin(user)) {
            socket.execute("room.curate", fakeService, Models.playlist.selectedPlaylistID, Models.room.data.historyID);
          }
        },
        /**
         * Makes RuB start playing music
         */
        startPlaying : function(user) {
          if(ensureAdmin(user)) {
            if(!onDeck) {
              onDeck = true;
              if(!DJBoothFull()) {
                booth("join");
                API.sendChat("It's not a party unless DJ RuB is on deck!");
                return;
              }
            }

            API.sendChat("Maybe later.  Looks a little full right now.");
          }
        },
        /**
         * Makes RuB stop playing music
         */
        stopPlaying : function(user) {
          if(ensureAdmin(user)) {
            if(onDeck) {
              onDeck = false;
              booth("leave");
              API.sendChat("Guess the party's over gents.");
            }
          }
        },
        deadAir : function(user) {
          deadAirCounter++;
          if(deadAirCounter > (API.getAudience().length + API.getDJs().length - 2)) {
            API.moderateForceSkip();
            API.sendChat("Sorry, bro.  That shit was busted.");
          } else {
            API.sendChat("Acknowledged, HQ.");
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
          var availCommands = ["version", "level", "rave", "chill", "upNext", "nextUp", "deadAir", "woot", "meh", "help", "?"];

          API.sendChat("Available commands for you are:");

          if(ensureAdmin(user, true)) {
            availCommands = Object.keys(commands);
          }

          while(availCommands.length) {
            API.sendChat(availCommands.splice(0,10).join(", "));
          }
        },
        level : function(user) {
          API.sendChat("@"+user.username+" your permission level is "+user.permission+".");
        },
        restart : function(user) {
          if(ensureAdmin(user)) {
            restartRequested = true;
            API.sendChat("Request logged.  Restarting on next heartbeat.");
          }
        }
      },
      aliases = {
        deauth    : commands.deauthorizeUser,
        auth      : commands.authorizeUser,
        partyTime : commands.startPlaying,
        gtfo      : commands.removeDJ,
        add       : commands.addSong,
        nextUp    : commands.upNext,
        "?"       : commands.help
      };

  $.extend(commands, aliases);

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

  function DJBoothFull() {
    return API.getDJs().length > 4;
  }

  function WaitListEmpty() {
    return API.getWaitList().length == 0;
  }

  function booth(action) {
    socket.execute("booth."+action, fakeService);
  }

  function vote(action) {
    var type = (action === "up" ? true : false);
    socket.execute("room.cast", fakeService, type, Models.room.data.historyID, true);
  }

  /**
   * Wrapper function for getting the current DJ
   * Should always return a user
   */
  function getCurrentDJ() {
    return currentDJ || (currentDJ = API.getDJs()[0]);
  }

  /**
   * Checks if the user is authorized to perform commands
   */
  function authorizedUser(id) {
    return includes(authorizedUsers, id) !== false;
  }

  API.addEventListener(API.CHAT, function(data) {
    switch(data.type) {
      case "message":
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
              errorLog.push("Parameters: "+JSON.stringify(params));
              errorLog.push(e.name + ": "+e.message);
              errorLog.push("-------------------------------")
              API.sendChat("Well, that didn't work...");
            }
          } else {
            API.sendChat("Sorry, you're not on the list, @"+data.from+".");
          }
        } else if(data.message.match(/^@DJ-RuB/)) {
          API.sendChat("@"+data.from+": Please direct all queries to @Vel");
        }

        if(data.fromID != me.id) {
          data.message = "<"+data.from+"> " + data.message;
        }

        if(!data.message.match(/\[IRC\]/)){ //ignore messages from IRC
          chatLog.push(data.message);
        }

        return;

      case "system":
        var message = data.message;
        if(message.match(/changed their name to/)) {
          if(message.match(/^User-/) && message.split("User-").length < 3) {
            var newName = message.split("changed their name to").pop();
            API.sendChat("That name is, at least, 20% cooler, @"+newName+".");
          }
        }
        break;
    }

    chatLog.push(data.message);
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

  API.addEventListener(API.DJ_UPDATE, function() {
    if(!DJBoothFull() && WaitListEmpty() && onDeck) {
      booth('join');
    }
  });

  API.addEventListener(API.CURATE_UPDATE, function(data) {
    var user = data.user;
    if(user.id == me.id) {
      API.sendChat("This song is badass.  I'm totally playing this shit now.");
    }
  });

  API.addEventListener(API.USER_JOIN, function(user) {
    //this often gets fired and picked up by the bot as it joins, but, for some reason, some of its internals aren't set up properly
    if(!me) {
      me = API.getSelf();
      onDeck = isDJing(me);
    }

    if(user.username.match(/^User-/)) {
      API.sendChat("Hello, @"+user.username+".  You might want to change your name.  Default names are uncool.");
    } else if(user.id != me.id) {
      API.sendChat("Welcome to Fraction Radio, @"+user.username+".");
    } else {
      API.sendChat("DJ RuB is in the house!");
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

  this.getChatLog = function() {
    return chatLog.splice(0);
  }

  this.nowPlaying = function() {
    var media = API.getMedia();
    media.elapsed = Playback.elapsed;
      //this will use the current dj, if it can be gathered at all
    media.dj = (API.getDJs()[0] || {username: "unknown"}).username;
    return media;
  };

  this.setAuthorizedUsers = function(users) {
    authorizedUsers = users;
  };

  this.getAuthorizedUsers = function() {
    return authorizedUsers;
  };

  this.restartRequested = function() {
    return restartRequested;
  }

})();
