/* to use in bookmarks:
 *    javascript:$("<script />").attr('id', 'plug-auto-scripts').attr('src', 'https://raw.github.com/chall8908/DJ-RuB/master/autoWoot.js').appendTo("body");
 */

(function() {
  if(window.autoWootLoaded) {
    return;
  }

  var djButton        = $("#button-dj-play"),
      waitListButton  = $('#button-dj-waitlist-join'),
      fakeService     = { onResult: $.noop }
      me              = API.getSelf(),
      onWaitList      = false,
      onDeck          = false,
      waitListSize    = API.getWaitList().length,
      raveInt         = 0,
      avatars         = [],
      currentAvi      = 0,
      defaultAvi      = me.avatarID;

  // Override default API.waitListJoin method
  var __waitListJoin = API.waitListJoin;
  API.waitListJoin = function() {
    if(djButton.is(":visible")) {
      djButton.click();
      onWaitList = false;
      onDeck = true;
    } else if(!onWaitList && !onDeck) {
      __waitListJoin();
      onWaitList = true;
      onDeck = false;
    }
  }

  function determineUsableAvatars() {
    var totalPoints = me.curatorPoints + me.djPoints + me.listenerPoints + 1;
    $.each(AvatarOverlay.getOriginalSet(), function(i, aviSet) {
      if(aviSet.required <= totalPoints) {
        avatars = avatars.concat(aviSet.avatars);
      }
    });
  }

  function wootSong(dj) {
    if(dj === true || dj.id != me.id) {
      $("#button-vote-positive").click();
    }
  }

  function activateRaveMode() {
    clearInterval(raveInt);
    raveInt = setInterval(function() {
      new UserChangeAvatarService(avatars[currentAvi]);
      currentAvi++;
      if(currentAvi >= avatars.length) {
        currentAvi = 0;
      }
    }, 500);
  }

  function deactivateRaveMode() {
    clearInterval(raveInt);
    new UserChangeAvatarService(defaultAvi);
  }

  determineUsableAvatars();
  wootSong(true);

  API.addEventListener(API.DJ_ADVANCE, function(data) {
    wootSong(data.dj);
  });

  API.addEventListener(API.DJ_UPDATE, function(djs) {
    if(onDeck && !onWaitList) {
      //maybe we left?
      onDeck = false;
      $.each(djs, function(i, dj) {
        if(dj.id == me.id) {
          onDeck = true;
          return false;
        }
      });
    }
    API.waitListJoin();
  });

  API.addEventListener(API.WAIT_LIST_UPDATE, function(users) {
    if(onWaitList && users.length < waitListSize && !onDeck) {
      //Make sure we weren't just removed
      waitListSize = users.length;
      onWaitList = false;
      $.each(users, function(i, user) {
        if(user.id == me.id) {
          onWaitList = true;
          return false;
        }
      });
    }

    API.waitListJoin();
  });

  API.addEventListener(API.CHAT, function(data) {
    if(data.fromID == "50ef4f8b3e083e2a4bc1310c") {
      if(data.message == "Assuming direct control.") {
        activateRaveMode();
      } else if(data.message == "Rescinding lockdown.") {
        deactivateRaveMode();
      }
    }
  });

  window.autoWootLoaded = true;
})();
