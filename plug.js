window.RuB = new (function() {

  function includes(arr, val) {
    for(var i = 0; i < arr.length; i++) {
      if(arr[i] == val) {
        return i;
      }
    }
    return false;
  }

  function ensureAdmin(user) {
    var admin = user.admin || user.owner;
    if(!admin) {
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
      currentDJ = API.getDJs()[0],
      currentSongThumbed = null,
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
            $.each(authorizedUsers, function(id, ind) {
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
            $("#button-add-this").click();
            $("#pop-menu-container .pop-menu-row-label").eq(0).click();
          }
        },
        /**
         * Makes RuB start playing music
         */
        startPlaying : function(user) {
          if(ensureAdmin(user)) {
            //API.moderateAddDJ(me.id);
            $("#button-dj-play").click();
            API.sendChat("It's not a party unless DJ RuB is on deck!");
          }
        },
        /**
         * Makes RuB stop playing music
         */
        stopPlaying : function(user) {
          if(ensureAdmin(user)) {
            //API.moderateRemoveDJ(me.id);
            $("#button-dj-quit").click();
            API.sendChat("Guess the party's over gents.");
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
                API.sendChat("Get up here, "+name+"!  It's time to rock this joint!");
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
        /**
         * Display a list of commands
         */
        help : function(user) {
          var keys = Object.keys(commands),
              message = "Available commands are: ";
          if(ensureAdmin(user) {
            message += keys.join(", ");
          } else {
            message += "woot, meh, help, ?";
          }
          
          API.sendChat(message);
        },
        level : function(user) {
          API.sendMessage("@"+user.username+" your permission level is "+user.permission+".";
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
    if(currentDJ.permission > 0 && currentDJ.id != me.id) {
      //autowoot
      commands.woot(me, true);
    }
    Playback.stop();
  });
  
  API.sendChat("DJ-RuB is in the house!");
  Playback.stop();
})();
