/*

               global comment
               global post
               global trending
               global message
               global user
               global app
               global socket
               global mobNotifications
               global timestampify
               global gameUpdate

            */
            
var firstRun = 1;          
var connected = 0;
            
var rebootIfError = setTimeout(function() {
    window.localStorage.clear();
    window.location.replace("index.html?connection=error");    
},20000);


/*    FIX OLD DATA FORMAT YAY  */

if (localStorage.getObject('gameData').posts != undefined && localStorage.getObject('gameData').posts[0].date != undefined) {
    window.localStorage.clear();
    window.location.replace("index.html?connection=error");    
}

function requestStatus(backlog) {
    if (backlog == undefined) {backlog = 0;}
    clearTimeout(rebootIfError);
    if (mobNotifications == 1) {
        app.initialize();
    } else {
        triggerCheck(backlog);
    }
    var waitCount = 0;
    for (var prop in localStorage.getObject('gameSettings').messageWait) {
        if (localStorage.getObject('gameSettings').messageWait.hasOwnProperty(prop)) {
            waitCount++;
        }
    }
    if (firstRun == 1 && waitCount > 0) {
        messageWait({messageWait:localStorage.getObject('gameSettings').messageWait});
    }
};

var retrieveTimer;

function connectionStrong() {
    connected = 1;
    $('#reconnect').fadeOut();
};

function introScreen() {
    
}

function receivedChoice(data) {
    debugNotice(timestampify()+'Received a choice',0);
    debugNotice(data,0);
    gameUpdate('removeReturn','settings',data.choiceId);
};

function updateData(updateData) {
    debugNotice(timestampify()+'Backlog received',0);
    debugNotice(updateData,0);
    if (updateData['message'].length > 0) {
        $.each(updateData['message'], function(index,value) {
            processMessage(value,1);
        });
    };
    if (updateData['feed'].length > 0) {
        $.each(updateData['feed'], function(index,value) {
            processFeed(value,1);
        });
    }
    if (updateData['comment'].length > 0) {
        $.each(updateData['comment'], function(index,value) {
            processComment(value,1);
        });
    }
    hideLoad();
};

function hideLoad() {
     $('#loadingLine').hide();
    $('#leftLoad').css('left','-50%');
    $('#rightLoad').css('right','-50%');
    setTimeout(function() {
        if(!$('#overlayData').hasClass('md-modal')) {
            $('#underlayData').fadeOut("fast", function() {
                $('#overlay').hide();
                $('#underlayData').removeClass();
                $('#underlayData').html("");
            });
        }
    },1000);
}

function newMessage(receivedMessages) {
    debugNotice(timestampify()+'PING - New message',1);
    debugNotice(receivedMessages,1);
    processMessage(receivedMessages,receivedMessages.noNote,receivedMessages.queueDay);
    gameUpdate('updateTime','settings',80);
    setTimeout(function(){
        triggerCheck();
    },20000);
    hideLoad();
};

function processMessage(receivedMessages,nonote,day) {
    if (receivedMessages.fromChoice  != undefined && receivedMessages.fromChoice != 'NA') {
        gameUpdate('removeReturn','settings',receivedMessages.fromChoice);
    }
    var messageGroup = [];
    var updatePause;
    function process() {
        gameUpdate('updateTime','settings',300);
        $.each(receivedMessages.messageItem.messages, function(index,value) {
            if (value.type != undefined && value.type == 'delay' || value.type != undefined && value.type == 'effect') {
                var incomingMessage = value;
            } else {
                var incomingMessage =  new message(value.fromId,value.toId,value.timestamp,value.message,value.image,value.video,deviceData['type'],value.msgId,1);
            }
            messageGroup.push(incomingMessage);
        });
        var nextMsg = 0;
        if (receivedMessages.messageItem.autoTarget == 'message') {
            nextMsg = receivedMessages.messageItem.autoId;
        }
        var compDate = getPoint(localStorage.getObject('gameSettings').startTime,new Date(),localStorage.getObject('gameSettings').timezone); 
	    var currentDay = compDate.day;
	    var difference = currentDay - day;
	    var noFighting = 0;
	   
        if (receivedMessages.messageItem.ttl != undefined && receivedMessages.messageItem.ttl != '' && receivedMessages.messageItem.ttl != 0) {
            if (Math.floor(Date.now() / 1000) > createTimestamp(receivedMessages.messageItem.ttl,difference)) {
                var data = localStorage.getObject('dataCache');
                var messageAim = data.messageObjects[receivedMessages.messageItem.ttlId];
    			if (messageAim.autoTarget == 'choice') {
    				var choice = data.choiceObjects[messageAim.autoId];
    			}
    			if ($(document).find("title").text() == 'Twaddle - Messages') {
                    if (currentlyViewing == messageAim.messages[0].toId) {
                    	$('.choiceBlock').hide();
                    }
    			}
    			newMessage({messageItem:data.messageObjects[receivedMessages.messageItem.ttlId],choices:choice,noNote:1,queueDay:day});
    			noFighting = 1;
            } else {
                debugNotice(timestampify()+'TIME TILL LIFE',1);
                gameUpdate('updateTimer','data',receivedMessages.messageItem.messages[0].toId,receivedMessages.messageItem.ttl,receivedMessages.messageItem.ttlTarget,receivedMessages.messageItem.ttlId);
            }
        }
        debugNotice(receivedMessages);
        var result = '';
        if (receivedMessages.messageItem.result != undefined) {
            result = receivedMessages.messageItem.result;
        }
        messages.packed(messageGroup,receivedMessages.choices,nonote,nextMsg,difference,day,noFighting,result);
        gameUpdate('updateMessages','settings',receivedMessages.messageItem.messageId);
    }
    if (updating == 1) {
        while (updating == 1) {
            clearTimeout(updatePause);
            updatePause = setTimeout(function() {
                process();
            },3000);
        }
    } else {
        process();
    }
}

function askForNotes() {
    firstLoadTime = 0;
    debugNotice(timestampify()+'Notes please server!',0);
    var lastUpdate = localStorage.getObject('gameSettings').lastUpdate;
     if (localStorage.getObject('gameSettings').firstLoad == 1) {
        debugNotice(timestampify()+'omg first load',0);
        lastUpdate = 1440;
        gameUpdate('firstLoad','settings');
    }
    debugNotice(timestampify()+'Retrieving data',0);
    socket.emit('pageLoad', {
        page:$(document).find("title").text(),
        playerName:playerName,
        startTime:localStorage.getObject('gameSettings').startTime,
        lastUpdate:lastUpdate,
        currentTime:new Date(),
        users:localStorage.getObject('gameData').users,
        timezone:localStorage.getObject('gameSettings').timezone,
        lastFeed:localStorage.getObject('gameSettings').lastFeed,
        lastMessage:localStorage.getObject('gameSettings').lastMessage,
        lastComment:localStorage.getObject('gameSettings').lastComment,
        firstLoad:firstLoadTime,
        firstRun:firstRun,
        reg:deviceData['reg'],
        mob: deviceData['type']
    });
}

function newFeed(receivedFeed,day) {
    processFeed(receivedFeed,receivedFeed.noNote,day);
    gameUpdate('updateTime','settings',80);
    setTimeout(function(){
        triggerCheck();
    },20000);
    hideLoad();
};

function processFeed(receivedFeed,nonote,day) {
    gameUpdate('updateFeed','settings',receivedFeed.feedItem.postId);
    debugNotice(timestampify()+'new feed item retrieved',0);
    debugNotice(receivedFeed,0);
    function process() {
        var commentBuilder = [];
        gameUpdate('updateTime','settings',300);
        var dac = 0
        if (receivedFeed.comments && receivedFeed.comments.comments != '') {
            $.each(receivedFeed.comments.comments, function(index, value) {
                var later = createTimestamp(value['date'],receivedFeed.queueDay)
                var now = Math.floor(Date.now() / 1000);
                if ((now - later) > 960) {
                    now = later;
                }
                var currentComment = new comment(value['order'],value['user'],now,value['text'],value['image'],value['video'],value['likes'],receivedFeed.comments.commentId);
                commentBuilder.push(currentComment);
                dac += 4;
            });
        }
        if (receivedFeed.choices && receivedFeed.choices != '') {
            var newChoice = new choice(receivedFeed.choices.choiceId,receivedFeed.choices.choice1,receivedFeed.choices.choice2,receivedFeed.choices.choice3,'',receivedFeed.choices.resultType);
            var currentComment = new comment(0,0,'CHOICE',newChoice,'','',0);
            commentBuilder.push(currentComment);
        }
        var later = createTimestamp(receivedFeed.feedItem['date'],receivedFeed.queueDay)
        var now = Math.floor(Date.now() / 1000);
        if ((now - later) > 960) {
            now = later;
        }
        var currentFeed = new post(receivedFeed.feedItem.postId,receivedFeed.feedItem.fromId,now,receivedFeed.feedItem.text,receivedFeed.feedItem.image,receivedFeed.feedItem.video,receivedFeed.feedItem.likes,commentBuilder,0,receivedFeed.feedItem.caption);
        gameUpdate('updateLocal','data',currentFeed,'posts',day,receivedFeed.feedItem['date']);
        if ($(document).find("title").text() == 'Twaddle - A social media for the everyman') {
            if (nonote == 1) {
                feed.backlog(currentFeed);
            } else {
                var tempFeed = [];
                tempFeed[day] = [];
                tempFeed[day].push(currentFeed);
                feed.create('feedContent',tempFeed,0,0);
            }
        }
    }
    var updatePause;
    if (updating == 1) {
        while (updating == 1) {
            clearTimeout(updatePause);
            updatePause = setTimeout(function() {
            process();
            },3000);
        }
    } else {
        process();
    }
}

function newComment(receivedFeed) {
    debugNotice(timestampify()+'New comment',0);
    debugNotice(receivedFeed,0);
    processComment(receivedFeed,receivedFeed.noNote);
    gameUpdate('updateTime','settings',80);
    setTimeout(function(){
        triggerCheck();
    },20000);
    hideLoad();
};

function processComment(receivedComment,nonote) {
    if (receivedComment.fromChoice != undefined && receivedComment.fromChoice != 'NA') {
        gameUpdate('removeReturn','settings',receivedComment.fromChoice);
    }
    gameUpdate('updateComment','settings',receivedComment.comment.commentId);
    var tempComments = [];
    if (receivedComment.comment.comments[0] != undefined) {
        if (nonote == 1) {
            var now = createTimestamp(receivedComment.comment.comments[0].date,receivedComment.queueDay)
        } else {
            var later = createTimestamp(receivedComment.comment.comments[0].date,receivedComment.queueDay);
            var now = Math.floor(Date.now() / 1000);
            if ((now - later) > 960 && receivedComment.ignoreTime == 0) {
                now = later;
            }
        }
        
        $.each(receivedComment.comment.comments, function(index, value) {
            var currentComment = new comment(value['order'],value['user'],now,value['text'],value['image'],value['video'],value['likes'],receivedComment.comment.commentId);
            tempComments.push(currentComment);
        });
    }
    if (receivedComment.choices && receivedComment.choices != '') {
        var newChoice = new choice(receivedComment.choices.choiceId,receivedComment.choices.choice1,receivedComment.choices.choice2,receivedComment.choices.choice3,'',receivedComment.choices.resultType);
        var currentComment = new comment(0,0,'CHOICE',newChoice,'','',0,receivedComment.commentId);
        tempComments.push(currentComment);
    }
    gameUpdate('updateLocal','data',tempComments,'comments',receivedComment);
    if (nonote == 1) {
        var tempAppend = feed.commentBuilder(tempComments,receivedComment.comment.feedId,1);
        $('#comments_'+receivedComment.comment.feedId).append(tempAppend);
        if (receivedComment.choices && receivedComment.choices != '') {
            feed.createComment(receivedComment.comment.feedId, receivedComment.choices);   
        }
    } else {
        feed.commentPoster(tempComments,receivedComment.comment.feedId)
    }
}

function emitChoice(choiceId,choiceMadeData) {
    debugNotice(timestampify() + 'Choice has hit the init',0);
    choiceMade({currentTime:new Date(),timezone:localStorage.getObject('gameSettings').timezone,choiceId:choiceId,choiceMade:choiceMadeData});
}

var afaTimeout = [];

function askForAnother(nextOne,noNote) {
    debugNotice('Next one please! ('+noNote+')',0);
    if (afaTimeout != undefined && afaTimeout[nextOne] != undefined) {
        clearTimeout(afaTimeout[nextOne]);
    }
    anotherMessage({playerName:playerName,currentTime:new Date(),timezone:localStorage.getObject('gameSettings').timezone,nextId:nextOne,noNote:noNote});
}

var emitTimeout;

function emitReg() {
    clearTimeout(emitTimeout);
    if (connected == 1) {
        deviceReg({playerName:playerName,currentTime:new Date(),device:deviceData});   
    } else {
        debugNotice(timestampify()+'Not connected during emit function',0);
        emitTimeout = setTimeout(function() {emitReg;},500);
    }
}

if (mobNotifications == 1) {
    debugNotice('Binding resume event',0);
    document.addEventListener('resume',onResume, false);
    document.addEventListener('pause',onPause, false);
    
    function onResume() {
        debugNotice('Resuming',0);
        window.location.href = 'index.html?page='+currentPage+'&id='+currentlyViewing;
    }
    
    function onPause() {
        debugNotice('Application paused',0);
    }
}
