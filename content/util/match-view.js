'use strict';
/* match-view.js
 * utilities for match view
 *
 * @author ryanli
 */

if (!Foxtrick)
	var Foxtrick = {};
if (!Foxtrick.util)
	Foxtrick.util = {};

Foxtrick.util.matchView = {};

Foxtrick.util.matchView.startLoad = function(container) {
	var doc = container.ownerDocument;
	var loading = Foxtrick.util.note.createLoading(doc);
	container.appendChild(loading);
};

Foxtrick.util.matchView.fillMatches = function(container, xml, errorText) {
	if (xml === null) {
		container.textContent = errorText;
		return;
	}

	var type2info = function(type, cup) {
		// convert match type integer to match type info
		// source:
		// https://www.hattrick.org/goto.ashx?path=/Community/CHPP/NewDocs/DataTypes.aspx%23matchTypeID
		var mapping = {
			1: { key: 'league', className: 'matchLeague' },
			2: { key: 'qualification', className: 'matchQualification' },
			4: { key: 'friendly', className: 'matchFriendly' },
			5: { key: 'friendly.cup', className: 'matchFriendly' },
			7: { key: 'masters', className: 'matchMasters' },
			8: { key: 'friendly', className: 'matchFriendly' },
			9: { key: 'friendly.cup', className: 'matchFriendly' },
			10: { key: 'nt.competitive', className: ' matchLeague' },
			11: { key: 'nt.competitive', className: ' matchLeague' },
			12: { key: 'nt.friendly', className: ' matchFriendly' },
			100: { key: 'youth.league', className: 'matchLeague' },
			101: { key: 'youth.friendly', className: 'matchFriendly' },
			103: { key: 'youth.friendly.cup', className: 'matchFriendly' },
			105: { key: 'youth.friendly', className: 'matchFriendly' },
			106: { key: 'youth.friendly.cup', className: 'matchFriendly' },
		};
		var cups = {
			4: { key: 'cupA', className: 'matchCupA' },
			7: { key: 'cupB1', className: 'matchCupB1' },
			8: { key: 'cupB2', className: 'matchCupB2' },
			9: { key: 'cupB3', className: 'matchCupB3' },
			10: { key: 'cupC', className: 'matchCupC' },
		};
		var obj = type == 3 ? cups[cup] : mapping[type];

		if (obj) {
			return {
				str: Foxtrick.L10n.getString('match.type.' + obj.key),
				className: obj.className
			};
		}
		return null;
	};
	var getMatchInfo = function(match) {
		var type = match.getElementsByTagName('MatchType')[0].textContent;
		var cupLvl = match.getElementsByTagName('CupLevel')[0].textContent;
		var cupIdx = match.getElementsByTagName('CupLevelIndex')[0].textContent;
		var cup = parseInt(cupLvl, 10) * 3 + parseInt(cupIdx, 10);
		return type2info(type, cup);
	};

	var doc = container.ownerDocument;

	container.textContent = ''; // clear container first
	var table = doc.createElement('table');
	container.appendChild(table);

	var teamId = xml.getElementsByTagName('TeamID')[0].textContent;
	var teamName = xml.getElementsByTagName('TeamName')[0].textContent;
	var isYouth = xml.bool('IsYouth');
	var matches = xml.getElementsByTagName('Match');

	// add one played and one not played
	var played = Foxtrick.filter(function(n) {
		return n.getElementsByTagName('Status')[0].textContent == 'FINISHED';
	}, matches);
	var notPlayed = Foxtrick.filter(function(n) {
		return n.getElementsByTagName('Status')[0].textContent != 'FINISHED';
	}, matches);

	// get last previous and first future match
	played.reverse();
	var toAdd = Foxtrick.map(function(type) {
		// only supported types (no HTO)
		return Foxtrick.nth(getMatchInfo, type);
	}, [played, notPlayed]);

	var nextmatchdate = toAdd[1] ? xml.time('MatchDate', toAdd[1]) : null;

	for (var i = 0; i < toAdd.length; ++i) {
		var match = toAdd[i];
		if (!match)
			continue;

		var matchId = match.getElementsByTagName('MatchID')[0].textContent;
		var homeTeam = match.getElementsByTagName('HomeTeamName')[0].textContent;
		var awayTeam = match.getElementsByTagName('AwayTeamName')[0].textContent;
		var homeId = match.getElementsByTagName('HomeTeamID')[0].textContent;
		var awayId = match.getElementsByTagName('AwayTeamID')[0].textContent;
		var side = (teamId == homeId) ? 'home' : 'away';
		var typeInfo = getMatchInfo(match);
		var status = match.getElementsByTagName('Status')[0].textContent;
		if (status == 'FINISHED') {
			var homeGoals = match.getElementsByTagName('HomeGoals')[0].textContent;
			var awayGoals = match.getElementsByTagName('AwayGoals')[0].textContent;
		}
		else {
			var homeGoals = null;
			var awayGoals = null;
		}

		var getMatchRow = function() {
			var rtl = Foxtrick.util.layout.isRtl(doc);

			var row = doc.createElement('tr');

			var type = match.getElementsByTagName('MatchType')[0].textContent;
			var matchTypeCell = doc.createElement('td');
			if (typeInfo) {
				var typeImg = doc.createElement('img');
				typeImg.src = '/Img/icons/transparent.gif';
				typeImg.className = typeInfo.className;
				typeImg.title = typeImg.alt = typeInfo.str;
				matchTypeCell.appendChild(typeImg);
			}
			row.appendChild(matchTypeCell);

			var matchCell = doc.createElement('td');
			var matchLink = doc.createElement('a');
			matchLink.setAttribute('data-match-type', type);
			matchLink.href = '/Club/Matches/Match.aspx?matchID=' + matchId
				+ (isYouth ? '&SourceSystem=Youth' : '&SourceSystem=Hattrick');
			// get in one line for standard theme while won't fit in one
			// line anyway for simple theme
			var cutlength = 12;
			if (!rtl) {
				matchLink.title = homeTeam + ' - ' + awayTeam;
				var span1 = doc.createElement('span');
				span1.className = 'nowrap';
				span1.textContent = homeTeam.substr(0, cutlength);
				matchLink.appendChild(span1);
				matchLink.appendChild(doc.createTextNode(' - '));
				var span2 = doc.createElement('span');
				span2.className = 'nowrap';
				span2.textContent = awayTeam.substr(0, cutlength);
				matchLink.appendChild(span2);
			}
			else {
				matchLink.title = awayTeam + ' - ' + homeTeam;
				var span1 = doc.createElement('span');
				span1.className = 'nowrap';
				span1.textContent = awayTeam.substr(0, cutlength);
				matchLink.appendChild(span1);
				matchLink.appendChild(doc.createTextNode(' - '));
				var span2 = doc.createElement('span');
				span2.className = 'nowrap';
				span2.textContent = homeTeam.substr(0, cutlength);
				matchLink.appendChild(span2);
			}
			matchCell.appendChild(matchLink);
			row.appendChild(matchCell);

			var resultCell = doc.createElement('td');
			if (homeGoals !== null && awayGoals !== null) {
				resultCell.textContent = homeGoals + ' - ' + awayGoals;
				homeGoals = Number(homeGoals);
				awayGoals = Number(awayGoals);
				if (homeGoals == awayGoals) {
					resultCell.className = 'draw';
				}
				else if ((homeGoals > awayGoals && side == 'home')
					|| (homeGoals < awayGoals && side == 'away')) {
					resultCell.className = 'won';
				}
				else {
					resultCell.className = 'lost';
				}
			}
			else {
				matchLink.setAttribute('data-live', '');
				// add HT-Live
				var liveLink = doc.createElement('a');
				liveLink.href = '/Club/Matches/Live.aspx?actionType=addMatch&matchID=' + matchId
					+ '&SourceSystem=' + (isYouth ? 'Youth' : 'Hattrick');
				var liveImg = doc.createElement('img');
				liveImg.className = 'matchHTLive';
				liveImg.src = '/Img/Icons/transparent.gif';
				liveImg.alt = liveImg.title = Foxtrick.L10n.getString('MyMonitor.htLive');
				liveLink.appendChild(liveImg);
				resultCell.appendChild(liveLink);
			}
			Foxtrick.addClass(resultCell, 'nowrap');
			row.appendChild(resultCell);
			return row;
		};

		table.appendChild(getMatchRow());
	}
	return nextmatchdate;
};
