var sql 	= require("seriate");
var config  = require('config');
var request = require('request');
var moment  = require('moment-timezone');
var pinnacleAPI = require('pinnacle-sports-api');
var pinnacle    = new pinnacleAPI(config.get("username"), config.get("password"));

var logger = require('./library/notify');

// Change the config settings to match your
// SQL Server and database
var configDB = config.get('db');

sql.setDefaultConfig( configDB );

var sports = config.get("sport");

logger("started");

//getLeagueBySport(4,0);
//checkGame(715629062,0);
collectGames(sports,false);
//collectLines(sports);

/*
sendLine(linetosend,function(lineResult){
	logger(lineResult);
});
*/

function collectGames(sportList,overwrite){

	sportList.forEach(function(sportID){
		
		getLeagueBySport(sportID, function(res){
			sid = res.sportID;
			leagues = res.league;
			var gameOptions = { sportId : sid, leagueids : leagues.toString() };
			//logger(gameOptions)
			getGames(gameOptions, overwrite, function(gamesReturn){
				logger(gamesReturn);
			});
			
		});
		
	});
	
}

function collectLines(sportList){

	sportList.forEach(function(sportID){
		getLeagueBySport(sportID, function(res){
			sid = res.sportID;
			leagues = res.league;				
			//logger(sid+" "+leagues);
			checkLastSince(sid,leagues, function(oddsOptions){
				getLines(oddsOptions, function(oddsReturn){
					logger(oddsReturn);
				});
			});
		});
	});
	
}

function checkGame(gameID,cb){
	
	var isGame = false;
	
	sql.execute( {  
        query: "SELECT id FROM PINN_GAME WHERE eventID = @eventID",
        params: {
            eventID: {
                type: sql.BIGINT,
                val: gameID,
            }
        }
    } ).then( function( results ) {
		if (results.length > 0){
			isGame = true;
		}
		cb(isGame);
        //logger( results.length );
    }, function( err ) {
        logger( "Something bad happened:", err );
    } );
	
}


function getLeagueBySport(sportID,cb){
	
	var leagueList = [];
	var r = { "sportID" : sportID, league : []};
	
	sql.execute( {  
        query: "SELECT leagueID FROM PINN_MATCH WHERE sportID = @sport",
        params: {
            sport: {
                type: sql.INT,
                val: sportID,
            }
        }
    } ).then( function( results ) {
		results.forEach(function(league){
			leagueList.push(league.leagueID);
		});
		r.league.push(leagueList);
        cb(r);
    }, function( err ) {
        logger( "Something bad happened:", err );
    } );
	
}

function getGames(options,overwrite,cb){

	var r = {};
	var el = 0;
	pinnacle.getFixtures(options, function(err, response, body) {
		if (err) {
			r['status'] = 0;
			r['error'] = err;
			cb(r);
		}

		if(body){
			var sportId = body.sportId;
			var leagues = body.league;
			leagues.forEach(function(league){
				var leagueId = league.id;
				var eventLength = league.events.length;
				el = el + eventLength;
				if (eventLength > 0){
					
					logger(sportId+" "+leagueId+" "+league.events.length);
					
					var events = league.events;
					
					events.forEach(function(event){
						var eventId = event.id;
						var eventUTC = event.starts;
						var rot = event.rotNum;
						var home = event.home;
						var away = event.away;
						var live = event.liveStatus;
						var status = event.status;
						var parlay = event.parlayRestriction;
						var homePitcher = null;
						var awayPitcher = null;
						if(event.hasOwnProperty('homePitcher')){
							homePitcher = event.homePitcher;
						}
						if(event.hasOwnProperty('awayPitcher')){
							awayPitcher = event.awayPitcher;
						}
						var dt = moment(eventUTC);
						var eventDT = dt.tz('America/New_York');
						var newDT = new Date(eventDT);
						//logger(eventDT+" "+newDT);
						//logger(eventId+" "+eventDT+" "+home+" "+away);
						
						checkGame(eventId, function(id) {
							if (!id){
								addGame(sportId,leagueId,eventId,newDT,away,home,rot,live,status,parlay,awayPitcher,homePitcher);
							} 
							//else {
							//	logger("Game Already in the System");
							//}
						});
						
					});
				}
			});
			r['status'] = 1;
			r['sportId'] = sportId;
			r['events'] = el;
		} else {
			r['status'] = 1;
			r['events'] = el;
		}
		cb(r);
	});

}

function addSince(sportID,leagueID,since){
		
	sql.execute( {  
        query: "INSERT INTO PINN_SINCE (sportID,leagueID,since) VALUES (@sport,@league,@since)",
        params: {
            sport	: { type: sql.INT, val: sportID },
			league	: { type: sql.VARCHAR, val: leagueID },
			since	: { type: sql.BIGINT, val: since }
        }
    } ).then( function( results ) {
        logger( "Since Added" );
    }, function( err ) {
        logger( "Something bad happened:", err );
    } );
	
}

function addGame(sportID,leagueID,eventID,gameDT,away,home,rot,live,st,parlay,awayPitcher,homePitcher){
		
	sql.execute( {  
        query: "INSERT INTO PINN_GAME (sportID,leagueID,eventID,gameDT,awayTeam,homeTeam,rotNum,liveStatus,gameStatus,"+
			"parlayRestriction,awayPitcher,homePitcher) values (@sport,@league,@event,@gameDT,@away,@home,@rotNum,"+
			"@live,@status,@parlay,@awayPitcher,@homePitcher)",
        params: {
            sport		: { type: sql.INT, val: sportID },
			league		: { type: sql.INT, val: leagueID },
			event		: { type: sql.BIGINT, val: eventID },
			gameDT		: { type: sql.DATETIMEOFFSET, val: gameDT },
			away		: { type: sql.VARCHAR, val: away },
			home		: { type: sql.VARCHAR, val: home },
			rotNum		: { type: sql.INT, val: rot },
			live		: { type: sql.INT, val: live },
			status		: { type: sql.CHAR, val: st },
			parlay		: { type: sql.INT, val: parlay },
			awayPitcher : { type: sql.VARCHAR, val: awayPitcher },
			homePitcher : { type: sql.VARCHAR, val: homePitcher }
        }
    } ).then( function( results ) {
        logger( "Game Added" );
    }, function( err ) {
        logger( "Something bad happened:", err );
    } );
	
}

function addLine(sportID,leagueID,eventID,lineID,periodID,periodCutoff,live,alt,altID,hsp,vsp,hodds,vodds,hml,vml,draw,total,totalOv,totalUn){
		
	sql.execute( {  
        query: "INSERT INTO PINN_LINE (sportID,leagueID,eventID,lineID,periodID,periodCutoff,isLive,isAlternative,altLineID,"+
			"visitorSpread,homeSpread,visitorOdds,homeOdds,visitorML,homeML,draw,total,totalOver,totalUnder) "+
			"VALUES (@sport,@league,@event,@line,@period,@cutoff,@live,@alt,@altID,@vsp,@hsp,@vodds,@hodds,"+
			"@vml,@hml,@draw,@total,@totalOv,@totalUn)",
        params: {
            sport	: { type: sql.INT, val: sportID },
			league	: { type: sql.INT, val: leagueID },
			event	: { type: sql.BIGINT, val: eventID },
			line	: { type: sql.BIGINT, val: lineID },
			period	: { type: sql.INT, val: periodID },
			cutoff	: { type: sql.BIT, val: periodCutoff },
			live	: { type: sql.BIT, val: live },
			alt		: { type: sql.INT, val: alt },
			altID	: { type: sql.BGIINT, val: altID },
			vsp 	: { type: sql.MONEY, val: vsp },
			hsp 	: { type: sql.MONEY, val: hsp },
			vodds	: { type: sql.INT, val: vodds },
			hodds	: { type: sql.INT, val: hodds },
			vml		: { type: sql.INT, val: vml },
			hml		: { type: sql.INT, val: hml },
			draw	: { type: sql.INT, val: draw },
			total	: { type: sql.MONEY, val: total },
			totalOv	: { type: sql.INT, val: totalOv },
			totalUn	: { type: sql.INT, val: totalUn },
        }
    } ).then( function( results ) {
        //logger( "Line Added" );
		if (alt == 0){
			var linetosend = {
				"u" : "g8",
				"p" : "g8bridge",
				"action" : "setValue",
				"sid" : sportID,
				"eid" : eventID,
				"pid" : periodID,
				"lid" : "154",
				"vml" : vml,
				"hml" : hml,
				"ttl" : total,
				"tov" : totalOv,
				"tun" : totalUn,
				"vsd" : vsp,
				"vso" : vodds,
				"hsd" : hsp,
				"hso" : hodds,
				"draw" : draw
			}
			sendLine(linetosend,function(lineResult){
				logger(lineResult);
			});
		}
    }, function( err ) {
        logger( "Something bad happened:", err );
    } );
	
}

function checkLastSince(sportID,leagueID,cb){
	
	var since = "";
	var r = { sportId : sportID, leagueids : leagueID.toString() };
	
	sql.execute( {  
        query: "SELECT TOP 1 since FROM PINN_SINCE WHERE sportId = @sport AND leagueID = @league ORDER BY id DESC",
        params: {
            sport  : { type: sql.INT, val: sportID },
			league : { type: sql.VARCHAR, val: leagueID }
        }
    } ).then( function( results ) {
		
		if (results.length > 0){
			since = results[0].since;
		}
		
		if (since === ""){
			cb(r)
		} else {
			r['since'] = since;
			cb(r);
		}
		
    }, function( err ) {
        logger( "Something bad happened:", err );
    } );
	
}

function getLines(options,cb) {
	
	var r = {};
	var eventLength = 0;
	var el = 0;
	
	pinnacle.getOdds(options, function(err, response, body) {
		if (err) {
			r['status'] = 0;
			r['error'] = err;
			cb(r);
		}

		if (body){
			var sportId = body.sportId;
			var last = body.last;
			leagueList = options.leagueids.toString();
			addSince(sportId,leagueList,last);
			for(var myKey in body.leagues) {
				var leagueId = body.leagues[myKey].id;
				eventLength = body.leagues[myKey].events.length;
				el = el + eventLength;
				if (eventLength > 0){
					var events = body.leagues[myKey].events;
					events.forEach(function(line){
						var live = 0;
						var isAlternative = 0;
						var alternativeID = null;
						var homeSpread = null;
						var awaySpread = null;
						var homeOdds = null;
						var awayOdds = null;
						var totalPoints = null;
						var totalOver   = null;
						var totalUnder  = null;
						var awayML = null;
						var homeML = null;
						var draw   = null;
						var eventId = line.id;
						var periods = line.periods;
						
						periods.forEach(function(period){
							var lineID = period.lineId;
							var periodID = period.number;
							var cutoff = period.cutoff;
							var dt = moment(cutoff);
							var eventDT = dt.tz('America/New_York');
							var periodCutoff = new Date(eventDT);
							//SPREAD
							if(period.hasOwnProperty('spreads')){
								var spreads = period.spreads;
								for (var spread in spreads){
									if(spreads[spread].hasOwnProperty('altLineId')){
										var altHomeSpread = null;
										var altAwaySpread = null;
										var altHomeSpreadOdds = null;
										var altAwaySpreadOdds = null;
										isAlternative = 1;
										alternativeID = spreads[spread].altLineId;
										altHomeSpread = spreads[spread].hdp;
										altAwaySpread = altHomeSpread*-1;
										altHomeSpreadOdds = spreads[spread].home;
										altAwaySpreadOdds = spreads[spread].away;
										addLine(sportId,leagueId,eventId,lineID,periodID,periodCutoff,live,isAlternative,alternativeID,
											altHomeSpread,altAwaySpread,altHomeSpreadOdds,altAwaySpreadOdds,null,null,null,null,null,null);
									} else {
										homeSpread = spreads[spread].hdp;
										awaySpread = homeSpread*-1;
										homeOdds = spreads[spread].home;
										awayOdds = spreads[spread].away;
									}
									//logger(alternativeID+" "+homeSpread);
								}
							}
							//MONEYLINE
							if(period.hasOwnProperty('moneyline')){
								homeML = period.moneyline.home;
								awayML = period.moneyline.away;
								if (period.moneyline.hasOwnProperty('draw')){
									draw = period.moneyline.draw;
								}
								//logger(homeML+" "+awayML);
							}
							//TOTAL
							if(period.hasOwnProperty('totals')){
								var totals = period.totals;
								for (var total in totals){
									if(totals[total].hasOwnProperty('altLineId')){
										var altTotal = null;
										var altTotalOver = null;
										var altTotalUnder = null;
										isAlternative = 1;
										alternativeID = totals[total].altLineId;
										altTotal 	  = totals[total].points;
										altTotalOver  = totals[total].over;
										altTotalUnder = totals[total].under;
										addLine(sportId,leagueId,eventId,lineID,periodID,periodCutoff,live,isAlternative,alternativeID,
											null,null,null,null,null,null,null,altTotal,altTotalOver,altTotalUnder);
									} else {
										totalPoints = totals[total].points;
										totalOver   = totals[total].over;
										totalUnder  = totals[total].under;
									}
									//logger(alternativeID+" "+totalPoints+" "+totalOver+" / "+totalUnder);
								}
							}

							addLine(sportId,leagueId,eventId,lineID,periodID,periodCutoff,live,0,null,homeSpread,awaySpread,
									homeOdds,awayOdds,homeML,awayML,draw,totalPoints,totalOver,totalUnder);
							
						});
						
					});

				}
			}
			r['status'] = 1;
			r['sportId'] = sportId;
			r['events'] = el;
			//logger("Sport: "+sportId+"League: "+leagueId+" Lines Added: "+eventLength);
		} else {
			r['status'] = 1;
			r['events'] = eventLength;
		}
		cb(r);
	});
	
}

function sendLine(params, cb){
	request.post(
		'http://tools.golden8sports.com/bridge/index.asp',
		{ form: params },
		function (error, response, body) {
			//logger(body);
			if (!error && response.statusCode == 200) {
				cb(body);
			}
		}
	);
}