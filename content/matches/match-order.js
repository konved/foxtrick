/**
 * match-order.js
 * adding extra info to match order interface
 * @author convinced
 */

'use strict';

/* eslint-disable max-params, no-magic-numbers */
Foxtrick.modules['MatchOrderInterface'] = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.MATCHES,
	PAGES: ['matchOrder'],
	OPTIONS: [
		'GotTrainingOnField', 'DisplayLastMatchInDetails',
		'Specialties',
		'ShowFaces',
		'SwapPositions', 'StayOnPage',
		['CloneOrder', 'AutoExpandCloned'],
		'FixPenaltyTakers',
		[
			'AddPenaltyTakerButtons',
			'UseSubsForPenalties',
			'DontSortPenaltyTakers',
			'PrioritizeSP',
			'ClearPenaltyTakersFirst',
		],
	],
	CSS: Foxtrick.InternalPath + 'resources/css/match-order.css',
	OPTIONS_CSS: [
		null, null,
		Foxtrick.InternalPath + 'resources/css/match-order-specialties.css',
		Foxtrick.InternalPath + 'resources/css/match-order-faces.css',
		null, null,
		[Foxtrick.InternalPath + 'resources/css/match-order-clone.css'],
		null,
		[],
	],
	run: function(doc) {
		const module = this;

		let url = doc.location.href;
		var sourceSystem = Foxtrick.getUrlParam(url, 'SourceSystem');
		var isYouth = sourceSystem.toLowerCase() == 'youth' ||
			!!Foxtrick.getUrlParam(url, 'isYouth');

		var avatarsParamsString;
		var getAvatars;
		var getPlayers;
		var checkImages = function(doc, target, avatarsXml, getID, scale, recursion) {
			if (!Foxtrick.Prefs.isModuleOptionEnabled(module, 'ShowFaces'))
				return;

			var addImage = function(fieldplayer) {
				var id = getID(fieldplayer);
				if (!id)
					return false;

				let elName = `${isYouth ? 'Youth' : ''}Player`;
				var player = null;
				for (let p of avatarsXml.getElementsByTagName(elName)) {
					if (id === avatarsXml.num(`${elName}ID`, p)) {
						player = p;
						break;
					}
				}
				if (!player) {
					if (recursion) {
						Foxtrick.error(`Infinite recursion in ${module.MODULE_NAME}`);
					}
					else {
						// id not found, possibly new player, invalidate cache and refetch
						let now = Foxtrick.util.time.getHTTimeStamp(doc);
						Foxtrick.util.api.setCacheLifetime(avatarsParamsString, now);
						Foxtrick.log('New player found: refreshing player cache.');
						getPlayers(true);
						getAvatars(JSON.parse(avatarsParamsString), { recursion: true });
					}
					return true;
				}

				Foxtrick.addClass(fieldplayer, 'smallFaceCardBox');

				var shirt = fieldplayer.querySelector('.shirt');
				if (Foxtrick.hasClass(shirt, 'smallFaceCard'))
					return false;

				Foxtrick.addClass(shirt, 'smallFaceCard');
				var style = 'top:-20px; width:' + Math.round(100 / scale) + 'px; height:' +
					// eslint-disable-next-line no-magic-numbers
					Math.round(123 / scale) + 'px';
				shirt.setAttribute('style', style);

				Foxtrick.Pages.Match.makeAvatar(shirt, player, scale);
				return false;
			};

			// stop on first match
			Foxtrick.any(addImage, target.querySelectorAll('.player'));
		};
		var savePenaltySkills = function(playerList) {
			var players = {};
			for (let p of playerList) {
				// formula by HO
				// eslint-disable-next-line no-magic-numbers
				let skill = p.experience * 1.5 + p.setPieces * 0.7 + p.scoring * 0.3;
				// eslint-disable-next-line no-magic-numbers
				skill = p.specialtyNumber == 1 ? skill * 1.1 : skill;
				players[p.id] = skill;
			}
			Foxtrick.session.set('match-orders-penalty-skills', players)
				.catch(Foxtrick.catch('MO PenaltySkills'));
		};

		var checkSpecialties = function(doc, target, playerList, getID, targetClass) {
			if (Foxtrick.Prefs.isModuleOptionEnabled(module, 'Specialties')) {
				var cardsHealth = target.getElementsByClassName(targetClass);
				for (let card of cardsHealth) {
					let id = getID(card);
					if (!id || Foxtrick.hasClass(card, 'ft-specialty'))
						continue;

					let player = Foxtrick.Pages.Players.getPlayerFromListById(playerList, id);
					if (player && player.specialtyNumber) {
						Foxtrick.addClass(card, 'ft-specialty');
						let specIdx = player.specialtyNumber;
						let opts = { class: 'ft-specialty-img' };
						Foxtrick.addSpecialty(card, specIdx, opts)
							.catch(Foxtrick.catch('MOI addSpecialty'));
					}
				}
			}
		};

		// button to clone last order
		var runAddCloneButtons = function() {
			// the brain, remembers which id is what kind of setting, substitution, swap or change
			var mapping = {};

			if (Foxtrick.Prefs.isModuleOptionEnabled(module, 'CloneOrder')) {
				var getLastNode = function() {
					var orders = doc.getElementsByClassName('substitution');
					if (!orders.length)
						return null;

					return orders[orders.length - 1];
				};
				var getIdFromNode = function(node) {
					try {
						return parseInt(node.id.match(/\d+/)[0], 10);
					}
					catch (e) {
						return 0;
					}
				};
				var getLastId = function() {
					var lastnode = getLastNode();
					if (lastnode !== null)
						return getIdFromNode(lastnode);
					return 0;
				};

				// figure out the types of the loaded stuff
				var figureLoadedOrders = function() {
					var orders = doc.getElementsByClassName('substitution');
					if (!orders.length)
						return;

					for (let order of orders) {
						let id = getIdFromNode(order);
						if (!id)
							continue;

						if (doc.getElementById('change_' + id))
							mapping[id] = 'addChange';
						if (doc.getElementById('swapout_' + id))
							mapping[id] = 'addSwap';
						if (doc.getElementById('out_' + id))
							mapping[id] = 'addSub';
					}
				};

				// addCloneAsTypeButton
				var addCloneAsTypeButtonForNode = function(node, type, className, title, alt,
				                                           text, linkType) {

					if (node.getElementsByClassName(className).length)
						return;

					let sub = node.querySelector('.remove');
					let cloned = Foxtrick.cloneElement(sub, true);
					cloned.textContent = text;
					Foxtrick.removeClass(cloned, 'remove');
					Foxtrick.addClass(cloned, className);
					Foxtrick.addClass(cloned, 'ft-match-order-clone-button');
					cloned.title = title;
					cloned.alt = alt;
					node.appendChild(cloned);

					Foxtrick.onClick(cloned, function() {
						// eslint-disable-next-line no-use-before-define, no-invalid-this
						cloneAsTypeById(getIdFromNode(this.parentNode), linkType);
					});
				};
				var cloneOpts = {
					clone: {
						title: Foxtrick.L10n.getString('matchOrder.cloneOrder'),
						alt: Foxtrick.L10n.getString('matchOrder.cloneOrder'),
						text: Foxtrick.L10n.getString('matchOrder.cloneOrder.abbr'),
					},
					addSwap: {
						title: Foxtrick.L10n.getString('matchOrder.cloneAsSwap'),
						alt: Foxtrick.L10n.getString('matchOrder.cloneAsSwap'),
						text: Foxtrick.L10n.getString('matchOrder.cloneAsSwap.abbr'),
					},
					addChange: {
						title: Foxtrick.L10n.getString('matchOrder.cloneAsChange'),
						alt: Foxtrick.L10n.getString('matchOrder.cloneAsChange'),
						text: Foxtrick.L10n.getString('matchOrder.cloneAsChange.abbr'),
					},
					addSub: {
						title: Foxtrick.L10n.getString('matchOrder.cloneAsSub'),
						alt: Foxtrick.L10n.getString('matchOrder.cloneAsSub'),
						text: Foxtrick.L10n.getString('matchOrder.cloneAsSub.abbr'),
					},
				};
				var addCloneButtonForNodeByType = function(node, type, idx) {
					let opts = cloneOpts[type];
					let { title, alt, text } = opts;

					let tp = type;
					if (tp == 'clone')
						tp = mapping[getIdFromNode(node)];

					let desiredClass = 'ft-match-order-clone-' + idx;
					// FIXME
					addCloneAsTypeButtonForNode(node, tp, desiredClass, title, alt, text, tp);
				};
				var cloneAsTypeById = function(srcId, type) {
					var id;
					var cloneSettings = function(sourceId, targetId) {
						// adjust minutes
						var min = doc.getElementById('minutestext_' + targetId);
						var minOrg = doc.getElementById('minutestext_' + sourceId);

						while (min.textContent != minOrg.textContent)
							doc.getElementById('minutesplus_' + id).click();

						// display advanced, default copy from src, otherwise autoexpand
						let advTarget = doc.getElementById('advanced_' + targetId);
						let advSource = doc.getElementById('advanced_' + sourceId);
						if (Foxtrick.Prefs.isModuleOptionEnabled(module, 'AutoExpandCloned'))
							advTarget.setAttribute('style', 'display:block;');
						else
							advTarget.setAttribute('style', advSource.getAttribute('style'));

						// behaviour
						let behTarget = doc.getElementById('behaviour_' + targetId);
						let behSource = doc.getElementById('behaviour_' + sourceId);
						if (behTarget && behSource)
							behTarget.value = behSource.value;

						// cardcond
						doc.getElementById('cardcond_' + targetId).value =
							doc.getElementById('cardcond_' + sourceId).value;

						// standingcond
						doc.getElementById('standingcond_' + targetId).value =
							doc.getElementById('standingcond_' + sourceId).value;

						// minifield
						// it does not make much sence to clone the minifield and might lead to
						// unwanted errors
					};

					// get button for the order by id
					var srcTypeButton = doc.getElementById(type);

					// click it
					srcTypeButton.click();

					// get id of the cloned entry and update mapping
					id = getLastId();
					mapping[id] = mapping[srcId];

					// clone the settings
					cloneSettings(srcId, id);
				};

				var addCloneButtonsForNode = function(node) {

					// counter for class naming, used in styling
					var i = 0;

					// normal clone button
					addCloneButtonForNodeByType(node, 'clone', ++i);

					var type = mapping[getIdFromNode(node)];

					if (type != 'addSub')
						addCloneButtonForNodeByType(node, 'addSub', ++i);

					if (type != 'addChange')
						addCloneButtonForNodeByType(node, 'addChange', ++i);

					if (type != 'addSwap')
						addCloneButtonForNodeByType(node, 'addSwap', ++i);
				};

				figureLoadedOrders();
				var orders = doc.querySelectorAll('.substitution');
				if (orders.length) {
					for (let order of orders)
						addCloneButtonsForNode(order);
				}
			}
		};

		var makeCopyTemplate = function() {
			var POS_TITLE_TMPL = '[th align=center]{p{0}Title}[/th]\n';
			var PLAYER_TMPL = '[td align=center]{p{0}Name}\n[playerid={p{0}Id}]\n' +
				'[b]{p{0}Spec}[/b]\n{p{0}Dir}[/td]\n';

			var template = '{teams} [matchid={matchId}]\n' +
				'{formation}\n{tacticsStr} [u]{tactics}[/u]\n\n' +
				'[table][tr][th colspan=5 align=center]{lineupStr}[/th][/tr]\n' +
				'[tr][th colspan=2][/th][th align=center]{kpPosition}[/th]' +
				'[th colspan=2][/th][/tr]\n[tr][td colspan=2][/td]\n';

			template += Foxtrick.format(PLAYER_TMPL, [0]);

			template += '[td colspan=2][/td][/tr]\n[tr][th align=center]{rwbPosition}[/th]' +
				'[th colspan=3 align=center]{cdsPosition}[/th]' +
				'[th align=center]{lwbPosition}[/th][/tr]\n[tr]\n';

			Foxtrick.forEach(function(num) {
				template += Foxtrick.format(PLAYER_TMPL, [num]);
			}, [1, 2, 3, 4, 5]);

			template += '[/tr]\n[tr][th align=center]{rwPosition}[/th]' +
				'[th colspan=3 align=center]{imsPosition}[/th]' +
				'[th align=center]{lwPosition}[/th][/tr]\n[tr]\n';

			Foxtrick.forEach(function(num) {
				template += Foxtrick.format(PLAYER_TMPL, [num]);
			}, [6, 7, 8, 9, 10]);

			template += '[/tr]\n[tr][th][/th]' +
				'[th colspan=3 align=center]{fwsPosition}[/th][th][/th][/tr]\n[tr][td][/td]\n';

			Foxtrick.forEach(function(num) {
				template += Foxtrick.format(PLAYER_TMPL, [num]);
			}, [11, 12, 13]);

			template += '[td][/td][/tr][/table]\n\n' +
				'[table][tr][th colspan=5 align=center]{bench}[/th][/tr]\n[tr]\n';

			Foxtrick.forEach(function(num) {
				template += Foxtrick.format(POS_TITLE_TMPL, [num]);
			}, [14, 15, 16, 17, 18]);

			template += '[/tr]\n[tr]\n';

			Foxtrick.forEach(function(num) {
				template += Foxtrick.format(PLAYER_TMPL, [num]);
			}, [14, 15, 16, 17, 18]);

			template += '[/tr][/table]\n\n[table][tr]\n';

			Foxtrick.forEach(function(num) {
				template += Foxtrick.format(POS_TITLE_TMPL, [num]);
			}, [19, 20]);

			template += '[/tr]\n[tr]\n';

			Foxtrick.forEach(function(num) {
				template += Foxtrick.format(PLAYER_TMPL, [num]);
			}, [19, 20]);

			template += '[/tr][/table]';

			return template;
		};


		/** @type {Listener<HTMLElement, MouseEvent>} */
		var copyLineup = function() {
			// eslint-disable-next-line no-invalid-this
			var doc = this.ownerDocument;
			var COPY_TMPL = makeCopyTemplate();

			// right: 1, left: -1
			var X_DIRS = {
				middle: [0, 1, 0, 0, 0, -1, 1, 0, 0, 0, -1],
				wing: [0, 0, -1, 0, 1, 0, 0, -1, 0, 1, 0, -1, 0, 1],
			};
			var DIRS = {
				offensive: '▼',
				defensive: '▲',
				right: '▶',
				left: '◀︎',
			};

			var data = {
				tacticsStr: Foxtrick.L10n.getString('match.tactics'),
				lineupStr: Foxtrick.L10n.getString('match.lineup'),
				bench: Foxtrick.L10n.getString('match.bench'),
			};

			var STRINGS = [
				'kpPosition',
				'rwbPosition',
				'cdsPosition',
				'lwbPosition',
				'rwPosition',
				'imsPosition',
				'lwPosition',
				'fwsPosition',
			];
			Foxtrick.forEach(function(str) {
				data[str] = Foxtrick.L10n.getString(str);
			}, STRINGS);

			Foxtrick.forEach(function(pos) {
				data['p' + pos + 'Title'] = doc.getElementById(pos + '_text').textContent.trim();
			}, [14, 15, 16, 17, 18, 19, 20]);

			// get team names and highlight own team
			var crumbs = Foxtrick.Pages.All.getBreadCrumbs(doc);
			var thisTeam = crumbs[0].textContent.trim();
			var bothTeams = crumbs[1].textContent.trim();
			var re = Foxtrick.strToRe(thisTeam);
			var matched = bothTeams.match(re);
			data.teams = matched ?
				bothTeams.replace(re, `[b]${thisTeam}[/b]`) :
				bothTeams += ` - [b]${thisTeam}[/b]`;

			data.matchId = Foxtrick.util.id.getMatchIdFromUrl(doc.location.href) || '';
			data.formation = doc.getElementById('formations').textContent.trim();

			// tactics
			// var teamTacticsTitle = module.getTacticsLabel(doc);
			var teamTacticsSelect = doc.getElementById('teamtactics');
			var selectedTactics = teamTacticsSelect.options[teamTacticsSelect.selectedIndex];
			data.tactics = selectedTactics.textContent.trim();

			// positions
			Foxtrick.forEach(function(posDiv, pos) {
				var player = posDiv.querySelector('.player');
				if (!player)
					return;

				var id = player.id.match(/\d+/)[0];
				data['p' + pos + 'Id'] = id;

				var name = Foxtrick.cloneElement(player.querySelector('.name'), true);
				var nrSpan = name.querySelector('span');
				if (nrSpan)
					nrSpan.parentNode.removeChild(nrSpan);

				data['p' + pos + 'Name'] = name.textContent.trim();

				var dir;
				for (var x in X_DIRS) {
					if (Foxtrick.hasClass(posDiv, x)) {
						var dirNum = X_DIRS[x][pos];
						if (dirNum)
							dir = dirNum === 1 ? 'right' : 'left';

						break;
					}
				}
				for (var d in DIRS) {
					if (Foxtrick.hasClass(posDiv, d)) {
						dir = d;
						break;
					}
				}
				if (dir)
					data['p' + pos + 'Dir'] = DIRS[dir];

				// spec
				var strip = doc.querySelector('#players #list_playerID' + id);
				var json = JSON.parse(strip.dataset.json);
				var spec = Foxtrick.L10n.getSpecialtyFromNumber(json.specialty);
				if (spec)
					data['p' + pos + 'Spec'] = spec;

			}, doc.querySelectorAll('#fieldplayers .position'));

			var ret = Foxtrick.format(COPY_TMPL, data);

			// prune missing
			var PRUNE_PTRNS = [
				'{p0Name}\n[playerid={p0Id}]\n',
				'[b]{p0Spec}[/b]\n',
				'{p0Dir}',
			];
			Foxtrick.forEach(function(ptrn) {
				var reStr = Foxtrick.strToRe(ptrn).replace(/0/g, '\\d+');
				var re = new RegExp(reStr, 'g');
				ret = ret.replace(re, '');
			}, PRUNE_PTRNS);

			Foxtrick.copy(doc, ret);
			var copied = Foxtrick.L10n.getString('copy.lineup.copied');
			Foxtrick.util.note.add(doc, copied, 'ft-ratings-copy-note');
		};

		/** @param {document} doc */
		var runMatchOrder = function(doc) {
			var getID = function(fieldplayer) {
				if (!fieldplayer.id)
					return null;
				return Number(fieldplayer.id.match(/list_playerID(\d+)/i)[1]);
			};
			var getIDParent = function(node) {
				if (!node.parentNode.id)
					return null;
				return Number(node.parentNode.id.match(/list_playerID(\d+)/i)[1]);
			};

			// add extra info
			var hasPlayerInfo = false;
			var hasAvatars = false;
			var hasInterface = false;
			var playerList = null;
			var avatarsXml = null;

			var teamId = Foxtrick.Pages.Match.getMyTeamId(doc);

			// load ahead players and then wait for interface loaded
			getPlayers = function(fresh) {
				// TODO promisify
				Foxtrick.Pages.Players.getPlayerList(doc, (playerInfo) => {
					if (!playerInfo || playerInfo.length === 0) {
						Foxtrick.log('unable to retrieve player list.');
						return;
					}

					Foxtrick.log('hasPlayerInfo');
					hasPlayerInfo = true;
					playerList = playerInfo;

					savePenaltySkills(playerList);

					if (hasInterface) {
						// eslint-disable-next-line no-use-before-define
						showPlayerInfo(doc.getElementById('orders'));
					}
				}, { teamId: teamId, currentSquad: true, includeMatchInfo: true, refresh: fresh });
			};
			getPlayers();

			/** @type {CHPPParams} */
			var avatarsParams = [
				['file', (isYouth ? 'youth' : '') + 'avatars'],
				['version', '1.1'],
				[(isYouth ? 'youthT' : 't') + 'eamId', teamId],
			];
			avatarsParamsString = JSON.stringify(avatarsParams); // save as string (immutable)
			getAvatars = function(avatarsParams, opts) {
				/** @type {CHPPOpts} */
				let cOpts = { cache: 'session' };
				Foxtrick.util.api.retrieve(doc, avatarsParams, cOpts, (xml, errorText) => {
					if (!xml || errorText) {
						Foxtrick.log(errorText);
						return;
					}
					Foxtrick.log('hasAvatars');
					avatarsXml = xml;
					hasAvatars = true;
					var field = doc.getElementById('field');
					var rec = opts && opts.recursion;
					// TODO promisify
					if (hasInterface)
						checkImages(doc, field, avatarsXml, getID, 3, rec);
				});
			};
			getAvatars(avatarsParams);

			// eslint-disable-next-line complexity
			var waitForInterface = function(ev) {
				if (hasInterface)
					return;
				Foxtrick.log('hasInterface');
				hasInterface = true;
				if (hasPlayerInfo) {
					// eslint-disable-next-line no-use-before-define
					showPlayerInfo(doc.getElementById('orders'));
				}

				if (hasAvatars)
					checkImages(doc, doc.getElementById('field'), avatarsXml, getID, 3);

				// copy lineup
				if (!doc.getElementById('ft_copy_lineup')) {
					var copyLineupDiv = Foxtrick.createFeaturedElement(doc, module, 'div');
					copyLineupDiv.id = 'ft_copy_lineup';
					var copyLineupLink = doc.createElement('span');
					copyLineupLink.textContent = Foxtrick.L10n.getString('button.copy');
					copyLineupDiv.appendChild(copyLineupLink);
					Foxtrick.onClick(copyLineupLink, copyLineup);
					var formations = doc.getElementById('formations');
					formations.parentNode.insertBefore(copyLineupDiv, formations.nextSibling);
				}

				// checkbox to swap positions
				var needsSwapPositions =
					Foxtrick.Prefs.isModuleOptionEnabled(module, 'SwapPositions');

				if (needsSwapPositions && !doc.getElementById('ft_swap_positions')) {
					let swapPositionsDiv = Foxtrick.createFeaturedElement(doc, module, 'div');
					swapPositionsDiv.id = 'ft_swap_positions';
					let swapPositionsLink = doc.createElement('span');
					swapPositionsLink.textContent =
						Foxtrick.L10n.getString('matchOrder.swapPositions');
					swapPositionsDiv.appendChild(swapPositionsLink);
					let formations = doc.getElementById('formations');
					formations.parentNode.insertBefore(swapPositionsDiv, formations.nextSibling);
					doc.dispatchEvent(new Event('ftenableswap'));
					doc.documentElement.dataset.ftEnableSwap = true;
				}


				// fill & clear penalty takers
				var needsPenalties =
					Foxtrick.Prefs.isModuleOptionEnabled(module, 'AddPenaltyTakerButtons');

				if (needsPenalties && !doc.getElementById('ft_penalty_controls')) {

					var penaltyOptionsDiv = doc.createElement('div');
					penaltyOptionsDiv.id = 'ft_penalty_options';
					var options = [
						'UseSubsForPenalties',
						'DontSortPenaltyTakers',
						'PrioritizeSP',
						'ClearPenaltyTakersFirst',
					];

					for (let opt of options) {
						var toggleDiv = doc.createElement('div');
						var toggle = doc.createElement('input');
						toggle.type = 'checkbox';
						toggle.id = 'ft-penaltyOpt-' + opt;
						toggle.checked = Foxtrick.Prefs.isModuleOptionEnabled(module, opt);
						Foxtrick.onClick(toggle, function(ev) {
							var on = ev.target.checked;
							let oName = `${module.MODULE_NAME}.${opt}`;
							Foxtrick.Prefs.setModuleEnableState(oName, on);
						});
						toggleDiv.appendChild(toggle);
						var togLabel = doc.createElement('label');
						togLabel.htmlFor = `ft-penaltyOpt-${opt}`;
						togLabel.textContent =
							Foxtrick.L10n.getString(`module.${module.MODULE_NAME}.${opt}.desc`);
						toggleDiv.appendChild(togLabel);
						penaltyOptionsDiv.appendChild(toggleDiv);
					}

					var fillPenaltyTakersLink = doc.createElement('span');
					fillPenaltyTakersLink.id = 'ft_fill_penalty_takers';
					fillPenaltyTakersLink.textContent =
						Foxtrick.L10n.getString('matchOrder.fillPenaltyTakers');

					Foxtrick.onClick(fillPenaltyTakersLink, function() {

						var useSubs =
							Foxtrick.Prefs.isModuleOptionEnabled(module, 'UseSubsForPenalties');
						var doSort =
							!Foxtrick.Prefs.isModuleOptionEnabled(module, 'DontSortPenaltyTakers');
						var priority =
							Foxtrick.Prefs.isModuleOptionEnabled(module, 'PrioritizeSP');
						var clearFirst =
							Foxtrick.Prefs.isModuleOptionEnabled(module, 'ClearPenaltyTakersFirst');

						if (clearFirst)
							doc.getElementById('ft_clear_penalty_takers').click();

						// TODO promisify
						// eslint-disable-next-line complexity
						Foxtrick.sessionGet('match-orders-penalty-skills', (ps) => {

							// collect data about existing kickers first
							var taken = [], placed = [], sp;

							// let's find the sp player (position #20)
							var spPlayer = doc.getElementById(20).firstChild;
							if (spPlayer)
								sp = spPlayer.id;

							for (var i = 21; i < 32; ++i) { // position #21 is first kicker
								taken[i] = doc.getElementById(i).firstChild;
								if (taken[i])
									placed[taken[i].id] = i;
							}
							var lastTaken = 20; // index to last filled position

							var players = [...doc.querySelectorAll('#players > div')];

							if (doSort && hasPlayerInfo && typeof ps !== 'undefined') {
								players.sort(function(a, b) { // sort descending
									var [aid] = a.id.match(/\d+/);
									var [bid] = b.id.match(/\d+/);

									if (ps[aid] == null && ps[bid] == null)
										return 0;
									if (ps[aid] == null)
										return 1;
									if (ps[bid] == null)
										return -1;

									return ps[bid] - ps[aid];
								});
							}

							if (priority && sp) {
								let idx = players.findIndex(p => p.id == sp);

								// remove sp taker from the middle and add to the front
								let [taker] = players.splice(idx, 1);
								players.unshift(taker);
							}

							// eslint-disable-next-line no-magic-numbers
							for (let player of players) {
								if (lastTaken >= 31)
									break;

								// player exists and we have unchecked positions

								// skip unused players, already placed players and subs
								if (!useSubs && Foxtrick.hasClass(player, 'bench') ||
									!Foxtrick.hasClass(player, 'used') ||
								    placed[player.id])
									continue;

								// eslint-disable-next-line no-magic-numbers
								while (lastTaken < 31) {
									// next position exists
									if (taken[lastTaken + 1]) {
										// next position is taken: check another one
										++lastTaken;
										continue;
									}

									// next position is free: placing player
									player.click();
									doc.getElementById(lastTaken + 1).click();
									++lastTaken;

									// continue with next player
									break;
								}
							}
						});
					});

					var clearPenaltyTakersLink = doc.createElement('span');
					clearPenaltyTakersLink.id = 'ft_clear_penalty_takers';
					clearPenaltyTakersLink.textContent =
						Foxtrick.L10n.getString('matchOrder.clearPenaltyTakers');

					var penaltyButtons = doc.createElement('div');
					penaltyButtons.id = 'ft_penalty_buttons';
					penaltyButtons.appendChild(clearPenaltyTakersLink);
					penaltyButtons.appendChild(fillPenaltyTakersLink);
					var frag = Foxtrick.createFeaturedElement(doc, module, 'div');
					frag.id = 'ft_penalty_controls';
					frag.appendChild(penaltyButtons);
					frag.appendChild(doc.createElement('hr'));
					frag.appendChild(penaltyOptionsDiv);

					var penalties = doc.getElementById('tab_penaltytakers');
					penalties.appendChild(frag);
					doc.dispatchEvent(new Event('ftenablepenaltycontrols'));
					doc.documentElement.dataset.ftEnablePenaltyControls = true;
				}

				if (Foxtrick.Prefs.isModuleOptionEnabled(module, 'StayOnPage')) {
					doc.dispatchEvent(new Event('ftenablestay'));
					doc.documentElement.dataset.ftEnableStay = true;
				}
				if (Foxtrick.Prefs.isModuleOptionEnabled(module, 'FixPenaltyTakers')) {
					doc.dispatchEvent(new Event('ftenablepenaltiesfix'));
					doc.documentElement.dataset.ftEnablePenaltiesFix = true;
				}

				// add playerid to details
				Foxtrick.listen(doc.getElementById('players'), 'mouseover', function() {
					// eslint-disable-next-line consistent-this, no-invalid-this
					let el = this;
					if (Foxtrick.hasClass(el, 'player')) {
						var detailsTemplate = doc.getElementById('detailsTemplate');
						var idSearch = el.id.match(/list_playerID(\d+)/i);
						if (idSearch)
							detailsTemplate.setAttribute('playerid', idSearch[1]);
					}
				}, true);

				// listen to all that has players (seperatelly to reduce excessive calling)
				var details = doc.getElementById('details');
				Foxtrick.onChange(details, function() {
					// Foxtrick.log('details change');
					let display =
						Foxtrick.Prefs.isModuleOptionEnabled(module, 'DisplayLastMatchInDetails');
					if (hasPlayerInfo) {
						if (display) {
							// eslint-disable-next-line no-use-before-define
							addLastMatchtoDetails();
						}
						if (Foxtrick.Prefs.isModuleEnabled('LoyaltyDisplay')) {
							// TODO make module method
							// eslint-disable-next-line no-use-before-define
							injectLoyaltyBars();
						}
					}
				});

				var list = doc.getElementById('list');
				Foxtrick.onChange(list, function() {
					// Foxtrick.log('list change');
					if (hasPlayerInfo) {
						// TODO make module method
						// eslint-disable-next-line no-use-before-define
						showPlayerInfo(list);
					}
					if (hasAvatars)
						checkImages(doc, list, avatarsXml, getID, 3);
				});

				var fieldplayers = doc.getElementById('fieldplayers');
				Foxtrick.onChange(fieldplayers, function() {
					// Foxtrick.log('fieldplayers change');
					if (hasPlayerInfo) {
						// eslint-disable-next-line no-use-before-define
						showPlayerInfo(fieldplayers);
					}
					if (hasAvatars)
						checkImages(doc, fieldplayers, avatarsXml, getID, 3);
				});

				var tabSubs = doc.getElementById('tab_subs');
				Foxtrick.onChange(tabSubs, function() {
					// Foxtrick.log('tab_subs change');
					if (hasPlayerInfo) {
						// eslint-disable-next-line no-use-before-define
						showPlayerInfo(tabSubs);
					}
					if (hasAvatars)
						checkImages(doc, tabSubs, avatarsXml, getID, 3);

					runAddCloneButtons();
				});

				var tabPenaltytakers = doc.getElementById('tab_penaltytakers');
				Foxtrick.onChange(tabPenaltytakers, function() {
					// Foxtrick.log('tab_penaltytakers change');
					if (hasPlayerInfo) {
						// eslint-disable-next-line no-use-before-define
						showPlayerInfo(tabPenaltytakers);
					}
					if (hasAvatars)
						checkImages(doc, tabPenaltytakers, avatarsXml, getID, 3);
				});
			};

			var addLastMatchtoDetails = function() {
				// add last match to details
				let details = doc.getElementById('details');
				let specials = details.querySelector('.specials');
				if (!specials || details.querySelector('.ft-extraInfo'))
					return;

				let playerId = Number(specials.parentElement.getAttribute('playerid'));
				if (!playerId)
					return;

				let player = Foxtrick.Pages.Players.getPlayerFromListById(playerList, playerId);
				if (!player || !player.lastMatchText)
					return;

				let span = doc.createElement('span');
				span.className = 'ft-extraInfo';
				span.appendChild(doc.createElement('br'));
				span.appendChild(doc.createTextNode(player.lastMatchText));
				specials.appendChild(span);
			};

			// loyalty, uses loyalty-display.js module code
			var injectLoyaltyBars = function() {
				var details = doc.getElementById('details');
				var specials = details.querySelector('.specials');
				if (specials) {
					let playerId = Number(specials.parentElement.getAttribute('playerid'));
					if (playerId) {
						let player =
							Foxtrick.Pages.Players.getPlayerFromListById(playerList, playerId);
						if (!player)
							return;

						let details = doc.getElementById('details');
						Foxtrick.modules['LoyaltyDisplay'].exec(player, details);
					}
				}
			};

			var showPlayerInfo = function(target) {
				// original version was removed due to HT request,
				// this highlights players on the field for supporters only
				if (Foxtrick.Prefs.isModuleOptionEnabled(module, 'GotTrainingOnField')) {
					// players aren't sent with the document
					// but the eventListeners will take care later
					var listPlayers = target.querySelectorAll('.player');
					if (!listPlayers.length)
						return;

					for (let player of listPlayers) {
						if (Foxtrick.hasClass(player, 'trained')) // only for supporters
							Foxtrick.addClass(player, 'ft-highlight-onfield');
					}
				}

				// show potential specialty icons
				checkSpecialties(doc, target, playerList, getIDParent, 'cards_health');
			};

			// @ts-ignore
			Foxtrick.listen(doc, 'ftinterfaceready', function(e) {
				let found = doc.querySelector('#tab_penaltytakers div');
				Foxtrick.log('interface ready:', !!found);
				waitForInterface();
			});
		};

		runMatchOrder(doc);
		Foxtrick.util.inject.jsLink(doc, Foxtrick.InternalPath + 'resources/js/matchOrder.js');
	},
};
