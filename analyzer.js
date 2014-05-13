var EventEmitter = require("events").EventEmitter;

var mongo = require("mongodb");
var _ = require("lodash");
var Table = require("cli-table");

var server = new mongo.Server("localhost", 27017, { auto_reconnect: true });
var db = new mongo.Db("usageStats", server, { w: 1 });

db.open(function(err, db) {
	if(err) {
		throw err;
	}



	db.collection("actions", function(err, collection) {
		if(err) {
			throw err;
		}

		var analyzer = new EventEmitter();

		analyzer.on("done", function() {
			analyze(collection, function() {
				analyzer.emit("done");
			});
		});

		analyzer.emit("done");
	});
});

var prevOutput = "";

function analyze(collection, done) {
	var analyzers = [
		analyzePowerups,
		analyzeKeybindnings.bind(null, "-- Keybindings changed to --", "changed_to_left_key_binding", "changed_to_right_key_binding"),
		analyzeKeybindnings.bind(null, "-- Keybindings changed from --", "change_from_left_key_binding", "change_from_right_key_binding"),
		analyzeIllegalKeybindings,
		analyzeSettings
	];

	var num = _.size(analyzers);

	var numDone = 0;

	var output = new Array(num);

	var preDone = function() {
		numDone++;

		if(numDone === num) {
			var consoleOutput = new Array(40).join("\n");

			_.forEach(output, function(result) {
				consoleOutput += result;
			});

			if(prevOutput !== consoleOutput) {
				console.log(consoleOutput);
				prevOutput = consoleOutput;
			}

			done();
		}
	};

	_.forEach(analyzers, function(analyzer, i) {
		analyzer(collection, function(result) {
			output[i] = result;
			preDone();
		});
	});
}

function analyzePowerups(collection, done) {
	collection.find({"event": "change_power_up_setting", "extra.power_up": {$exists: true}}, {"sort": "date"}).toArray(function(err, items) {
		if(err) throw err;

		var counter = {};

		items.forEach(function(item) {
			if(!counter[item.extra.power_up]) {
				counter[item.extra.power_up] = {
					disabled: 0,
					enabled: 0
				};
			}

			if(item.extra.status === "on") {
				counter[item.extra.power_up].enabled++;
			} else {
				counter[item.extra.power_up].disabled++;
			}
		});

		var output = "-- Powerups disabled/enabled --" + "\n";

		var table = new Table({
			head: ["powerup", "enabled", "disabled"],
			colWidths: [30, 10, 10]
		});

		for(pu in counter) {
			var name = pu;
			var enabled = counter[pu].enabled;
			var disabled = counter[pu].disabled;

			table.push([name, enabled, disabled]);
		}

		output += table.toString() + "\n";

		done(output);
	});
}

function analyzeKeybindnings(header, left, right, collection, done) {
	var or = {};
	or["extra." + left] = { $exists: true };
	or["extra." + right] = { $exists: true };

	var find = {
		event: "change_player_setting",
		$or: [or]
	};

	var proj = {
		"_id": 0,
	};

	proj["extra." + left] = 1;
	proj["extra." + right] = 1;

	collection.find(find, proj).toArray(function(err, items) {
		if(err) throw err;

		var incCounter = function(key) {
			if(!counter[key]) {
				counter[key] = 0;
			}

			counter[key]++;	
		}

		var counter = {};

		_.forEach(items, function(item) {
			incCounter(item.extra[left] + " " + item.extra[right]);
		});

		var table = new Table({
			head: ["key combination", "count"],
			colWidths: [30, 10]
		});

		_.forEach(counter, function(num, key) {
			table.push([key, num]);
		});

		var output = header + "\n" + table.toString() + "\n";

		done(output);
	});
}

function analyzeIllegalKeybindings(collection, done) {
	var find = {
		event: "change_player_setting",
		$or: [
			{
				"extra.illegal_left_key_binding": {$exists: true}
			},
			{
				"extra.illegal_right_key_binding": {$exists: true}
			}
		]
	};

	var proj = {
		"_id": 0,
		"extra.illegal_right_key_binding": 1,
		"extra.illegal_left_key_binding": 1
	};

	collection.find(find, proj).toArray(function(err, items) {
		if(err) {
			throw err;
		}

		var incCounter = function(key) {
			if(!counter[key]) {
				counter[key] = 0;
			}

			counter[key]++;	
		}

		var counter = {};

		_.forEach(items, function(item) {
			incCounter(item.extra.illegal_left_key_binding || item.extra.illegal_right_key_binding);
		});

		var table = new Table({
			head: ["key", "count"],
			colWidths: [30, 10]
		});

		_.forEach(counter, function(num, key) {
			table.push([key, num]);
		});

		var output = "-- Illegal keybindings --" + "\n" + table.toString() + "\n\n";

		done(output);
	});
}

function analyzeSettings(collection, done) {
	done("");
}