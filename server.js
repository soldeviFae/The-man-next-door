//var http = require('http');
var express = require('express'),
	compression = require('compression'),
	app = express(),
	router = express.Router(''),
	moment = require('moment');

var data = require('./gameData.js');
var sendQueue = [];

app.use(express.static(__dirname + '/public'));
app.use(router),
app.use(compression());

var clients = [];
var clientData = {};
var sequence = 1;


router.get("/", function(req,res) {
	res.sendFile(__dirname + '/public/index.html');
});

router.get("/feed", function(req,res) {
	res.sendFile(__dirname + '/public/feed.html');
});

router.get("/sam", function(req,res) {
	res.sendFile(__dirname + '/public/sam.html');
});

router.get("/messages", function(req,res) {
	res.sendFile(__dirname + '/public/messages.html');
});

router.get("/twaddle", function(req,res) {
	res.sendFile(__dirname + '/public/twaddle.html');
});



var server = app.listen(process.env.PORT, process.env.IP);

console.log(timestampify()+'Server running');

var	io = require('socket.io').listen(server);

io.set( 'origins', '*:*' );

var clients

io.on('connection', function(socket) {
	var userId = socket.id;
	io.sockets.connected[userId].emit('requestStatus');
	clients[socket.id] = [];
	clients[socket.id]['socket'] = socket;
	
	socket.on('disconnect', function() {
		//console.log('Target left');	
		var index = clients.indexOf(userId);
	});
	
	socket.on('pageLoad', function(page) {
		var compDate = getPoint(page.startTime,page.currentTime,page.timezone); 
		var currentDay = compDate.day;
		var timeThroughDay = Math.round(compDate.timeThrough);
		if (page.lastUpdate != 1440) {
			var updatedLast = moment(page.currentTime).clone().diff(moment(page.lastUpdate), 'minutes');
		} else {
			var updatedLast = page.lastUpdate;
		}
		console.log(timestampify()+userId+': '+page.playerName+' - '+data.pages[page.page]+'. Time: '+currentDay+': '+timeThroughDay+'. Updated: '+updatedLast);
		clientData[userId] = {};
		clientData[userId]['name'] = page.playerName;
		clientData[userId]['timezone'] = page.timezone;
		clientData[userId]['lastUpdated'] = updatedLast;
		if (clientData[userId]['lastFeed'] == undefined || page.lastFeed.length > clientData[userId]['lastFeed']) {
			clientData[userId]['lastFeed'] = page.lastFeed;
		}
		if (clientData[userId]['lastMessage'] == undefined || page.lastMessage.length > clientData[userId]['lastMessage']) {
			clientData[userId]['lastMessage'] = page.lastMessage;
		}
		if (clientData[userId]['lastComment'] == undefined || page.lastComment.length > clientData[userId]['lastComment']) {
			clientData[userId]['lastComment'] = page.lastComment;
		}
		queueFunc.update(userId,day,timeThroughDay,updatedLast,clientData[userId]['lastFeed'],clientData[userId]['lastMessage'],clientData[userId]['lastComment'],page.firstRun)
		if (page.firstLoad == 1) {
			io.to(userId).emit('newMessage',{messageItem:data.messageObjects[0],choices:data.choiceObjects[0]});
		}
	});
	
	socket.on('choiceMade', function(replyData) {
		console.log(timestampify()+replyData.playerName+' came across choice '+replyData.choiceId+' and took path '+replyData.choiceMade);	
		if (data.choiceObjects[replyData.choiceId]['result'+replyData.choiceMade] != 0) {
			if (data.choiceObjects[replyData.choiceId].resultType == 'comment') {
				var resultTest = 'result'+replyData.choiceMade;
				var commentResult = data.commentObjects[data.choiceObjects[replyData.choiceId]['result'+replyData.choiceMade]];
				var choiceResult = '';
				if (data.commentObjects[data.choiceObjects[replyData.choiceId]['result'+replyData.choiceMade]].autoTarget == 'choice') {
					var choiceResult = data.choiceObjects[data.commentObjects[data.choiceObjects[replyData.choiceId]['result'+replyData.choiceMade]].autoId]
				}
				//commentResult.feedId = replyData.additionalTarget;
				var object2 = {timeStamp:0,user:userId,type:'comment',data:commentResult,choice:choiceResult};
			} else if (data.choiceObjects[replyData.choiceId].resultType == 'message') {
				var messageResult = data.messageObjects[data.choiceObjects[replyData.choiceId]['result'+replyData.choiceMade]];
				var choiceResult = '';
				if (data.messageObjects[data.choiceObjects[replyData.choiceId]['result'+replyData.choiceMade]].autoTarget == 'choice') {
					var choiceResult = data.choiceObjects[data.messageObjects[data.choiceObjects[replyData.choiceId]['result'+replyData.choiceMade]].autoId]
				}
				choiceResult.additionalTarget = replyData.additionalTarget;
				var object2 = {timeStamp:0,user:userId,type:'message',data:messageResult,choice:choiceResult};
			}
			sendQueue.push(object2);
			organiseQueue();
		}
	});
	
	socket.on('anotherMessage', function(replyData) {
		console.log(timestampify()+replyData.playerName+' asked for another message (Message: '+replyData.nextId+')');	
		var messageItem = data.messageObjects[replyData.nextId];
		var choiceResult = '';
		if (messageItem.autoTarget == 'choice') {
			var choiceResult = data.choiceObjects[messageItem.autoId]
		}
		io.to(userId).emit('newMessage',{messageItem:messageItem,choices:choiceResult});
	});
});


function timestampify() {
	var currentdate = new Date(); 
	currentdate = new Date(currentdate.getTime() + 10*60*60000)
	var datetime = "[" + currentdate.getDate() + "/"
                + (currentdate.getMonth()+1)  + "/" 
                + currentdate.getFullYear() + " @ "  
                + currentdate.getHours() + ":"  
                + currentdate.getMinutes() + ":" 
                + currentdate.getSeconds()+'] ';
    return datetime;
}

function getPoint(start,currentTime,timezone) {
	var thisDate = moment(currentTime).utcOffset(timezone * -1);
	var startDate = moment(start).utcOffset(timezone * -1);
	var startMidnight = startDate.clone().startOf('day').utcOffset(timezone * -1);
	var thisMidnight = thisDate.clone().startOf('day').utcOffset(timezone * -1);
	day =  moment(thisMidnight).diff(startMidnight, 'days');
	timeThroughDay = thisDate.clone().diff(thisMidnight, 'minutes');
	//console.log('Start time is '+start+'. Current time is '+currentTime+'. Difference is '+(parseInt(currentTime) - parseInt(start))+'. Which should be the same as '+timeThroughDay);
	return {day:day,timeThrough:timeThroughDay};
}

function debugSetup(userId) {
	var object2 = {timeStamp:moment().unix() + 2,user:userId,type:'message',data:data.messageObjects[1].messages,choice:data.choiceObjects[1]};
	sendQueue.push(object2);
	organiseQueue()
}

function organiseQueue() {
	function compare(a,b) {
      if (a.timeStamp < b.timeStamp)
        return -1;
      if (a.timeStamp > b.timeStamp)
        return 1;
      return 0;
    }
    sendQueue.sort(compare);
}

var watcher = setInterval(function() {
	if (sendQueue.length > 0) {
		queueFunc.check();
	}	
},50);

var queueFunc = {};

queueFunc.add = function(day,timeStampToHit,userId,timeThroughDay,noNote) {
	if (timeStampToHit != 0) {
		if (data.events[day][timeStampToHit]['object'] == 'feedObjects') { var type = 'feed'; 
		} else if (data.events[day][timeStampToHit]['object'] == 'commentObjects') { var type = 'comment'; 
		} else if (data.events[day][timeStampToHit]['object'] == 'messageObjects') { var type = 'messages'; }
		if (data[data.events[day][timeStampToHit]['object']][data.events[day][timeStampToHit]['id']].autoTarget && data[data.events[day][timeStampToHit]['object']][data.events[day][timeStampToHit]['id']].autoTarget == 'choice') {
			var queueChoice = data.choiceObjects[data[data.events[day][timeStampToHit]['object']][data.events[day][timeStampToHit]['id']].autoId];
		} else {
			var queueChoice = '';
		}
		console.log(timestampify()+'Update found, Type: '+type+', id: '+data.events[day][timeStampToHit]['id']);
		var queueObject = {
			timeStamp:moment().unix() + ((timeStampToHit - timeThroughDay) * 60),
			timeToHit:timeStampToHit,
			user:userId,
			type:type,
			data:data[data.events[day][timeStampToHit]['object']][data.events[day][timeStampToHit]['id']],
			choice:queueChoice,
			noNote:noNote
		};
		sendQueue.push(queueObject);
		organiseQueue()
	}
}

queueFunc.getIndex = function(object) {
	var replyString = '';
	for (var i in object) {
		replyString = replyString + i + ',';
	}
	return replyString.substr(0,replyString.length-1);
}

queueFunc.update = function(userId,day,timeThroughDay,updatedLast,lastFeed,lastMessage,lastComment,noNote) {
	console.log(timestampify()+'Checking update for '+userId.substr(0,4)+'<->'+clientData[userId].name + ' . '+queueFunc.getIndex(lastFeed)+'|'+queueFunc.getIndex(lastMessage)+'|'+queueFunc.getIndex(lastComment));
	timeStampToHit = 0;
	var itemsQueued = 0;
	var itemsSent = 0;
	for (var i in data.events[day]) {
		var notDone = 1;
		if (lastFeed != '' && data.events[day][i].object == 'feedObjects') {
			if (lastFeed[data.events[day][i].id] == 1) {
				notDone = 0;
			}
		}
		if (lastComment != '' && data.events[day][i].object == 'commentObjects') {
			if (lastComment[data.events[day][i].id] == 1) {
				notDone = 0;
			}
		}
		if (lastMessage != '' && data.events[day][i].object == 'messageObjects') {
			if (lastMessage[data.events[day][i].id] == 1) {
				notDone = 0;
			}
		}
		console.log(timestampify()+'Checking event - '+i+' - '+ data.events[day][i].id+' should be a '+data.events[day][i].object +'. Not Done = '+notDone);
		if (notDone == 1) {
			queueFunc.add(day,i,userId,timeThroughDay,noNote);
			if (i > timeThroughDay) {
				itemsQueued++;
				break;
			} else {
				itemsSent++;
			}
		}
	}
	io.to(userId).emit('hideLoad');
	var initialLength = sendQueue.length;
	sendQueue = uniqueTest(sendQueue);
	if (sendQueue.length > initialLength) {
		console.log(timestampify()+'Found '+parseInt(initialLength) - parseInt(sendQueue.length)+' duplicates');	
	} else {
		console.log(timestampify()+'No duplicates found');
	}
}

queueFunc.report = function(limit) {
	var current = moment().unix();
	if (limit == 0 || current % 600 <= 1) {
		var replyString = '';
		for (var i in sendQueue) {
			if (sendQueue[i].type == 'feed') {
				replyString += 'User: '+sendQueue[i].user.substr(0, 4)+'<->'+clientData[sendQueue[i].user].name+', Type: Post, Id: '+sendQueue[i].data.postId+'|';
			} else if (sendQueue[i].type == 'comment') {
				replyString += 'User: '+sendQueue[i].user.substr(0, 4)+'<->'+clientData[sendQueue[i].user].name+', Type: Comment, Id: '+sendQueue[i].data.commentId+'|';
			} else if (sendQueue[i].type == 'message') {
				replyString += 'User: '+sendQueue[i].user.substr(0, 4)+'<->'+clientData[sendQueue[i].user].name+', Type: Message, Id: '+sendQueue[i].data.messageId+'|';
			}
		}
		console.log(timestampify()+'Queue update, total in queue is '+sendQueue.length+', next update in '+Math.floor((sendQueue[0]['timeStamp'] - current) / 60)+' minutes');
		console.log(timestampify()+replyString.substr(0,replyString.length-1));
	}
}

queueFunc.check = function() {
	var current = moment().unix();
	var timer1 = new Date();
	queueFunc.report(1);
	var didSend = 0;
	while (sendQueue[0] != undefined && sendQueue[0]['timeStamp'] <= current) {
		didSend = 1;
		console.log(timestampify()+'Sending '+sendQueue[0]['type'] + ' to '+sendQueue[0].user.substr(0, 4)+'<->'+clientData[sendQueue[0]['user']]['name']);
		if (sendQueue[0]['type'] == 'messages' || sendQueue[0]['type'] == 'message') {
			if (sendQueue[0]['user'] == undefined) {
				console.log(timestampify()+'Shit. Error.');
			} else {
				io.to(sendQueue[0]['user']).emit('newMessage',{messageItem:sendQueue[0]['data'],choices:sendQueue[0]['choice'],noNote:sendQueue[0].noNote});
				clientData[sendQueue[0]['user']]['lastMessage'][sendQueue[0]['data'].messageId] = 1;
			}
		} else if (sendQueue[0]['type'] == 'comment') {
			if (sendQueue[0]['user'] == undefined) {
				console.log(timestampify()+'Shit. Error.');
			} else {
				io.to(sendQueue[0]['user']).emit('newComment',{comment:sendQueue[0]['data'],choices:sendQueue[0]['choice'],noNote:sendQueue[0].noNote});
				clientData[sendQueue[0]['user']]['lastComment'][sendQueue[0]['data'].commentId] = 1;
			}
		} else if (sendQueue[0]['type'] == 'feed') {
			if (sendQueue[0]['user'] == undefined) {
				console.log(timestampify()+'Shit. Error.');
			} else {
				if (sendQueue[0]['data'].comments != 0) {
					var commentSend = data.commentObjects[sendQueue[0]['data'].comments];
				}
				io.to(sendQueue[0]['user']).emit('newFeed',{feedItem:sendQueue[0]['data'],choices:sendQueue[0]['choice'],comments:commentSend,noNote:sendQueue[0].noNote});
				clientData[sendQueue[0]['user']]['lastFeed'][sendQueue[0]['data'].postId] = 1;
			}
		}
		sendQueue.shift();
		organiseQueue()
	}
	var timer2 = new Date();
	if (timer2.getTime() - timer1.getTime() > 5) {
		console.log(timestampify()+ '>>>>>>>>>>>>>>>>>>  Check function took '+timer2.getTime() - timer1.getTime()+'. didSend: '+didSend+' <<<<<<<<<<<<<<<<<<');
	}
}

	
function uniqueTest(arr) {
  var n, y, x, i, r;
  var arrResult = {},
    unique = [];
    console.log(timestampify()+'-----Unique test-----');
  for (i = 0, n = arr.length; i < n; i++) {
    var item = arr[i];
    arrResult[item.timeToHit + " - " + item.user] = item;
    console.log(timestampify()+'Item: '+item.timeToHit + " - " + item.user);
  }
  i = 0;
  for (var item in arrResult) {
    unique[i++] = arrResult[item];
  }
  return unique;
}

var indexOf = function(needle) {
    if(typeof Array.prototype.indexOf === 'function') {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function(needle) {
            var i = -1, index = -1;

            for(i = 0; i < this.length; i++) {
                if(this[i] === needle) {
                    index = i;
                    break;
                }
            }

            return index;
        };
    }

    return indexOf.call(this, needle);
};

function countProperties(obj) {
    var count = 0;

    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            ++count;
    }

    return count;
}