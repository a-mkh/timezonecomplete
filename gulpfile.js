
var eventStream = require("event-stream");
var browserify = require("gulp-browserify");
var debug = require("gulp-debug");
var dtsBundle = require("dts-bundle");
var fs = require("fs");
var gulp = require("gulp");
var gulpIgnore = require("gulp-ignore");
var gutil = require("gulp-util");
var rename = require("gulp-rename");
var rimraf = require("gulp-rimraf");
var sourcemaps = require("gulp-sourcemaps");
var tslint = require("gulp-tslint");
var typedoc = require("gulp-typedoc");
var typescript = require("gulp-typescript");
var wrapUmd = require("gulp-wrap-umd");

process.chdir(__dirname);

///////////////////////////////////////////////////////////////////////////////
// Overall tasks
///////////////////////////////////////////////////////////////////////////////

const MODULE_NAME="timezonecomplete";

// Nice help message
gulp.task("help", function(cb) {
	console.log("Build system for Spirit IT " + MODULE_NAME);
	console.log("");
	console.log("BUILD COMMANDS:");
	console.log("");
	console.log("gulp                 Build all");
	console.log("gulp clean           Clean build output");
	console.log("gulp build           Build");
	console.log("gulp doc             Create documentation");
	console.log("gulp help            This help message");
	console.log("gulp browser_package Create browser package");
	console.log("gulp bundle          Make a bundled timezonecomplete.d.ts file");
	console.log("gulp release         All of the above except clean");

	console.log("");
	cb(); // signal end-of-task
});

// Default task: this is called when just typing "gulp" on command line
gulp.task("default", ["build"]);

gulp.task("clean", function() {
	gulp
		.src([
			"coverage/",
			"dist/",
			"doc/",
			"gulp-tsc*/",
			"lib/**/*.d.ts",
			"lib/**/*.js",
			"lib/**/*.map",
			"test/**/*.d.ts",
			"test/**/*.js",
			"test/**/*.map",
			"TestResults/",
			"examples/**/*.d.ts",
			"examples/**/*.js",
			"examples/**/*.map",
			"doc/"
		], { read: false, base: "." })
		.pipe(gulpIgnore.exclude("**/maintenance/**"))
		.pipe(rimraf({force: true}))
		.on("error", trapError) // make exit code non-zero
})

gulp.task("bundle", ["build"], function() {
	dtsBundle.bundle({
		name: 'timezonecomplete',
		main: 'lib/index.d.ts',
		baseDir: './lib',
		externals: false,
	});
})

gulp.task("doc", ["build"], function() {
	return gulp.src(["lib/**.ts"], {base: "."})
		.pipe(gulpIgnore.exclude("**/*.d.ts"))
		.pipe(typedoc({
			module: "commonjs",
			out: "./doc",
			name: "timezonecomplete",
			target: "es5",
			excludeExternals: "",
		}))
		.on("error", trapError);
});

var tslintOpts = {
	"rules": {
		"ban": [true,
			["_", "extend"],
			["_", "isNull"],
			["_", "isDefined"]
		],
		"class-name": true,
		"comment-format": [true,
			"check-space"
			//,"check-lowercase"
		],
		"curly": true,
		"eofline": true,
		"forin": true,
		"indent": [true, 4],
		"interface-name": false, // we do not start our interfaces with "I"
		"jsdoc-format": false, // buggy
		"label-position": true,
		"label-undefined": true,
		"max-line-length": [true, 140],
		"no-arg": true,
		"no-bitwise": true,
		"no-console": [true,
			"time",
			"timeEnd"
		],
		"no-construct": true,
		"no-debugger": true,
		"no-duplicate-key": true,
		"no-duplicate-variable": true,
		"no-empty": true,
		"no-eval": true,
		"no-string-literal": true,
		"no-trailing-comma": true,
		"no-trailing-whitespace": true,
		"no-unused-expression": true,
		"no-unused-variable": false, // re-enable when they've fixed all the false positives
		"no-unreachable": true,
		"no-use-before-declare": true,
		"no-var-requires": true,
		"one-line": [true,
			"check-open-brace",
			"check-catch",
			"check-else",
			"check-whitespace"
		],
		"quotemark": [true, "double"],
		"radix": true,
		"semicolon": true,
		"triple-equals": [true, "allow-null-check"],
		"typedef": [true,
			"callSignature",
			// "catchClause",   not allowed by TypeScript
			"indexSignature",
			"parameter",
			"propertySignature",
			// "variableDeclarator"  unnecessary since we have --noImplicitAny
			"memberVariableDeclarator",
		],
		"typedef-whitespace": [true,
			["callSignature", "noSpace"],
			["catchClause", "noSpace"],
			["indexSignature", "space"]
		],
		"use-strict": [true,
			"check-module",
			// "check-function"
		],
		"variable-name": [true,
			"allow-leading-underscore"
		],
		"whitespace": [true,
			"check-branch",
			"check-decl",
			"check-operator",
			"check-separator",
			"check-type"
		],
	}
};

gulp.task("build", function () {
	var tsResult = gulp.src([
		"lib/*.ts",
		"test/*.ts",
	], { base: "." })
		.pipe(gulpIgnore.exclude("**/*.d.ts"))
		.pipe(tslint({
			configuration: tslintOpts
		}))
		.pipe(tslint.report('verbose', {
			emitError: true
		}))
		.on("error", function (err) {
			result.emit("error", err);
		})
		.pipe(sourcemaps.init())
		.pipe(typescript({
			module: "commonjs",
			declarationFiles: true,
			target: "es5",
			noImplicitAny: true
		}));
	var jsStream = tsResult.js
		.pipe(sourcemaps.write());
	var dtsStream = tsResult.dts;
	var streamEnd = eventStream.merge(jsStream, dtsStream);

	var result = streamEnd
		.pipe(gulp.dest("."))
	result.on("error", trapError); // make exit code non-zero
	return result;
});

	// note "doc" not part of release because we must call that separately in a DOS window due typedoc bug
gulp.task("release", ["build", "browser_package", "bundle", "doc"]);

gulp.task("browser_package", ["build"], function() {
	return browserifyTask("timezonecomplete");
})

function browserifyTask(packageName) {
	var template = fs.readFileSync("./umd-template/umd-require.jst");
	return gulp.src("lib/index.js", {base: "."})
		.pipe(browserify({
			require: [
				["./index.js", {expose: packageName}]
			]
		}))
		.pipe(wrapUmd({
			namespace: "timezonecomplete",
			deps: [],
			exports: packageName,
			template: template
		}))
		.pipe(rename("timezonecomplete.js"))
		.pipe(gulp.dest("dist/"))
		.on("error", trapError); // make exit code non-zero
}


// Generic error handling function
// This is needed because Gulp always returns exit code 0
// unless an exception is thrown which gives a useless stack trace.
function trapError(e) {
	if (e.plugin && e.message) {
		// it is a gulp plugin error
		console.log("Error in plugin: " + e.plugin);
		console.log(e.message);
	}
	else {
		// some other error
		gutil.log(e);
	}
	console.log("\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\||||||||////////////////////");
	console.log(">>>>>>>>>>>>>>>>> FAILED <<<<<<<<<<<<<<<<<<<<");
	console.log("/////////////////||||||||\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\");
}
