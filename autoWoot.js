(function() {
  var djButton        = $("#button-dj-play"),
      waitListButton  = $('#button-dj-waitlist-join'),
      me              = API.getSelf(),
      onWaitList      = false,
      onDeck          = false,
      waitListSize    = API.getWaitList().length;
      
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
  
  API.addEventListener(API.DJ_ADVANCE, function(data) {
    if(data.dj.id != me.id) {
      $("#button-vote-positive").click();
    }
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
})();