/**
* htms-points.js
* Foxtrick show HTMS points in player page
* @author taised
*/

////////////////////////////////////////////////// //////////////////////////////
//---------------------------------------------------------------------------

var FoxtrickHTMSPoints = {
	MODULE_NAME : "HTMSPoints",
	MODULE_CATEGORY : Foxtrick.moduleCategories.SHORTCUTS_AND_TWEAKS,
	PAGES : ["playerdetail"],

	run : function(page, doc) {
		var lang = FoxtrickPrefs.getString("htLanguage");
		var pageBase = "http://www.fantamondi.it/HTMS/nt.php?action=calc";
		var linkpage = "http://www.fantamondi.it/HTMS/index.php?page=nt&lang="+lang+"&action=calc";

		var skills = Foxtrick.Pages.Player.getSkillsWithText(doc);
		var age = Foxtrick.Pages.Player.getAge(doc);

		var skillList='&anni='+age.years+'&giorni='+age.days;
		//checking if bars or not
		var hasBars = (doc.getElementsByClassName("percentImage").length > 0);
		if (hasBars) {
			//bars
			var htmsValues=new Array('parate', 'difesa', 'regia', 'cross', 'passaggi', 'attacco', 'cp');
			var j=0;
			for (var i in skills.names) {
				//Foxtrick.dump('text: '+skills.texts[i]+' name: '+skills.names[i]+'\n');
				skillList+='&'+htmsValues[j]+'='+skills.values[i];
				j++;
			}
		}
		else {
			//normal, we skip stamina
			var htmsValues=new Array('parate', 'regia', 'passaggi', 'cross', 'difesa', 'attacco', 'cp');
			var skipStamina=true;
			var j=0;
			for (var i in skills.names) {
				if (skipStamina) {
					skipStamina=false;
				}
				else {
					skillList+='&'+htmsValues[j]+'='+skills.values[i];
					j++;
				}
			}
		}

		//creating the new element
		var ptable=doc.getElementById('ctl00_ctl00_CPContent_CPMain_pnlplayerInfo').getElementsByTagName('table').item(0);
		var nrow=ptable.insertRow(ptable.rows.length);
		var hcell=nrow.insertCell(0);
		hcell.innerHTML='<a href="'+linkpage+skillList+'" target="_blank">'+Foxtrickl10n.getString('foxtrick.htmsPoints.points')+' <span style="width: 16px; height: 16px; cursor: pointer;" class="foxtrickInfo">&nbsp; &nbsp;&nbsp;</span></a>';
		var ccell=nrow.insertCell(1);
		ccell.id='ft-htms-points';

		Foxtrick.LoadXML(pageBase + skillList, function(xml) {
				FoxtrickHTMSPoints.show_result(doc, xml);
			}, true);
	},

	show_result : function(doc, responseXML) {
		try {
			Foxtrick.stopListenToChange(doc);

			var pointsNow=responseXML.getElementsByTagName('HTMS_points').item(0).firstChild.nodeValue;
			var points28=responseXML.getElementsByTagName('HTMS_points_28').item(0).firstChild.nodeValue;

			//Foxtrick.dump('now: '+pointsNow+' - 28: '+points28);

			doc.getElementById('ft-htms-points').textContent = Foxtrickl10n.getString('foxtrick.htmsPoints.ability') + ': ' + pointsNow + ' / ' + Foxtrickl10n.getString('foxtrick.htmsPoints.potential') + ': ' + points28;

			Foxtrick.startListenToChange(doc);
		}
		catch (e) {
			Foxtrick.dumpError(e);
		}
	}
};
